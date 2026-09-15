import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { Announcement } from '../types';

const ANNOUNCEMENTS_KEY = 'it_lab_announcements';
const ANNOUNCEMENTS_CHANGED_EVENT = 'it-lab-announcements-changed';

function newId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function readAnnouncements(): Announcement[] {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_KEY);
    return raw ? (JSON.parse(raw) as Announcement[]) : [];
  } catch {
    return [];
  }
}

function writeAnnouncements(list: Announcement[], notify = false): void {
  try {
    localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(list));
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ANNOUNCEMENTS_CHANGED_EVENT));
    }
  } catch (err) {
    console.error('Failed to save announcements to localStorage', err);
  }
}

function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function toPayload(announcement: Announcement): Record<string, unknown> {
  return JSON.parse(JSON.stringify(announcement)) as Record<string, unknown>;
}

async function persistAnnouncement(announcement: Announcement): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'announcements', announcement.id), toPayload(announcement), {
        merge: true,
      });
    } catch (err) {
      console.error(`Error saving announcement ${announcement.id}:`, err);
    }
  }
}

export function formatAnnouncementTime(iso: string): string {
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

export function subscribeAnnouncementUpdates(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 200);
  };

  window.addEventListener(ANNOUNCEMENTS_CHANGED_EVENT, trigger);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ANNOUNCEMENTS_KEY || event.key === null) trigger();
  };
  window.addEventListener('storage', onStorage);

  let unsubscribeFirestore: (() => void) | undefined;
  if (isFirebaseConfigured && db) {
    unsubscribeFirestore = onSnapshot(
      collection(db, 'announcements'),
      trigger,
      (err) => {
        console.warn('Announcement live updates unavailable:', err);
      }
    );
  }

  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener(ANNOUNCEMENTS_CHANGED_EVENT, trigger);
    window.removeEventListener('storage', onStorage);
    unsubscribeFirestore?.();
  };
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'announcements'));
      if (!snap.empty) {
        const list: Announcement[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Announcement), id: d.id });
        });
        const sorted = sortAnnouncements(list);
        writeAnnouncements(sorted);
        return sorted;
      }

      const local = sortAnnouncements(readAnnouncements());
      if (local.length > 0) {
        for (const announcement of local) {
          try {
            await setDoc(doc(db, 'announcements', announcement.id), toPayload(announcement));
          } catch (e) {
            console.error('Error migrating announcement to Firestore:', e);
          }
        }
        return local;
      }

      writeAnnouncements([]);
      return [];
    } catch (err) {
      console.warn('Error fetching announcements from Firestore, using local:', err);
      return sortAnnouncements(readAnnouncements());
    }
  }

  return sortAnnouncements(readAnnouncements());
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  createdBy: string;
}): Promise<Announcement> {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) {
    throw new Error('Please enter a title.');
  }
  if (!message) {
    throw new Error('Please enter an announcement message.');
  }

  const announcement: Announcement = {
    id: newId(),
    title,
    message,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  const list = await fetchAnnouncements();
  writeAnnouncements([announcement, ...list], true);
  await persistAnnouncement(announcement);
  return announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const next = (await fetchAnnouncements()).filter((item) => item.id !== id);
  writeAnnouncements(next, true);

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      console.error('Error deleting announcement from Firestore:', err);
    }
  }
}
