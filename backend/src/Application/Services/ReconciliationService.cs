using backend.src.Domain.Interfaces;
using backend.src.Domain.Models;

namespace backend.src.Application.Services;

/// <summary>
/// Reconciliation engine - rules R1-R9.
/// R1: ITAS has leave, no E-Leave found (Critical)
/// R2: E-Leave approved, no ITAS entry (Critical)
/// R3: E-Leave pending, ITAS booked (Warning - Status mismatch)
/// R4: Leave type conflict between systems (Warning)
/// R5: Duration differs (Warning)
/// R6: E-Leave rejected but ITAS still has entry (Warning - Approval conflict)
/// R7: ITAS entry not submitted (Warning)
/// R8: E-Leave pending, no ITAS entry (Warning - Missing ITAS entry)
/// R9: Both systems pending (Warning)
/// </summary>
public class ReconciliationService : IReconciliationService
{
    private static readonly Dictionary<string, string> TypeMapping = new(StringComparer.OrdinalIgnoreCase)
    {
        // E-Leave portal names → ITAS type
        ["Annual Leave"]               = "Vacation",
        ["Casual Leave"]               = "Vacation",
        ["Sick Leave/Hospitalization"] = "Illness",
        ["Special Leave"]              = "Vacation",
        // Passthrough — CSV may already contain ITAS-style names
        ["Vacation"]                   = "Vacation",
        ["Illness"]                    = "Illness",
        ["Holiday"]                    = "Holiday",
    };

    private sealed class ITASLeaf
    {
        public string   EmployeeId   { get; init; } = "";
        public string   EmployeeName { get; init; } = "";
        public string?  Department   { get; init; }
        public string   Type         { get; init; } = "";
        public double   Hours        { get; init; }
        public bool     Submitted    { get; init; }
        public DateOnly Date         { get; init; }
    }

    private sealed class ELeaf
    {
        public ELeaveRecord Record { get; init; } = null!;
        public DateOnly     Date   { get; init; }
    }

    public ReconciliationResult Reconcile(
        IEnumerable<ELeaveRecord> eleaveRecords,
        IEnumerable<ITASRecord>   itasRecords)
    {
        var matched  = new List<MatchedRecord>();
        var warnings = new List<DiscrepancyItem>();
        var critical = new List<DiscrepancyItem>();

        var itasLeaves = ExtractITASLeaves(itasRecords);
        var elIdx      = IndexELeave(eleaveRecords);
        var itIdx      = IndexITAS(itasLeaves);
        var deptIdx    = BuildDeptIndex(itasRecords);

        var allKeys = elIdx.Keys.Union(itIdx.Keys).ToHashSet();

        foreach (var key in allKeys)
        {
            elIdx.TryGetValue(key, out var el);
            itIdx.TryGetValue(key, out var it);

            if (el != null && it != null)
                CompareEntries(el, it, matched, warnings, critical, deptIdx);
            else if (it != null)
                AddITASOnly(it, critical, warnings, deptIdx);
            else if (el != null)
                AddELeaveOnly(el, critical, warnings, deptIdx);
        }

        var summary = new ReconciliationSummary(
            Total:              allKeys.Count,
            Matched:            matched.Count,
            Warnings:           warnings.Count,
            Critical:           critical.Count,
            ReconciliationRate: allKeys.Count > 0
                ? (int)Math.Round((double)matched.Count / allKeys.Count * 100)
                : 0);

        return new ReconciliationResult(DateTime.UtcNow, allKeys.Count, matched, warnings, critical, summary);
    }

    private void CompareEntries(
        ELeaf el, ITASLeaf it,
        List<MatchedRecord>   matched,
        List<DiscrepancyItem> warnings,
        List<DiscrepancyItem> critical,
        Dictionary<string, string> deptIdx)
    {
        var issues     = new List<DiscrepancyItem>();
        var r          = el.Record;
        var date       = el.Date;
        var dept = ResolveDept(r.Department, it.Department, r.EmployeeId, deptIdx);
        var expType    = TypeMapping.GetValueOrDefault(r.LeaveType);
        var isPending  = r.Status.StartsWith("Pending", StringComparison.OrdinalIgnoreCase);
        var isRejected = r.Status.Equals("Rejected", StringComparison.OrdinalIgnoreCase);
        var itasDraft  = !it.Submitted;

        // R9: Both systems pending
        if (isPending && itasDraft)
        {
            issues.Add(D("R9", Severity.Warning, r, dept, date, r.LeaveType,
                r.Status, "Pending",
                "Both systems pending",
                "Complete approval in E-Leave and submit ITAS entry"));
        }
        else
        {
            // R3: Status mismatch - E-Leave pending but ITAS already booked
            if (isPending)
                issues.Add(D("R3", Severity.Warning, r, dept, date, r.LeaveType,
                    r.Status, $"{it.Type} ({it.Hours}h)",
                    "Status mismatch",
                    "Manager should approve the pending E-Leave application"));

            // R7: ITAS draft entry
            if (itasDraft)
                issues.Add(D("R7", Severity.Warning, r, dept, date, r.LeaveType,
                    r.Status, "Draft",
                    "ITAS entry not submitted",
                    "Submit the ITAS timesheet entry"));
        }

        // R4: Leave type conflict
        if (expType != null && !expType.Equals(it.Type, StringComparison.OrdinalIgnoreCase))
            issues.Add(D("R4", Severity.Warning, r, dept, date, r.LeaveType,
                r.LeaveType, it.Type,
                "Leave type conflict",
                $"E-Leave is \"{r.LeaveType}\" but ITAS has \"{it.Type}\" — correct in either system"));

        // R5: Duration differs
        var eleaveDays = r.Days;
        var itasDays   = Math.Round(it.Hours / 8.0, 1);
        if (Math.Abs(eleaveDays - itasDays) > 0.01)
            issues.Add(D("R5", Severity.Warning, r, dept, date, r.LeaveType,
                $"{eleaveDays} day(s)", $"{it.Hours}h",
                $"Duration differs ({eleaveDays} vs {itasDays} days)",
                "Verify correct duration in both systems"));

        // R6: Approval conflict - E-Leave rejected but still in ITAS
        if (isRejected)
            issues.Add(D("R6", Severity.Warning, r, dept, date, r.LeaveType,
                "Rejected", $"{it.Type} ({it.Hours}h)",
                "Approval conflict",
                "Remove ITAS entry or resubmit E-Leave application"));

        if (issues.Count == 0)
        {
            matched.Add(new MatchedRecord(r.EmployeeId, r.EmployeeName, dept,
                date.ToString("yyyy-MM-dd"), r.LeaveType, it.Type, it.Hours));
            return;
        }

        foreach (var issue in issues)
            (issue.Severity == Severity.Critical ? critical : warnings).Add(issue);
    }

    // R1: ITAS only - no E-Leave found
    private static void AddITASOnly(
        ITASLeaf it,
        List<DiscrepancyItem> critical,
        List<DiscrepancyItem> warnings,
        Dictionary<string, string> deptIdx)
    {
        var dept = ResolveDept(null, it.Department, it.EmployeeId, deptIdx);
        var rule   = it.Submitted ? "R1" : "R7";
        var sev    = it.Submitted ? Severity.Critical : Severity.Warning;
        var target = it.Submitted ? critical : warnings;

        target.Add(new DiscrepancyItem(rule, sev,
            it.EmployeeId, it.EmployeeName, dept,
            it.Date.ToString("yyyy-MM-dd"), it.Type,
            "-", $"{it.Type} ({it.Hours}h)",
            it.Submitted ? "No E-Leave application" : "ITAS entry not submitted",
            it.Submitted
                ? "Employee should submit leave application in E-Leave portal"
                : "Submit ITAS entry and verify if E-Leave application is required"));
    }

    // R2 / R8: E-Leave only - no ITAS entry
    private static void AddELeaveOnly(
        ELeaf el,
        List<DiscrepancyItem> critical,
        List<DiscrepancyItem> warnings,
        Dictionary<string, string> deptIdx)
    {
        var r    = el.Record;
        var date = el.Date;
        var dept = ResolveDept(r.Department, null, r.EmployeeId, deptIdx);

        if (r.Status.Equals("Approved", StringComparison.OrdinalIgnoreCase))
            critical.Add(new DiscrepancyItem("R2", Severity.Critical,
                r.EmployeeId, r.EmployeeName, dept, date.ToString("yyyy-MM-dd"),
                r.LeaveType, "Approved", "-",
                "No ITAS record found",
                "Employee should record leave in ITAS timesheet"));

        else if (r.Status.StartsWith("Pending", StringComparison.OrdinalIgnoreCase))
            warnings.Add(new DiscrepancyItem("R8", Severity.Warning,
                r.EmployeeId, r.EmployeeName, dept, date.ToString("yyyy-MM-dd"),
                r.LeaveType, r.Status, "-",
                "Missing ITAS entry",
                "Complete approval flow, then submit ITAS entry if required"));
    }

    private static DiscrepancyItem D(
        string rule, Severity sev, ELeaveRecord r,
        string dept, DateOnly date, string leaveType,
        string elStatus, string itStatus,
        string issue, string rec) =>
        new(rule, sev, r.EmployeeId, r.EmployeeName, dept,
            date.ToString("yyyy-MM-dd"), leaveType, elStatus, itStatus, issue, rec);

    private static List<ITASLeaf> ExtractITASLeaves(IEnumerable<ITASRecord> records)
    {
        var leaves = new List<ITASLeaf>();
        foreach (var r in records)
            foreach (var e in r.Entries.Where(e =>
                e.Type is "Vacation" or "Illness" or "Holiday" && e.Hours > 0))
                leaves.Add(new ITASLeaf
                {
                    EmployeeId   = r.EmployeeId,
                    EmployeeName = r.EmployeeName,
                    Department   = r.Department,
                    Type         = e.Type,
                    Hours        = e.Hours,
                    Submitted    = r.Submitted,
                    Date         = e.Date,
                });
        return leaves;
    }

    private static Dictionary<string, ELeaf> IndexELeave(IEnumerable<ELeaveRecord> records)
    {
        var idx = new Dictionary<string, ELeaf>();
        foreach (var r in records)
            foreach (var date in ExpandDateRange(r.From, r.To))
                idx[$"{r.EmployeeId}_{date:yyyy-MM-dd}"] = new ELeaf { Record = r, Date = date };
        return idx;
    }

    private static Dictionary<string, ITASLeaf> IndexITAS(IEnumerable<ITASLeaf> leaves)
    {
        var idx = new Dictionary<string, ITASLeaf>();
        foreach (var l in leaves) idx[$"{l.EmployeeId}_{l.Date:yyyy-MM-dd}"] = l;
        return idx;
    }

        /// <summary>
    /// Resolve department: prefer ITAS (authoritative), fall back to E-Leave, then "-".
    /// Empty/whitespace-only strings are treated as missing.
    /// </summary>
    private static string ResolveDept(string? eleavedept, string? itasDept, string employeeId, Dictionary<string, string> deptIdx)
    {
        if (!string.IsNullOrWhiteSpace(itasDept))   return itasDept;
        if (deptIdx.TryGetValue(employeeId, out var d) && !string.IsNullOrWhiteSpace(d)) return d;
        if (!string.IsNullOrWhiteSpace(eleavedept)) return eleavedept;
        return "-";
    }

    /// <summary>
    /// Returns true if the status represents an approved/active leave.
    /// Handles: "Approved", leave type names used as status (Vacation, Illness, Holiday, etc.)
    /// </summary>
    private static bool IsApprovedStatus(string status)
    {
        if (string.IsNullOrWhiteSpace(status)) return false;
        if (status.Equals("Approved", StringComparison.OrdinalIgnoreCase)) return true;
        // Leave type names used as status (from CSVs without Status column)
        var leaveTypeNames = new[] { "Vacation", "Illness", "Holiday", "Annual Leave",
                                     "Casual Leave", "Sick Leave/Hospitalization", "Special Leave" };
        return leaveTypeNames.Any(l => l.Equals(status, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsPendingStatus(string status) =>
        status.StartsWith("Pending", StringComparison.OrdinalIgnoreCase);

    private static bool IsRejectedStatus(string status) =>
        status.Equals("Rejected", StringComparison.OrdinalIgnoreCase);

    private static Dictionary<string, string> BuildDeptIndex(IEnumerable<ITASRecord> records)
    {
        var idx = new Dictionary<string, string>();
        foreach (var r in records)
            if (r.Department != null) idx.TryAdd(r.EmployeeId, r.Department);
        return idx;
    }

    private static IEnumerable<DateOnly> ExpandDateRange(DateOnly from, DateOnly to)
    {
        for (var d = from; d <= to; d = d.AddDays(1)) yield return d;
    }

    private static string Fmt(DateOnly d) => d.ToString("MMM d");
}

