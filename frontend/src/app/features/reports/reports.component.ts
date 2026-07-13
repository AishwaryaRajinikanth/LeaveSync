import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SAMPLE_DATA } from '../../core/services/sample-data';
import { LEAVE_TYPE_MAP } from '../../core/models/reconciliation.model';

export type ReportScope  = 'director' | 'manager' | 'self';
export type ReportPeriod = 'year' | 'month' | 'week' | 'date';

export interface ReportRow {
  employeeId:   string;
  employeeName: string;
  department:   string;
  date:         string;
  eleave:       string;
  itas:         string;
  status:       'Synced' | 'Mismatched' | 'Missing in ITAS' | 'Missing in E-Leave';
  detail:       string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  scope  = signal<ReportScope>('manager');
  period = signal<ReportPeriod>('year');

  selectedYear  = signal(2026);
  selectedMonth = signal(7);
  selectedWeek  = signal('2026-07-05');
  selectedDate  = signal('2026-07-11');

  rows    = signal<ReportRow[]>([]);
  hasRun  = signal(false);

  months = [
    { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
    { v: 4, l: 'April' },   { v: 5, l: 'May' },       { v: 6, l: 'June' },
    { v: 7, l: 'July' },    { v: 8, l: 'August' },    { v: 9, l: 'September' },
    { v: 10, l: 'October'}, { v: 11, l: 'November' }, { v: 12, l: 'December' }
  ];

  weeks = [
    { v: '2026-07-05', l: 'Jul 5 – Jul 11, 2026' },
    { v: '2026-06-28', l: 'Jun 28 – Jul 4, 2026' },
    { v: '2026-06-21', l: 'Jun 21 – Jun 27, 2026' },
    { v: '2026-06-14', l: 'Jun 14 – Jun 20, 2026' },
  ];

  scopeLabel = computed(() => ({
    director: 'Showing: All teams (organization-wide)',
    manager:  'Showing: Your direct reports',
    self:     'Showing: Your own records only',
  }[this.scope()]));

  get summary() {
    const r = this.rows();
    const total    = r.length;
    const synced   = r.filter(x => x.status === 'Synced').length;
    const mismatch = r.filter(x => x.status === 'Mismatched').length;
    const missing  = r.filter(x => x.status.startsWith('Missing')).length;
    const rate     = total ? Math.round(synced / total * 100) : 0;
    return { total, synced, mismatch, missing, rate };
  }

  ngOnInit() { this.generate(); }

  setScope(s: ReportScope)   { this.scope.set(s); }
  setPeriod(p: ReportPeriod) { this.period.set(p); }

  generate() {
    const data = SAMPLE_DATA;
    const reverseMap: Record<string, string[]> = { Vacation: ['Annual Leave', 'Casual Leave'], Illness: ['Sick Leave/Hospitalization'] };
    const pool = new Map<string, any>();
    const deptByEmp: Record<string, string> = {};

    data.itasRecords.forEach((r: any) => { if (r.department) deptByEmp[r.employeeId] = r.department; });

    const allIds = new Set([
      ...data.eleaveRecords.map((r: any) => r.employeeId),
      ...data.itasRecords.map((r: any) => r.employeeId),
    ]);
    const selfId = (SAMPLE_DATA as any).employee?.id ?? [...allIds][0] ?? '8595727';
    const others = [...allIds].filter(id => id !== selfId);
    const managerIds = new Set([selfId, ...others.slice(0, 2)]);

    const allowed: Set<string> =
      this.scope() === 'self'    ? new Set([selfId]) :
      this.scope() === 'manager' ? managerIds :
      allIds;

    // Index e-leave
    data.eleaveRecords.forEach((rec: any) => {
      if (!allowed.has(rec.employeeId)) return;
      const from = new Date(rec.from + 'T00:00:00');
      const to   = new Date(rec.to   + 'T00:00:00');
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        if (!this.inPeriod(date)) continue;
        const key = `${rec.employeeId}|${date}`;
        const row = pool.get(key) || { employeeId: rec.employeeId, employeeName: rec.employeeName, department: deptByEmp[rec.employeeId] || '-', date, eleave: '', eleaveType: '', itas: '', itasType: '' };
        row.eleave     = `${rec.leaveType} (${rec.status})`;
        row.eleaveType = rec.leaveType;
        pool.set(key, row);
      }
    });

    // Index itas
    data.itasRecords.forEach((week: any) => {
      if (!allowed.has(week.employeeId)) return;
      week.entries.forEach((e: any) => {
        if ((e.type !== 'Vacation' && e.type !== 'Illness') || e.hours <= 0) return;
        if (!this.inPeriod(e.date)) return;
        const key = `${week.employeeId}|${e.date}`;
        const row = pool.get(key) || { employeeId: week.employeeId, employeeName: week.employeeName, department: week.department || deptByEmp[week.employeeId] || '-', date: e.date, eleave: '', eleaveType: '', itas: '', itasType: '' };
        row.itas     = `${e.type} (${e.hours}h)`;
        row.itasType = e.type;
        pool.set(key, row);
      });
    });

    const result: ReportRow[] = [...pool.values()].map(row => {
      let status: ReportRow['status'] = 'Mismatched';
      let detail = 'Leave type mismatch across systems';
      if (row.eleave && row.itas) {
        const mapped  = LEAVE_TYPE_MAP[row.eleaveType];
        const reverse = reverseMap[row.itasType] || [];
        if (mapped === row.itasType || reverse.includes(row.eleaveType)) {
          status = 'Synced'; detail = 'Leave entry is synchronized in both systems';
        }
      } else if (row.eleave && !row.itas) {
        status = 'Missing in ITAS';   detail = 'E-Leave entry not found in ITAS';
      } else if (!row.eleave && row.itas) {
        status = 'Missing in E-Leave'; detail = 'ITAS non-PAR entry not found in E-Leave';
      }
      return { ...row, status, detail } as ReportRow;
    }).sort((a, b) => b.date.localeCompare(a.date));

    this.rows.set(result);
    this.hasRun.set(true);
  }

  private inPeriod(dateStr: string): boolean {
    const d = new Date(dateStr + 'T00:00:00');
    switch (this.period()) {
      case 'year':  return d.getFullYear() === this.selectedYear();
      case 'month': return d.getFullYear() === this.selectedYear() && d.getMonth() + 1 === this.selectedMonth();
      case 'week': {
        const from = new Date(this.selectedWeek() + 'T00:00:00');
        const to   = new Date(from); to.setDate(from.getDate() + 6);
        return d >= from && d <= to;
      }
      case 'date':  return dateStr === this.selectedDate();
    }
  }
}
