import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-panel.component.html',
  styleUrls: ['./notification-panel.component.scss']
})
export class NotificationPanelComponent {
  isOpen = signal(false);

  constructor(public notif: NotificationService) {}

  toggle() { this.isOpen.update(v => !v); }
  markAllRead() { this.notif.clearAll(); }
  get unreadCount() {
    return (this.notif as any)._notifications$?.value?.length ?? 0;
  }
}
