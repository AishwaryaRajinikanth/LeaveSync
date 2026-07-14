namespace backend.src.Application.DTOs;

public record NotificationRequest(
    string EmployeeId,
    string Issue,
    string Date,
    string Priority,
    string Recommendation,
    string? EmployeeName = null,
    string? Department = null
);
