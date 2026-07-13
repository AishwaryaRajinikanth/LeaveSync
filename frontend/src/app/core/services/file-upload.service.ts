import { Injectable } from '@angular/core';
import { ELeaveRecord } from '../models/eleave.model';
import { ITASRecord } from '../models/itas.model';

@Injectable({ providedIn: 'root' })
export class FileUploadService {

  parseELeaveCsv(csvText: string): ELeaveRecord[] {
    const rows = this.parseCsv(csvText);
    return rows.map(r => ({
      // Supports template columns: Employee ID, Leave Type, From, TO, Hours/Days
      // Also supports extended columns: Employee Name, Status, Department, Reporting Manager
      employeeId:       String(r['Employee ID'] || r['EmployeeID'] || r['Employee Id'] || '').trim(),
      employeeName:     String(r['Employee Name'] || r['EmployeeName'] || r['Employee ID'] || r['Employee Id'] || '').trim(),
      department:       String(r['Department'] || '').trim(),
      reportingManager: String(r['Reporting Manager'] || r['Primary Approver'] || '').trim(),
      leaveType:        this.mapELeaveType(String(r['Leave Type'] || r['LeaveType'] || r['PAR Name'] || 'Annual Leave').trim()),
      from:             this.normalizeDate(r['From'] || r['StartDate'] || r['Date'] || ''),
      to:               this.normalizeDate(r['TO'] || r['To'] || r['EndDate'] || r['Date'] || ''),
      days:             this.parseDays(r['Hours/Days'] || r['Days'] || r['Hours'] || '1'),
      status:           String(r['Status'] || 'Approved').trim() as any,
      appliedDate:      this.normalizeDate(r['Applied Date'] || r['AppliedDate'] || r['Date'] || ''),
    })).filter(r => !!r.employeeId);
  }

  parseITASCsv(csvText: string): ITASRecord[] {
    const rows = this.parseCsv(csvText);
    const byEmp: Record<string, ITASRecord> = {};

    rows.forEach(r => {
      // Supports template columns: Employee Id, Department, Hours, PAR Name, Date, Primary Approver, Department Manager
      // Also supports: Employee ID, EmployeeID, Employee Name
      const id = String(r['Employee Id'] || r['Employee ID'] || r['EmployeeID'] || r['EmployeeId'] || '').trim();
      if (!id) return;
      if (!byEmp[id]) {
        byEmp[id] = {
          employeeId:       id,
          employeeName:     String(r['Employee Name'] || r['EmployeeName'] || id).trim(),
          department:       String(r['Department'] || '').trim(),
          reportingManager: String(r['Department Manager'] || r['Primary Approver'] || r['Reporting Manager'] || '').trim(),
          weekEnding:       this.normalizeDate(r['Week Ending'] || r['WeekEnding'] || r['Date'] || ''),
          entries: [],
          submitted: true,
        };
      }
      const hours = parseFloat(r['Hours'] || r['Hrs on PAR'] || '0') || 0;
      const parName = String(r['PAR Name'] || r['PAR'] || r['Type'] || 'Work').trim();
      byEmp[id].entries.push({
        date:           this.normalizeDate(r['Date'] || ''),
        type:           this.mapITASType(parName),
        par:            parName,
        hours,
        phase:          String(r['Phase'] || r['PAR Description'] || parName).trim(),
        parDescription: String(r['PAR Name'] || r['PAR Description'] || '').trim(),
      });
    });

    return Object.values(byEmp);
  }

  private parseCsv(text: string): Record<string, string>[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
  }

  private normalizeDate(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  private parseDays(value: string): number {
    const n = parseFloat(value);
    if (isNaN(n)) return 1;
    // If value is hours (8, 16â€¦) convert to days, otherwise treat as days
    return n >= 8 ? n / 8 : n;
  }

  private mapELeaveType(type: string): any {
    const t = type.toLowerCase();
    if (t.includes('vacation') || t.includes('annual')) return 'Annual Leave';
    if (t.includes('illness') || t.includes('sick'))    return 'Sick Leave/Hospitalization';
    if (t.includes('casual'))                           return 'Casual Leave';
    if (t.includes('special'))                          return 'Special Leave';
    return type; // pass through if already a valid leave type string
  }

  private mapITASType(par: string): any {
    const p = par.toLowerCase();
    if (p.includes('vacation') || p.includes('annual'))  return 'Vacation';
    if (p.includes('illness') || p.includes('sick'))     return 'Illness';
    if (p.includes('holiday'))                           return 'Holiday';
    if (p.includes('training'))                          return 'Work'; // training is PAR time
    return 'Work';
  }
}
