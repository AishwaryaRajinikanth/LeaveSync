using backend.src.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace backend.src.Api.Controllers;

/// <summary>
/// Reconciliation API — accepts E-Leave and ITAS file uploads, returns reconciliation result.
/// Phase 2: Replace file upload with REST API source calls, keeping this controller contract intact.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ReconciliationController(IFileParserService parser, IReconciliationService engine) : ControllerBase
{
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Upload(IFormFile eleaveFile, IFormFile itasFile)
    {
        if (eleaveFile is null || eleaveFile.Length == 0)
            return BadRequest(new { error = "E-Leave file is required." });
        if (itasFile is null || itasFile.Length == 0)
            return BadRequest(new { error = "ITAS file is required." });

        var allowedTypes = new[] { ".csv", ".xlsx" };
        var eleaveExt = Path.GetExtension(eleaveFile.FileName).ToLowerInvariant();
        var itasExt   = Path.GetExtension(itasFile.FileName).ToLowerInvariant();

        if (!allowedTypes.Contains(eleaveExt) || !allowedTypes.Contains(itasExt))
            return BadRequest(new { error = "Only .csv and .xlsx files are accepted." });

        await using var eleaveStream = eleaveFile.OpenReadStream();
        await using var itasStream   = itasFile.OpenReadStream();

        var eleaveRecords = await parser.ParseELeaveAsync(eleaveStream, eleaveFile.FileName);
        var itasRecords   = await parser.ParseITASAsync(itasStream,   itasFile.FileName);

        var result = engine.Reconcile(eleaveRecords, itasRecords);
        return Ok(result);
    }

    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "ok", timestamp = DateTime.UtcNow });
}
