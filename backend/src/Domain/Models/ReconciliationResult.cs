namespace backend.src.Domain.Models;

public enum Severity { Warning, Critical }

/// <summary>Priority label shown in the UI: High (was Critical), Medium (was Warning)</summary>
public static class Priority
{
    public static string From(Severity s) => s == Severity.Critical ? "high" : "medium";
}

public record DiscrepancyItem(
    string Rule,
    Severity Severity,
    string EmployeeId,
    string EmployeeName,
    string Department,
    string Date,
    string LeaveType,
    string EleaveStatus,   // camelCase → eleaveStatus  ✓
    string ItasStatus,     // camelCase → itasStatus    ✓
    string Issue,
    string Recommendation
)
{
    /// <summary>Derived priority label for the UI</summary>
    public string Priority => Models.Priority.From(Severity);
};

public record MatchedRecord(
    string EmployeeId,
    string EmployeeName,
    string Department,
    string Date,
    string LeaveType,
    string ITASType,
    double Hours
);

public record ReconciliationSummary(
    int Total,
    int Matched,
    int Warnings,
    int Critical,
    int ReconciliationRate
);

public record ReconciliationResult(
    DateTime Timestamp,
    int TotalRecords,
    List<MatchedRecord> Matched,
    List<DiscrepancyItem> Warnings,
    List<DiscrepancyItem> Critical,
    ReconciliationSummary Summary
);
