import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Student, AttendanceRecord } from '../types';
import { getMonthlyAttendance } from '../services/attendanceService';
import {
  exportMonthlyRegister,
  getMonthName,
  getDaysInMonth,
  getStatusCode,
} from '../services/excelService';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  currentYear: number;
  currentMonth: number;
}

const MONTHS = [
  { value: 1, name: 'January' },
  { value: 2, name: 'February' },
  { value: 3, name: 'March' },
  { value: 4, name: 'April' },
  { value: 5, name: 'May' },
  { value: 6, name: 'June' },
  { value: 7, name: 'July' },
  { value: 8, name: 'August' },
  { value: 9, name: 'September' },
  { value: 10, name: 'October' },
  { value: 11, name: 'November' },
  { value: 12, name: 'December' },
];

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  students,
  currentYear,
  currentMonth,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const availableYears = [currentYear - 1, currentYear, currentYear + 1];

  // Fetch monthly records whenever modal opens or month/year changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setNotification(null);
      try {
        const data = await getMonthlyAttendance(selectedYear, selectedMonth);
        if (isMounted) {
          setRecords(data);
        }
      } catch (err) {
        if (isMounted) {
          setNotification({
            type: 'error',
            message: 'Failed to fetch attendance data for this month.',
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedYear, selectedMonth]);

  if (!isOpen) return null;

  const totalDays = getDaysInMonth(selectedYear, selectedMonth);
  const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;

  // Quick lookup table: `${studentId}_${day}` -> status
  const lookup: Record<string, string> = {};
  records.forEach((rec) => {
    const parts = rec.date.split('-');
    if (parts.length === 3 && parts[0] === String(selectedYear) && parts[1] === monthStr) {
      const dayNum = parseInt(parts[2], 10);
      lookup[`${rec.studentId}_${dayNum}`] = rec.status;
    }
  });

  const handleDownload = () => {
    try {
      setIsDownloading(true);
      setNotification(null);
      exportMonthlyRegister(students, records, selectedYear, selectedMonth);
      setNotification({
        type: 'success',
        message: `Attendance_${getMonthName(selectedMonth)}_${selectedYear}.xlsx downloaded.`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Failed to download attendance report.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      id="modal-monthly-report-overlay"
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        id="modal-monthly-report"
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Attendance Register</h3>
              <p className="text-xs text-slate-500">
                View attendance records and export Excel spreadsheet
              </p>
            </div>
          </div>
          <button
            id="btn-close-monthly-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Download Controls */}
        <div className="p-4 sm:px-6 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <select
              id="select-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>

            <select
              id="select-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-download-excel"
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || isLoading || students.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Generating...' : 'Export Excel'}</span>
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center gap-2 shrink-0 ${
              notification.type === 'success'
                ? 'bg-green-50 text-green-700 border-b border-green-200'
                : 'bg-red-50 text-red-700 border-b border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Matrix Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/20">
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Loading monthly records...
              </div>
            ) : students.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No students enrolled.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="py-2.5 px-3 w-8 text-center border-r border-slate-200 font-mono">
                      #
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-200 min-w-[140px]">
                      Student
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-200 hidden md:table-cell min-w-[180px]">
                      Email
                    </th>
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                      <th
                        key={day}
                        className="py-2.5 px-1 text-center w-7 border-r border-slate-200 font-mono text-[11px]"
                      >
                        {day}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center text-green-700 bg-green-50/75 font-semibold border-r border-slate-200">
                      P
                    </th>
                    <th className="py-2.5 px-2 text-center text-red-700 bg-red-50/75 font-semibold border-r border-slate-200">
                      A
                    </th>
                    <th className="py-2.5 px-2 text-center text-amber-700 bg-amber-50/75 font-semibold border-r border-slate-200">
                      L
                    </th>
                    <th className="py-2.5 px-2 text-center text-teal-700 bg-teal-50/75 font-semibold">
                      EL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student, idx) => {
                    let countP = 0;
                    let countA = 0;
                    let countL = 0;
                    let countEL = 0;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-r border-slate-100">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                          {student.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] border-r border-slate-100 hidden md:table-cell whitespace-nowrap">
                          {student.email}
                        </td>
                        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                          const status = lookup[`${student.id}_${day}`] as any;
                          const code = getStatusCode(status);

                          if (status === 'present') countP++;
                          else if (status === 'absent') countA++;
                          else if (status === 'late') countL++;
                          else if (status === 'early_left') countEL++;

                          let badgeColor = 'text-slate-200';
                          if (code === 'P') badgeColor = 'text-green-600 font-bold';
                          else if (code === 'A') badgeColor = 'text-red-600 font-bold';
                          else if (code === 'L') badgeColor = 'text-amber-600 font-bold';
                          else if (code === 'EL') badgeColor = 'text-teal-600 font-bold';

                          return (
                            <td
                              key={day}
                              className={`py-2.5 px-1 text-center font-mono text-[11px] border-r border-slate-100 ${badgeColor}`}
                            >
                              {code || '·'}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-2 text-center font-bold text-green-700 bg-green-50/30 border-r border-slate-100">
                          {countP}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-red-700 bg-red-50/30 border-r border-slate-100">
                          {countA}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-amber-700 bg-amber-50/30 border-r border-slate-100">
                          {countL}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-teal-700 bg-teal-50/30">
                          {countEL}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Excel file: Attendance_{getMonthName(selectedMonth)}_{selectedYear}.xlsx</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold text-xs text-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
