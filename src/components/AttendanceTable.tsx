import React, { useMemo, useState } from 'react';
import {
  Search,
  Save,
  CheckCircle2,
  Check,
  RotateCcw,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import type { AttendanceDayEntry, AttendanceFilter, AttendanceStatus, Student } from '../types';

interface AttendanceTableProps {
  students: Student[];
  attendanceMap: Record<string, AttendanceDayEntry>;
  todayDisplay: string;
  isLoading: boolean;
  isSaving: boolean;
  hasExistingRecords: boolean;
  statusFilter: AttendanceFilter;
  onStatusFilterChange: (filter: AttendanceFilter) => void;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onMarkAllPresent: () => void;
  onClearAll: () => void;
  onSaveAttendance: () => Promise<void>;
  onOpenMonthlyReport: () => void;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    activeClasses: string;
    inactiveClasses: string;
  }
> = {
  present: {
    label: 'Present',
    activeClasses: 'bg-green-600 text-white font-semibold shadow-xs',
    inactiveClasses: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
  },
  absent: {
    label: 'Absent',
    activeClasses: 'bg-red-600 text-white font-semibold shadow-xs',
    inactiveClasses: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
  },
  late: {
    label: 'Late',
    activeClasses: 'bg-amber-600 text-white font-semibold shadow-xs',
    inactiveClasses: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
  },
  early_left: {
    label: 'Early Left',
    activeClasses: 'bg-teal-600 text-white font-semibold shadow-xs',
    inactiveClasses: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
  },
};

function formatJoinTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  students,
  attendanceMap,
  todayDisplay,
  isLoading,
  isSaving,
  hasExistingRecords,
  statusFilter,
  onStatusFilterChange,
  onStatusChange,
  onMarkAllPresent,
  onClearAll,
  onSaveAttendance,
  onOpenMonthlyReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const presentCount = students.filter((s) => attendanceMap[s.id]?.status === 'present').length;
  const lateCount = students.filter((s) => attendanceMap[s.id]?.status === 'late').length;

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'present') {
        return attendanceMap[student.id]?.status === 'present';
      }
      if (statusFilter === 'late') {
        return attendanceMap[student.id]?.status === 'late';
      }
      return true;
    });
  }, [students, searchTerm, statusFilter, attendanceMap]);

  const unmarkedCount = students.filter((s) => !attendanceMap[s.id]).length;

  const emptyTitle = (() => {
    if (searchTerm || statusFilter !== 'all') {
      if (statusFilter === 'present') return 'No present students';
      if (statusFilter === 'late') return 'No late students';
      return 'No matching students found';
    }
    return 'No students enrolled';
  })();

  const emptyHint = (() => {
    if (statusFilter === 'present') return 'Mark students as Present to see them in this filter.';
    if (statusFilter === 'late') return 'Mark students as Late to see them in this filter.';
    if (searchTerm) return 'Try searching with another name or email';
    return 'Please contact the administrator to register students in the system.';
  })();

  const filters: { id: AttendanceFilter; label: string; count: number; activeClasses: string }[] = [
    {
      id: 'all',
      label: 'All',
      count: students.length,
      activeClasses: 'bg-slate-800 text-white border-slate-800',
    },
    {
      id: 'present',
      label: 'Present',
      count: presentCount,
      activeClasses: 'bg-green-600 text-white border-green-600',
    },
    {
      id: 'late',
      label: 'Late',
      count: lateCount,
      activeClasses: 'bg-amber-600 text-white border-amber-600',
    },
  ];

  return (
    <div id="attendance-table-container" className="space-y-4">
      {/* Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Today's Attendance
              </h2>
              <p className="text-xs text-slate-500">
                {todayDisplay}
              </p>
            </div>
            <button
              id="btn-open-monthly-register"
              type="button"
              onClick={onOpenMonthlyReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Monthly Register</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-students-input"
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              id="btn-mark-all-present"
              type="button"
              onClick={onMarkAllPresent}
              disabled={students.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Mark all students as Present"
            >
              <Check className="w-3.5 h-3.5" />
              <span>All Present</span>
            </button>

            <button
              id="btn-clear-all-attendance"
              type="button"
              onClick={onClearAll}
              disabled={students.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Reset all status selections"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        <div
          id="attendance-status-filters"
          className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Filter
          </span>
          {filters.map((filter) => {
            const isActive = statusFilter === filter.id;
            return (
              <button
                key={filter.id}
                id={`filter-attendance-${filter.id}`}
                type="button"
                onClick={() => onStatusFilterChange(filter.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  isActive
                    ? filter.activeClasses
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`min-w-[1.25rem] text-center rounded-md px-1 text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Student Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div id="table-loading-state" className="p-12 text-center text-slate-500">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium text-slate-500">Loading student roster...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div id="table-empty-state" className="p-12 text-center text-slate-500">
            <p className="text-sm font-semibold text-slate-700 mb-1">{emptyTitle}</p>
            <p className="text-xs text-slate-400">{emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table id="students-attendance-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th scope="col" className="py-3 px-4 w-12 text-center font-mono">
                    #
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Student
                  </th>
                  <th scope="col" className="py-3 px-4 hidden md:table-cell">
                    Email
                  </th>
                  <th scope="col" className="py-3 px-4 text-center">
                    Status
                  </th>
                  <th scope="col" className="py-3 px-4 text-center whitespace-nowrap">
                    Join Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((student, index) => {
                  const entry = attendanceMap[student.id];
                  const currentStatus = entry?.status;
                  const joinTimeLabel = currentStatus === 'late' ? formatJoinTime(entry?.joinTime) : '';

                  return (
                    <tr
                      key={student.id}
                      id={`student-row-${student.id}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{student.name}</div>
                        <div className="text-slate-400 md:hidden text-[11px]">{student.email}</div>
                      </td>

                      <td className="py-3 px-4 hidden md:table-cell text-slate-500">
                        {student.email}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div
                          id={`attendance-options-${student.id}`}
                          className="inline-flex items-center p-1 bg-slate-100 rounded-lg gap-1"
                        >
                          {(['present', 'absent', 'late', 'early_left'] as AttendanceStatus[]).map(
                            (statusKey) => {
                              const config = STATUS_CONFIG[statusKey];
                              const isSelected = currentStatus === statusKey;

                              return (
                                <button
                                  key={statusKey}
                                  id={`btn-${statusKey}-${student.id}`}
                                  type="button"
                                  onClick={() => onStatusChange(student.id, statusKey)}
                                  className={`px-3 py-1 rounded-md text-xs transition-all cursor-pointer ${
                                    isSelected
                                      ? config.activeClasses
                                      : config.inactiveClasses
                                  }`}
                                  title={`Mark ${student.name} as ${config.label}`}
                                >
                                  {config.label}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {joinTimeLabel ? (
                          <span
                            id={`join-time-${student.id}`}
                            className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded-md border border-amber-200"
                          >
                            <Clock className="w-3 h-3" />
                            {joinTimeLabel}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {students.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              {unmarkedCount > 0 ? (
                <span className="text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  {unmarkedCount} remaining to mark
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-md border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All students marked
                </span>
              )}
              {hasExistingRecords && (
                <span className="text-slate-400 text-xs hidden sm:inline">
                  (Today's records already saved. Click below to update.)
                </span>
              )}
            </div>

            <button
              id="btn-save-attendance"
              type="button"
              disabled={isSaving || students.length === 0}
              onClick={onSaveAttendance}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : hasExistingRecords
                  ? 'Update Attendance'
                  : 'Save Attendance'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
