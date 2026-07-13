export type ReconciliationRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';
export type Severity = 'critical' | 'warning';
export type ReconciliationStatus =
  | 'Matched'
  | 'Missing in ITAS'
  | 'Missing in E-Leave'
  | 'Mismatch'
  | 'Duplicate';

export interface DiscrepancyItem {
  rule: string;
  severity: string;
  priority?: string;         // 'high' | 'medium' — provided by backend
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  leaveType?: string;        // provided by backend
  eleaveStatus: string;
  itasStatus: string;
  issue: string;
  recommendation: string;
}

export interface MatchedRecord {
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  leaveType: string;
  itasType: string;
  hours: number;
  status: 'Reconciled';
}

export interface ReconciliationSummary {
  total: number;
  matched: number;
  warnings: number;
  critical: number;
  reconciliationRate: number;
}

export interface ReconciliationResult {
  timestamp: string;
  totalRecords: number;
  matched: MatchedRecord[];
  warnings: DiscrepancyItem[];
  critical: DiscrepancyItem[];
  summary: ReconciliationSummary;
}

export interface UploadState {
  eleaveLoaded: boolean;
  itasLoaded: boolean;
  eleaveFileName: string;
  itasFileName: string;
}

export const LEAVE_TYPE_MAP: Record<string, string> = {
  'Annual Leave': 'Vacation',
  'Casual Leave': 'Vacation',
  'Sick Leave/Hospitalization': 'Illness',
  'Special Leave': 'Vacation',
};
