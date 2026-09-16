import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage';
import { db, isFirebaseConfigured, storage } from '../firebase/firebaseConfig';
import type { AssignmentMaterial, AssignmentSubmission } from '../types';
import { withFirestoreTimeout } from '../utils/firestoreTimeout';

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

async function writeLocalBlob(id: string, blob: Blob): Promise<void> {
  const database = await openFileDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(LOCAL_FILE_STORE, 'readwrite');
    tx.objectStore(LOCAL_FILE_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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
      await withFirestoreTimeout(
        setDoc(doc(db, collectionName, id), toPayload(data), { merge: true }),
        10000
      );
    } catch (err) {
      console.error(`Error saving ${collectionName}/${id}:`, err);
    }
  }
}

export function readAssignmentsLocal(): AssignmentMaterial[] {
  return sortByNewest(readList<AssignmentMaterial>(ASSIGNMENTS_KEY));
}

export function readAssignmentSubmissionsLocal(): AssignmentSubmission[] {
  return sortByNewest(readList<AssignmentSubmission>(SUBMISSIONS_KEY));
}

async function fetchCollection<T extends { id: string; createdAt?: string; submittedAt?: string }>(
  collectionName: string,
  storageKey: string
): Promise<T[]> {
  const local = sortByNewest(readList<T>(storageKey));

  if (isFirebaseConfigured && db) {
    try {
      const snap = await withFirestoreTimeout(getDocs(collection(db, collectionName)));
      if (!snap.empty) {
        const list: T[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as T), id: d.id });
        });
        const sorted = sortByNewest(list);
        writeList(storageKey, sorted);
        return sorted;
      }

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
      return local;
    }
  }

  return local;
}

const CHUNK_CHARS = 90_000;
const WRITE_CONCURRENCY = 20;
/** Raw file size that fits in one Firestore doc (~1 MiB limit). */
const FIRESTORE_BYTES_MAX = 900_000;
/** Files at or below this size use a single Storage upload. */
const STORAGE_SIMPLE_MAX = 8 * 1024 * 1024;

/** After Storage fails once, skip it for the rest of the session (avoids repeated hangs). */
let storageDisabled = false;

function storageAttemptTimeoutMs(fileSize: number): number {
  if (fileSize < 256 * 1024) return 5000;
  if (fileSize < 2 * 1024 * 1024) return 8000;
  return 15000;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToBlob(value: string, type = 'application/octet-stream'): Blob {
  return new Blob([base64ToBytes(value)], { type });
}

function isFirestoreFile(path?: string, url?: string): boolean {
  return Boolean(path?.startsWith('firestore:') || url?.startsWith('firestore:'));
}

function firestoreFileId(path?: string, url?: string, fallback = ''): string {
  const raw = path?.startsWith('firestore:') ? path : url?.startsWith('firestore:') ? url : '';
  return raw ? raw.slice('firestore:'.length) : fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function uploadViaStorage(
  storagePath: string,
  file: File,
  onProgress?: ProgressCb
): Promise<{ fileUrl: string; storagePath: string }> {
  if (!storage) {
    throw new Error('Cloud storage is not available.');
  }

  const fileRef = ref(storage, storagePath);
  onProgress?.(5);

  const uploadPromise =
    file.size <= STORAGE_SIMPLE_MAX
      ? (async () => {
          const snapshot = await uploadBytes(fileRef, file, {
            contentType: file.type || 'application/octet-stream',
          });
          onProgress?.(92);
          const fileUrl = await getDownloadURL(snapshot.ref);
          return { fileUrl, storagePath };
        })()
      : new Promise<{ fileUrl: string; storagePath: string }>((resolve, reject) => {
          const task = uploadBytesResumable(fileRef, file, {
            contentType: file.type || 'application/octet-stream',
          });
          task.on(
            'state_changed',
            (snapshot) => {
              const pct = snapshot.totalBytes
                ? Math.min(92, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 92))
                : 5;
              onProgress?.(pct);
            },
            reject,
            () => {
              void getDownloadURL(task.snapshot.ref)
                .then((fileUrl) => resolve({ fileUrl, storagePath }))
                .catch(reject);
            }
          );
        });

  onProgress?.(100);
  return uploadPromise;
}

function firestoreDataToBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (
    typeof data === 'object' &&
    data !== null &&
    'toUint8Array' in data &&
    typeof (data as { toUint8Array: () => Uint8Array }).toUint8Array === 'function'
  ) {
    return (data as { toUint8Array: () => Uint8Array }).toUint8Array();
  }
  throw new Error('Unsupported file data format.');
}

/** Fast single-write upload for small/medium files (no base64, no Storage). */
async function uploadViaFirestoreBytes(
  fileId: string,
  file: File,
  onProgress?: ProgressCb
): Promise<void> {
  if (!db) {
    throw new Error('Database is not available.');
  }

  onProgress?.(12);
  const bytes = new Uint8Array(await file.arrayBuffer());
  onProgress?.(35);

  await withFirestoreTimeout(
    setDoc(doc(db, 'assignmentFiles', fileId), {
      fileName: file.name,
      fileType: file.type || '',
      fileSize: file.size,
      chunkCount: 0,
      encoding: 'bytes-single',
      data: bytes,
    }),
    12000
  );
  onProgress?.(100);
}

async function runPool(
  count: number,
  limit: number,
  worker: (index: number) => Promise<void>,
  onProgress?: (done: number) => void
): Promise<void> {
  let next = 0;
  let done = 0;

  const run = async () => {
    while (next < count) {
      const index = next;
      next += 1;
      await worker(index);
      done += 1;
      onProgress?.(done);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, count) }, () => run()));
}

async function uploadViaFirestore(
  fileId: string,
  file: File,
  onProgress?: ProgressCb
): Promise<void> {
  if (!db) {
    throw new Error('Database is not available.');
  }

  onProgress?.(8);
  const base64 = await fileToBase64(file);
  onProgress?.(18);

  if (base64.length < 850_000) {
    await withFirestoreTimeout(
      setDoc(doc(db, 'assignmentFiles', fileId), {
        fileName: file.name,
        fileType: file.type || '',
        fileSize: file.size,
        chunkCount: 0,
        encoding: 'b64-single',
        data: base64,
      }),
      12000
    );
    onProgress?.(100);
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  }
  const total = chunks.length;

  await runPool(
    total,
    WRITE_CONCURRENCY,
    async (index) => {
      await withFirestoreTimeout(
        setDoc(doc(db, 'assignmentFiles', fileId, 'chunks', String(index)), {
          data: chunks[index],
          index,
        }),
        12000
      );
    },
    (done) => {
      onProgress?.(18 + Math.round((done / total) * 78));
    }
  );

  await withFirestoreTimeout(
    setDoc(doc(db, 'assignmentFiles', fileId), {
      fileName: file.name,
      fileType: file.type || '',
      fileSize: file.size,
      chunkCount: total,
      encoding: 'b64-split',
    }),
    12000
  );
  onProgress?.(100);
}

async function downloadFirestoreFile(fileId: string, fileName: string): Promise<void> {
  if (!db) {
    throw new Error('Database is not available.');
  }

  const meta = await withFirestoreTimeout(getDoc(doc(db, 'assignmentFiles', fileId)), 10000);
  const encoding = String(meta.data()?.encoding || '');
  const single = String(meta.data()?.data || '');
  const fileType = String(meta.data()?.fileType || '') || 'application/octet-stream';

  let blob: Blob;
  if (encoding === 'bytes-single') {
    blob = new Blob([firestoreDataToBytes(meta.data()?.data)], { type: fileType });
  } else if (encoding === 'b64-single' && single) {
    blob = base64ToBlob(single, fileType);
  } else {
    const snap = await getDocs(collection(db, 'assignmentFiles', fileId, 'chunks'));
    if (snap.empty) {
      throw new Error('This file could not be found.');
    }
    const ordered = snap.docs.sort((a, b) => Number(a.id) - Number(b.id));
    if (encoding === 'b64-split') {
      blob = base64ToBlob(ordered.map((item) => String(item.data().data || '')).join(''));
    } else {
      const parts = ordered.map((item) => base64ToBytes(String(item.data().data || '')));
      const size = parts.reduce((sum, part) => sum + part.length, 0);
      const merged = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        merged.set(part, offset);
        offset += part.length;
      }
      blob = new Blob([merged]);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  startBrowserDownload(objectUrl, fileName);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

async function deleteFirestoreFile(fileId: string): Promise<void> {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'assignmentFiles', fileId, 'chunks'));
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
    await deleteDoc(doc(db, 'assignmentFiles', fileId));
  } catch (err) {
    console.warn('Failed to delete Firestore file chunks:', err);
  }
}

function firestoreUploadResult(localId: string): {
  fileUrl: string;
  storagePath: string;
  localOnly: boolean;
  fileBackend: 'storage' | 'firestore';
} {
  return {
    fileUrl: `firestore:${localId}`,
    storagePath: `firestore:${localId}`,
    localOnly: false,
    fileBackend: 'firestore',
  };
}

async function uploadFile(
  storagePath: string,
  localId: string,
  file: File,
  onProgress?: ProgressCb
): Promise<{ fileUrl: string; storagePath: string; localOnly: boolean; fileBackend: 'storage' | 'firestore' }> {
  onProgress?.(1);

  void writeLocalBlob(localId, file).catch((err) => {
    console.warn('Failed to cache uploaded file locally:', err);
  });

  // Fast path: small files go straight to Firestore (binary, one write). Avoids Storage hangs.
  if (isFirebaseConfigured && db && file.size <= FIRESTORE_BYTES_MAX) {
    await uploadViaFirestoreBytes(localId, file, onProgress);
    return firestoreUploadResult(localId);
  }

  // Larger files: try Storage with a short timeout, then chunked Firestore fallback.
  if (storage && !storageDisabled) {
    try {
      const uploaded = await withTimeout(
        uploadViaStorage(storagePath, file, onProgress),
        storageAttemptTimeoutMs(file.size),
        'Storage upload timed out'
      );
      return {
        ...uploaded,
        localOnly: false,
        fileBackend: 'storage',
      };
    } catch (err) {
      storageDisabled = true;
      console.warn('Storage upload unavailable, using Firestore fallback:', err);
    }
  }

  if (isFirebaseConfigured && db) {
    await uploadViaFirestore(localId, file, onProgress);
    return firestoreUploadResult(localId);
  }

  onProgress?.(100);
  return {
    fileUrl: `local:${localId}`,
    storagePath: `local:${localId}`,
    localOnly: true,
    fileBackend: 'storage',
  };
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
  classId?: string;
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
    classId: input.classId,
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
    fileBackend: uploaded.fileBackend,
  };

  const list = readList<AssignmentMaterial>(ASSIGNMENTS_KEY).filter((item) => item.id !== id);
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
  const cached = readList<AssignmentSubmission>(SUBMISSIONS_KEY);
  const existing = cached.find((item) => item.id === id);

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
    fileBackend: uploaded.fileBackend,
  };

  writeList(
    SUBMISSIONS_KEY,
    [submission, ...cached.filter((item) => item.id !== id)]
  );
  await persistDoc('assignmentSubmissions', submission.id, submission);

  if (existing?.storagePath && existing.storagePath !== uploaded.storagePath) {
    if (isFirestoreFile(existing.storagePath, existing.fileUrl)) {
      void deleteFirestoreFile(firestoreFileId(existing.storagePath, existing.fileUrl, `sub_${id}`));
    } else if (storage) {
      void deleteObject(ref(storage, existing.storagePath)).catch((err) => {
        console.warn('Failed to remove previous submission file:', err);
      });
    }
  }

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

  if (existing) {
    if (isFirestoreFile(existing.storagePath, existing.fileUrl)) {
      await deleteFirestoreFile(firestoreFileId(existing.storagePath, existing.fileUrl, id));
    } else if (existing.storagePath && storage) {
      try {
        await deleteObject(ref(storage, existing.storagePath));
      } catch (err) {
        console.warn('Failed to delete assignment file from Storage:', err);
      }
    }
  }

  await deleteLocalBlob(id);

  for (const submission of related) {
    if (isFirestoreFile(submission.storagePath, submission.fileUrl)) {
      await deleteFirestoreFile(
        firestoreFileId(submission.storagePath, submission.fileUrl, `sub_${submission.id}`)
      );
    } else if (submission.storagePath && storage) {
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

function startBrowserDownload(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadStoredFile(options: {
  id: string;
  fileName: string;
  fileUrl: string;
  localId: string;
  storagePath?: string;
}): Promise<void> {
  if (isFirestoreFile(options.storagePath, options.fileUrl)) {
    await downloadFirestoreFile(
      firestoreFileId(options.storagePath, options.fileUrl, options.localId),
      options.fileName
    );
    return;
  }

  if (options.fileUrl.startsWith('http')) {
    startBrowserDownload(options.fileUrl, options.fileName);
    return;
  }

  const blob = await readLocalBlob(options.localId);
  if (blob) {
    const objectUrl = URL.createObjectURL(blob);
    startBrowserDownload(objectUrl, options.fileName);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
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
    storagePath: assignment.storagePath,
  });
}

export async function downloadSubmission(submission: AssignmentSubmission): Promise<void> {
  await downloadStoredFile({
    id: submission.id,
    fileName: submission.fileName,
    fileUrl: submission.fileUrl,
    localId: `sub_${submission.id}`,
    storagePath: submission.storagePath,
  });
}
