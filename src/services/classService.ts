import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { LabClass, Student } from '../types';
import { withFirestoreTimeout } from '../utils/firestoreTimeout';

const CLASSES_KEY = 'it_lab_classes';

function newId(): string {
  return `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function readClasses(): LabClass[] {
  try {
    const raw = localStorage.getItem(CLASSES_KEY);
    return raw ? (JSON.parse(raw) as LabClass[]) : [];
  } catch {
    return [];
  }
}

function writeClasses(list: LabClass[]): void {
  try {
    localStorage.setItem(CLASSES_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save classes to localStorage', err);
  }
}

async function persistClass(item: LabClass): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'labClasses', item.id), item, { merge: true });
    } catch (err) {
      console.error(`Error saving class ${item.id}:`, err);
    }
  }
}

export function readClassesLocal(): LabClass[] {
  return readClasses();
}

export async function fetchClasses(): Promise<LabClass[]> {
  const local = readClasses();

  if (isFirebaseConfigured && db) {
    try {
      const snap = await withFirestoreTimeout(getDocs(collection(db, 'labClasses')));
      if (!snap.empty) {
        const list: LabClass[] = [];
        snap.forEach((d) => {
          const data = d.data() as LabClass;
          list.push({
            ...data,
            id: d.id,
            teacherIds: data.teacherIds || [],
            studentIds: data.studentIds || [],
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        writeClasses(list);
        return list;
      }

      if (local.length > 0) {
        for (const item of local) {
          await persistClass(item);
        }
        return local;
      }

      writeClasses([]);
      return [];
    } catch (err) {
      console.warn('Error fetching classes from Firestore, using local:', err);
    }
  }

  return local;
}

export async function createClass(input: {
  name: string;
  description?: string;
  teacherIds?: string[];
  studentIds?: string[];
}): Promise<LabClass> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Please enter a class name.');
  }

  const item: LabClass = {
    id: newId(),
    name,
    description: input.description?.trim() || '',
    teacherIds: input.teacherIds || [],
    studentIds: input.studentIds || [],
    createdAt: new Date().toISOString(),
  };

  const list = [...readClasses(), item];
  writeClasses(list);
  await persistClass(item);
  return item;
}

export async function updateClass(
  id: string,
  patch: Partial<Pick<LabClass, 'name' | 'description' | 'teacherIds' | 'studentIds'>>
): Promise<LabClass> {
  const list = readClasses();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('Class not found.');
  }

  const updated: LabClass = {
    ...list[index],
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : list[index].name,
    description:
      patch.description !== undefined ? patch.description.trim() : list[index].description,
    teacherIds: patch.teacherIds ?? list[index].teacherIds,
    studentIds: patch.studentIds ?? list[index].studentIds,
  };

  if (!updated.name) {
    throw new Error('Class name cannot be empty.');
  }

  list[index] = updated;
  writeClasses(list);
  await persistClass(updated);
  return updated;
}

export async function deleteClass(id: string): Promise<void> {
  const list = readClasses().filter((item) => item.id !== id);
  writeClasses(list);

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'labClasses', id));
    } catch (err) {
      console.error(`Error deleting class ${id}:`, err);
    }
  }
}

export async function fetchClassesForTeacher(teacherId: string): Promise<LabClass[]> {
  const all = await fetchClasses();
  return all.filter((item) => item.teacherIds.includes(teacherId));
}

export async function fetchClassesForStudent(studentId: string): Promise<LabClass[]> {
  const all = await fetchClasses();
  return all.filter((item) => item.studentIds.includes(studentId));
}

export function filterStudentsByClass(allStudents: Student[], classItem: LabClass): Student[] {
  const ids = new Set(classItem.studentIds);
  return allStudents.filter((student) => ids.has(student.id));
}

export function belongsToClass(classId: string, recordClassId?: string): boolean {
  return recordClassId === classId;
}
