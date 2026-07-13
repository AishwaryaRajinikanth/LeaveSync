import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthSession } from '../models/auth.model';

const AUTH_KEY = 'ups-sso-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session$ = new BehaviorSubject<AuthSession | null>(this.loadSession());

  get session$() { return this._session$.asObservable(); }
  get session(): AuthSession | null { return this._session$.value; }
  get isAuthenticated(): boolean { return !!this._session$.value; }

  login(employeeId: string, provider: 'ups' | 'ms'): Promise<AuthSession> {
    return new Promise(resolve => {
      setTimeout(() => {
        const session: AuthSession = {
          id: employeeId,
          name: 'Joseph John Leo',
          provider,
          timestamp: new Date().toISOString()
        };
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
        this._session$.next(session);
        resolve(session);
      }, 3200);
    });
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    this._session$.next(null);
  }

  private loadSession(): AuthSession | null {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
