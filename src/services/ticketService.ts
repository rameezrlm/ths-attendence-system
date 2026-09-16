import { collection, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { Ticket, TicketStatus } from '../types';
import { withFirestoreTimeout } from '../utils/firestoreTimeout';

const TICKETS_KEY = 'it_lab_tickets';
const TICKETS_CHANGED_EVENT = 'it-lab-tickets-changed';

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'approved',
  'in_progress',
  'resolved',
];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'New issue',
  approved: 'Issue approved',
  in_progress: 'In progress',
  resolved: 'Work done / resolved',
};

export const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-slate-100 text-slate-700 border-slate-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  resolved: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

function newId(): string {
  return `tk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function readTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(TICKETS_KEY);
    return raw ? (JSON.parse(raw) as Ticket[]) : [];
  } catch {
    return [];
  }
}

function writeTickets(list: Ticket[], notify = false): void {
  try {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(list));
    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(TICKETS_CHANGED_EVENT));
    }
  } catch (err) {
    console.error('Failed to save tickets to localStorage', err);
  }
}

function ticketUpdatedAt(ticket: Ticket): string {
  return ticket.updatedAt || ticket.createdAt || '';
}

function mergeTickets(remote: Ticket[], local: Ticket[]): Ticket[] {
  const map = new Map<string, Ticket>();
  for (const ticket of remote) {
    map.set(ticket.id, ticket);
  }
  for (const ticket of local) {
    const existing = map.get(ticket.id);
    if (!existing || ticketUpdatedAt(ticket) >= ticketUpdatedAt(existing)) {
      map.set(ticket.id, ticket);
    }
  }
  return [...map.values()];
}

function toFirestorePayload(ticket: Ticket): Record<string, unknown> {
  return JSON.parse(JSON.stringify(ticket)) as Record<string, unknown>;
}

function sortTickets(list: Ticket[]): Ticket[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function normalizeTicketStatus(status: string | undefined): TicketStatus {
  if (status === 'approved' || status === 'in_progress' || status === 'resolved' || status === 'open') {
    return status;
  }
  if (status === 'pending' || status === 'rejected') {
    return 'open';
  }
  return 'open';
}

async function persistTicket(ticket: Ticket): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'tickets', ticket.id), toFirestorePayload(ticket), { merge: true });
    } catch (err) {
      console.error(`Error saving ticket ${ticket.id} to Firestore:`, err);
    }
  }
}

export function subscribeTicketUpdates(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 200);
  };

  window.addEventListener(TICKETS_CHANGED_EVENT, trigger);
  const onStorage = (event: StorageEvent) => {
    if (event.key === TICKETS_KEY || event.key === null) trigger();
  };
  window.addEventListener('storage', onStorage);

  let unsubscribeFirestore: (() => void) | undefined;
  if (isFirebaseConfigured && db) {
    unsubscribeFirestore = onSnapshot(
      collection(db, 'tickets'),
      trigger,
      (err) => {
        console.warn('Ticket live updates unavailable:', err);
      }
    );
  }

  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener(TICKETS_CHANGED_EVENT, trigger);
    window.removeEventListener('storage', onStorage);
    unsubscribeFirestore?.();
  };
}

export function readTicketsLocal(): Ticket[] {
  return sortTickets(
    readTickets().map((ticket) => ({
      ...ticket,
      status: normalizeTicketStatus(ticket.status),
    }))
  );
}

export async function fetchTickets(): Promise<Ticket[]> {
  const hydrate = (list: Ticket[]) =>
    sortTickets(
      list.map((ticket) => ({
        ...ticket,
        status: normalizeTicketStatus(ticket.status),
      }))
    );

  const local = hydrate(readTickets());

  if (isFirebaseConfigured && db) {
    try {
      const snap = await withFirestoreTimeout(getDocs(collection(db, 'tickets')));
      if (!snap.empty) {
        const remote: Ticket[] = [];
        snap.forEach((d) => {
          remote.push({ ...(d.data() as Ticket), id: d.id });
        });
        const merged = hydrate(mergeTickets(remote, local));
        writeTickets(merged);

        for (const ticket of merged) {
          const remoteTicket = remote.find((item) => item.id === ticket.id);
          if (!remoteTicket || ticketUpdatedAt(ticket) > ticketUpdatedAt(remoteTicket)) {
            void persistTicket(ticket);
          }
        }
        return merged;
      }

      if (local.length > 0) {
        for (const ticket of local) {
          try {
            await setDoc(doc(db, 'tickets', ticket.id), toFirestorePayload(ticket));
          } catch (e) {
            console.error('Error migrating ticket to Firestore:', e);
          }
        }
        return local;
      }

      writeTickets([]);
      return [];
    } catch (err) {
      console.warn('Error fetching tickets from Firestore, using local:', err);
      return local;
    }
  }

  return local;
}

export async function fetchStudentTickets(studentId: string): Promise<Ticket[]> {
  const all = await fetchTickets();
  return all.filter((t) => t.studentId === studentId);
}

export async function createTicket(input: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  message: string;
  classId?: string;
}): Promise<Ticket> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject) {
    throw new Error('Please enter a subject.');
  }
  if (!message) {
    throw new Error('Please describe your ticket.');
  }

  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: newId(),
    classId: input.classId,
    studentId: input.studentId,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    subject,
    message,
    status: 'open',
    seenByStudent: true,
    createdAt: now,
    updatedAt: now,
  };

  const list = await fetchTickets();
  writeTickets([ticket, ...list], true);
  await persistTicket(ticket);
  return ticket;
}

export function nextTicketStatus(status: TicketStatus): TicketStatus | null {
  if (status === 'open') return 'approved';
  if (status === 'approved') return 'in_progress';
  if (status === 'in_progress') return 'resolved';
  return null;
}

export function nextTicketActionLabel(status: TicketStatus): string | null {
  if (status === 'open') return 'Approve issue';
  if (status === 'approved') return 'Start progress';
  if (status === 'in_progress') return 'Mark work done';
  return null;
}

export async function advanceTicketStatus(
  ticketId: string,
  teacherName: string,
  teacherNote?: string
): Promise<Ticket> {
  const list = await fetchTickets();
  const index = list.findIndex((t) => t.id === ticketId);
  if (index === -1) {
    throw new Error('Ticket not found');
  }

  const current = list[index];
  const next = nextTicketStatus(current.status);
  if (!next) {
    throw new Error('This ticket is already resolved.');
  }

  const now = new Date().toISOString();
  const note = teacherNote?.trim();
  const updated: Ticket = {
    ...current,
    status: next,
    teacherNote: note || current.teacherNote || '',
    resolvedBy: teacherName,
    seenByStudent: false,
    updatedAt: now,
  };
  if (next === 'resolved') {
    updated.resolvedAt = now;
  } else if (current.resolvedAt) {
    updated.resolvedAt = current.resolvedAt;
  } else {
    delete updated.resolvedAt;
  }

  list[index] = updated;
  writeTickets(list, true);
  await persistTicket(updated);
  return updated;
}

export async function markStudentTicketsSeen(studentId: string): Promise<void> {
  const list = await fetchTickets();
  let changed = false;

  const next = list.map((ticket) => {
    if (ticket.studentId !== studentId || ticket.status === 'open' || ticket.seenByStudent) {
      return ticket;
    }
    changed = true;
    const updated: Ticket = { ...ticket, seenByStudent: true };
    void persistTicket(updated);
    return updated;
  });

  if (changed) {
    writeTickets(next, true);
  }
}

export function pendingTicketCount(tickets: Ticket[]): number {
  return tickets.filter((t) => t.status !== 'resolved').length;
}

export function unreadNotificationCount(tickets: Ticket[], studentId: string): number {
  return tickets.filter(
    (t) => t.studentId === studentId && t.status !== 'open' && !t.seenByStudent
  ).length;
}

export function formatTicketTime(iso: string): string {
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
