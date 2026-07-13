namespace backend.src.Domain.Models;

public record ELeaveRecord(
    string EmployeeId,
    string EmployeeName,
    string? Department,
    string? ReportingManager,
    string LeaveType,
    DateOnly From,
    DateOnly To,
    double Days,
    string Status,
    DateOnly AppliedDate
);
