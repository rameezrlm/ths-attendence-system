import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { AttendanceDayEntry, AttendanceRecord, AttendanceStatus, Student } from '../types';
import { withFirestoreTimeout } from '../utils/firestoreTimeout';

const ATTENDANCE_STORAGE_KEY = 'it_lab_attendance';

function getLocalAttendance(): Record<string, AttendanceRecord> {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAttendanceMap(map: Record<string, AttendanceRecord>) {
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save attendance map to localStorage', err);
  }
}

function toDayEntry(rec: AttendanceRecord): AttendanceDayEntry {
  return {
    status: rec.status,
    joinTime: rec.status === 'late' && rec.joinTime ? rec.joinTime : undefined,
  };
}

/**
 * Fetch attendance map for a specific date (format: YYYY-MM-DD).
 * Returns: { [studentId]: { status, joinTime? } }
 */
/**
 * Strict class match for teacher/admin day roster.
 * Records without classId only appear when no class filter is set (admin global view).
 */
function matchesClassFilter(rec: AttendanceRecord, classId?: string): boolean {
  if (!classId) return true;
  return rec.classId === classId;
}

/**
 * Student view: show class-scoped records plus legacy/admin records with no classId.
 */
function matchesStudentClassFilter(rec: AttendanceRecord, classId?: string): boolean {
  if (!classId) return true;
  return !rec.classId || rec.classId === classId;
}

function buildAttendanceId(classId: string | undefined, studentId: string, dateStr: string): string {
  return classId ? `${classId}_${studentId}_${dateStr}` : `${studentId}_${dateStr}`;
}

export async function getAttendanceByDate(
  dateStr: string,
  classId?: string
): Promise<Record<string, AttendanceDayEntry>> {
  const result: Record<string, AttendanceDayEntry> = {};

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, 'attendance'), where('date', '==', dateStr));
      const snap = await withFirestoreTimeout(getDocs(q));
      snap.forEach((d) => {
        const data = d.data() as AttendanceRecord;
        if (data.studentId && data.status && matchesClassFilter(data, classId)) {
          result[data.studentId] = toDayEntry(data);
        }
      });
      const local = getLocalAttendance();
      snap.forEach((d) => {
        const data = d.data() as AttendanceRecord;
        local[d.id] = data;
      });
      saveLocalAttendanceMap(local);
      return result;
    } catch (err) {
      console.warn('Firestore attendance fetch failed, checking local:', err);
    }
  }

  const localMap = getLocalAttendance();
  Object.values(localMap).forEach((rec) => {
    if (
      rec.date === dateStr &&
      rec.studentId &&
      rec.status &&
      matchesClassFilter(rec, classId)
    ) {
      result[rec.studentId] = toDayEntry(rec);
    }
  });

  return result;
}

/**
 * Save or update attendance for students on a given date.
 * Enforces: Single record per Student + Date.
 * Stores joinTime only when the student is marked late.
 */
export async function saveAttendanceForDate(
  dateStr: string,
  records: { student: Student; status: AttendanceStatus; joinTime?: string }[],
  classId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const localMap = getLocalAttendance();

  for (const item of records) {
    const attendanceId = buildAttendanceId(classId, item.student.id, dateStr);
    const legacyId = `${item.student.id}_${dateStr}`;
    const existingRec = localMap[attendanceId] || localMap[legacyId];
    const joinTime =
      item.status === 'late' ? item.joinTime || existingRec?.joinTime || now : '';

    const record: AttendanceRecord = {
      id: attendanceId,
      classId,
      studentId: item.student.id,
      studentName: item.student.name,
      studentEmail: item.student.email,
      date: dateStr,
      status: item.status,
      joinTime,
      createdAt: existingRec?.createdAt || now,
      updatedAt: now,
    };

    localMap[attendanceId] = record;

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'attendance', attendanceId), record, { merge: true });
      } catch (err) {
        console.error(`Failed to save attendance for ${item.student.name} to Firestore:`, err);
      }
    }
  }

  saveLocalAttendanceMap(localMap);
}

/**
 * Fetch all attendance records for a specific year and month.
 * Month is 1-indexed (1 = Jan, 9 = Sep, 12 = Dec).
 */
export async function getMonthlyAttendance(
  year: number,
  month: number
): Promise<AttendanceRecord[]> {
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const prefix = `${year}-${monthStr}`; // e.g. "2026-09"

  if (isFirebaseConfigured && db) {
    try {
      const startDate = `${prefix}-01`;
      const endDate = `${prefix}-31`;
      const q = query(
        collection(db, 'attendance'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snap = await withFirestoreTimeout(getDocs(q));
      const records: AttendanceRecord[] = [];
      snap.forEach((d) => {
        records.push(d.data() as AttendanceRecord);
      });
      return records;
    } catch (err) {
      console.warn('Error fetching monthly attendance from Firestore, checking local:', err);
    }
  }

  const localMap = getLocalAttendance();
  return Object.values(localMap).filter((rec) => rec.date && rec.date.startsWith(prefix));
}

function sortAttendanceNewest(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function getAttendanceForStudentLocal(
  studentId: string,
  classId?: string
): AttendanceRecord[] {
  const localMap = getLocalAttendance();
  const filtered = Object.values(localMap).filter(
    (rec) => rec.studentId === studentId && matchesStudentClassFilter(rec, classId)
  );
  const byDate = new Map<string, AttendanceRecord>();
  sortAttendanceNewest(filtered).forEach((rec) => {
    const existing = byDate.get(rec.date);
    if (!existing) {
      byDate.set(rec.date, rec);
      return;
    }
    if (classId && rec.classId === classId && existing.classId !== classId) {
      byDate.set(rec.date, rec);
    }
  });
  return sortAttendanceNewest([...byDate.values()]);
}

/**
 * Fetch every saved attendance record for one student, newest date first.
 */
export async function getAttendanceForStudent(
  studentId: string,
  classId?: string
): Promise<AttendanceRecord[]> {
  const local = getAttendanceForStudentLocal(studentId, classId);

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, 'attendance'), where('studentId', '==', studentId));
      const snap = await withFirestoreTimeout(getDocs(q));
      const records: AttendanceRecord[] = [];
      const localMap = getLocalAttendance();

      snap.forEach((d) => {
        const data = { ...(d.data() as AttendanceRecord), id: d.id };
        records.push(data);
        localMap[d.id] = data;
      });
      saveLocalAttendanceMap(localMap);

      // Prefer newest record per date when both class-scoped and legacy exist
      const byDate = new Map<string, AttendanceRecord>();
      sortAttendanceNewest(
        records.filter((rec) => matchesStudentClassFilter(rec, classId))
      ).forEach((rec) => {
        const existing = byDate.get(rec.date);
        if (!existing) {
          byDate.set(rec.date, rec);
          return;
        }
        if (classId && rec.classId === classId && existing.classId !== classId) {
          byDate.set(rec.date, rec);
        }
      });

      return sortAttendanceNewest([...byDate.values()]);
    } catch (err) {
      console.warn('Error fetching student attendance from Firestore, checking local:', err);
    }
  }

  return local;
}
