namespace backend.src.Domain.Models;

/// <summary>All possible reconciliation outcomes — configurable without code changes.</summary>
public static class ReconciliationStatus
{
    public const string Matched              = "Matched";
    public const string MissingInITAS        = "MissingInITAS";
    public const string MissingInELeave      = "MissingInELeave";
    public const string DateMismatch         = "DateMismatch";
    public const string LeaveTypeMismatch    = "LeaveTypeMismatch";
    public const string DuplicateRecord      = "DuplicateRecord";
    public const string InvalidEmployeeId    = "InvalidEmployeeId";
    public const string Excluded             = "Excluded";
    public const string RequiresManualReview = "RequiresManualReview";
}

/// <summary>Single reconciled row — one per (EmployeeId, Date) comparison.</summary>
public record ReconciliationRecord(
    string  Status,
    string  EmployeeId,
    string? EmployeeName,
    string  Department,
    string  Date,
    string? EleaveType,      // serializes as eleaveType
    string? ItasType,        // serializes as itasType
    string  Issue,
    string  Recommendation
);

/// <summary>Detailed 9-field KPI breakdown for the dashboard.</summary>
public record ReconciliationSummary(
    int TotalITASRecords,
    int TotalELeaveRecords,
    int Matched,
    int MissingInITAS,
    int MissingInELeave,
    int DateMismatches,
    int LeaveTypeMismatches,
    int DuplicateRecords,
    int HolidaysSkipped,
    int ReconciliationPercentage
);

public record ReconciliationResult(
    DateTime Timestamp,
    List<ReconciliationRecord> Records,
    ReconciliationSummary Summary
);
