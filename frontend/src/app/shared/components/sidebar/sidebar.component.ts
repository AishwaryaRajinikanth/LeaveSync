import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

const NAV = [
  { path: '/dashboard',     icon: 'sync_alt',         label: 'Reconciliation' },
  { path: '/portals/itas',  icon: 'schedule',          label: 'ITAS'           },
  { path: '/portals/eleave',icon: 'flight_takeoff',    label: 'E-Leave'        },
  { path: '/calendar',      icon: 'calendar_month',    label: 'Calendar'       },
  { path: '/reports',       icon: 'bar_chart',         label: 'Reports'        },
  { path: '/settings',      icon: 'settings',          label: 'Settings'       },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  nav = NAV;
  constructor(public auth: AuthService) {}
}
