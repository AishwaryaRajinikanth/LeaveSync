import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  syncInterval = '6';
  startTime    = '00:00';
  autoNotify   = true;
  retryOnFail  = true;
  matchFields  = { empId: true, date: true, type: true, status: true, remarks: false };
  notifications = { emailEmployee: true, emailManager: true, emailHr: true, teams: false, bell: true };
  durationTolerance = '0 days';
  statusGrace       = 'None';

  constructor(private notify: NotificationService) {}

  save()   { this.notify.showToast('Sync rules saved'); }
  cancel() { this.notify.showToast('Changes reverted'); }
}
