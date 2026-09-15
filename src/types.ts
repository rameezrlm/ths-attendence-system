export type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_left';

export type AttendanceCode = 'P' | 'A' | 'L' | 'EL';

export interface Student {
  id: string;
  name: string;
  email: string;
  contact?: string;
  password?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  date: string; // Format: YYYY-MM-DD
  status: AttendanceStatus;
  /** ISO timestamp of when a late student joined. Only set when status is late. */
  joinTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDayEntry {
  status: AttendanceStatus;
  joinTime?: string;
}

export type AttendanceFilter = 'all' | 'present' | 'late';

export interface Teacher {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
}

export interface UserSession {
  role: 'admin' | 'teacher' | 'student';
  name: string;
  email: string;
  studentId?: string;
}

export interface AttendanceSummary {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  earlyLeft: number;
  unmarked: number;
}

/** Gradebook section such as Quiz, Assignment, or Project. Created once. */
export interface GradeSection {
  id: string;
  name: string;
  totalMarks: number;
  createdAt: string;
  order: number;
}

/** Individual assessment inside a section, e.g. Quiz 1, Quiz 2. */
export interface GradeAssessment {
  id: string;
  sectionId: string;
  name: string;
  totalMarks: number;
  createdAt: string;
  order: number;
}

/** Marks a student received on one assessment. */
export interface GradeMark {
  id: string;
  assessmentId: string;
  studentId: string;
  marks: number;
  updatedAt: string;
}

export type TicketStatus = 'open' | 'approved' | 'in_progress' | 'resolved';

export interface AssignmentMaterial {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  storagePath: string;
  uploadedBy: string;
  createdAt: string;
  closesAt: string;
  localOnly?: boolean;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  storagePath: string;
  submittedAt: string;
  localOnly?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  message: string;
  status: TicketStatus;
  teacherNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  seenByStudent: boolean;
  createdAt: string;
  updatedAt: string;
}
