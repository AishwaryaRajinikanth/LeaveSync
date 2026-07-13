import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage { message: string; icon: string; id: number; }
export interface Notification  { type: 'critical' | 'warning' | 'info'; title: string; employee: string; time: string; action: string; }

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _toasts$ = new BehaviorSubject<ToastMessage[]>([]);
  private _notifications$ = new BehaviorSubject<Notification[]>([]);
  private _toastId = 0;

  toasts$        = this._toasts$.asObservable();
  notifications$ = this._notifications$.asObservable();

  showToast(message: string, icon = 'check_circle'): void {
    const id = ++this._toastId;
    const current = this._toasts$.value;
    this._toasts$.next([...current, { message, icon, id }]);
    setTimeout(() => this._toasts$.next(this._toasts$.value.filter(t => t.id !== id)), 3500);
  }

  pushNotifications(notifications: Notification[]): void {
    this._notifications$.next([...notifications, ...this._notifications$.value]);
  }

  clearAll(): void { this._notifications$.next([]); }
}
