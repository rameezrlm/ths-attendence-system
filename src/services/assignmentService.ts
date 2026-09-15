import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, isFirebaseConfigured, storage } from '../firebase/firebaseConfig';
import type { AssignmentMaterial, AssignmentSubmission } from '../types';

const ASSIGNMENTS_KEY = 'it_lab_assignments';
const SUBMISSIONS_KEY = 'it_lab_assignment_submissions';
const LOCAL_FILE_DB = 'it_lab_assignment_files';
const LOCAL_FILE_STORE = 'files';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.odp',
  '.odt',
  '.png',
  '.jpg',
  '.jpeg',
  '.zip',
];

type ProgressCb = (percent: number) => void;

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

function sortByNewest<T extends { id: string; createdAt?: string; submittedAt?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const left = a.createdAt || a.submittedAt || '';
    const right = b.createdAt || b.submittedAt || '';
    return right.localeCompare(left);
  });
}

function toPayload(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function fileExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-()+ ]/g, '_');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDatetimeLocalValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultClosesAtLocal(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(date);
}

function openFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_FILE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCAL_FILE_STORE)) {
        request.result.createObjectStore(LOCAL_FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalBlob(id: string, file: Blob, onProgress?: ProgressCb): Promise<void> {
  onProgress?.(20);
  const database = await openFileDb();
  onProgress?.(55);
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(LOCAL_FILE_STORE, 'readwrite');
    tx.objectStore(LOCAL_FILE_STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  onProgress?.(100);
}

async function readLocalBlob(id: string): Promise<Blob | null> {
  try {
    const database = await openFileDb();
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(LOCAL_FILE_STORE, 'readonly');
      const request = tx.objectStore(LOCAL_FILE_STORE).get(id);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function deleteLocalBlob(id: string): Promise<void> {
  try {
    const database = await openFileDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(LOCAL_FILE_STORE, 'readwrite');
      tx.objectStore(LOCAL_FILE_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete local assignment file:', err);
  }
}

async function persistDoc(collectionName: string, id: string, data: object): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, collectionName, id), toPayload(data), { merge: true });
    } catch (err) {
      console.error(`Error saving ${collectionName}/${id}:`, err);
    }
  }
}

async function fetchCollection<T extends { id: string; createdAt?: string; submittedAt?: string }>(
  collectionName: string,
  storageKey: string
): Promise<T[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      if (!snap.empty) {
        const list: T[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as T), id: d.id });
        });
        const sorted = sortByNewest(list);
        writeList(storageKey, sorted);
        return sorted;
      }

      const local = sortByNewest(readList<T>(storageKey));
      if (local.length > 0) {
        for (const item of local) {
          try {
            await setDoc(doc(db, collectionName, item.id), toPayload(item));
          } catch (e) {
            console.error(`Error migrating ${collectionName} to Firestore:`, e);
          }
        }
        return local;
      }

      writeList(storageKey, []);
      return [];
    } catch (err) {
      console.warn(`Error fetching ${collectionName}, using local:`, err);
      return sortByNewest(readList<T>(storageKey));
    }
  }

  return sortByNewest(readList<T>(storageKey));
}

async function uploadFile(
  storagePath: string,
  localId: string,
  file: File,
  onProgress?: ProgressCb
): Promise<{ fileUrl: string; storagePath: string; localOnly: boolean }> {
  onProgress?.(1);

  if (storage) {
    try {
      const fileRef = ref(storage, storagePath);
      const task = uploadBytesResumable(fileRef, file);
      const fileUrl = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          (snapshot) => {
            const percent = Math.max(
              1,
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            );
            onProgress?.(percent);
          },
          reject,
          async () => {
            try {
              onProgress?.(100);
              resolve(await getDownloadURL(task.snapshot.ref));
            } catch (err) {
              reject(err);
            }
          }
        );
      });
      return { fileUrl, storagePath, localOnly: false };
    } catch (err) {
      console.warn('Firebase Storage upload failed, saving file locally:', err);
    }
  }

  await saveLocalBlob(localId, file, onProgress);
  return { fileUrl: '', storagePath: '', localOnly: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAssignmentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isAssignmentClosed(assignment: AssignmentMaterial, now = Date.now()): boolean {
  if (!assignment.closesAt) return false;
  const closeTime = new Date(assignment.closesAt).getTime();
  if (Number.isNaN(closeTime)) return false;
  return closeTime <= now;
}

export function validateAssignmentFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return 'File must be 25 MB or smaller.';
  }
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Upload a document or slides file (PDF, Word, PowerPoint, image, or ZIP).';
  }
  return null;
}

export async function fetchAssignments(): Promise<AssignmentMaterial[]> {
  return fetchCollection<AssignmentMaterial>('assignments', ASSIGNMENTS_KEY);
}

export async function fetchAssignmentSubmissions(): Promise<AssignmentSubmission[]> {
  return fetchCollection<AssignmentSubmission>('assignmentSubmissions', SUBMISSIONS_KEY);
}

export async function createAssignment(input: {
  title: string;
  description: string;
  file: File;
  uploadedBy: string;
  closesAt: string;
  onProgress?: ProgressCb;
}): Promise<AssignmentMaterial> {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) {
    throw new Error('Please enter a title.');
  }
  if (!description) {
    throw new Error('Please add a description for students.');
  }

  const closesAt = new Date(input.closesAt);
  if (Number.isNaN(closesAt.getTime())) {
    throw new Error('Please set a valid submission close date and time.');
  }
  if (closesAt.getTime() <= Date.now()) {
    throw new Error('Submission close time must be in the future.');
  }

  const fileError = validateAssignmentFile(input.file);
  if (fileError) {
    throw new Error(fileError);
  }

  const id = newId('asg');
  const uploaded = await uploadFile(
    `assignments/${id}/${safeFileName(input.file.name)}`,
    id,
    input.file,
    input.onProgress
  );
  const assignment: AssignmentMaterial = {
    id,
    title,
    description,
    fileName: input.file.name,
    fileType: input.file.type || fileExtension(input.file.name),
    fileSize: input.file.size,
    fileUrl: uploaded.fileUrl,
    storagePath: uploaded.storagePath,
    uploadedBy: input.uploadedBy,
    createdAt: new Date().toISOString(),
    closesAt: closesAt.toISOString(),
    localOnly: uploaded.localOnly,
  };

  const list = await fetchAssignments();
  writeList(ASSIGNMENTS_KEY, [assignment, ...list]);
  await persistDoc('assignments', assignment.id, assignment);
  return assignment;
}

export async function submitAssignmentWork(input: {
  assignment: AssignmentMaterial;
  studentId: string;
  studentName: string;
  studentEmail: string;
  file: File;
  onProgress?: ProgressCb;
}): Promise<AssignmentSubmission> {
  if (isAssignmentClosed(input.assignment)) {
    throw new Error('Submission is closed for this assignment.');
  }

  const fileError = validateAssignmentFile(input.file);
  if (fileError) {
    throw new Error(fileError);
  }

  const id = `${input.assignment.id}_${input.studentId}`;
  const existing = (await fetchAssignmentSubmissions()).find((item) => item.id === id);
  if (existing?.storagePath && storage) {
    try {
      await deleteObject(ref(storage, existing.storagePath));
    } catch (err) {
      console.warn('Failed to replace previous submission file:', err);
    }
  }

  const uploaded = await uploadFile(
    `assignments/${input.assignment.id}/submissions/${input.studentId}/${safeFileName(input.file.name)}`,
    `sub_${id}`,
    input.file,
    input.onProgress
  );

  const submission: AssignmentSubmission = {
    id,
    assignmentId: input.assignment.id,
    studentId: input.studentId,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    fileName: input.file.name,
    fileType: input.file.type || fileExtension(input.file.name),
    fileSize: input.file.size,
    fileUrl: uploaded.fileUrl,
    storagePath: uploaded.storagePath,
    submittedAt: new Date().toISOString(),
    localOnly: uploaded.localOnly,
  };

  const list = (await fetchAssignmentSubmissions()).filter((item) => item.id !== id);
  writeList(SUBMISSIONS_KEY, [submission, ...list]);
  await persistDoc('assignmentSubmissions', submission.id, submission);
  return submission;
}

export async function deleteAssignment(id: string): Promise<void> {
  const current = await fetchAssignments();
  const existing = current.find((item) => item.id === id);
  writeList(
    ASSIGNMENTS_KEY,
    current.filter((item) => item.id !== id)
  );

  const submissions = await fetchAssignmentSubmissions();
  const related = submissions.filter((item) => item.assignmentId === id);
  writeList(
    SUBMISSIONS_KEY,
    submissions.filter((item) => item.assignmentId !== id)
  );

  if (existing?.storagePath && storage) {
    try {
      await deleteObject(ref(storage, existing.storagePath));
    } catch (err) {
      console.warn('Failed to delete assignment file from Storage:', err);
    }
  }

  await deleteLocalBlob(id);

  for (const submission of related) {
    if (submission.storagePath && storage) {
      try {
        await deleteObject(ref(storage, submission.storagePath));
      } catch (err) {
        console.warn('Failed to delete submission file from Storage:', err);
      }
    }
    await deleteLocalBlob(`sub_${submission.id}`);
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'assignmentSubmissions', submission.id));
      } catch (err) {
        console.error('Error deleting submission from Firestore:', err);
      }
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'assignments', id));
    } catch (err) {
      console.error('Error deleting assignment from Firestore:', err);
    }
  }
}

async function downloadStoredFile(options: {
  id: string;
  fileName: string;
  fileUrl: string;
  localId: string;
}): Promise<void> {
  let blob: Blob | null = null;

  if (options.fileUrl) {
    try {
      const response = await fetch(options.fileUrl);
      if (response.ok) {
        blob = await response.blob();
      }
    } catch (err) {
      console.warn('Could not fetch file as a blob, opening instead:', err);
    }
  }

  if (!blob) {
    blob = await readLocalBlob(options.localId);
  }

  if (blob) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = options.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    return;
  }

  if (options.fileUrl) {
    window.open(options.fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  throw new Error('This file is not available on this device.');
}

export async function downloadAssignment(assignment: AssignmentMaterial): Promise<void> {
  await downloadStoredFile({
    id: assignment.id,
    fileName: assignment.fileName,
    fileUrl: assignment.fileUrl,
    localId: assignment.id,
  });
}

export async function downloadSubmission(submission: AssignmentSubmission): Promise<void> {
  await downloadStoredFile({
    id: submission.id,
    fileName: submission.fileName,
    fileUrl: submission.fileUrl,
    localId: `sub_${submission.id}`,
  });
}
