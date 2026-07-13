import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';

const PORTALS: Record<string, { label: string; icon: string; url: string }> = {
  itas:   { label: 'ITAS',    icon: 'schedule',        url: 'https://itas.inside.ups.com/ActivityRecording.aspx' },
  eleave: { label: 'E-Leave', icon: 'flight_takeoff',  url: 'https://aphr.inside.ups.com/hrportal/EL/EL_NewApplication.aspx' },
};

@Component({
  selector: 'app-portal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.scss']
})
export class PortalComponent {
  portalKey = signal<string>('itas');
  state     = signal<'launcher' | 'loading' | 'blocked'>('launcher');
  frameUrl  = signal('');

  get portal() { return PORTALS[this.portalKey()] ?? PORTALS['itas']; }

  constructor(route: ActivatedRoute, private notify: NotificationService) {
    route.params.subscribe(p => this.portalKey.set(p['type'] ?? 'itas'));
  }

  openNew()    { window.open(this.portal.url, '_blank'); }
  tryEmbed()   {
    this.state.set('loading');
    this.frameUrl.set(this.portal.url);
    setTimeout(() => this.state.set('blocked'), 3000);
  }
}
