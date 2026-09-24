export type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_left' | 'leave';

export type AttendanceCode = 'P' | 'A' | 'L' | 'EL' | 'LV';

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
  classId?: string;
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

export type AttendanceFilter =
  | 'all'
  | 'present'
  | 'absent'
  | 'late'
  | 'early_left'
  | 'leave'
  | 'unmarked';

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
  teacherId?: string;
  studentId?: string;
}

/** Admin-created course/class with assigned teachers and students. */
export interface LabClass {
  id: string;
  name: string;
  description?: string;
  teacherIds: string[];
  studentIds: string[];
  createdAt: string;
}

export interface AttendanceSummary {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  earlyLeft: number;
  leave: number;
  unmarked: number;
}

/** Gradebook section such as Quiz, Assignment, or Project. Created once. */
export interface GradeSection {
  id: string;
  classId?: string;
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
  classId?: string;
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
  fileBackend?: 'storage' | 'firestore';
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
  fileBackend?: 'storage' | 'firestore';
}

export interface Announcement {
  id: string;
  classId?: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  classId?: string;
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
