using backend.src.Domain.Models;

namespace backend.src.Domain.Interfaces;

/// <summary>
/// Abstraction for file parsing — swap with API adapter in Phase 2 without touching business logic.
/// </summary>
public interface IFileParserService
{
    Task<IEnumerable<ELeaveRecord>> ParseELeaveAsync(Stream stream, string fileName);
    Task<IEnumerable<ITASRecord>>   ParseITASAsync  (Stream stream, string fileName);
}
