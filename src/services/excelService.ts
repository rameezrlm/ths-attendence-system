import * as XLSX from 'xlsx';
import type { AttendanceRecord, AttendanceStatus, Student } from '../types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function getMonthName(monthIndex: number): string {
  // 1-indexed (1 = January, 12 = December)
  return MONTH_NAMES[monthIndex - 1] || 'Month';
}

export function getDaysInMonth(year: number, month: number): number {
  // month is 1-indexed: passing month directly with day 0 gives last day of this month
  return new Date(year, month, 0).getDate();
}

/**
 * Converts internal status to traditional register short code.
 * present -> P
 * absent -> A
 * late -> L
 * early_left -> EL
 */
export function getStatusCode(status?: AttendanceStatus): string {
  if (!status) return '';
  switch (status) {
    case 'present':
      return 'P';
    case 'absent':
      return 'A';
    case 'late':
      return 'L';
    case 'early_left':
      return 'EL';
    default:
      return '';
  }
}

/**
 * Generate traditional attendance register Excel file (.xlsx)
 */
export function exportMonthlyRegister(
  students: Student[],
  attendanceRecords: AttendanceRecord[],
  year: number,
  month: number
): void {
  const monthName = getMonthName(month);
  const totalDays = getDaysInMonth(year, month);
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  // Map attendance by: `${studentId}_${dayNumber}` -> status
  const lookup: Record<string, AttendanceStatus> = {};
  attendanceRecords.forEach((rec) => {
    // rec.date is "YYYY-MM-DD"
    const parts = rec.date.split('-');
    if (parts.length === 3 && parts[0] === String(year) && parts[1] === monthStr) {
      const dayNum = parseInt(parts[2], 10);
      lookup[`${rec.studentId}_${dayNum}`] = rec.status;
    }
  });

  // Build Sheet Rows
  const rows: (string | number)[][] = [];

  // Title Banner
  rows.push(['TALEEM-O-HUNAR SOCIETY - IT LAB ATTENDANCE REGISTER']);
  rows.push([`Monthly Attendance Register: ${monthName} ${year}`]);
  rows.push([]); // blank separator

  // Header Row
  const headerRow: (string | number)[] = ['Roll #', 'Student Name', 'Email'];
  for (let d = 1; d <= totalDays; d++) {
    headerRow.push(d);
  }
  // Summary count columns
  headerRow.push('Total P', 'Total A', 'Total L', 'Total EL', 'Attendance %');
  rows.push(headerRow);

  // Student Rows
  students.forEach((student, index) => {
    const studentRow: (string | number)[] = [
      index + 1,
      student.name,
      student.email,
    ];

    let countP = 0;
    let countA = 0;
    let countL = 0;
    let countEL = 0;
    let totalMarked = 0;

    for (let d = 1; d <= totalDays; d++) {
      const status = lookup[`${student.id}_${d}`];
      const code = getStatusCode(status);
      studentRow.push(code);

      if (status === 'present') countP++;
      else if (status === 'absent') countA++;
      else if (status === 'late') countL++;
      else if (status === 'early_left') countEL++;

      if (status) totalMarked++;
    }

    // Attendance percentage (Present + Late + EarlyLeft / total marked days or days with records)
    const effectiveAttended = countP + countL + countEL;
    const attPercentage = totalMarked > 0 ? `${Math.round((effectiveAttended / totalMarked) * 100)}%` : '-';

    studentRow.push(countP, countA, countL, countEL, attPercentage);
    rows.push(studentRow);
  });

  // Summary Row at bottom
  const dailySummaryP: (string | number)[] = ['Summary', 'Total Present (P)', ''];
  const dailySummaryA: (string | number)[] = ['', 'Total Absent (A)', ''];
  for (let d = 1; d <= totalDays; d++) {
    let dayP = 0;
    let dayA = 0;
    students.forEach((s) => {
      const st = lookup[`${s.id}_${d}`];
      if (st === 'present') dayP++;
      if (st === 'absent') dayA++;
    });
    dailySummaryP.push(dayP > 0 ? dayP : '');
    dailySummaryA.push(dayA > 0 ? dayA : '');
  }
  rows.push([]);
  rows.push(dailySummaryP);
  rows.push(dailySummaryA);

  // Convert to worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Format column widths
  const colWidths: { wch: number }[] = [
    { wch: 8 },  // Roll #
    { wch: 24 }, // Student Name
    { wch: 28 }, // Email
  ];

  // Days column widths (narrow for codes)
  for (let d = 1; d <= totalDays; d++) {
    colWidths.push({ wch: 5 });
  }

  // Summary columns
  colWidths.push({ wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 14 });
  ws['!cols'] = colWidths;

  // Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  const sheetName = `${monthName}_${year}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const filename = `Attendance_${monthName}_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}
