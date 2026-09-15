import { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { AttendanceTable } from './components/AttendanceTable';
import { MonthlyReportModal } from './components/MonthlyReportModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Login } from './components/Login';
import { TeacherGradebook } from './components/TeacherGradebook';
import { StudentGradebook } from './components/StudentGradebook';
import { StudentProfile } from './components/StudentProfile';
import { StudentTickets } from './components/StudentTickets';
import { StudentNotifications } from './components/StudentNotifications';
import { TeacherTickets } from './components/TeacherTickets';
import { fetchStudents } from './services/studentService';
import {
  getAttendanceByDate,
  saveAttendanceForDate,
} from './services/attendanceService';
import { getCurrentSession, logoutUser } from './services/teacherService';
import {
  fetchTickets,
  pendingTicketCount,
  unreadNotificationCount,
} from './services/ticketService';
import type {
  Student,
  AttendanceStatus,
  AttendanceSummary,
  UserSession,
  AttendanceDayEntry,
  AttendanceFilter,
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
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceDayEntry>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasExistingRecords, setHasExistingRecords] = useState<boolean>(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');

  // Teacher workspace: Gradebook or existing Attendance section
  const [teacherView, setTeacherView] = useState<'gradebook' | 'attendance' | 'tickets'>('gradebook');
  const [studentView, setStudentView] = useState<
    'gradebook' | 'tickets' | 'notifications' | 'profile'
  >('gradebook');
  const [pendingTickets, setPendingTickets] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

  const refreshTicketStats = async () => {
    if (!session) return;
    try {
      const tickets = await fetchTickets();
      if (session.role === 'teacher') {
        setPendingTickets(pendingTicketCount(tickets));
      }
      if (session.role === 'student' && session.studentId) {
        setUnreadNotifications(unreadNotificationCount(tickets, session.studentId));
      }
    } catch (err) {
      console.error('Failed to load ticket stats:', err);
    }
  };

  useEffect(() => {
    if (session && (session.role === 'teacher' || session.role === 'student')) {
      refreshTicketStats();
    }
  }, [session]);

  // Live Summary calculation for Teacher view
  const summary: AttendanceSummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let earlyLeft = 0;

    students.forEach((s) => {
      const st = attendanceMap[s.id]?.status;
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
    setAttendanceMap((prev) => {
      const previous = prev[studentId];
      const joinTime =
        status === 'late'
          ? previous?.status === 'late' && previous.joinTime
            ? previous.joinTime
            : new Date().toISOString()
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

  // 3. Student Role: View own marks, grouped by section
  if (session.role === 'student') {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col antialiased">
        <Header
          session={session}
          onLogout={handleLogout}
          todayDisplay={todayDisplay}
        />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div
            id="student-workspace-tabs"
            className="inline-flex flex-wrap p-1 bg-white border border-slate-200 rounded-xl shadow-xs"
          >
            <button
              id="tab-student-gradebook"
              type="button"
              onClick={() => setStudentView('gradebook')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'gradebook'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Gradebook
            </button>
            <button
              id="tab-student-tickets"
              type="button"
              onClick={() => setStudentView('tickets')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'tickets'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Tickets
            </button>
            <button
              id="tab-student-notifications"
              type="button"
              onClick={() => setStudentView('notifications')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'notifications'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Notifications
              {unreadNotifications > 0 && (
                <span className="min-w-[1.15rem] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                  {unreadNotifications}
                </span>
              )}
            </button>
            <button
              id="tab-student-profile"
              type="button"
              onClick={() => setStudentView('profile')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'profile'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Profile
            </button>
          </div>

          {!session.studentId ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Your student account could not be loaded. Please sign out and sign in again.
            </div>
          ) : studentView === 'profile' ? (
            <StudentProfile studentId={session.studentId} session={session} />
          ) : studentView === 'tickets' ? (
            <StudentTickets
              studentId={session.studentId}
              studentName={session.name}
              studentEmail={session.email}
              onTicketsChanged={refreshTicketStats}
            />
          ) : studentView === 'notifications' ? (
            <StudentNotifications
              studentId={session.studentId}
              onNotificationsSeen={() => setUnreadNotifications(0)}
            />
          ) : (
            <StudentGradebook studentId={session.studentId} studentName={session.name} />
          )}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          IT Lab Student Attendance Management System • Taleem-O-Hunar Society
        </footer>
      </div>
    );
  }

  // 4. Teacher Role: Gradebook + existing Attendance section
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
        todayDisplay={todayDisplay}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div
          id="teacher-workspace-tabs"
          className="inline-flex flex-wrap p-1 bg-white border border-slate-200 rounded-xl shadow-xs"
        >
          <button
            id="tab-gradebook"
            type="button"
            onClick={() => setTeacherView('gradebook')}
            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              teacherView === 'gradebook'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Gradebook
          </button>
          <button
            id="tab-attendance"
            type="button"
            onClick={() => setTeacherView('attendance')}
            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              teacherView === 'attendance'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Attendance
          </button>
          <button
            id="tab-tickets"
            type="button"
            onClick={() => setTeacherView('tickets')}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              teacherView === 'tickets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Tickets
            {pendingTickets > 0 && (
              <span className="min-w-[1.15rem] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                {pendingTickets}
              </span>
            )}
          </button>
        </div>

        {teacherView === 'gradebook' && (
          <section id="section-gradebook" aria-label="Teacher Gradebook">
            <TeacherGradebook students={students} showToast={showToast} />
          </section>
        )}

        {teacherView === 'tickets' && (
          <section id="section-tickets" aria-label="Teacher Tickets">
            <TeacherTickets
              session={session}
              showToast={showToast}
              onStatsChange={setPendingTickets}
            />
          </section>
        )}

        {teacherView === 'attendance' && (
          <>
            <section id="section-summary-cards" aria-label="Attendance Summary">
              <SummaryCards
                summary={summary}
                activeFilter={attendanceFilter}
                onFilterChange={setAttendanceFilter}
              />
            </section>

            <section id="section-attendance-table" aria-label="Daily Attendance Table">
              <AttendanceTable
                students={students}
                attendanceMap={attendanceMap}
                todayDisplay={todayDisplay}
                isLoading={isLoading}
                isSaving={isSaving}
                hasExistingRecords={hasExistingRecords}
                statusFilter={attendanceFilter}
                onStatusFilterChange={setAttendanceFilter}
                onStatusChange={handleStatusChange}
                onMarkAllPresent={handleMarkAllPresent}
                onClearAll={handleClearAll}
                onSaveAttendance={handleSaveAttendance}
                onOpenMonthlyReport={() => setIsMonthlyReportOpen(true)}
              />
            </section>
          </>
        )}
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
