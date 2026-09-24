import React, { useEffect, useMemo, useState } from 'react';
import type {
  AttendanceDayEntry,
  AttendanceFilter,
  AttendanceStatus,
  AttendanceSummary,
  Student,
} from '../types';
import { getAttendanceByDate, saveAttendanceForDate } from '../services/attendanceService';
import { SummaryCards } from './SummaryCards';
import { AttendanceTable } from './AttendanceTable';
import { MonthlyReportModal } from './MonthlyReportModal';

interface AdminAttendanceProps {
  students: Student[];
  isLoadingStudents: boolean;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function formatDateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateToDisplay(isoStr: string): string {
  try {
    const [y, m, d] = isoStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

function shiftDate(isoStr: string, days: number): string {
  const [y, m, d] = isoStr.split('-').map(Number);
  const next = new Date(y, m - 1, d);
  next.setDate(next.getDate() + days);
  return formatDateToISO(next);
}

function defaultJoinTime(dateStr: string, isToday: boolean): string {
  if (isToday) return new Date().toISOString();
  const local = new Date(`${dateStr}T09:00:00`);
  if (Number.isNaN(local.getTime())) return new Date().toISOString();
  return local.toISOString();
}

export const AdminAttendance: React.FC<AdminAttendanceProps> = ({
  students,
  isLoadingStudents,
  showToast,
}) => {
  const todayISO = useMemo(() => formatDateToISO(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceDayEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingRecords, setHasExistingRecords] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);

  const isToday = selectedDate === todayISO;
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const loadAttendance = async (dateStr: string) => {
    setIsLoading(true);
    try {
      const attData = await getAttendanceByDate(dateStr);
      setAttendanceMap(attData);
      setHasExistingRecords(Object.keys(attData).length > 0);
    } catch (err) {
      console.error('Failed to load attendance:', err);
      showToast('error', 'Failed to load attendance for this date.');
      setAttendanceMap({});
      setHasExistingRecords(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendance(selectedDate);
  }, [selectedDate]);

  const summary: AttendanceSummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let earlyLeft = 0;
    let leave = 0;

    students.forEach((s) => {
      const st = attendanceMap[s.id]?.status;
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'early_left') earlyLeft++;
      else if (st === 'leave') leave++;
    });

    const totalStudents = students.length;
    const marked = present + absent + late + earlyLeft + leave;
    const unmarked = Math.max(0, totalStudents - marked);

    return { totalStudents, present, absent, late, earlyLeft, leave, unmarked };
  }, [students, attendanceMap]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => {
      const previous = prev[studentId];
      const joinTime =
        status === 'late'
          ? previous?.status === 'late' && previous.joinTime
            ? previous.joinTime
            : defaultJoinTime(selectedDate, isToday)
          : undefined;

      return {
        ...prev,
        [studentId]: { status, joinTime },
      };
    });
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceDayEntry> = {};
    students.forEach((s) => {
      updated[s.id] = { status: 'present' };
    });
    setAttendanceMap(updated);
    showToast('success', 'Marked all students as Present.');
  };

  const handleClearAll = () => {
    setAttendanceMap({});
  };

  const handleSaveAttendance = async () => {
    const unmarkedStudents = students.filter((s) => !attendanceMap[s.id]);
    if (unmarkedStudents.length > 0) {
      showToast('error', 'Please mark attendance for all students before saving.');
      return;
    }

    try {
      setIsSaving(true);
      const recordsToSave = students.map((student) => ({
        student,
        status: attendanceMap[student.id].status,
        joinTime: attendanceMap[student.id].joinTime,
      }));

      await saveAttendanceForDate(selectedDate, recordsToSave);
      setHasExistingRecords(true);
      showToast(
        'success',
        isToday
          ? "Today's attendance saved successfully."
          : `Attendance for ${formatDateToDisplay(selectedDate)} saved.`
      );
    } catch (err) {
      console.error('Failed to save attendance:', err);
      showToast('error', 'Failed to save attendance. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="admin-attendance" className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pick any date</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Open a past day to correct attendance. Changes overwrite the saved record for that date.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-admin-att-yesterday"
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            >
              Previous day
            </button>
            <input
              id="admin-attendance-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              id="btn-admin-att-today"
              type="button"
              onClick={() => setSelectedDate(todayISO)}
              disabled={isToday}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer disabled:opacity-40"
            >
              Today
            </button>
            <button
              id="btn-admin-att-next"
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            >
              Next day
            </button>
          </div>
        </div>
      </div>

      <SummaryCards
        summary={summary}
        activeFilter={attendanceFilter}
        onFilterChange={setAttendanceFilter}
      />

      <AttendanceTable
        students={students}
        attendanceMap={attendanceMap}
        todayDisplay={formatDateToDisplay(selectedDate)}
        isLoading={isLoading || isLoadingStudents}
        isSaving={isSaving}
        hasExistingRecords={hasExistingRecords}
        statusFilter={attendanceFilter}
        onStatusFilterChange={setAttendanceFilter}
        onStatusChange={handleStatusChange}
        onMarkAllPresent={handleMarkAllPresent}
        onClearAll={handleClearAll}
        onSaveAttendance={handleSaveAttendance}
        onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
        title={isToday ? "Today's Attendance" : 'Edit Attendance'}
        existingRecordsHint="This day's records are already saved. You can still change them and update."
      />

      <MonthlyReportModal
        isOpen={isMonthlyReportOpen}
        onClose={() => setIsMonthlyReportOpen(false)}
        students={students}
        currentYear={selectedDateObj.getFullYear()}
        currentMonth={selectedDateObj.getMonth() + 1}
      />
    </div>
  );
};
