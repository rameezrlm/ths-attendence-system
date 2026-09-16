import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { GradeSection, GradeAssessment, GradeMark } from '../types';
import { withFirestoreTimeout } from '../utils/firestoreTimeout';

const SECTIONS_KEY = 'it_lab_grade_sections';
const ASSESSMENTS_KEY = 'it_lab_grade_assessments';
const MARKS_KEY = 'it_lab_grade_marks';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage`, err);
  }
}

function sortByOrder<T extends { order: number; createdAt: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function readGradeSectionsLocal(): GradeSection[] {
  return sortByOrder(readList<GradeSection>(SECTIONS_KEY));
}

export function readGradeAssessmentsLocal(): GradeAssessment[] {
  return sortByOrder(readList<GradeAssessment>(ASSESSMENTS_KEY));
}

export function readGradeMarksLocal(): GradeMark[] {
  return readList<GradeMark>(MARKS_KEY);
}

async function fetchCollection<T>(
  collectionName: string,
  storageKey: string
): Promise<T[]> {
  const local = readList<T>(storageKey);

  if (isFirebaseConfigured && db) {
    try {
      const snap = await withFirestoreTimeout(getDocs(collection(db, collectionName)));
      if (!snap.empty) {
        const list: T[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as T), id: d.id });
        });
        writeList(storageKey, list);
        return list;
      }

      if (local.length > 0) {
        for (const item of local) {
          const id = (item as { id?: string }).id;
          if (!id) continue;
          try {
            await setDoc(doc(db, collectionName, id), item as object);
          } catch (e) {
            console.error(`Error migrating ${collectionName} to Firestore:`, e);
          }
        }
        return local;
      }

      writeList(storageKey, []);
      return [];
    } catch (err) {
      console.warn(`Error fetching ${collectionName} from Firestore, using local:`, err);
      return local;
    }
  }

  return local;
}

async function persistDoc(
  collectionName: string,
  id: string,
  data: object
): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, collectionName, id), data, { merge: true });
    } catch (err) {
      console.error(`Error saving ${collectionName}/${id} to Firestore:`, err);
    }
  }
}

async function removeDoc(collectionName: string, id: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      console.error(`Error deleting ${collectionName}/${id} from Firestore:`, err);
    }
  }
}

export async function fetchGradeSections(): Promise<GradeSection[]> {
  const list = await fetchCollection<GradeSection>('gradeSections', SECTIONS_KEY);
  return sortByOrder(list);
}

export async function fetchGradeAssessments(): Promise<GradeAssessment[]> {
  const list = await fetchCollection<GradeAssessment>('gradeAssessments', ASSESSMENTS_KEY);
  return sortByOrder(list);
}

export async function fetchGradeMarks(): Promise<GradeMark[]> {
  return fetchCollection<GradeMark>('gradeMarks', MARKS_KEY);
}

export async function createGradeSection(
  name: string,
  totalMarks = 0,
  classId?: string
): Promise<GradeSection> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Please enter a section name.');
  }

  const existing = await fetchGradeSections();
  const scoped = classId
    ? existing.filter((section) => section.classId === classId)
    : existing;
  const duplicate = scoped.find((s) => normalizeName(s.name) === normalizeName(trimmed));
  if (duplicate) {
    throw new Error(
      `"${duplicate.name}" already exists. Use + Add ${duplicate.name} to create another assessment.`
    );
  }

  const section: GradeSection = {
    id: newId('gs'),
    classId,
    name: trimmed,
    totalMarks: Number.isFinite(totalMarks) && totalMarks > 0 ? totalMarks : 0,
    createdAt: new Date().toISOString(),
    order: scoped.length,
  };

  writeList(SECTIONS_KEY, [...existing, section]);
  await persistDoc('gradeSections', section.id, section);
  return section;
}

export function nextAssessmentName(sectionName: string, assessments: GradeAssessment[]): string {
  const prefix = sectionName.trim();
  const taken = new Set(assessments.map((a) => normalizeName(a.name)));
  let n = assessments.length + 1;
  while (taken.has(normalizeName(`${prefix} ${n}`))) {
    n += 1;
  }
  return `${prefix} ${n}`;
}

export async function addGradeAssessment(
  section: GradeSection,
  totalMarks: number,
  name?: string
): Promise<GradeAssessment> {
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
    throw new Error('Total marks must be greater than 0.');
  }

  const all = await fetchGradeAssessments();
  const inSection = all.filter((a) => a.sectionId === section.id);
  const assessmentName = (name || '').trim() || nextAssessmentName(section.name, inSection);

  const taken = inSection.find((a) => normalizeName(a.name) === normalizeName(assessmentName));
  if (taken) {
    throw new Error(`"${assessmentName}" already exists in ${section.name}.`);
  }

  const assessment: GradeAssessment = {
    id: newId('ga'),
    sectionId: section.id,
    name: assessmentName,
    totalMarks,
    createdAt: new Date().toISOString(),
    order: inSection.length,
  };

  writeList(ASSESSMENTS_KEY, [...all, assessment]);
  await persistDoc('gradeAssessments', assessment.id, assessment);
  return assessment;
}

export async function updateGradeAssessment(
  assessmentId: string,
  patch: { name?: string; totalMarks?: number }
): Promise<GradeAssessment> {
  const all = await fetchGradeAssessments();
  const index = all.findIndex((a) => a.id === assessmentId);
  if (index === -1) {
    throw new Error('Assessment not found');
  }

  const current = all[index];
  const nextName = patch.name !== undefined ? patch.name.trim() : current.name;
  const nextTotal =
    patch.totalMarks !== undefined ? patch.totalMarks : current.totalMarks;

  if (!nextName) {
    throw new Error('Please enter an assessment name.');
  }
  if (!Number.isFinite(nextTotal) || nextTotal <= 0) {
    throw new Error('Total marks must be greater than 0.');
  }

  const duplicate = all.find(
    (a) =>
      a.id !== assessmentId &&
      a.sectionId === current.sectionId &&
      normalizeName(a.name) === normalizeName(nextName)
  );
  if (duplicate) {
    throw new Error(`"${nextName}" already exists in this section.`);
  }

  const updated: GradeAssessment = {
    ...current,
    name: nextName,
    totalMarks: nextTotal,
  };
  all[index] = updated;
  writeList(ASSESSMENTS_KEY, all);
  await persistDoc('gradeAssessments', updated.id, updated);
  return updated;
}

export async function deleteGradeSection(sectionId: string): Promise<void> {
  const sections = (await fetchGradeSections()).filter((s) => s.id !== sectionId);
  writeList(SECTIONS_KEY, sections);
  await removeDoc('gradeSections', sectionId);

  const assessments = await fetchGradeAssessments();
  const removed = assessments.filter((a) => a.sectionId === sectionId);
  const remainingAssessments = assessments.filter((a) => a.sectionId !== sectionId);
  writeList(ASSESSMENTS_KEY, remainingAssessments);

  for (const assessment of removed) {
    await removeDoc('gradeAssessments', assessment.id);
  }

  const removedIds = new Set(removed.map((a) => a.id));
  const marks = await fetchGradeMarks();
  const remainingMarks = marks.filter((m) => !removedIds.has(m.assessmentId));
  writeList(MARKS_KEY, remainingMarks);

  for (const mark of marks) {
    if (removedIds.has(mark.assessmentId)) {
      await removeDoc('gradeMarks', mark.id);
    }
  }
}

export async function deleteGradeAssessment(assessmentId: string): Promise<void> {
  const assessments = (await fetchGradeAssessments()).filter((a) => a.id !== assessmentId);
  writeList(ASSESSMENTS_KEY, assessments);
  await removeDoc('gradeAssessments', assessmentId);

  const marks = await fetchGradeMarks();
  const remainingMarks = marks.filter((m) => m.assessmentId !== assessmentId);
  writeList(MARKS_KEY, remainingMarks);

  for (const mark of marks) {
    if (mark.assessmentId === assessmentId) {
      await removeDoc('gradeMarks', mark.id);
    }
  }
}

export function markKey(assessmentId: string, studentId: string): string {
  return `${assessmentId}_${studentId}`;
}

export async function saveGradeMarks(
  entries: { assessmentId: string; studentId: string; marks: number | null }[]
): Promise<GradeMark[]> {
  const existing = await fetchGradeMarks();
  const map = new Map(existing.map((m) => [m.id, m]));
  const now = new Date().toISOString();
  const saved: GradeMark[] = [];

  for (const entry of entries) {
    const id = markKey(entry.assessmentId, entry.studentId);

    if (entry.marks === null) {
      if (map.has(id)) {
        map.delete(id);
        await removeDoc('gradeMarks', id);
      }
      continue;
    }

    const record: GradeMark = {
      id,
      assessmentId: entry.assessmentId,
      studentId: entry.studentId,
      marks: entry.marks,
      updatedAt: now,
    };
    map.set(id, record);
    saved.push(record);
    await persistDoc('gradeMarks', id, record);
  }

  writeList(MARKS_KEY, Array.from(map.values()));
  return Array.from(map.values());
}

export function marksToMap(marks: GradeMark[]): Record<string, number> {
  const result: Record<string, number> = {};
  marks.forEach((m) => {
    result[m.id] = m.marks;
  });
  return result;
}

export interface StudentCourseStats {
  studentId: string;
  obtained: number;
  total: number;
  percent: number;
}

export interface ClassGradebookStats {
  classAveragePercent: number;
  ranked: StudentCourseStats[];
  byStudentId: Record<string, StudentCourseStats>;
}

export function computeStudentCourseStats(
  studentId: string,
  assessments: GradeAssessment[],
  marks: GradeMark[]
): StudentCourseStats {
  const marksMap = marksToMap(marks);
  let obtained = 0;
  let total = 0;

  assessments.forEach((assessment) => {
    total += assessment.totalMarks;
    const value = marksMap[markKey(assessment.id, studentId)];
    if (typeof value === 'number') {
      obtained += value;
    }
  });

  const percent = total > 0 ? (obtained / total) * 100 : 0;
  return { studentId, obtained, total, percent };
}

export function computeClassGradebookStats(
  studentIds: string[],
  assessments: GradeAssessment[],
  marks: GradeMark[]
): ClassGradebookStats {
  const stats = studentIds.map((id) => computeStudentCourseStats(id, assessments, marks));
  const withAssessments = stats.filter((item) => item.total > 0);
  const classAveragePercent =
    withAssessments.length > 0
      ? withAssessments.reduce((sum, item) => sum + item.percent, 0) / withAssessments.length
      : 0;

  const ranked = [...withAssessments].sort((a, b) => b.percent - a.percent);
  const byStudentId: Record<string, StudentCourseStats> = {};
  stats.forEach((item) => {
    byStudentId[item.studentId] = item;
  });

  return { classAveragePercent, ranked, byStudentId };
}

export function percentToLetterGrade(percent: number): string {
  if (percent >= 80) return 'A';
  if (percent >= 65) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 40) return 'D';
  return 'F';
}

export function formatGradePercent(value: number): string {
  return value.toFixed(2);
}

export interface GradeColorScheme {
  card: string;
  label: string;
  value: string;
  suffix: string;
}

export function getGradeColorScheme(percent: number): GradeColorScheme {
  const grade = percentToLetterGrade(percent);

  switch (grade) {
    case 'A':
      return {
        card: 'bg-green-50 border-green-200',
        label: 'text-green-700',
        value: 'text-green-900',
        suffix: 'text-green-700/80',
      };
    case 'B':
      return {
        card: 'bg-emerald-50 border-emerald-200',
        label: 'text-emerald-700',
        value: 'text-emerald-900',
        suffix: 'text-emerald-700/80',
      };
    case 'C':
      return {
        card: 'bg-amber-50 border-amber-200',
        label: 'text-amber-700',
        value: 'text-amber-900',
        suffix: 'text-amber-700/80',
      };
    case 'D':
      return {
        card: 'bg-orange-50 border-orange-200',
        label: 'text-orange-700',
        value: 'text-orange-900',
        suffix: 'text-orange-700/80',
      };
    default:
      return {
        card: 'bg-red-50 border-red-200',
        label: 'text-red-700',
        value: 'text-red-900',
        suffix: 'text-red-700/80',
      };
  }
}
