export type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_left';

export type AttendanceCode = 'P' | 'A' | 'L' | 'EL';

export interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  date: string; // Format: YYYY-MM-DD
  status: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
}

export interface UserSession {
  role: 'admin' | 'teacher';
  name: string;
  email: string;
}

export interface AttendanceSummary {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  earlyLeft: number;
  unmarked: number;
}
