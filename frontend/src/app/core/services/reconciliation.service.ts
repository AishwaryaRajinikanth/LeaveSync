import { Injectable } from '@angular/core';
import { ELeaveRecord } from '../models/eleave.model';
import { ITASRecord } from '../models/itas.model';
import { ReconciliationResult } from '../models/reconciliation.model';

/**
 * ReconciliationService - client-side stub.
 * Actual reconciliation is performed by the backend API via ApiService.uploadAndReconcile().
 */
@Injectable({ providedIn: 'root' })
export class ReconciliationService {

  readonly rules = [
    { id: 'R1', name: 'Missing in E-Leave',  severity: 'critical', description: 'ITAS has leave entry but no E-Leave application found' },
    { id: 'R2', name: 'Missing in ITAS',     severity: 'critical', description: 'E-Leave approved but not recorded in ITAS' },
    { id: 'R3', name: 'Date Mismatch',       severity: 'warning',  description: 'Same employee and leave type but dates differ' },
    { id: 'R4', name: 'Leave Type Mismatch', severity: 'warning',  description: 'Leave type in E-Leave does not match ITAS after mapping' },
    { id: 'R5', name: 'Duplicate Record',    severity: 'warning',  description: 'Same (EmployeeId, Date) appears more than once' },
    { id: 'R6', name: 'Invalid Employee ID', severity: 'critical', description: 'Employee ID is missing or invalid' },
  ];

  /** Returns an empty result - use ApiService.uploadAndReconcile() for real reconciliation. */
  reconcile(_eleave: ELeaveRecord[], _itas: ITASRecord[]): ReconciliationResult {
    return {
      timestamp: new Date().toISOString(),
      records: [],
      summary: {
        totalITASRecords: 0, totalELeaveRecords: 0,
        matched: 0, missingInITAS: 0, missingInELeave: 0,
        dateMismatches: 0, leaveTypeMismatches: 0,
        duplicateRecords: 0, holidaysSkipped: 0,
        reconciliationPercentage: 0
      }
    };
  }
}
