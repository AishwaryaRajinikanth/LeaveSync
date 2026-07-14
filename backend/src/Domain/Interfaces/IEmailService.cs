using backend.src.Application.DTOs;

namespace backend.src.Domain.Interfaces;

public interface IEmailService
{
    Task SendAsync(NotificationRequest request);
    Task SendBulkAsync(IEnumerable<NotificationRequest> requests);
}
