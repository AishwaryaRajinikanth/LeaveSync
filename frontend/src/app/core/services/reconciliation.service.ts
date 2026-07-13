import { Injectable } from '@angular/core';
import { ELeaveRecord } from '../models/eleave.model';
import { ITASRecord } from '../models/itas.model';
import {
  DiscrepancyItem, MatchedRecord, ReconciliationResult,
  LEAVE_TYPE_MAP
} from '../models/reconciliation.model';

/**
 * ReconciliationService — exact port of reconciliation-engine.js rules R1-R8.
 * No business logic changes; only framework adaptation.
 */
@Injectable({ providedIn: 'root' })
export class ReconciliationService {

  readonly rules = [
    { id: 'R1', name: 'Missing in E-Leave',      severity: 'critical', description: 'ITAS has leave entry but no E-Leave application found' },
    { id: 'R2', name: 'Missing in ITAS',          severity: 'critical', description: 'E-Leave approved but not recorded in ITAS' },
    { id: 'R3', name: 'Pending Approval',         severity: 'warning',  description: 'Leave recorded in ITAS but E-Leave still pending approval' },
    { id: 'R4', name: 'Type Mismatch',            severity: 'critical', description: 'Leave type in E-Leave does not match ITAS category' },
    { id: 'R5', name: 'Duration Mismatch',        severity: 'warning',  description: 'Duration differs between E-Leave and ITAS' },
    { id: 'R6', name: 'Rejected but Recorded',   severity: 'critical', description: 'E-Leave rejected but still recorded in ITAS' },
    { id: 'R7', name: 'ITAS Draft Entry',         severity: 'warning',  description: 'ITAS has a leave entry that is not submitted yet' },
    { id: 'R8', name: 'Pending Missing in ITAS',  severity: 'warning',  description: 'E-Leave is pending and ITAS entry is not yet present' },
  ];

  reconcile(eleaveRecords: ELeaveRecord[], itasRecords: ITASRecord[]): ReconciliationResult {
    const results: ReconciliationResult = {
      timestamp: new Date().toISOString(),
      totalRecords: 0,
      matched: [],
      warnings: [],
      critical: [],
      summary: { total: 0, matched: 0, warnings: 0, critical: 0, reconciliationRate: 0 }
    };

    const itasLeaves = this.extractITASLeaves(itasRecords);
    const eleaveByKey = this.indexELeaveRecords(eleaveRecords);
    const itasByKey = this.indexITASLeaves(itasLeaves);
    const deptByEmployee = this.buildDepartmentIndex(itasRecords);

    const allKeys = new Set([...Object.keys(eleaveByKey), ...Object.keys(itasByKey)]);
    results.totalRecords = allKeys.size;

    allKeys.forEach(key => {
      const el = eleaveByKey[key];
      const it = itasByKey[key];

      if (el && it) {
        this.compareEntries(el, it, results, deptByEmployee);
      } else if (it && !el) {
        const isSubmitted = it['submitted'] !== false;
        const target = isSubmitted ? results.critical : results.warnings;
        target.push({
          rule: isSubmitted ? 'R1' : 'R7',
          severity: isSubmitted ? 'critical' : 'warning',
          employeeId: it.employeeId,
          employeeName: it.employeeName,
          department: it['department'] || deptByEmployee[it.employeeId] || '-',
          date: it.date,
          eleaveStatus: 'Not Found',
          itasStatus: `${it.type} (${it.hours}h)`,
          issue: isSubmitted
            ? `ITAS shows ${it.type} on ${this.fmt(it.date)}, no E-Leave application found`
            : `ITAS has unsubmitted ${it.type} on ${this.fmt(it.date)} and no E-Leave application`,
          recommendation: isSubmitted
            ? 'Employee should submit leave application in E-Leave portal'
            : 'Submit ITAS entry and verify if E-Leave application is required'
        });
      } else if (el && !it) {
        if (el.status === 'Approved') {
          results.critical.push({
            rule: 'R2', severity: 'critical',
            employeeId: el.employeeId, employeeName: el.employeeName,
            department: el.department || deptByEmployee[el.employeeId] || '-',
            date: el.from,
            eleaveStatus: `${el.leaveType} (${el.status})`,
            itasStatus: 'Not Found',
            issue: `E-Leave approved ${el.leaveType} on ${this.fmt(el.from)}, not reflected in ITAS`,
            recommendation: 'Employee should record leave in ITAS timesheet'
          });
        } else if (String(el.status).startsWith('Pending')) {
          results.warnings.push({
            rule: 'R8', severity: 'warning',
            employeeId: el.employeeId, employeeName: el.employeeName,
            department: el.department || deptByEmployee[el.employeeId] || '-',
            date: el.from,
            eleaveStatus: `${el.leaveType} (${el.status})`,
            itasStatus: 'Not Found',
            issue: `E-Leave ${el.leaveType} on ${this.fmt(el.from)} is pending and not yet in ITAS`,
            recommendation: 'Complete approval flow, then submit ITAS entry if required'
          });
        }
      }
    });

    results.summary = {
      total: results.totalRecords,
      matched: results.matched.length,
      warnings: results.warnings.length,
      critical: results.critical.length,
      reconciliationRate: results.totalRecords > 0
        ? Math.round((results.matched.length / results.totalRecords) * 100)
        : 0
    };

    return results;
  }

  private compareEntries(el: any, it: any, results: ReconciliationResult, deptIdx: Record<string, string>): void {
    const expectedType = LEAVE_TYPE_MAP[el.leaveType];
    const issues: DiscrepancyItem[] = [];
    const dept = it.department || el.department || deptIdx[el.employeeId] || '-';
    const isPending = String(el.status || '').startsWith('Pending');
    const isRejected = String(el.status || '') === 'Rejected';

    if (isPending) issues.push({ rule: 'R3', severity: 'warning', employeeId: el.employeeId, employeeName: el.employeeName, department: dept, date: el.from, eleaveStatus: `${el.leaveType} (${el.status})`, itasStatus: `${it.type} (${it.hours}h)`, issue: `${el.leaveType} on ${this.fmt(el.from)} recorded in ITAS but E-Leave is "${el.status}"`, recommendation: 'Manager should approve the pending E-Leave application' });
    if (it.submitted === false) issues.push({ rule: 'R7', severity: 'warning', employeeId: el.employeeId, employeeName: el.employeeName, department: dept, date: el.from, eleaveStatus: `${el.leaveType} (${el.status})`, itasStatus: `${it.type} (${it.hours}h) Draft`, issue: `ITAS entry for ${this.fmt(el.from)} is not submitted yet`, recommendation: 'Submit the ITAS timesheet entry' });
    if (expectedType && expectedType !== it.type) issues.push({ rule: 'R4', severity: 'critical', employeeId: el.employeeId, employeeName: el.employeeName, department: dept, date: el.from, eleaveStatus: `${el.leaveType}`, itasStatus: `${it.type}`, issue: `Type mismatch: E-Leave shows "${el.leaveType}" but ITAS has "${it.type}"`, recommendation: 'Correct the leave type in either system' });
    if (el.days * 8 !== it.hours) issues.push({ rule: 'R5', severity: 'warning', employeeId: el.employeeId, employeeName: el.employeeName, department: dept, date: el.from, eleaveStatus: `${el.days} day(s)`, itasStatus: `${it.hours} hours`, issue: `Duration mismatch: E-Leave shows ${el.days} day(s) but ITAS has ${it.hours} hours`, recommendation: 'Verify correct duration in both systems' });
    if (isRejected) issues.push({ rule: 'R6', severity: 'critical', employeeId: el.employeeId, employeeName: el.employeeName, department: dept, date: el.from, eleaveStatus: `${el.leaveType} (Rejected)`, itasStatus: `${it.type} (${it.hours}h)`, issue: `E-Leave rejected but ${it.type} still recorded in ITAS on ${this.fmt(el.from)}`, recommendation: 'Remove leave entry from ITAS or resubmit E-Leave application' });

    if (issues.length > 0) {
      issues.forEach(i => (i.severity === 'critical' ? results.critical : results.warnings).push(i));
    } else {
      results.matched.push({ employeeId: el.employeeId, employeeName: el.employeeName, department: dept, date: el.from, leaveType: el.leaveType, itasType: it.type, hours: it.hours, status: 'Reconciled' });
    }
  }

  private extractITASLeaves(records: ITASRecord[]): any[] {
    const leaves: any[] = [];
    records.forEach(r => {
      r.entries.forEach(e => {
        if ((e.type === 'Vacation' || e.type === 'Illness' || e.type === 'Holiday') && e.hours > 0) {
          leaves.push({ employeeId: r.employeeId, employeeName: r.employeeName, department: r.department || '-', date: e.date, type: e.type, hours: e.hours, weekEnding: r.weekEnding, submitted: r.submitted });
        }
      });
    });
    return leaves;
  }

  private indexELeaveRecords(records: ELeaveRecord[]): Record<string, any> {
    const idx: Record<string, any> = {};
    records.forEach(r => {
      this.expandDateRange(r.from, r.to).forEach(date => {
        idx[`${r.employeeId}_${date}`] = { ...r, from: date, days: 1 };
      });
    });
    return idx;
  }

  private indexITASLeaves(leaves: any[]): Record<string, any> {
    const idx: Record<string, any> = {};
    leaves.forEach(l => { idx[`${l.employeeId}_${l.date}`] = l; });
    return idx;
  }

  private buildDepartmentIndex(records: ITASRecord[]): Record<string, string> {
    const idx: Record<string, string> = {};
    records.forEach(r => { if (r.employeeId && r.department) idx[r.employeeId] = r.department; });
    return idx;
  }

  private expandDateRange(from: string, to: string): string[] {
    const dates: string[] = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
    return dates;
  }

  private fmt(d: string): string {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
