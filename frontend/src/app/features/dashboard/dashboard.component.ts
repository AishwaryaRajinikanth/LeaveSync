import { Component, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReconciliationResult, ReconciliationRecord, ReconciliationStatus, STATUS_LABEL, STATUS_CLASS } from '../../core/models/reconciliation.model';
import { NotificationRequest } from '../../core/services/api.service';

interface WeekDay { name: string; date: string; fullDate: string; statusClass: string; statusText: string; detail: string; isToday: boolean; }
interface ComparisonRecord { date: string; type: string; status: string; highlight: '' | 'critical' | 'warning'; }
interface NotifyModal { mode: 'single' | 'all'; item?: ReconciliationRecord; items?: ReconciliationRecord[]; empCount: number; recordCount: number; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  private api    = inject(ApiService);
  private notify = inject(NotificationService);

  eleaveFile   = signal<File | null>(null);
  itasFile     = signal<File | null>(null);
  running      = signal(false);
  results      = signal<ReconciliationResult | null>(null);
  activeFilter = signal<string>('issues');
  weekDays     = signal<WeekDay[]>([]);
  weekLabel    = signal('');
  eleaveSide   = signal<ComparisonRecord[]>([]);
  itasSide     = signal<ComparisonRecord[]>([]);
  notifiedSet  = new Set<string>();

  columnFilters = signal<Record<string, Set<string>>>({});
  openFilter    = signal<string | null>(null);
  filterSearch  = signal<Record<string, string>>({});
  notifyModal   = signal<NotifyModal | null>(null);

  private readonly filterCols = ['employee', 'department', 'date', 'eleaveType', 'itasType', 'status', 'issue'];

  readonly STATUS_LABEL = STATUS_LABEL;
  readonly STATUS_CLASS = STATUS_CLASS;

  get canRun(): boolean { return !!this.eleaveFile() && !!this.itasFile(); }

  private baseRecords(): ReconciliationRecord[] {
    const r = this.results();
    if (!r) return [];
    const f = this.activeFilter();
    if (f === 'issues')  return r.records.filter(rec => rec.status !== 'Matched');
    if (f === 'matched') return r.records.filter(rec => rec.status === 'Matched');
    return r.records.filter(rec => rec.status === f as ReconciliationStatus);
  }

  private cellValue(d: ReconciliationRecord, col: string): string {
    switch (col) {
      case 'employee':   return d.employeeId;
      case 'department': return d.department || '-';
      case 'date':       return d.date;
      case 'eleaveType': return d.eleaveType || '-';
      case 'itasType':   return d.itasType   || '-';
      case 'status':     return STATUS_LABEL[d.status] ?? d.status;
      case 'issue':      return d.issue;
      default:           return '';
    }
  }

  uniqueValues(col: string): string[] {
    const search = (this.filterSearch()[col] ?? '').toLowerCase();
    const set = new Set<string>();
    this.baseRecords().forEach(d => set.add(this.cellValue(d, col)));
    return [...set].sort().filter(v => !search || v.toLowerCase().includes(search));
  }

  getFilterSearch(col: string): string {
    return this.filterSearch()[col] ?? '';
  }

  setFilterSearch(col: string, value: string, event: Event) {
    event.stopPropagation();
    this.filterSearch.set({ ...this.filterSearch(), [col]: value });
  }

  get allDiscrepancies(): ReconciliationRecord[] {
    const filters = this.columnFilters();
    return this.baseRecords().filter(d =>
      this.filterCols.every(col => {
        const sel = filters[col];
        if (!sel || sel.size === 0) return true;
        return sel.has(this.cellValue(d, col));
      })
    );
  }

  toggleFilter(col: string, event: Event) {
    event.stopPropagation();
    this.openFilter.set(this.openFilter() === col ? null : col);
  }

  @HostListener('document:click')
  closeAllFilters() { this.openFilter.set(null); }

  isFilterActive(col: string): boolean {
    const s = this.columnFilters()[col];
    return !!s && s.size > 0;
  }

  isChecked(col: string, value: string): boolean {
    const s = this.columnFilters()[col];
    return !!s && s.has(value);
  }

  toggleValue(col: string, value: string) {
    const current = { ...this.columnFilters() };
    const set = new Set(current[col] ?? []);
    if (set.has(value)) set.delete(value); else set.add(value);
    current[col] = set;
    this.columnFilters.set(current);
  }

  clearColumnFilter(col: string, event?: Event) {
    if (event) event.stopPropagation();
    const filters = { ...this.columnFilters() };
    delete filters[col];
    this.columnFilters.set(filters);
    this.filterSearch.set({ ...this.filterSearch(), [col]: '' });
    this.openFilter.set(null);
  }

  onELeaveFile(e: Event) { this.eleaveFile.set((e.target as HTMLInputElement).files?.[0] ?? null); }
  onITASFile(e: Event)   { this.itasFile.set(  (e.target as HTMLInputElement).files?.[0] ?? null); }

  async runReconciliation() {
    if (!this.canRun) { this.notify.showToast('Please upload both E-Leave and ITAS files first'); return; }
    this.running.set(true);
    this.api.uploadAndReconcile(this.eleaveFile()!, this.itasFile()!).subscribe({
      next: (result: ReconciliationResult) => {
        this.results.set(result);
        this.activeFilter.set('issues');
        this.columnFilters.set({});
        this.buildWeekView(result);
        this.buildComparison(result);
        this.running.set(false);
        const issues = result.records.filter(r => r.status !== 'Matched');
        const notifs = issues.slice(0, 20).map(i => ({
          type: (i.status === 'MissingInITAS' || i.status === 'MissingInELeave' || i.status === 'InvalidEmployeeId')
            ? 'critical' as const : 'warning' as const,
          title: `${STATUS_LABEL[i.status]}: ${i.issue.slice(0, 60)}`,
          employee: i.employeeId,
          time: 'Just now',
          action: i.recommendation
        }));
        if (result.summary.matched > 0)
          notifs.push({ type: 'warning' as const, title: `${result.summary.matched} record(s) matched`, employee: 'System', time: 'Just now', action: 'No action needed' });
        this.notify.pushNotifications(notifs);
        this.notify.showToast(`Reconciliation complete - ${result.summary.reconciliationPercentage}% match rate`);
      },
      error: (err: any) => {
        this.running.set(false);
        const msg = err?.error?.error ?? err?.message ?? 'Unknown error';
        this.notify.showToast(`API error: ${msg}`);
      }
    });
  }

  setFilter(f: string) { this.activeFilter.set(f); this.columnFilters.set({}); }

  statusLabel(s: ReconciliationStatus): string { return STATUS_LABEL[s] ?? s; }
  statusClass(s: ReconciliationStatus): string  { return STATUS_CLASS[s] ?? 'warning'; }

  isCritical(s: ReconciliationStatus): boolean {
    return s === 'MissingInITAS' || s === 'MissingInELeave' || s === 'InvalidEmployeeId';
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  notifyIssue(item: ReconciliationRecord) {
    this.notifyModal.set({ mode: 'single', item, items: [item], empCount: 1, recordCount: 1 });
  }

  isNotified(item: ReconciliationRecord): boolean {
    return this.notifiedSet.has(`${item.employeeId}_${item.date}_${item.status}`);
  }

  notifyAll() {
    const rows = this.allDiscrepancies.filter(r => r.status !== 'Matched');
    if (!rows.length) { this.notify.showToast('No visible records to notify'); return; }
    const uniqueIds = new Set(rows.map(r => r.employeeId));
    this.notifyModal.set({ mode: 'all', items: rows, empCount: uniqueIds.size, recordCount: rows.length });
  }

  cancelNotify() { this.notifyModal.set(null); }

  confirmNotify() {
    const modal = this.notifyModal();
    if (!modal) return;
    this.notifyModal.set(null);

    if (modal.mode === 'single' && modal.item) {
      const item = modal.item;
      const key  = `${item.employeeId}_${item.date}_${item.status}`;
      const req: NotificationRequest = {
        employeeId: item.employeeId, issue: item.issue, date: item.date,
        priority: this.isCritical(item.status) ? 'High' : 'Medium',
        recommendation: item.recommendation, employeeName: item.employeeName, department: item.department,
      };
      this.api.notify(req).subscribe({
        next: () => { this.notifiedSet.add(key); this.notify.showToast(`Notification sent to ${item.employeeId}@ups.com`, 'send'); },
        error: (err: any) => this.notify.showToast(`Failed: ${err?.error?.error ?? err?.message ?? 'Unknown error'}`, 'error')
      });
    } else if (modal.mode === 'all' && modal.items) {
      const requests: NotificationRequest[] = modal.items.map(item => ({
        employeeId: item.employeeId, issue: item.issue, date: item.date,
        priority: this.isCritical(item.status) ? 'High' : 'Medium',
        recommendation: item.recommendation, employeeName: item.employeeName, department: item.department,
      }));
      this.api.notifyAll(requests).subscribe({
        next: (res) => {
          modal.items!.forEach(i => this.notifiedSet.add(`${i.employeeId}_${i.date}_${i.status}`));
          this.notify.showToast(res.message ?? `Notified ${modal.recordCount} record(s)`, 'send');
        },
        error: (err: any) => this.notify.showToast(`Failed: ${err?.error?.error ?? err?.message ?? 'Unknown error'}`, 'error')
      });
    }
  }

  resolveIssue(item: ReconciliationRecord) {
    this.notify.showToast(`Opening portal to resolve: ${item.issue}`);
  }

  exportCsv() {
    const rows = this.allDiscrepancies;
    if (!rows.length) { this.notify.showToast('No records to export'); return; }
    const clean = (s: string) =>
      (s ?? '').replace(/[--]/g, '-').replace(/[\u201c\u201d]/g, '"')
               .replace(/\u2019/g, "'").replace(/[^\x00-\x7F]/g, ' ');
    const header = 'Employee ID,Department,Date,E-Leave Type,ITAS Type,Status,Issue,Recommendation';
    const lines  = rows.map(d => [
      d.employeeId,
      `"${clean(d.department || '-')}"`,
      d.date,
      `"${clean(d.eleaveType || '-')}"`,
      `"${clean(d.itasType   || '-')}"`,
      `"${clean(STATUS_LABEL[d.status] ?? d.status)}"`,
      `"${clean(d.issue)}"`,
      `"${clean(d.recommendation || '')}"`
    ].join(','));
    const bom  = '\uFEFF';
    const blob = new Blob([bom + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify.showToast(`Exported ${rows.length} record(s)`);
  }

  private buildWeekView(result: ReconciliationResult) {
    const dates = result.records.map(x => x.date).filter(Boolean).sort();
    if (!dates.length) { this.weekDays.set([]); return; }
    const anchor = new Date(dates[dates.length - 1] + 'T00:00:00');
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - anchor.getDay());
    const today = new Date().toISOString().split('T')[0];
    const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const fullDate  = d.toISOString().split('T')[0];
      const matched   = result.records.find(r => r.date === fullDate && r.status === 'Matched');
      const critical  = result.records.find(r => r.date === fullDate && this.isCritical(r.status as ReconciliationStatus));
      const warning   = result.records.find(r => r.date === fullDate && r.status !== 'Matched' && !this.isCritical(r.status as ReconciliationStatus));
      let statusClass = i === 0 || i === 6 ? 'status-weekend' : 'status-work';
      let statusText  = i === 0 || i === 6 ? 'Weekend' : 'Work';
      let detail = '';
      if (critical) { statusClass = 'status-mismatch'; statusText = '! Issue'; detail = critical.issue.slice(0, 30); }
      else if (warning) { statusClass = 'status-mismatch'; statusText = '! Warn'; detail = warning.issue.slice(0, 30); }
      else if (matched) { statusClass = 'status-vacation'; statusText = matched.eleaveType ?? 'Leave'; detail = ''; }
      return { name: d.toLocaleDateString('en-US', { weekday: 'short' }), date: `${d.getMonth()+1}/${d.getDate()}`, fullDate, statusClass, statusText, detail, isToday: fullDate === today };
    });
    const wEnd = new Date(weekStart); wEnd.setDate(weekStart.getDate() + 6);
    this.weekLabel.set(`Week of ${weekStart.toLocaleDateString('en-US', {month:'short',day:'numeric'})} - ${wEnd.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}`);
    this.weekDays.set(days);
  }

  private buildComparison(result: ReconciliationResult) {
    const focusId = result.records[0]?.employeeId ?? '';
    const focusRecords = result.records.filter(r => r.employeeId === focusId);
    const el: ComparisonRecord[] = focusRecords
      .filter(r => r.eleaveType)
      .map(r => ({ date: r.date, type: r.eleaveType!, status: r.status, highlight: this.isCritical(r.status as ReconciliationStatus) ? 'critical' as const : r.status !== 'Matched' ? 'warning' as const : '' as const }));
    const it: ComparisonRecord[] = focusRecords
      .filter(r => r.itasType)
      .map(r => ({ date: r.date, type: r.itasType!, status: r.status, highlight: this.isCritical(r.status as ReconciliationStatus) ? 'critical' as const : r.status !== 'Matched' ? 'warning' as const : '' as const }));
    this.eleaveSide.set(el);
    this.itasSide.set(it);
  }
}

