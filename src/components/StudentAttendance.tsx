import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import {
  getAttendanceForStudent,
  getAttendanceForStudentLocal,
} from '../services/attendanceService';
import { getDaysInMonth, getMonthName } from '../services/excelService';

interface StudentAttendanceProps {
  classId: string;
  studentId: string;
  studentName: string;
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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_STYLE: Record<
  AttendanceStatus,
  { label: string; code: string; cell: string; badge: string }
> = {
  present: {
    label: 'Present',
    code: 'P',
    cell: 'bg-green-100 text-green-800 border-green-200',
    badge: 'bg-green-50 text-green-700 border-green-200',
  },
  absent: {
    label: 'Absent',
    code: 'A',
    cell: 'bg-red-100 text-red-800 border-red-200',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  late: {
    label: 'Late',
    code: 'L',
    cell: 'bg-amber-100 text-amber-800 border-amber-200',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  early_left: {
    label: 'Early Left',
    code: 'EL',
    cell: 'bg-teal-100 text-teal-800 border-teal-200',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  leave: {
    label: 'Leave',
    code: 'LV',
    cell: 'bg-violet-100 text-violet-800 border-violet-200',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

function mondayOffset(year: number, month: number): number {
  const sundayIndex = new Date(year, month - 1, 1).getDay();
  return (sundayIndex + 6) % 7;
}

function formatJoinTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export const StudentAttendance: React.FC<StudentAttendanceProps> = ({
  classId,
  studentId,
  studentName,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState(() => getAttendanceForStudentLocal(studentId, classId));
  const [isLoading, setIsLoading] = useState(
    () => getAttendanceForStudentLocal(studentId, classId).length === 0
  );

  useEffect(() => {
    let isMounted = true;

    const load = async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      try {
        const data = await getAttendanceForStudent(studentId, classId);
        if (isMounted) setRecords(data);
      } catch (err) {
        console.error('Failed to load student attendance:', err);
        if (isMounted && !silent) setRecords(getAttendanceForStudentLocal(studentId, classId));
      } finally {
        if (isMounted && !silent) setIsLoading(false);
      }
    };

    const hasCache = getAttendanceForStudentLocal(studentId, classId).length > 0;
    void load(hasCache);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [studentId, classId]);

  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const startPad = mondayOffset(selectedYear, selectedMonth);
  const availableYears = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const monthRecords = useMemo(
    () => records.filter((rec) => rec.date && rec.date.startsWith(monthPrefix)),
    [records, monthPrefix]
  );

  const byDay = useMemo(() => {
    const map: Record<number, AttendanceRecord> = {};
    monthRecords.forEach((rec) => {
      const day = Number(rec.date.split('-')[2]);
      if (day) map[day] = rec;
    });
    return map;
  }, [monthRecords]);

  const present = monthRecords.filter((r) => r.status === 'present').length;
  const absent = monthRecords.filter((r) => r.status === 'absent').length;
  const late = monthRecords.filter((r) => r.status === 'late').length;
  const earlyLeft = monthRecords.filter((r) => r.status === 'early_left').length;
  const leave = monthRecords.filter((r) => r.status === 'leave').length;
  const marked = monthRecords.length;
  const attended = present + late + earlyLeft;
  const percent = marked > 0 ? Math.round((attended / marked) * 100) : null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading your attendance...</p>
      </div>
    );
  }

  return (
    <div id="student-attendance" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Attendance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your daily attendance for {studentName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            id="student-attendance-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.name}
              </option>
            ))}
          </select>
          <select
            id="student-attendance-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Present</p>
          <p className="text-xl font-bold text-green-700 mt-0.5">{present}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Absent</p>
          <p className="text-xl font-bold text-red-700 mt-0.5">{absent}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Late</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{late}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Early Left</p>
          <p className="text-xl font-bold text-teal-700 mt-0.5">{earlyLeft}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Leave</p>
          <p className="text-xl font-bold text-violet-700 mt-0.5">{leave}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Attended</p>
          <p className="text-xl font-bold text-indigo-700 mt-0.5">
            {percent === null ? '—' : `${percent}%`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">
            {getMonthName(selectedMonth)} {selectedYear}
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: startPad }).map((_, idx) => (
              <div key={`pad-${idx}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const rec = byDay[day];
              const style = rec ? STATUS_STYLE[rec.status] ?? null : null;
              return (
                <div
                  key={day}
                  title={style ? `${style.label}${rec?.status === 'late' && rec.joinTime ? ` · ${formatJoinTime(rec.joinTime)}` : ''}` : 'Not marked'}
                  className={`aspect-square rounded-lg border flex flex-col items-center justify-center ${
                    style ? style.cell : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}
                >
                  <span className="text-[11px] font-semibold leading-none">{day}</span>
                  <span className="text-[9px] font-bold mt-0.5">{style?.code || ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Marked days</h3>
        </div>
        {monthRecords.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-800">No attendance this month</p>
            <p className="text-xs text-slate-500 mt-1">
              Records appear here after your teacher or admin marks the day.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...monthRecords]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((rec) => {
                const style = STATUS_STYLE[rec.status];
                if (!style) return null;
                return (
                  <li key={rec.id || rec.date} className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-700">{formatDayLabel(rec.date)}</span>
                    <span className="flex items-center gap-2">
                      {rec.status === 'late' && rec.joinTime && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {formatJoinTime(rec.joinTime)}
                        </span>
                      )}
                      <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-semibold ${style.badge}`}>
                        {style.label}
                      </span>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
};
