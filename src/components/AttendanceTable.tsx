import React, { useState } from 'react';
import {
  Search,
  Save,
  CheckCircle2,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { Student, AttendanceStatus } from '../types';

interface AttendanceTableProps {
  students: Student[];
  attendanceMap: Record<string, AttendanceStatus>;
  todayDisplay: string;
  isLoading: boolean;
  isSaving: boolean;
  hasExistingRecords: boolean;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
  onMarkAllPresent: () => void;
  onClearAll: () => void;
  onSaveAttendance: () => Promise<void>;
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

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  students,
  attendanceMap,
  todayDisplay,
  isLoading,
  isSaving,
  hasExistingRecords,
  onStatusChange,
  onMarkAllPresent,
  onClearAll,
  onSaveAttendance,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter students by name or email
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unmarkedCount = students.filter((s) => !attendanceMap[s.id]).length;

  return (
    <div id="attendance-table-container" className="space-y-4">
      {/* Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Today info - NO calendar option as teacher only marks current day */}
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Today's Attendance
            </h2>
            <p className="text-xs text-slate-500">
              {todayDisplay}
            </p>
          </div>

          {/* Search + Quick Actions */}
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
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {searchTerm ? 'No matching students found' : 'No students enrolled'}
            </p>
            <p className="text-xs text-slate-400">
              {searchTerm
                ? 'Try searching with another name or email'
                : 'Please contact the administrator to register students in the system.'}
            </p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((student, index) => {
                  const currentStatus = attendanceMap[student.id];

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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Bar: Validation Indicator and Save Button */}
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
