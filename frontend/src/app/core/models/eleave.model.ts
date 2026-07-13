export type LeaveStatus =
  | 'Approved'
  | 'Rejected'
  | 'Pending at Supervisor'
  | 'Pending at HR';

export type LeaveType =
  | 'Annual Leave'
  | 'Sick Leave/Hospitalization'
  | 'Casual Leave'
  | 'Special Leave';

export interface ELeaveRecord {
  employeeId: string;
  employeeName: string;
  department?: string;
  reportingManager?: string;
  leaveType: LeaveType;
  from: string;        // YYYY-MM-DD
  to: string;          // YYYY-MM-DD
  days: number;
  status: LeaveStatus;
  appliedDate: string;
}
