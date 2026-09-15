import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Trash2,
  Users,
  Search,
  Eye,
  EyeOff,
  LogOut,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  Pencil,
  KeyRound,
  Plus,
  X,
  Ticket as TicketIcon,
} from 'lucide-react';
import {
  fetchStudents,
  addStudent,
  deleteStudent,
  updateStudentPassword,
} from '../services/studentService';
import {
  fetchTeachers,
  addTeacher,
  deleteTeacher,
  updateTeacher,
} from '../services/teacherService';
import { fetchTickets, pendingTicketCount } from '../services/ticketService';
import { TeacherTickets } from './TeacherTickets';
import type { Student, Teacher, UserSession } from '../types';

interface AdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
  todayDisplay: string;
}

type AdminViewMode = 'overview' | 'students' | 'teachers' | 'tickets';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onLogout,
  todayDisplay,
}) => {
  const [viewMode, setViewMode] = useState<AdminViewMode>('overview');

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
  const [pendingTickets, setPendingTickets] = useState(0);

  // Search states
  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');

  // Password visibility map
  const [visiblePasswordMap, setVisiblePasswordMap] = useState<Record<string, boolean>>({});

  // Student Modals: Add, Edit, Delete
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentContact, setStudentContact] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [showEditStudentPassword, setShowEditStudentPassword] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Teacher Modals: Add, Edit, Delete
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [isSubmittingTeacher, setIsSubmittingTeacher] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherPassword, setEditTeacherPassword] = useState('');
  const [showEditTeacherPassword, setShowEditTeacherPassword] = useState(false);
  const [isUpdatingTeacher, setIsUpdatingTeacher] = useState(false);
  const [editTeacherError, setEditTeacherError] = useState<string | null>(null);

  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Load initial data from Firestore / local storage
  const loadData = async () => {
    try {
      setIsLoadingStudents(true);
      const studentList = await fetchStudents();
      setStudents(studentList);
    } catch (err) {
      console.error('Failed to load students:', err);
      showToast('error', 'Failed to load students.');
    } finally {
      setIsLoadingStudents(false);
    }

    try {
      setIsLoadingTeachers(true);
      const teacherList = await fetchTeachers();
      setTeachers(teacherList);
    } catch (err) {
      console.error('Failed to load teachers:', err);
      showToast('error', 'Failed to load teachers.');
    } finally {
      setIsLoadingTeachers(false);
    }

    try {
      const tickets = await fetchTickets();
      setPendingTickets(pendingTicketCount(tickets));
    } catch (err) {
      console.error('Failed to load tickets:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Student Actions ---

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError(null);

    const name = studentName.trim();
    const email = studentEmail.trim().toLowerCase();
    const password = studentPassword.trim();

    if (!name || !email || !password) {
      setStudentError('Please fill in name, email, and password.');
      return;
    }

    if (password.length < 4) {
      setStudentError('Password must be at least 4 characters.');
      return;
    }

    if (students.some((s) => s.email.toLowerCase() === email)) {
      setStudentError('A student with this email address already exists.');
      return;
    }

    try {
      setIsSubmittingStudent(true);
      const newStudent = await addStudent(name, email, password, studentContact.trim());
      setStudents((prev) => {
        const next = [...prev, newStudent];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setStudentName('');
      setStudentEmail('');
      setStudentContact('');
      setStudentPassword('');
      setIsAddStudentModalOpen(false);
      showToast('success', `Student "${name}" successfully added.`);
    } catch {
      setStudentError('Failed to add student. Please try again.');
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleOpenEditStudent = (student: Student) => {
    setStudentToEdit(student);
    setEditStudentPassword('');
    setEditStudentError(null);
    setShowEditStudentPassword(false);
  };

  const handleUpdateStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEdit) return;
    setEditStudentError(null);

    const password = editStudentPassword.trim();

    if (!password) {
      setEditStudentError('Please enter a new password.');
      return;
    }

    if (password.length < 4) {
      setEditStudentError('Password must be at least 4 characters.');
      return;
    }

    try {
      setIsUpdatingStudent(true);
      const updated = await updateStudentPassword(studentToEdit.id, password);
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setStudentToEdit(null);
      showToast('success', `Password reset for "${updated.name}".`);
    } catch {
      setEditStudentError('Failed to reset password. Please try again.');
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      await deleteStudent(studentToDelete.id);
      setStudents((prev) => prev.filter((s) => s.id !== studentToDelete.id));
      showToast('success', `Student "${studentToDelete.name}" removed.`);
    } catch {
      showToast('error', 'Failed to delete student.');
    } finally {
      setStudentToDelete(null);
    }
  };

  // --- Teacher Actions ---

  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);

    const name = teacherName.trim();
    const email = teacherEmail.trim().toLowerCase();
    const password = teacherPassword.trim();

    if (!name || !email || !password) {
      setTeacherError('Please fill in name, email, and password.');
      return;
    }

    if (password.length < 4) {
      setTeacherError('Password must be at least 4 characters.');
      return;
    }

    if (teachers.some((t) => t.email.toLowerCase() === email)) {
      setTeacherError('A teacher with this email already exists.');
      return;
    }

    try {
      setIsSubmittingTeacher(true);
      const newTeacher = await addTeacher(name, email, password);
      setTeachers((prev) => [...prev, newTeacher]);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setIsAddTeacherModalOpen(false);
      showToast('success', `Teacher "${name}" added successfully.`);
    } catch {
      setTeacherError('Failed to add teacher. Please try again.');
    } finally {
      setIsSubmittingTeacher(false);
    }
  };

  const handleOpenEditTeacher = (teacher: Teacher) => {
    setTeacherToEdit(teacher);
    setEditTeacherName(teacher.name);
    setEditTeacherEmail(teacher.email);
    setEditTeacherPassword(teacher.password);
    setEditTeacherError(null);
    setShowEditTeacherPassword(false);
  };

  const handleUpdateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherToEdit) return;
    setEditTeacherError(null);

    const name = editTeacherName.trim();
    const email = editTeacherEmail.trim().toLowerCase();
    const password = editTeacherPassword.trim();

    if (!name || !email || !password) {
      setEditTeacherError('Please fill in name, email, and password.');
      return;
    }

    if (password.length < 4) {
      setEditTeacherError('Password must be at least 4 characters.');
      return;
    }

    if (teachers.some((t) => t.id !== teacherToEdit.id && t.email.toLowerCase() === email)) {
      setEditTeacherError('Another teacher with this email already exists.');
      return;
    }

    try {
      setIsUpdatingTeacher(true);
      const updated = await updateTeacher(teacherToEdit.id, name, email, password);
      setTeachers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setTeacherToEdit(null);
      showToast('success', `Teacher "${name}" updated successfully.`);
    } catch {
      setEditTeacherError('Failed to update teacher. Please try again.');
    } finally {
      setIsUpdatingTeacher(false);
    }
  };

  const handleConfirmDeleteTeacher = async () => {
    if (!teacherToDelete) return;
    try {
      await deleteTeacher(teacherToDelete.id);
      setTeachers((prev) => prev.filter((t) => t.id !== teacherToDelete.id));
      showToast('success', `Teacher "${teacherToDelete.name}" removed.`);
    } catch {
      showToast('error', 'Failed to delete teacher.');
    } finally {
      setTeacherToDelete(null);
    }
  };

  const togglePasswordVisibility = (teacherId: string) => {
    setVisiblePasswordMap((prev) => ({
      ...prev,
      [teacherId]: !prev[teacherId],
    }));
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.contact || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      t.email.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const displayName = session.name || 'Admin';
  const initial = (displayName.charAt(0) || 'A').toUpperCase();

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

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-slate-200 p-1 bg-white shadow-xs flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>IT Lab Attendance</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                  Admin
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Taleem-O-Hunar Society
              </p>
            </div>
          </div>

          {/* Right: Today Date, Profile, Logout */}
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-xs text-slate-500 font-medium hidden md:inline">
              {todayDisplay}
            </span>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Admin Profile */}
            <div
              id="admin-profile-icon"
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {initial}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Administrator</p>
              </div>
            </div>

            <button
              id="btn-admin-logout"
              type="button"
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* VIEW 1: OVERVIEW WITH TWO MAIN CARDS */}
        {viewMode === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Page Header */}
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Administration Console
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage students, teachers, and student tickets.
              </p>
            </div>

            {/* PRIMARY CARDS: STUDENTS, TEACHERS, TICKETS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Students */}
              <div
                id="card-open-students"
                onClick={() => setViewMode('students')}
                className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {students.length} Enrolled
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Students
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Manage student admissions. Open this card to add new students, update existing student names or emails, and delete records.
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                  <span>Open Students Management</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 2: Teachers */}
              <div
                id="card-open-teachers"
                onClick={() => setViewMode('teachers')}
                className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {teachers.length} Instructors
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    Teachers
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Manage instructor login accounts. Open this card to register new teachers, update login credentials, and remove faculty access.
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
                  <span>Open Teachers Management</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 3: Tickets */}
              <div
                id="card-open-tickets"
                onClick={() => setViewMode('tickets')}
                className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
                      <TicketIcon className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                      {pendingTickets} Open
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                    Tickets
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Review student issues and update status. Students are notified when a ticket is approved, in progress, or resolved.
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-600 group-hover:text-amber-700">
                  <span>Open Ticket Inbox</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: STUDENTS MANAGEMENT SCREEN */}
        {viewMode === 'students' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Navigation & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Overview</span>
                </button>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Admin</span>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-slate-800">Students Management</span>
                </div>
              </div>

              {/* Quick Tab Switcher */}
              <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Overview
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-xs font-semibold bg-white text-indigo-700 rounded-md shadow-xs cursor-default"
                >
                  Students ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('teachers')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Teachers ({teachers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('tickets')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Tickets ({pendingTickets})
                </button>
              </div>
            </div>

            {/* Students Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header Bar with Add Button and Search */}
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Students Directory</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {students.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add new admissions, reset a student password, or remove entries.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    id="btn-open-add-student-modal"
                    type="button"
                    onClick={() => {
                      setStudentName('');
                      setStudentEmail('');
                      setStudentContact('');
                      setStudentPassword('');
                      setShowStudentPassword(false);
                      setStudentError(null);
                      setIsAddStudentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Student</span>
                  </button>
                </div>
              </div>

              {/* Table List */}
              {isLoadingStudents ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Loading students from database...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    {studentSearch ? 'No students match your search criteria.' : 'No students found.'}
                  </p>
                  {!studentSearch && (
                    <button
                      type="button"
                      onClick={() => setIsAddStudentModalOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add your first student</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4">Password</th>
                        <th className="py-3 px-4">Added Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((student, idx) => (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center font-medium text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {student.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                            {student.email}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {student.contact || '—'}
                          </td>
                          <td className="py-3 px-4">
                            {student.password ? (
                              <div className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 font-mono text-xs">
                                <span>{visiblePasswordMap[student.id] ? student.password : '••••••••'}</span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(student.id)}
                                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                  title={visiblePasswordMap[student.id] ? 'Hide password' : 'Show password'}
                                >
                                  {visiblePasswordMap[student.id] ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-amber-700 text-[11px] font-medium">Not set</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Reset password */}
                              <button
                                id={`btn-edit-student-${student.id}`}
                                type="button"
                                onClick={() => handleOpenEditStudent(student)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title={`Reset password for ${student.name}`}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                id={`btn-delete-student-${student.id}`}
                                type="button"
                                onClick={() => setStudentToDelete(student)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title={`Delete ${student.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: TEACHERS MANAGEMENT SCREEN */}
        {viewMode === 'teachers' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Navigation & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Overview</span>
                </button>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Admin</span>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-slate-800">Teachers Management</span>
                </div>
              </div>

              {/* Quick Tab Switcher */}
              <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('students')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Students ({students.length})
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-xs font-semibold bg-white text-emerald-700 rounded-md shadow-xs cursor-default"
                >
                  Teachers ({teachers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('tickets')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Tickets ({pendingTickets})
                </button>
              </div>
            </div>

            {/* Teachers Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header Bar with Add Button and Search */}
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Instructors & Faculty</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {teachers.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register instructor accounts, update passwords, or delete access.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search teachers..."
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    id="btn-open-add-teacher-modal"
                    type="button"
                    onClick={() => {
                      setTeacherName('');
                      setTeacherEmail('');
                      setTeacherPassword('');
                      setShowTeacherPassword(false);
                      setTeacherError(null);
                      setIsAddTeacherModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Teacher</span>
                  </button>
                </div>
              </div>

              {/* Table List */}
              {isLoadingTeachers ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Loading instructors from database...
                </div>
              ) : filteredTeachers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    {teacherSearch ? 'No teachers match your search criteria.' : 'No teachers registered.'}
                  </p>
                  {!teacherSearch && (
                    <button
                      type="button"
                      onClick={() => setIsAddTeacherModalOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register first teacher</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Instructor Name</th>
                        <th className="py-3 px-4">Email Login</th>
                        <th className="py-3 px-4">Password</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTeachers.map((teacher, idx) => {
                        const isPwVisible = !!visiblePasswordMap[teacher.id];
                        return (
                          <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 text-center font-medium text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {teacher.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {teacher.email}
                            </td>
                            <td className="py-3 px-4">
                              <div className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 font-mono text-xs">
                                <span>{isPwVisible ? teacher.password : '••••••••'}</span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(teacher.id)}
                                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                  title={isPwVisible ? 'Hide password' : 'Show password'}
                                >
                                  {isPwVisible ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                {/* Edit / Update Button */}
                                <button
                                  id={`btn-edit-teacher-${teacher.id}`}
                                  type="button"
                                  onClick={() => handleOpenEditTeacher(teacher)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title={`Edit ${teacher.name}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Button */}
                                <button
                                  id={`btn-delete-teacher-${teacher.id}`}
                                  type="button"
                                  onClick={() => setTeacherToDelete(teacher)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title={`Remove ${teacher.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: STUDENT TICKETS */}
        {viewMode === 'tickets' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Overview</span>
                </button>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Admin</span>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-slate-800">Tickets</span>
                </div>
              </div>

              <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('overview')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('students')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Students ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('teachers')}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                >
                  Teachers ({teachers.length})
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-xs font-semibold bg-white text-amber-700 rounded-md shadow-xs cursor-default"
                >
                  Tickets ({pendingTickets})
                </button>
              </div>
            </div>

            <TeacherTickets
              session={session}
              showToast={showToast}
              onStatsChange={setPendingTickets}
              description="Student tickets land here. Update the status and the student is notified in their Notifications tab."
            />
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODALS: ADD STUDENT, EDIT STUDENT, DELETE STUDENT        */}
      {/* ======================================================== */}

      {/* 1. Add Student Modal */}
      {isAddStudentModalOpen && (
        <div
          id="modal-add-student-overlay"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Student</h3>
                  <p className="text-[11px] text-slate-400">Enroll student into the IT Lab</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {studentError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{studentError}</span>
              </div>
            )}

            <form onSubmit={handleAddStudentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Bilal"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. bilal@gmail.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0300 1234567"
                  value={studentContact}
                  onChange={(e) => setStudentContact(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Login Password
                </label>
                <div className="relative">
                  <input
                    type={showStudentPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    placeholder="Min 4 characters"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStudentPassword(!showStudentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showStudentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Students use email and this password to view their gradebook.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-add-student"
                  type="submit"
                  disabled={isSubmittingStudent}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSubmittingStudent ? 'Adding...' : 'Add Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Student Modal */}
      {studentToEdit && (
        <div
          id="modal-edit-student-overlay"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Password</h3>
                  <p className="text-[11px] text-slate-400">Profile details are locked. Password only.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editStudentError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{editStudentError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStudentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  {studentToEdit.name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  {studentToEdit.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact
                </label>
                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  {studentToEdit.contact || '—'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Login Password
                </label>
                <div className="relative">
                  <input
                    type={showEditStudentPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={editStudentPassword}
                    onChange={(e) => setEditStudentPassword(e.target.value)}
                    placeholder="Enter a new password"
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditStudentPassword(!showEditStudentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEditStudentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStudentToEdit(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-student"
                  type="submit"
                  disabled={isUpdatingStudent}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isUpdatingStudent ? 'Saving...' : 'Reset Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div
          id="modal-delete-student-overlay"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Delete Student?
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-800">{studentToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-student"
                type="button"
                onClick={handleConfirmDeleteStudent}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS: ADD TEACHER, EDIT TEACHER, DELETE TEACHER        */}
      {/* ======================================================== */}

      {/* 4. Add Teacher Modal */}
      {isAddTeacherModalOpen && (
        <div
          id="modal-add-teacher-overlay"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Teacher</h3>
                  <p className="text-[11px] text-slate-400">Register faculty login credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTeacherModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {teacherError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleAddTeacherSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instructor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sir Hamza"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email / Login Username
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. hamza@taleem.org"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Login Password
                </label>
                <div className="relative">
                  <input
                    type={showTeacherPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    placeholder="Min 4 characters"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showTeacherPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-add-teacher"
                  type="submit"
                  disabled={isSubmittingTeacher}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSubmittingTeacher ? 'Adding...' : 'Add Teacher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Edit Teacher Modal */}
      {teacherToEdit && (
        <div
          id="modal-edit-teacher-overlay"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Update Teacher</h3>
                  <p className="text-[11px] text-slate-400">Edit faculty details or reset password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTeacherToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editTeacherError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{editTeacherError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateTeacherSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instructor Name
                </label>
                <input
                  type="text"
                  required
                  value={editTeacherName}
                  onChange={(e) => setEditTeacherName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email / Login Username
                </label>
                <input
                  type="email"
                  required
                  value={editTeacherEmail}
                  onChange={(e) => setEditTeacherEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Login Password
                </label>
                <div className="relative">
                  <input
                    type={showEditTeacherPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={editTeacherPassword}
                    onChange={(e) => setEditTeacherPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditTeacherPassword(!showEditTeacherPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEditTeacherPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTeacherToEdit(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-teacher"
                  type="submit"
                  disabled={isUpdatingTeacher}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>{isUpdatingTeacher ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Teacher Confirmation Modal */}
      {teacherToDelete && (
        <div
          id="modal-delete-teacher-overlay"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Delete Teacher?
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Remove <strong className="text-slate-800">{teacherToDelete.name}</strong>? They will no longer be able to log in to the system.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setTeacherToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-teacher"
                type="button"
                onClick={handleConfirmDeleteTeacher}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Delete Teacher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
