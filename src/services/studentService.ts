import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { Student } from '../types';

const STORAGE_KEY = 'it_lab_students';

function getLocalStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: Student[] = JSON.parse(raw);
    return parsed;
  } catch {
    return [];
  }
}

function saveLocalStudents(students: Student[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  } catch (err) {
    console.error('Failed to save students to localStorage', err);
  }
}

export async function fetchStudents(): Promise<Student[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'students'));
      if (!snap.empty) {
        const list: Student[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || '',
            email: data.email || '',
            contact: data.contact || '',
            password: data.password || '',
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        saveLocalStudents(list);
        return list;
      }

      // If Firestore is currently empty, check if we have any existing local students to upload
      const local = getLocalStudents();
      if (local.length > 0) {
        for (const s of local) {
          try {
            await setDoc(doc(db, 'students', s.id), s);
          } catch (e) {
            console.error('Error migrating local student to Firestore:', e);
          }
        }
        return local;
      }

      saveLocalStudents([]);
      return [];
    } catch (error) {
      console.warn('Firestore fetch error, reading local cache:', error);
      return getLocalStudents();
    }
  }

  return getLocalStudents();
}

export async function addStudent(
  name: string,
  email: string,
  password: string,
  contact = ''
): Promise<Student> {
  const newStudent: Student = {
    id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    contact: contact.trim(),
    password: password.trim(),
    createdAt: new Date().toISOString(),
  };

  // Local storage update
  const current = getLocalStudents();
  current.push(newStudent);
  current.sort((a, b) => a.name.localeCompare(b.name));
  saveLocalStudents(current);

  // Firestore update if configured
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'students', newStudent.id), newStudent);
    } catch (err) {
      console.error('Error writing student to Firestore:', err);
    }
  }

  return newStudent;
}

export async function deleteStudent(studentId: string): Promise<void> {
  const current = getLocalStudents().filter((s) => s.id !== studentId);
  saveLocalStudents(current);

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (err) {
      console.error('Error deleting student from Firestore:', err);
    }
  }
}

export async function getStudentById(id: string): Promise<Student | null> {
  const list = await fetchStudents();
  return list.find((s) => s.id === id) ?? null;
}

export async function updateStudent(
  id: string,
  name: string,
  email: string,
  password?: string,
  contact?: string
): Promise<Student> {
  const current = getLocalStudents();
  const index = current.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error('Student not found');
  }

  const updated: Student = {
    ...current[index],
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password && password.trim() ? password.trim() : current[index].password,
    contact: contact !== undefined ? contact.trim() : current[index].contact || '',
  };

  current[index] = updated;
  current.sort((a, b) => a.name.localeCompare(b.name));
  saveLocalStudents(current);

  if (isFirebaseConfigured && db) {
    try {
      const payload: Record<string, string> = {
        name: updated.name,
        email: updated.email,
        contact: updated.contact || '',
      };
      if (password && password.trim()) {
        payload.password = updated.password || password.trim();
      }
      await updateDoc(doc(db, 'students', id), payload);
    } catch (err) {
      console.error('Error updating student in Firestore:', err);
    }
  }

  return updated;
}

export async function updateStudentPassword(id: string, password: string): Promise<Student> {
  const current = await fetchStudents();
  const index = current.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error('Student not found');
  }

  const nextPassword = password.trim();
  if (nextPassword.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }

  const updated: Student = {
    ...current[index],
    password: nextPassword,
  };

  current[index] = updated;
  saveLocalStudents(current);

  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, 'students', id), { password: nextPassword });
    } catch (err) {
      console.error('Error updating student password in Firestore:', err);
    }
  }

  return updated;
}

