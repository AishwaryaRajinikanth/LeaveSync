namespace backend.src.Domain.Models;

public record ITASEntry(
    DateOnly Date,
    string Type,
    string Par,
    double Hours,
    string? Phase,
    string? ParDescription
);

public record ITASRecord(
    string EmployeeId,
    string EmployeeName,
    string? Department,
    string? ReportingManager,
    DateOnly WeekEnding,
    List<ITASEntry> Entries,
    bool Submitted = true
);
