using Azure;
using Azure.Communication.Email;
using backend.src.Application.DTOs;
using backend.src.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace backend.src.Infrastructure.Services;

public class AcsEmailService(IConfiguration config, ILogger<AcsEmailService> logger) : IEmailService
{
    private readonly string _connectionString  = config["AcsEmail:ConnectionString"]
        ?? throw new InvalidOperationException("AcsEmail:ConnectionString is not configured.");
    private readonly string _senderAddress     = config["AcsEmail:SenderAddress"]
        ?? throw new InvalidOperationException("AcsEmail:SenderAddress is not configured.");
    private readonly string _recipientDomain   = config["AcsEmail:RecipientDomain"] ?? "ups.com";

    public async Task SendAsync(NotificationRequest request)
    {
        var to  = $"{request.EmployeeId}@{_recipientDomain}";
        var msg = BuildMessage(request, to);

        logger.LogInformation("Sending email notification to {To} for employee {Name}", to, request.EmployeeName);

        var client   = new EmailClient(_connectionString);
        var sendOp   = await client.SendAsync(WaitUntil.Started, msg);
        logger.LogInformation("Email queued. Operation ID: {OperationId}", sendOp.Id);
    }

    public async Task SendBulkAsync(IEnumerable<NotificationRequest> requests)
    {
        var tasks = requests.Select(r => SendAsync(r));
        await Task.WhenAll(tasks);
    }

    private EmailMessage BuildMessage(NotificationRequest r, string to)
    {
        var displayName  = string.IsNullOrWhiteSpace(r.EmployeeName) ? $"Employee {r.EmployeeId}" : r.EmployeeName;
        var priorityColor = r.Priority.Equals("High", StringComparison.OrdinalIgnoreCase)
            ? "#d93025" : "#f29900";

        var html = $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
              <div style="background:#1a3a5c;padding:20px 24px">
                <h2 style="color:#fff;margin:0;font-size:20px">&#9888; Leave Reconciliation Alert</h2>
              </div>
              <div style="padding:24px">
                <p style="margin:0 0 16px">Dear <strong>{displayName}</strong>,</p>
                <p style="margin:0 0 16px">A discrepancy has been detected in your leave records that requires your attention.</p>
                <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
                  <tr style="background:#f5f7fa">
                    <td style="padding:10px 14px;font-weight:600;width:140px;border:1px solid #e0e0e0">Employee ID</td>
                    <td style="padding:10px 14px;border:1px solid #e0e0e0">{r.EmployeeId}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;font-weight:600;border:1px solid #e0e0e0">Date</td>
                    <td style="padding:10px 14px;border:1px solid #e0e0e0">{r.Date}</td>
                  </tr>
                  <tr style="background:#f5f7fa">
                    <td style="padding:10px 14px;font-weight:600;border:1px solid #e0e0e0">Issue</td>
                    <td style="padding:10px 14px;border:1px solid #e0e0e0">{r.Issue}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 14px;font-weight:600;border:1px solid #e0e0e0">Priority</td>
                    <td style="padding:10px 14px;border:1px solid #e0e0e0">
                      <span style="background:{priorityColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">{r.Priority}</span>
                    </td>
                  </tr>
                  <tr style="background:#f5f7fa">
                    <td style="padding:10px 14px;font-weight:600;border:1px solid #e0e0e0">Recommendation</td>
                    <td style="padding:10px 14px;border:1px solid #e0e0e0">{r.Recommendation}</td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#5f6368;font-size:13px">Please take the necessary action to resolve this discrepancy.</p>
                <div style="margin-top:20px;display:flex;gap:12px">
                  <a href="https://aphr.inside.ups.com/hrportal/EL/EL_NewApplication.aspx" target="_blank"
                     style="display:inline-block;padding:10px 20px;background:#1a3a5c;color:#ffb500;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;margin-right:10px">
                    Open E-Leave Portal
                  </a>
                  <a href="https://itas.inside.ups.com/ActivityRecording.aspx" target="_blank"
                     style="display:inline-block;padding:10px 20px;background:#f5f7fa;color:#1a3a5c;border:1.5px solid #1a3a5c;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px">
                    Open ITAS Timesheet
                  </a>
                </div>
              </div>
              <div style="background:#f5f7fa;padding:14px 24px;border-top:1px solid #e0e0e0">
                <p style="margin:0;color:#9aa0a6;font-size:12px">This is an automated notification from the Leave Reconciliation System. Do not reply to this email.</p>
              </div>
            </div>
            """;

        var content = new EmailContent($"[Alert] Leave Discrepancy - {r.Date} [{r.Priority} Priority]")
        {
            Html = html,
            PlainText = $"Dear {displayName},\n\nA leave discrepancy has been detected.\n\nEmployee ID: {r.EmployeeId}\nIssue: {r.Issue}\nDate: {r.Date}\nPriority: {r.Priority}\nRecommendation: {r.Recommendation}\n\nThis is an automated notification from the Leave Reconciliation System."
        };

        return new EmailMessage(
            senderAddress: _senderAddress,
            recipients:    new EmailRecipients([new EmailAddress(to, displayName)]),
            content:       content
        );
    }
}

