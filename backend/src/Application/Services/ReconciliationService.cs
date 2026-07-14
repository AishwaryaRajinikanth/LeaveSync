using backend.src.Domain.Interfaces;
using backend.src.Domain.Models;
using Microsoft.Extensions.Configuration;

namespace backend.src.Application.Services;

/// <summary>
/// Reconciliation engine v2 - exact algorithm:
///
/// Pass A - For each ITAS leave record:
///   If holiday date                      -> Excluded (skip, counted in HolidaysSkipped)
///   Else if E-Leave found same emp+date:
///     Types match                        -> Matched
///     Types differ                       -> Leave Type Mismatch
///   Else (no E-Leave on this date):
///     Employee NOT in E-Leave at all     -> Missing in E-Leave
///     Employee IS in E-Leave (diff date) -> Date Mismatch
///
/// Pass B - For each E-Leave record:
///   If Employee NOT in ITAS at all       -> Missing in ITAS
///   (If employee IS in ITAS, covered by Pass A)
/// </summary>
public class ReconciliationService(IConfiguration config) : IReconciliationService
{
    private readonly Dictionary<string, string> _typeMapping  = BuildMapping(config);
    private readonly HashSet<string>            _excludeTypes = BuildExcludes(config);
    private readonly HashSet<DateOnly>          _holidays     = BuildHolidays(config);

    private static Dictionary<string, string> BuildMapping(IConfiguration cfg)
    {
        var section = cfg.GetSection("ReconciliationConfig:LeaveTypeMapping");
        var fromCfg = section.Get<Dictionary<string, string>>();
        if (fromCfg != null && fromCfg.Count > 0)
        {
            var ci = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in fromCfg) ci[kv.Key] = kv.Value;
            return ci;
        }
        return new(StringComparer.OrdinalIgnoreCase)
        {
            ["Annual Leave"]               = "Vacation",
            ["Casual Leave"]               = "Vacation",
            ["Vacation"]                   = "Vacation",
            ["Unpaid Leave"]               = "Vacation",
            ["Sick Leave"]                 = "Illness",
            ["Sick Leave/Hospitalization"] = "Illness",
            ["Hospitalization"]            = "Illness",
            ["Illness"]                    = "Illness",
            ["Holiday"]                    = "Holiday",
            ["Special Leave"]              = "Vacation",
        };
    }

    private static HashSet<string> BuildExcludes(IConfiguration cfg)
    {
        var arr = cfg.GetSection("ReconciliationConfig:ExcludeTypes").Get<string[]>();
        return arr != null
            ? new HashSet<string>(arr, StringComparer.OrdinalIgnoreCase)
            : new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Holiday" };
    }

    private static HashSet<DateOnly> BuildHolidays(IConfiguration cfg)
    {
        var set = new HashSet<DateOnly>();
        foreach (var entry in cfg.GetSection("ReconciliationConfig:HolidayCalendar").GetChildren())
            if (DateOnly.TryParseExact(entry["Date"], "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var d))
                set.Add(d);
        return set;
    }

    private string MapType(string leaveType) =>
        _typeMapping.TryGetValue(leaveType, out var m) ? m : leaveType;

    private sealed class ITASLeaf
    {
        public string   EmployeeId   { get; init; } = "";
        public string?  EmployeeName { get; init; }
        public string?  Department   { get; init; }
        public string   Type         { get; init; } = "";
        public DateOnly Date         { get; init; }
    }

    private sealed class ELeaf
    {
        public string   EmployeeId   { get; init; } = "";
        public string?  EmployeeName { get; init; }
        public string?  Department   { get; init; }
        public string   LeaveType    { get; init; } = "";
        public string   MappedType   { get; init; } = "";
        public DateOnly Date         { get; init; }
    }

    public ReconciliationResult Reconcile(
        IEnumerable<ELeaveRecord> eleaveRecords,
        IEnumerable<ITASRecord>   itasRecords)
    {
        var results  = new List<ReconciliationRecord>();
        var elList   = eleaveRecords.ToList();
        var itasList = itasRecords.ToList();
        var deptIdx  = BuildDeptIndex(itasList);

        // Flag invalid Employee IDs in E-Leave
        foreach (var r in elList.Where(r => string.IsNullOrWhiteSpace(r.EmployeeId)))
            results.Add(R(ReconciliationStatus.InvalidEmployeeId, "?", r.EmployeeName,
                "-", r.From.ToString("yyyy-MM-dd"), r.LeaveType, null,
                "Missing or invalid Employee ID in E-Leave",
                "Correct the Employee ID in the E-Leave portal"));

        var validELeave = elList.Where(r => !string.IsNullOrWhiteSpace(r.EmployeeId)).ToList();

        // Extract only recognised leave entries (Work/Training/etc. filtered at parse level)
        var itasLeaves   = ExtractITASLeaves(itasList);
        var eleaveLeaves = ExpandELeaveLeaves(validELeave);
        var totalITAS    = itasLeaves.Count;
        var totalELeave  = eleaveLeaves.Count;

        // Duplicate detection
        var itasDupKeys = itasLeaves
            .GroupBy(l => $"{l.EmployeeId}_{l.Date:yyyy-MM-dd}")
            .Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();
        var eleaveDupKeys = eleaveLeaves
            .GroupBy(l => $"{l.EmployeeId}_{l.Date:yyyy-MM-dd}")
            .Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();
        var processedDups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var key in itasDupKeys)
        {
            var leaf = itasLeaves.First(l => $"{l.EmployeeId}_{l.Date:yyyy-MM-dd}" == key);
            results.Add(R(ReconciliationStatus.DuplicateRecord, leaf.EmployeeId, leaf.EmployeeName,
                ResolveDept(null, leaf.Department, leaf.EmployeeId, deptIdx),
                leaf.Date.ToString("yyyy-MM-dd"), null, leaf.Type,
                $"Duplicate ITAS entry on {leaf.Date:MMM d} ({leaf.Type})",
                "Remove the duplicate timesheet entry from ITAS"));
            processedDups.Add(key);
        }
        foreach (var key in eleaveDupKeys)
        {
            var leaf = eleaveLeaves.First(l => $"{l.EmployeeId}_{l.Date:yyyy-MM-dd}" == key);
            results.Add(R(ReconciliationStatus.DuplicateRecord, leaf.EmployeeId, leaf.EmployeeName,
                ResolveDept(leaf.Department, null, leaf.EmployeeId, deptIdx),
                leaf.Date.ToString("yyyy-MM-dd"), leaf.LeaveType, null,
                $"Duplicate E-Leave entry on {leaf.Date:MMM d} ({leaf.LeaveType})",
                "Remove the duplicate leave application from E-Leave portal"));
            processedDups.Add(key);
        }

        // Build E-Leave lookup by (empId_date)
        var eleaveIdx = new Dictionary<string, ELeaf>(StringComparer.OrdinalIgnoreCase);
        foreach (var l in eleaveLeaves)
            eleaveIdx.TryAdd($"{l.EmployeeId}_{l.Date:yyyy-MM-dd}", l);

        var empInITAS   = itasLeaves  .Select(l => l.EmployeeId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var empInELeave = eleaveLeaves.Select(l => l.EmployeeId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        int holidaysSkipped = 0;

        // ---- Pass A: For each ITAS leave record ----
        foreach (var it in itasLeaves)
        {
            var key     = $"{it.EmployeeId}_{it.Date:yyyy-MM-dd}";
            var dateStr = it.Date.ToString("yyyy-MM-dd");
            if (processedDups.Contains(key))   continue;
            if (_holidays.Contains(it.Date)) { holidaysSkipped++; continue; }

            var dept = ResolveDept(null, it.Department, it.EmployeeId, deptIdx);

            // Holiday PAR entry — show as Excluded; E-Leave on same date is not a discrepancy
            if (_excludeTypes.Contains(it.Type))
            {
                if (eleaveIdx.TryGetValue(key, out var elH))
                    results.Add(R(ReconciliationStatus.Excluded, it.EmployeeId, elH.EmployeeName,
                        dept, dateStr, elH.LeaveType, it.Type,
                        "Holiday records are excluded from reconciliation",
                        "No action required"));
                else
                    holidaysSkipped++;
                continue;
            }

            if (eleaveIdx.TryGetValue(key, out var el))
            {
                if (it.Type.Equals(el.MappedType, StringComparison.OrdinalIgnoreCase))
                    results.Add(R(ReconciliationStatus.Matched, it.EmployeeId, el.EmployeeName,
                        dept, dateStr, el.LeaveType, it.Type,
                        "Leave records match across both systems", "No action required"));
                else
                    results.Add(R(ReconciliationStatus.LeaveTypeMismatch, it.EmployeeId, el.EmployeeName,
                        dept, dateStr, el.LeaveType, it.Type,
                        $"E-Leave \"{el.LeaveType}\" maps to \"{el.MappedType}\" but ITAS shows \"{it.Type}\"",
                        "Verify and correct the leave type in either system"));
            }
            else if (!empInELeave.Contains(it.EmployeeId))
            {
                results.Add(R(ReconciliationStatus.MissingInELeave, it.EmployeeId, it.EmployeeName,
                    dept, dateStr, null, it.Type,
                    $"ITAS has {it.Type} on {it.Date:MMM d} but employee has no E-Leave application",
                    "Employee should submit a leave application in the E-Leave portal"));
            }
            else
            {
                results.Add(R(ReconciliationStatus.DateMismatch, it.EmployeeId, it.EmployeeName,
                    dept, dateStr, null, it.Type,
                    $"ITAS has {it.Type} on {it.Date:MMM d} but no E-Leave record found on this date",
                    "Verify and correct the leave date in E-Leave to match ITAS"));
            }
        }

        // ---- Pass B: For each E-Leave record - only Missing in ITAS ----
        // Build set of dates where ITAS has an explicit Holiday entry per employee
        var itasHolidayKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var it in itasLeaves.Where(l => _excludeTypes.Contains(l.Type)))
            itasHolidayKeys.Add($"{it.EmployeeId}_{it.Date:yyyy-MM-dd}");

        foreach (var el in eleaveLeaves)
        {
            var key = $"{el.EmployeeId}_{el.Date:yyyy-MM-dd}";
            if (processedDups.Contains(key))        continue;
            if (_holidays.Contains(el.Date))      { holidaysSkipped++; continue; }
            if (itasHolidayKeys.Contains(key))     continue; // covered as Excluded in Pass A
            if (empInITAS.Contains(el.EmployeeId)) continue; // covered by Pass A

            var dept = ResolveDept(el.Department, null, el.EmployeeId, deptIdx);
            results.Add(R(ReconciliationStatus.MissingInITAS, el.EmployeeId, el.EmployeeName,
                dept, el.Date.ToString("yyyy-MM-dd"), el.LeaveType, null,
                $"E-Leave has {el.LeaveType} on {el.Date:MMM d} but employee has no ITAS timesheet entry",
                "Employee should submit the corresponding entry in the ITAS timesheet"));
        }

        // Summary
        var matched      = results.Count(r => r.Status == ReconciliationStatus.Matched);
        var missingITAS  = results.Count(r => r.Status == ReconciliationStatus.MissingInITAS);
        var missingEL    = results.Count(r => r.Status == ReconciliationStatus.MissingInELeave);
        var dateMismatch = results.Count(r => r.Status == ReconciliationStatus.DateMismatch);
        var typeMismatch = results.Count(r => r.Status == ReconciliationStatus.LeaveTypeMismatch);
        var duplicates   = results.Count(r => r.Status == ReconciliationStatus.DuplicateRecord);
        var total        = results.Count;
        var pct          = total > 0 ? (int)Math.Round((double)matched / total * 100) : 0;

        return new ReconciliationResult(DateTime.UtcNow, results, new ReconciliationSummary(
            TotalITASRecords:         totalITAS,
            TotalELeaveRecords:       totalELeave,
            Matched:                  matched,
            MissingInITAS:            missingITAS,
            MissingInELeave:          missingEL,
            DateMismatches:           dateMismatch,
            LeaveTypeMismatches:      typeMismatch,
            DuplicateRecords:         duplicates,
            HolidaysSkipped:          holidaysSkipped,
            ReconciliationPercentage: pct));
    }

    // ---- Helpers ----

    private static ReconciliationRecord R(
        string status, string empId, string? empName,
        string dept, string date,
        string? eleaveType, string? itasType,
        string issue, string rec) =>
        new(status, empId, empName, dept, date, eleaveType, itasType, issue, rec);

    private List<ITASLeaf> ExtractITASLeaves(IEnumerable<ITASRecord> records)
    {
        var result = new List<ITASLeaf>();
        foreach (var r in records)
            if (!string.IsNullOrWhiteSpace(r.EmployeeId))
                foreach (var e in r.Entries.Where(e => e.Hours > 0))  // include ALL absence types
                    result.Add(new ITASLeaf
                    {
                        EmployeeId   = r.EmployeeId,
                        EmployeeName = r.EmployeeName,
                        Department   = r.Department,
                        Type         = e.Type,
                        Date         = e.Date,
                    });
        return result;
    }

    private List<ELeaf> ExpandELeaveLeaves(IEnumerable<ELeaveRecord> records)
    {
        var result = new List<ELeaf>();
        foreach (var r in records)
        {
            var mapped = MapType(r.LeaveType);
            if (_excludeTypes.Contains(mapped)) continue;
            foreach (var date in ExpandDateRange(r.From, r.To))
                result.Add(new ELeaf
                {
                    EmployeeId   = r.EmployeeId,
                    EmployeeName = r.EmployeeName,
                    Department   = r.Department,
                    LeaveType    = r.LeaveType,
                    MappedType   = mapped,
                    Date         = date,
                });
        }
        return result;
    }

    private static string ResolveDept(
        string? eleaveDept, string? itasDept,
        string empId, Dictionary<string, string> deptIdx)
    {
        if (!string.IsNullOrWhiteSpace(itasDept))   return itasDept;
        if (deptIdx.TryGetValue(empId, out var d) && !string.IsNullOrWhiteSpace(d)) return d;
        if (!string.IsNullOrWhiteSpace(eleaveDept)) return eleaveDept;
        return "-";
    }

    private static Dictionary<string, string> BuildDeptIndex(IEnumerable<ITASRecord> records)
    {
        var idx = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in records)
            if (r.Department != null) idx.TryAdd(r.EmployeeId, r.Department);
        return idx;
    }

    private static IEnumerable<DateOnly> ExpandDateRange(DateOnly from, DateOnly to)
    {
        for (var d = from; d <= to; d = d.AddDays(1)) yield return d;
    }
}
