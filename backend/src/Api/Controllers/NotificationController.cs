using backend.src.Application.DTOs;
using backend.src.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace backend.src.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationController(IEmailService emailService, ILogger<NotificationController> logger) : ControllerBase
{
    /// <summary>Sends a notification email to a single employee.</summary>
    [HttpPost("notify")]
    public async Task<IActionResult> Notify([FromBody] NotificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EmployeeId))
            return BadRequest(new { error = "EmployeeId is required." });

        try
        {
            await emailService.SendAsync(request);
            logger.LogInformation("Notification sent to {EmployeeId}", request.EmployeeId);
            return Ok(new { success = true, message = $"Notification sent to {request.EmployeeId}@ups.com" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send notification to {EmployeeId}", request.EmployeeId);
            return StatusCode(500, new { error = "Failed to send notification.", detail = ex.Message });
        }
    }

    /// <summary>Sends notification emails to all provided employees (filtered/visible rows).</summary>
    [HttpPost("notify-all")]
    public async Task<IActionResult> NotifyAll([FromBody] IEnumerable<NotificationRequest> requests)
    {
        var list = requests.ToList();
        if (list.Count == 0)
            return BadRequest(new { error = "No records provided." });

        try
        {
            await emailService.SendBulkAsync(list);
            logger.LogInformation("Bulk notification sent to {Count} employees", list.Count);
            return Ok(new { success = true, message = $"Notifications sent to {list.Count} employee(s)" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send bulk notifications");
            return StatusCode(500, new { error = "Failed to send bulk notifications.", detail = ex.Message });
        }
    }

    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "ok", service = "notification", timestamp = DateTime.UtcNow });
}
