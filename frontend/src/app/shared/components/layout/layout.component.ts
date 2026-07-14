import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToastComponent } from '../toast/toast.component';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, ToastComponent, ChatComponent],
  template: `
    <div class="app-layout">
      <app-sidebar />
      <div class="main-wrapper">
        <app-header />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast />
    <app-chat />
  `,
  styles: [`
    .app-layout { display: flex; height: 100vh; overflow: hidden; }
    .main-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 100vh; }
    .main-content { flex: 1; overflow-y: auto; padding: 20px 24px; background: #F0F2F5; }
  `]
})
export class LayoutComponent {}
