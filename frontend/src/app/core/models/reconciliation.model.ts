export type ReconciliationStatus =
  | 'Matched'
  | 'MissingInITAS'
  | 'MissingInELeave'
  | 'DateMismatch'
  | 'LeaveTypeMismatch'
  | 'DuplicateRecord'
  | 'InvalidEmployeeId'
  | 'Excluded'
  | 'RequiresManualReview';

export interface ReconciliationRecord {
  status:          ReconciliationStatus;
  employeeId:      string;
  employeeName?:   string;
  department:      string;
  date:            string;
  eleaveType?:     string;
  itasType?:       string;
  issue:           string;
  recommendation:  string;
}

export interface ReconciliationSummary {
  totalITASRecords:        number;
  totalELeaveRecords:      number;
  matched:                 number;
  missingInITAS:           number;
  missingInELeave:         number;
  dateMismatches:          number;
  leaveTypeMismatches:     number;
  duplicateRecords:        number;
  holidaysSkipped:         number;
  reconciliationPercentage: number;
}

export interface ReconciliationResult {
  timestamp: string;
  records:   ReconciliationRecord[];
  summary:   ReconciliationSummary;
}

/** Human-readable label for each status */
export const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  Matched:              'Matched',
  MissingInITAS:        'Missing in ITAS',
  MissingInELeave:      'Missing in E-Leave',
  DateMismatch:         'Date Mismatch',
  LeaveTypeMismatch:    'Leave Type Mismatch',
  DuplicateRecord:      'Duplicate Record',
  InvalidEmployeeId:    'Invalid Employee ID',
  Excluded:             'Excluded',
  RequiresManualReview: 'Manual Review',
};

/** CSS class suffix for badge colouring */
export const STATUS_CLASS: Record<ReconciliationStatus, string> = {
  Matched:              'matched',
  MissingInITAS:        'critical',
  MissingInELeave:      'critical',
  DateMismatch:         'warning',
  LeaveTypeMismatch:    'warning',
  DuplicateRecord:      'warning',
  InvalidEmployeeId:    'critical',
  Excluded:             'excluded',
  RequiresManualReview: 'warning',
};

/** Configurable leave type map (frontend reference only) */
export const LEAVE_TYPE_MAP: Record<string, string> = {
  'Annual Leave':               'Vacation',
  'Casual Leave':               'Vacation',
  'Vacation':                   'Vacation',
  'Unpaid Leave':               'Vacation',
  'Sick Leave':                 'Illness',
  'Sick Leave/Hospitalization': 'Illness',
  'Hospitalization':            'Illness',
  'Illness':                    'Illness',
  'Special Leave':              'Vacation',
};

/** Legacy compat types — kept for notification service only */
export interface UploadState {
  eleaveLoaded:    boolean;
  itasLoaded:      boolean;
  eleaveFileName:  string;
  itasFileName:    string;
}
