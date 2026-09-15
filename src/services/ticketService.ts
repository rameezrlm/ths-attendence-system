import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/firebaseConfig';
import type { Ticket, TicketStatus } from '../types';

const TICKETS_KEY = 'it_lab_tickets';

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

function writeTickets(list: Ticket[]): void {
  try {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save tickets to localStorage', err);
  }
}

function sortTickets(list: Ticket[]): Ticket[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function persistTicket(ticket: Ticket): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'tickets', ticket.id), ticket, { merge: true });
    } catch (err) {
      console.error(`Error saving ticket ${ticket.id} to Firestore:`, err);
    }
  }
}

export async function fetchTickets(): Promise<Ticket[]> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'tickets'));
      if (!snap.empty) {
        const list: Ticket[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Ticket), id: d.id });
        });
        writeTickets(list);
        return sortTickets(list);
      }

      const local = readTickets();
      if (local.length > 0) {
        for (const ticket of local) {
          try {
            await setDoc(doc(db, 'tickets', ticket.id), ticket);
          } catch (e) {
            console.error('Error migrating ticket to Firestore:', e);
          }
        }
        return sortTickets(local);
      }

      writeTickets([]);
      return [];
    } catch (err) {
      console.warn('Error fetching tickets from Firestore, using local:', err);
      return sortTickets(readTickets());
    }
  }

  return sortTickets(readTickets());
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
    studentId: input.studentId,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    subject,
    message,
    status: 'pending',
    seenByStudent: true,
    createdAt: now,
    updatedAt: now,
  };

  const list = await fetchTickets();
  writeTickets([ticket, ...list]);
  await persistTicket(ticket);
  return ticket;
}

export async function resolveTicket(
  ticketId: string,
  status: Exclude<TicketStatus, 'pending'>,
  resolvedBy: string,
  teacherNote?: string
): Promise<Ticket> {
  const list = await fetchTickets();
  const index = list.findIndex((t) => t.id === ticketId);
  if (index === -1) {
    throw new Error('Ticket not found');
  }

  const now = new Date().toISOString();
  const updated: Ticket = {
    ...list[index],
    status,
    teacherNote: teacherNote?.trim() || '',
    resolvedBy,
    resolvedAt: now,
    seenByStudent: false,
    updatedAt: now,
  };

  list[index] = updated;
  writeTickets(list);
  await persistTicket(updated);
  return updated;
}

export async function markStudentTicketsSeen(studentId: string): Promise<void> {
  const list = await fetchTickets();
  const now = new Date().toISOString();
  let changed = false;

  const next = list.map((ticket) => {
    if (ticket.studentId !== studentId || ticket.status === 'pending' || ticket.seenByStudent) {
      return ticket;
    }
    changed = true;
    const updated: Ticket = { ...ticket, seenByStudent: true, updatedAt: now };
    void persistTicket(updated);
    return updated;
  });

  if (changed) {
    writeTickets(next);
  }
}

export function pendingTicketCount(tickets: Ticket[]): number {
  return tickets.filter((t) => t.status === 'pending').length;
}

export function unreadNotificationCount(tickets: Ticket[], studentId: string): number {
  return tickets.filter(
    (t) => t.studentId === studentId && t.status !== 'pending' && !t.seenByStudent
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
