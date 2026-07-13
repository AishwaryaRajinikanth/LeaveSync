export type ITASEntryType = 'Work' | 'Vacation' | 'Illness' | 'Holiday' | 'Training';

export interface ITASEntry {
  date: string;          // YYYY-MM-DD
  type: ITASEntryType;
  par: string;           // PAR code or '0'
  hours: number;
  phase?: string;        // e.g. Design/Develop/Test
  parDescription?: string;
}

export interface ITASRecord {
  employeeId: string;
  employeeName: string;
  department?: string;
  reportingManager?: string;
  weekEnding: string;    // YYYY-MM-DD
  entries: ITASEntry[];
  vacationUsed?: number;
  illnessUsed?: number;
  submitted?: boolean;
}
