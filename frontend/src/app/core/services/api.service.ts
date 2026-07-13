import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { ReconciliationResult } from '../models/reconciliation.model';
import { environment } from '../../../environments/environment';

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

  getAiSummary(result: ReconciliationResult): Observable<string> {
    return this.http.post<string>(`${this.base}/ai/summary`, result);
  }
}
