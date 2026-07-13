import { Component, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReconciliationResult, DiscrepancyItem } from '../../core/models/reconciliation.model';
import { ELeaveRecord } from '../../core/models/eleave.model';
import { ITASRecord } from '../../core/models/itas.model';

interface WeekDay { name: string; date: string; fullDate: string; statusClass: string; statusText: string; detail: string; isToday: boolean; }
interface ComparisonRecord { date: string; type: string; status: string; highlight: '' | 'critical' | 'warning'; }

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
  activeFilter = signal<'all' | 'critical' | 'warning'>('all');
  weekDays     = signal<WeekDay[]>([]);
  weekLabel    = signal('');
  eleaveSide   = signal<ComparisonRecord[]>([]);
  itasSide     = signal<ComparisonRecord[]>([]);
  notifiedSet  = new Set<string>();

  // Column filters — each column maps to a Set of selected values
  columnFilters  = signal<Record<string, Set<string>>>({});
  openFilter     = signal<string | null>(null);
  filterSearch   = signal<Record<string, string>>({});   // per-column search text

  private readonly filterCols = ['employee', 'department', 'date', 'eleaveStatus', 'itasStatus', 'issue', 'priority'];

  get canRun(): boolean { return !!this.eleaveFile() && !!this.itasFile(); }

  private baseDiscrepancies(): DiscrepancyItem[] {
    const r = this.results();
    if (!r) return [];
    if (this.activeFilter() === 'critical') return r.critical;
    if (this.activeFilter() === 'warning')  return r.warnings;
    return [...r.critical, ...r.warnings];
  }

  private cellValue(d: DiscrepancyItem, col: string): string {
    switch (col) {
      case 'employee':     return d.employeeName || ('EMP ' + d.employeeId);
      case 'department':   return d.department || '—';
      case 'date':         return d.date;      case 'leaveType':    return d.leaveType || '\u2014';      case 'eleaveStatus': return d.eleaveStatus || '—';
      case 'itasStatus':   return d.itasStatus || '—';
      case 'issue':        return d.issue;
      case 'priority':     return this.getPriority(d) === 'high' ? 'High' : 'Medium';
      default:             return '';
    }
  }

  /** Unique sorted values for a column filtered by search text */
  uniqueValues(col: string): string[] {
    const search = (this.filterSearch()[col] ?? '').toLowerCase();
    const set = new Set<string>();
    this.baseDiscrepancies().forEach(d => set.add(this.cellValue(d, col)));
    return [...set].sort().filter(v => !search || v.toLowerCase().includes(search));
  }

  getFilterSearch(col: string): string {
    return this.filterSearch()[col] ?? '';
  }

  setFilterSearch(col: string, value: string, event: Event) {
    event.stopPropagation();
    this.filterSearch.set({ ...this.filterSearch(), [col]: value });
  }

  get allDiscrepancies(): DiscrepancyItem[] {
    const filters = this.columnFilters();
    return this.baseDiscrepancies().filter(d =>
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
  closeAllFilters() {
    this.openFilter.set(null);
  }

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
    // Clear search and close dropdown
    this.filterSearch.set({ ...this.filterSearch(), [col]: '' });
    this.openFilter.set(null);
  }

  onELeaveFile(e: Event) { this.eleaveFile.set((e.target as HTMLInputElement).files?.[0] ?? null); }
  onITASFile(e: Event)   { this.itasFile.set(  (e.target as HTMLInputElement).files?.[0] ?? null); }

  async runReconciliation() {
    if (!this.canRun) {
      this.notify.showToast('Please upload both E-Leave and ITAS files first');
      return;
    }
    this.running.set(true);

    this.api.uploadAndReconcile(this.eleaveFile()!, this.itasFile()!).subscribe({
      next: (result: ReconciliationResult) => {
        this.results.set(result);
        this.buildWeekView([], [], result);
        this.buildComparison([], [], result);
        this.running.set(false);

        const notifs = [
          ...result.critical.map((i: DiscrepancyItem) => ({ type: 'critical' as const, title: `Critical: ${i.issue}`, employee: i.employeeName, time: 'Just now', action: i.recommendation })),
          ...result.warnings.map((i: DiscrepancyItem) => ({ type: 'warning'  as const, title: `Warning: ${i.issue}`,  employee: i.employeeName, time: 'Just now', action: i.recommendation })),
          ...(result.matched.length ? [{ type: 'info' as const, title: `${result.matched.length} record(s) successfully reconciled`, employee: 'System', time: 'Just now', action: 'No action needed' }] : [])
        ];
        this.notify.pushNotifications(notifs);
        this.notify.showToast(`Reconciliation complete â€” ${result.summary.reconciliationRate}% sync rate`);
      },
      error: (err: any) => {
        this.running.set(false);
        const msg = err?.error?.error ?? err?.message ?? 'Unknown error';
        this.notify.showToast(`API error: ${msg}`);
        console.error('Reconciliation API error', err);
      }
    });
  }

  setFilter(f: 'all' | 'critical' | 'warning') { this.activeFilter.set(f); }

  getPriority(d: DiscrepancyItem): string {
    return d.priority ?? (d.severity === 'critical' ? 'high' : 'medium');
  }

  initials(name: string): string {
    if (!name) return '?';
    return name.replace(/^EMP\s*/i, '').split(/[\s,]+/)
      .map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  eleaveClass(status: string): string {
    if (!status || status === '-') return 'sp-neutral';
    const s = status.toLowerCase();
    if (s.includes('approved')) return 'sp-approved';
    if (s.includes('pending'))  return 'sp-pending';
    if (s.includes('rejected')) return 'sp-rejected';
    return 'sp-neutral';
  }

  itasClass(status: string): string {
    if (!status || status === '-') return 'sp-neutral';
    const s = status.toLowerCase();
    if (s.includes('annual') || s.includes('vacation')) return 'sp-annual';
    if (s.includes('illness') || s.includes('sick'))    return 'sp-sick';
    if (s.includes('holiday'))                          return 'sp-holiday';
    if (s.includes('approved'))                         return 'sp-approved';
    if (s.includes('pending') || s.includes('draft'))   return 'sp-pending';
    if (s.includes('day') || s.includes('h)'))          return 'sp-duration';
    return 'sp-neutral';
  }

  resolveIssue(item: DiscrepancyItem) {
    this.notify.showToast(`Opening portal to resolve: ${item.issue}`);
  }

  notifyIssue(item: DiscrepancyItem) {
    const key = `${item.employeeId}_${item.date}_${item.rule}`;
    this.notifiedSet.add(key);
    this.notify.showToast(`Notification sent: ${item.employeeName} â€¢ ${item.date} â€¢ ${item.rule}`);
  }

  isNotified(item: DiscrepancyItem): boolean {
    return this.notifiedSet.has(`${item.employeeId}_${item.date}_${item.rule}`);
  }

  notifyAll() {
    const r = this.results();
    if (!r) return;
    [...r.critical, ...r.warnings].forEach(i => this.notifyIssue(i));
    this.notify.showToast(`Notified all ${r.critical.length + r.warnings.length} discrepancies`);
  }

  exportCsv() {
    if (!this.results()) return;

    // Export only currently filtered/visible rows matching UI columns exactly
    const rows = this.allDiscrepancies;
    if (rows.length === 0) { this.notify.showToast('No records to export'); return; }

    const clean = (s: string) =>
      (s ?? '')
        .replace(/\u2014/g, '-')   // em dash
        .replace(/\u2013/g, '-')   // en dash
        .replace(/\u201c|\u201d/g, '"')  // smart quotes
        .replace(/\u2019/g, "'")   // smart apostrophe
        .replace(/[^\x00-\x7F]/g, ' '); // any remaining non-ASCII

    // UI columns only: Employee ID, Employee Name, Dept, Date, E-Leave, ITAS, Issue, Priority
    const header = 'Employee ID,Department,Date,E-Leave,ITAS,Issue,Priority,Recommendation';
    const lines  = rows.map(d => [
      d.employeeId,
      `"${clean(d.department || '-')}"`,
      d.date,
      `"${clean(d.leaveType || d.eleaveStatus || '-')}"`,
      `"${clean(d.itasStatus || '-')}"`,
      `"${clean(d.issue)}"`,
      this.getPriority(d) === 'high' ? 'High' : 'Medium',
      `"${clean(d.recommendation || '')}"`
    ].join(','));

    const bom  = '\uFEFF'; // BOM for correct Excel UTF-8 encoding
    const blob = new Blob([bom + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.notify.showToast(`Exported ${rows.length} record(s)`);
  }

  private buildWeekView(_e: ELeaveRecord[], _i: ITASRecord[], result: ReconciliationResult) {
    const allItems: any[] = [...result.matched, ...result.critical, ...result.warnings];
    if (!allItems.length) { this.weekDays.set([]); return; }

    const dates = allItems.map(x => x.date).filter(Boolean).sort();
    const anchor = new Date(dates[dates.length - 1] + 'T00:00:00');
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - anchor.getDay());
    const today = new Date().toISOString().split('T')[0];

    const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const fullDate = d.toISOString().split('T')[0];
      const matched  = result.matched.find((m: any) => m.date === fullDate);
      const critical = result.critical.find((c: any) => c.date === fullDate);
      const warning  = result.warnings.find((w: any) => w.date === fullDate);

      let statusClass = i === 0 || i === 6 ? 'status-weekend' : 'status-work';
      let statusText  = i === 0 || i === 6 ? 'Weekend' : 'Work';
      let detail = '';

      if (critical) { statusClass = 'status-mismatch'; statusText = '⚠ Issue';   detail = critical.issue.slice(0, 30); }
      else if (warning) { statusClass = 'status-mismatch'; statusText = '⚠ Warn'; detail = warning.issue.slice(0, 30); }
      else if (matched) { statusClass = 'status-vacation'; statusText = (matched as any).leaveType ?? 'Leave'; detail = `${(matched as any).hours ?? ''}h`; }

      return { name: d.toLocaleDateString('en-US', { weekday: 'short' }), date: `${d.getMonth()+1}/${d.getDate()}`, fullDate, statusClass, statusText, detail, isToday: fullDate === today };
    });

    const wEnd = new Date(weekStart); wEnd.setDate(weekStart.getDate() + 6);
    this.weekLabel.set(`Week of ${weekStart.toLocaleDateString('en-US', {month:'short',day:'numeric'})} – ${wEnd.toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}`);
    this.weekDays.set(days);
  }

  private buildComparison(_e: ELeaveRecord[], _i: ITASRecord[], result: ReconciliationResult) {
    const focusId = (result.matched[0] ?? result.critical[0] ?? result.warnings[0])?.employeeId ?? '';

    const el: ComparisonRecord[] = [
      ...result.matched .filter((x: any) => x.employeeId === focusId).map((x: any) => ({ date: x.date, type: (x as any).leaveType ?? 'Leave', status: 'Approved',   highlight: '' as const })),
      ...result.critical.filter((x: any) => x.employeeId === focusId).map((x: any) => ({ date: x.date, type: x.eleaveStatus,                  status: x.eleaveStatus, highlight: 'critical' as const })),
      ...result.warnings.filter((x: any) => x.employeeId === focusId).map((x: any) => ({ date: x.date, type: x.eleaveStatus,                  status: x.eleaveStatus, highlight: 'warning'  as const })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const it: ComparisonRecord[] = [
      ...result.matched .filter((x: any) => x.employeeId === focusId).map((x: any) => ({ date: x.date, type: `${(x as any).itasType} (${(x as any).hours}h)`, status: 'Submitted', highlight: '' as const })),
      ...result.critical.filter((x: any) => x.employeeId === focusId).map((x: any) => ({ date: x.date, type: x.itasStatus, status: x.itasStatus, highlight: 'critical' as const })),
      ...result.warnings.filter((x: any) => x.employeeId === focusId).map((x: any) => ({ date: x.date, type: x.itasStatus, status: x.itasStatus, highlight: 'warning'  as const })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    this.eleaveSide.set(el);
    this.itasSide.set(it);
  }
}
