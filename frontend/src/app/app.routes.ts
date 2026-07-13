import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './shared/components/layout/layout.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'calendar',  loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: 'reports',   loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'settings',  loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'portals/:type', loadComponent: () => import('./features/portal/portal.component').then(m => m.PortalComponent) },
      { path: 'portals',       loadComponent: () => import('./features/portal/portal.component').then(m => m.PortalComponent) },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
