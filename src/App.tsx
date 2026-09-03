import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { AttendanceTable } from './components/AttendanceTable';
import { MonthlyReportModal } from './components/MonthlyReportModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Login } from './components/Login';
import { fetchStudents } from './services/studentService';
import {
  getAttendanceByDate,
  saveAttendanceForDate,
} from './services/attendanceService';
import { getCurrentSession, logoutUser } from './services/teacherService';
import type {
  Student,
  AttendanceStatus,
  AttendanceSummary,
  UserSession,
} from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

export default function App() {
  // Session State
  const [session, setSession] = useState<UserSession | null>(() => getCurrentSession());

  // Today's date (teacher can only mark attendance of current day)
  const todayISO = useMemo(() => formatDateToISO(new Date()), []);

  // Data states for Teacher Attendance
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasExistingRecords, setHasExistingRecords] = useState<boolean>(false);

  // Modals state for Teacher
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Load students for Teacher attendance roster
  const loadStudentsList = async () => {
    try {
      const data = await fetchStudents();
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
      showToast('error', 'Failed to load students roster.');
    }
  };

  // Load attendance for current day (today)
  const loadAttendanceForToday = async () => {
    setIsLoading(true);
    try {
      const attData = await getAttendanceByDate(todayISO);
      setAttendanceMap(attData);
      setHasExistingRecords(Object.keys(attData).length > 0);
    } catch (err) {
      console.error('Failed to load attendance:', err);
      showToast('error', "Failed to load today's attendance.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session && session.role === 'teacher') {
      loadStudentsList();
      loadAttendanceForToday();
    }
  }, [session]);

  // Live Summary calculation for Teacher view
  const summary: AttendanceSummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let earlyLeft = 0;

    students.forEach((s) => {
      const st = attendanceMap[s.id];
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'early_left') earlyLeft++;
    });

    const totalStudents = students.length;
    const marked = present + absent + late + earlyLeft;
    const unmarked = Math.max(0, totalStudents - marked);

    return { totalStudents, present, absent, late, earlyLeft, unmarked };
  }, [students, attendanceMap]);

  // Teacher Attendance Actions
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = { ...attendanceMap };
    students.forEach((s) => {
      updated[s.id] = 'present';
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
        status: attendanceMap[student.id],
      }));

      await saveAttendanceForDate(todayISO, recordsToSave);
      setHasExistingRecords(true);
      showToast('success', "Today's attendance saved successfully.");
    } catch (err) {
      console.error('Failed to save attendance:', err);
      showToast('error', 'Failed to save attendance. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setSession(null);
  };

  // 1. Not Authenticated: Show Login page
  if (!session) {
    return <Login onLoginSuccess={(sess) => setSession(sess)} />;
  }

  const todayDisplay = formatDateToDisplay(todayISO);
  const currentDateObj = new Date();

  // 2. Admin Role: Show Admin Dashboard ONLY (No attendance, just Student & Teacher management)
  if (session.role === 'admin') {
    return (
      <AdminDashboard
        session={session}
        onLogout={handleLogout}
        todayDisplay={todayDisplay}
      />
    );
  }

  // 3. Teacher Role: Show Daily Attendance Dashboard (Students registered by admin are shown; cannot add/delete students)
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col antialiased">
      {/* Toast Notification */}
      {toast && (
        <div
          id="toast-notification"
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg border flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-red-700 text-white border-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-200 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <Header
        session={session}
        onLogout={handleLogout}
        onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
        todayDisplay={todayDisplay}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Today's Attendance Summary Cards */}
        <section id="section-summary-cards" aria-label="Attendance Summary">
          <SummaryCards summary={summary} />
        </section>

        {/* Attendance Marking Table */}
        <section id="section-attendance-table" aria-label="Daily Attendance Table">
          <AttendanceTable
            students={students}
            attendanceMap={attendanceMap}
            todayDisplay={todayDisplay}
            isLoading={isLoading}
            isSaving={isSaving}
            hasExistingRecords={hasExistingRecords}
            onStatusChange={handleStatusChange}
            onMarkAllPresent={handleMarkAllPresent}
            onClearAll={handleClearAll}
            onSaveAttendance={handleSaveAttendance}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        IT Lab Student Attendance Management System • Taleem-O-Hunar Society
      </footer>

      {/* Monthly Report Register Modal */}
      <MonthlyReportModal
        isOpen={isMonthlyReportOpen}
        onClose={() => setIsMonthlyReportOpen(false)}
        students={students}
        currentYear={currentDateObj.getFullYear()}
        currentMonth={currentDateObj.getMonth() + 1}
      />
    </div>
  );
}
