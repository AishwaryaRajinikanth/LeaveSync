import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReconciliationResult } from '../models/reconciliation.model';
import { environment } from '../../../environments/environment';

export interface NotificationRequest {
  employeeId:     string;
  issue:          string;
  date:           string;
  priority:       string;
  recommendation: string;
  employeeName?:  string;
  department?:    string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadAndReconcile(eleaveFile: File, itasFile: File): Observable<ReconciliationResult> {
    const fd = new FormData();
    fd.append('eleaveFile', eleaveFile);
    fd.append('itasFile', itasFile);
    return this.http.post<ReconciliationResult>(`${this.base}/reconciliation/upload`, fd);
  }

  notify(request: NotificationRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.base}/notification/notify`, request);
  }

  notifyAll(requests: NotificationRequest[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.base}/notification/notify-all`, requests);
  }

  getAiSummary(result: ReconciliationResult): Observable<string> {
    return this.http.post<string>(`${this.base}/ai/summary`, result);
  }
}
