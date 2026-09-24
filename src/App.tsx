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
import { TeacherProfile } from './components/TeacherProfile';
import { StudentTickets } from './components/StudentTickets';
import { StudentNotifications } from './components/StudentNotifications';
import { TeacherTickets } from './components/TeacherTickets';
import { TeacherAssignments } from './components/TeacherAssignments';
import { StudentAssignments } from './components/StudentAssignments';
import { TeacherAnnouncements } from './components/TeacherAnnouncements';
import { StudentAnnouncements } from './components/StudentAnnouncements';
import { StudentAttendance } from './components/StudentAttendance';
import { CoursePicker } from './components/CoursePicker';
import { fetchStudents } from './services/studentService';
import { fetchTeachers } from './services/teacherService';
import {
  fetchClassesForStudent,
  fetchClassesForTeacher,
  filterStudentsByClass,
} from './services/classService';
import {
  getAttendanceByDate,
  saveAttendanceForDate,
} from './services/attendanceService';
import { getCurrentSession, logoutUser, saveSession } from './services/teacherService';
import {
  fetchTickets,
  pendingTicketCount,
  unreadNotificationCount,
  subscribeTicketUpdates,
} from './services/ticketService';
import type {
  Student,
  AttendanceStatus,
  AttendanceSummary,
  UserSession,
  AttendanceDayEntry,
  AttendanceFilter,
  LabClass,
} from './types';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [teacherView, setTeacherView] = useState<
    'gradebook' | 'assignments' | 'attendance' | 'tickets' | 'announcements' | 'profile'
  >('announcements');
  const [studentView, setStudentView] = useState<
    | 'gradebook'
    | 'assignments'
    | 'attendance'
    | 'tickets'
    | 'notifications'
    | 'announcements'
    | 'profile'
  >('announcements');
  const [pendingTickets, setPendingTickets] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [myClasses, setMyClasses] = useState<LabClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [teacherId, setTeacherId] = useState<string | undefined>(session?.teacherId);

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
  const loadAttendanceForToday = async (classId: string) => {
    setIsLoading(true);
    try {
      const attData = await getAttendanceByDate(todayISO, classId);
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
    if (!session || session.role !== 'teacher') return;
    if (session.teacherId) {
      setTeacherId(session.teacherId);
      return;
    }
    void fetchTeachers().then((list) => {
      const matched = list.find((teacher) => teacher.email === session.email);
      if (matched) setTeacherId(matched.id);
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setSelectedClassId(null);
    setMyClasses([]);
    if (session.role === 'teacher' && teacherId) {
      setClassesLoading(true);
      void fetchClassesForTeacher(teacherId)
        .then(setMyClasses)
        .finally(() => setClassesLoading(false));
    }
    if (session.role === 'student' && session.studentId) {
      setClassesLoading(true);
      void fetchClassesForStudent(session.studentId)
        .then(setMyClasses)
        .finally(() => setClassesLoading(false));
    }
  }, [session, teacherId]);

  useEffect(() => {
    if (session?.role === 'teacher' && selectedClassId) {
      void loadStudentsList();
      void loadAttendanceForToday(selectedClassId);
    }
  }, [session, selectedClassId]);

  const selectedClass = useMemo(
    () => myClasses.find((item) => item.id === selectedClassId) || null,
    [myClasses, selectedClassId]
  );

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return filterStudentsByClass(students, selectedClass);
  }, [students, selectedClass]);

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
    if (!session || (session.role !== 'teacher' && session.role !== 'student')) {
      return;
    }
    void refreshTicketStats();
    return subscribeTicketUpdates(() => {
      void refreshTicketStats();
    });
  }, [session]);

  // Live Summary calculation for Teacher view
  const summary: AttendanceSummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let earlyLeft = 0;
    let leave = 0;

    classStudents.forEach((s) => {
      const st = attendanceMap[s.id]?.status;
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'early_left') earlyLeft++;
      else if (st === 'leave') leave++;
    });

    const totalStudents = classStudents.length;
    const marked = present + absent + late + earlyLeft + leave;
    const unmarked = Math.max(0, totalStudents - marked);

    return { totalStudents, present, absent, late, earlyLeft, leave, unmarked };
  }, [classStudents, attendanceMap]);

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
    classStudents.forEach((s) => {
      updated[s.id] = { status: 'present' };
    });
    setAttendanceMap(updated);
    showToast('success', 'Marked all students as Present.');
  };

  const handleClearAll = () => {
    setAttendanceMap({});
  };

  const handleSaveAttendance = async () => {
    if (!selectedClassId) return;

    const unmarkedStudents = classStudents.filter((s) => !attendanceMap[s.id]);
    if (unmarkedStudents.length > 0) {
      showToast('error', 'Please mark attendance for all students before saving.');
      return;
    }

    try {
      setIsSaving(true);
      const recordsToSave = classStudents.map((student) => ({
        student,
        status: attendanceMap[student.id].status,
        joinTime: attendanceMap[student.id].joinTime,
      }));

      await saveAttendanceForDate(todayISO, recordsToSave, selectedClassId);
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
    setSelectedClassId(null);
    setMyClasses([]);
  };

  const handleOpenNotifications = () => {
    if (!selectedClassId) {
      showToast('error', 'Select a course first to view notifications.');
      return;
    }
    setStudentView('notifications');
  };

  const handleGoHome = () => {
    setSelectedClassId(null);
    if (session?.role === 'student') {
      setStudentView('announcements');
    }
    if (session?.role === 'teacher') {
      setTeacherView('announcements');
    }
  };

  // 1. Not Authenticated: Show Login page
  if (!session) {
    return <Login onLoginSuccess={(sess) => setSession(sess)} />;
  }

  const todayDisplay = formatDateToDisplay(todayISO);
  const currentDateObj = new Date();

  // 2. Admin Role: Show Admin Dashboard (students, teachers, tickets)
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
          onGoHome={handleGoHome}
          todayDisplay={todayDisplay}
          onOpenProfile={() => setStudentView('profile')}
          onOpenNotifications={handleOpenNotifications}
          isProfileActive={studentView === 'profile'}
          isNotificationsActive={studentView === 'notifications'}
          unreadNotifications={unreadNotifications}
        />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {!selectedClassId && studentView !== 'profile' ? (
            <CoursePicker
              classes={myClasses}
              roleLabel="student"
              isLoading={classesLoading}
              onSelect={(classId) => {
                setSelectedClassId(classId);
                setStudentView('announcements');
              }}
            />
          ) : (
            <>
          {selectedClassId && studentView !== 'profile' && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId(null);
                  setStudentView('announcements');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All Courses
              </button>
              <span className="text-xs font-bold text-slate-800">{selectedClass?.name}</span>
            </div>
          )}

          {selectedClassId && studentView !== 'profile' && (
          <div
            id="student-workspace-tabs"
            className="inline-flex flex-wrap p-1 bg-white border border-slate-200 rounded-xl shadow-xs"
          >
            <button
              id="tab-student-announcements"
              type="button"
              onClick={() => setStudentView('announcements')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'announcements'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Announcements
            </button>
            <button
              id="tab-student-assignments"
              type="button"
              onClick={() => setStudentView('assignments')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'assignments'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Submission
            </button>
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
              id="tab-student-attendance"
              type="button"
              onClick={() => setStudentView('attendance')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                studentView === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Attendance
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
          </div>
          )}

          {!session.studentId ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Your student account could not be loaded. Please sign out and sign in again.
            </div>
          ) : selectedClassId ? (
            <>
              <div className={studentView === 'gradebook' ? '' : 'hidden'}>
                <StudentGradebook
                  classId={selectedClassId}
                  studentId={session.studentId}
                  studentName={session.name}
                />
              </div>
              <div className={studentView === 'assignments' ? '' : 'hidden'}>
                <StudentAssignments
                  classId={selectedClassId}
                  studentId={session.studentId}
                  studentName={session.name}
                  studentEmail={session.email}
                />
              </div>
              <div className={studentView === 'attendance' ? '' : 'hidden'}>
                <StudentAttendance
                  classId={selectedClassId}
                  studentId={session.studentId}
                  studentName={session.name}
                />
              </div>
              <div className={studentView === 'announcements' ? '' : 'hidden'}>
                <StudentAnnouncements classId={selectedClassId} />
              </div>
              <div className={studentView === 'tickets' ? '' : 'hidden'}>
                <StudentTickets
                  classId={selectedClassId}
                  studentId={session.studentId}
                  studentName={session.name}
                  studentEmail={session.email}
                  onTicketsChanged={refreshTicketStats}
                />
              </div>
              <div className={studentView === 'notifications' ? '' : 'hidden'}>
                <StudentNotifications
                  classId={selectedClassId}
                  studentId={session.studentId}
                  onNotificationsSeen={() => setUnreadNotifications(0)}
                />
              </div>
            </>
          ) : studentView === 'profile' ? (
            <StudentProfile studentId={session.studentId} session={session} />
          ) : null}
            </>
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
        onGoHome={handleGoHome}
        todayDisplay={todayDisplay}
        onOpenProfile={() =>
          setTeacherView((prev) => (prev === 'profile' ? 'announcements' : 'profile'))
        }
        isProfileActive={teacherView === 'profile'}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {teacherView === 'profile' && teacherId ? (
          <TeacherProfile
            teacherId={teacherId}
            session={session}
            showToast={showToast}
            onSessionUpdated={(updated) => {
              saveSession(updated);
              setSession(updated);
            }}
          />
        ) : !selectedClassId ? (
          <CoursePicker
            classes={myClasses}
            roleLabel="teacher"
            isLoading={classesLoading}
            onSelect={(classId) => {
              setSelectedClassId(classId);
              setTeacherView('announcements');
            }}
          />
        ) : (
          <>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedClassId(null);
              setTeacherView('announcements');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Courses
          </button>
          <span className="text-xs font-bold text-slate-800">{selectedClass?.name}</span>
        </div>

        <div
          id="teacher-workspace-tabs"
          className="inline-flex flex-wrap p-1 bg-white border border-slate-200 rounded-xl shadow-xs"
        >
          <button
            id="tab-announcements"
            type="button"
            onClick={() => setTeacherView('announcements')}
            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              teacherView === 'announcements'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Announcements
          </button>
          <button
            id="tab-assignments"
            type="button"
            onClick={() => setTeacherView('assignments')}
            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              teacherView === 'assignments'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Submission
          </button>
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
            <TeacherGradebook
              classId={selectedClassId}
              className={selectedClass?.name || 'Course'}
              teacherName={session.name}
              students={classStudents}
              showToast={showToast}
            />
          </section>
        )}

        {teacherView === 'assignments' && (
          <section id="section-assignments" aria-label="Teacher Submissions">
            <TeacherAssignments
              classId={selectedClassId}
              session={session}
              showToast={showToast}
            />
          </section>
        )}

        {teacherView === 'announcements' && (
          <section id="section-announcements" aria-label="Teacher Announcements">
            <TeacherAnnouncements
              classId={selectedClassId}
              session={session}
              showToast={showToast}
            />
          </section>
        )}

        {teacherView === 'tickets' && (
          <section id="section-tickets" aria-label="Teacher Tickets">
            <TeacherTickets
              classId={selectedClassId}
              classStudentIds={selectedClass?.studentIds}
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
                students={classStudents}
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
        students={classStudents}
        currentYear={currentDateObj.getFullYear()}
        currentMonth={currentDateObj.getMonth() + 1}
      />
    </div>
  );
}
