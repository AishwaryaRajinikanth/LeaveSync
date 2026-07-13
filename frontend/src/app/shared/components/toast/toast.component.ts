import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, ToastMessage } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (t of (notif.toasts$ | async) ?? []; track t.id) {
        <div class="toast">
          <span class="material-symbols-outlined">{{ t.icon }}</span>
          {{ t.message }}
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
    .toast {
      background: #1e293b; color: #fff; padding: 12px 20px; border-radius: 8px;
      font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn { from { transform: translateX(60px); opacity: 0; } to { transform: none; opacity: 1; } }
    .material-symbols-outlined { font-size: 16px; color: #ffb500; }
  `]
})
export class ToastComponent {
  constructor(public notif: NotificationService) {}
}
