import React, { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import type { Ticket } from '../types';
import {
  fetchStudentTickets,
  formatTicketTime,
  markStudentTicketsSeen,
  readTicketsLocal,
  subscribeTicketUpdates,
  TICKET_STATUS_LABELS,
} from '../services/ticketService';
import { TicketProgress, TicketStatusBadge } from './TicketStatusBadge';

interface StudentNotificationsProps {
  classId: string;
  studentId: string;
  onNotificationsSeen?: () => void;
}

export const StudentNotifications: React.FC<StudentNotificationsProps> = ({
  classId,
  studentId,
  onNotificationsSeen,
}) => {
  const [tickets, setTickets] = useState(() =>
    readTicketsLocal().filter(
      (ticket) => ticket.studentId === studentId && ticket.classId === classId
    )
  );
  const [isLoading, setIsLoading] = useState(
    () => readTicketsLocal().filter((ticket) => ticket.studentId === studentId).length === 0
  );

  useEffect(() => {
    let cancelled = false;

    const load = async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const list = (await fetchStudentTickets(studentId)).filter(
          (ticket) => ticket.classId === classId
        );
        if (cancelled) return;
        setTickets(list);
        await markStudentTicketsSeen(studentId);
        if (!cancelled) onNotificationsSeen?.();
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        if (!cancelled && !silent) setIsLoading(false);
      }
    };

    const hasCache = readTicketsLocal().some((ticket) => ticket.studentId === studentId);
    void load(hasCache);
    const unsubscribe = subscribeTicketUpdates(() => {
      void load(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [studentId, classId]);

  const notifications = useMemo(
    () => tickets.filter((t) => t.status !== 'open'),
    [tickets]
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div id="student-notifications" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Notifications</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Status updates for your tickets: Issue approved, In progress, and Work done / resolved.
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No notifications yet</p>
          <p className="text-xs text-slate-500 mt-1">
            You will be notified when admin approves an issue or updates its progress.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((ticket) => (
            <li
              key={ticket.id}
              className={`bg-white rounded-xl border shadow-xs p-4 ${
                ticket.status === 'approved'
                  ? 'border-emerald-200'
                  : ticket.status === 'resolved'
                  ? 'border-indigo-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                  <p className="text-xs text-slate-500 mt-1">{ticket.message}</p>
                </div>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <TicketProgress status={ticket.status} />
              {ticket.teacherNote && (
                <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  Note: {ticket.teacherNote}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                {TICKET_STATUS_LABELS[ticket.status]} ·{' '}
                {formatTicketTime(ticket.resolvedAt || ticket.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
