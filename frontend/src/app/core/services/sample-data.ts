/** Ported from sample-data.js — demo dataset for reconciliation testing */
export const SAMPLE_DATA = {
  eleaveRecords: [
    { employeeId: '8595727', employeeName: 'LEO, JOSEPH JOHN', leaveType: 'Annual Leave',                from: '2026-07-06', to: '2026-07-06', days: 1.0, status: 'Pending at Supervisor', appliedDate: '2026-07-04' },
    { employeeId: '8595727', employeeName: 'LEO, JOSEPH JOHN', leaveType: 'Sick Leave/Hospitalization',  from: '2026-06-29', to: '2026-06-29', days: 1.0, status: 'Pending at HR',         appliedDate: '2026-06-29' },
    { employeeId: '8595727', employeeName: 'LEO, JOSEPH JOHN', leaveType: 'Sick Leave/Hospitalization',  from: '2026-06-15', to: '2026-06-15', days: 1.0, status: 'Pending at HR',         appliedDate: '2026-06-15' },
    { employeeId: '8595727', employeeName: 'LEO, JOSEPH JOHN', leaveType: 'Annual Leave',                from: '2026-06-23', to: '2026-06-23', days: 1.0, status: 'Approved',              appliedDate: '2026-06-20' },
    { employeeId: '8601234', employeeName: 'SMITH, JANE MARIE', leaveType: 'Sick Leave/Hospitalization', from: '2026-07-08', to: '2026-07-08', days: 1.0, status: 'Approved',              appliedDate: '2026-07-08' },
    { employeeId: '8601234', employeeName: 'SMITH, JANE MARIE', leaveType: 'Annual Leave',               from: '2026-07-10', to: '2026-07-11', days: 2.0, status: 'Approved',              appliedDate: '2026-07-07' },
    { employeeId: '8604567', employeeName: 'KUMAR, RAJESH',     leaveType: 'Casual Leave',               from: '2026-07-09', to: '2026-07-09', days: 1.0, status: 'Approved',              appliedDate: '2026-07-08' },
  ],
  itasRecords: [
    { employeeId: '8595727', employeeName: 'Joseph John Leo', weekEnding: '2026-07-11', submitted: true,
      entries: [
        { date: '2026-07-05', type: 'Work',     par: '46700', hours: 0, phase: 'Design/Develop/Test' },
        { date: '2026-07-06', type: 'Vacation', par: '0',     hours: 8, phase: 'Non-PAR' },
        { date: '2026-07-07', type: 'Work',     par: '46700', hours: 8, phase: 'Design/Develop/Test' },
        { date: '2026-07-08', type: 'Work',     par: '46700', hours: 8, phase: 'Design/Develop/Test' },
        { date: '2026-07-09', type: 'Work',     par: '46700', hours: 8, phase: 'Design/Develop/Test' },
        { date: '2026-07-10', type: 'Work',     par: '46700', hours: 8, phase: 'Design/Develop/Test' },
        { date: '2026-07-11', type: 'Work',     par: '46700', hours: 0, phase: 'Design/Develop/Test' },
      ]},
    { employeeId: '8595727', employeeName: 'Joseph John Leo', weekEnding: '2026-06-29', submitted: true,
      entries: [
        { date: '2026-06-23', type: 'Vacation', par: '0',     hours: 8, phase: 'Non-PAR' },
        { date: '2026-06-24', type: 'Work',     par: '46700', hours: 8, phase: 'Design/Develop/Test' },
        { date: '2026-06-29', type: 'Illness',  par: '0',     hours: 8, phase: 'Non-PAR' },
      ]},
    { employeeId: '8595727', employeeName: 'Joseph John Leo', weekEnding: '2026-06-15', submitted: true,
      entries: [{ date: '2026-06-15', type: 'Illness', par: '0', hours: 8, phase: 'Non-PAR' }]},
    { employeeId: '8601234', employeeName: 'Jane Marie Smith', weekEnding: '2026-07-11', submitted: true,
      entries: [
        { date: '2026-07-08', type: 'Work',     par: '47200', hours: 8, phase: 'Design/Develop/Test' },
        { date: '2026-07-10', type: 'Vacation', par: '0',     hours: 8, phase: 'Non-PAR' },
        { date: '2026-07-11', type: 'Vacation', par: '0',     hours: 8, phase: 'Non-PAR' },
      ]},
    { employeeId: '8604567', employeeName: 'Rajesh Kumar', weekEnding: '2026-07-11', submitted: true,
      entries: [{ date: '2026-07-09', type: 'Vacation', par: '0', hours: 8, phase: 'Non-PAR' }]},
  ]
};
