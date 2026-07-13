using backend.src.Domain.Models;

namespace backend.src.Domain.Interfaces;

/// <summary>
/// Abstraction for the reconciliation engine — swap implementation for API-based sources in Phase 2.
/// </summary>
public interface IReconciliationService
{
    ReconciliationResult Reconcile(IEnumerable<ELeaveRecord> eleaveRecords, IEnumerable<ITASRecord> itasRecords);
}
