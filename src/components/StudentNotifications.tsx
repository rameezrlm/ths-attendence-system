import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import type { Ticket } from '../types';
import {
  fetchStudentTickets,
  formatTicketTime,
  markStudentTicketsSeen,
} from '../services/ticketService';

interface StudentNotificationsProps {
  studentId: string;
  onNotificationsSeen?: () => void;
}

export const StudentNotifications: React.FC<StudentNotificationsProps> = ({
  studentId,
  onNotificationsSeen,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const list = await fetchStudentTickets(studentId);
        if (cancelled) return;
        setTickets(list);
        await markStudentTicketsSeen(studentId);
        if (!cancelled) onNotificationsSeen?.();
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const notifications = useMemo(
    () => tickets.filter((t) => t.status === 'approved' || t.status === 'rejected'),
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
          Ticket updates from your teacher. Approved tickets are marked here.
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No notifications yet</p>
          <p className="text-xs text-slate-500 mt-1">
            When a teacher approves or rejects a ticket, it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((ticket) => {
            const isApproved = ticket.status === 'approved';
            return (
              <li
                key={ticket.id}
                className={`bg-white rounded-xl border shadow-xs p-4 ${
                  isApproved ? 'border-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 mt-1">{ticket.message}</p>
                  </div>
                  {isApproved ? (
                    <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border bg-emerald-50 text-emerald-800 border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approved
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border bg-red-50 text-red-700 border-red-200">
                      Rejected
                    </span>
                  )}
                </div>
                {ticket.teacherNote && (
                  <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    Teacher note: {ticket.teacherNote}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-2">
                  {formatTicketTime(ticket.resolvedAt || ticket.updatedAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
