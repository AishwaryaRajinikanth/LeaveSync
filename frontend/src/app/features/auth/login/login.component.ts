import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  employeeId = signal('8595727');
  loading    = signal(false);
  step       = signal('Verifying identity...');
  progress   = signal(0);

  constructor(
    private auth: AuthService,
    private router: Router,
    private notify: NotificationService
  ) {
    if (this.auth.isAuthenticated) this.router.navigate(['/dashboard']);
  }

  async signIn(provider: 'ups' | 'ms') {
    if (!this.employeeId()) { this.notify.showToast('Please enter your Employee ID'); return; }
    this.loading.set(true);
    this.progress.set(0);

    const steps = [
      { pct: 40, msg: 'Authenticating credentials...' },
      { pct: 70, msg: 'Verifying UPS network access...' },
      { pct: 90, msg: 'Loading profile & permissions...' },
      { pct: 100, msg: 'Authentication successful' },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) { this.step.set(steps[i].msg); this.progress.set(steps[i].pct); i++; }
      else clearInterval(interval);
    }, 800);

    await this.auth.login(this.employeeId(), provider);
    this.notify.showToast('SSO authentication successful');
    this.router.navigate(['/dashboard']);
  }
}
