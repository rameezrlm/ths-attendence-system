import React, { useEffect, useMemo, useState } from 'react';
import { Check, Ticket as TicketIcon, X } from 'lucide-react';
import type { Ticket, TicketStatus, UserSession } from '../types';
import {
  fetchTickets,
  formatTicketTime,
  pendingTicketCount,
  resolveTicket,
} from '../services/ticketService';

interface TeacherTicketsProps {
  session: UserSession;
  showToast: (type: 'success' | 'error', message: string) => void;
  onStatsChange?: (pending: number) => void;
}

type TicketFilter = 'pending' | 'all' | 'approved' | 'rejected';

const STATUS_STYLES: Record<TicketStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const TeacherTickets: React.FC<TeacherTicketsProps> = ({
  session,
  showToast,
  onStatsChange,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<TicketFilter>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const list = await fetchTickets();
      setTickets(list);
      onStatsChange?.(pendingTicketCount(list));
    } catch (err) {
      console.error('Failed to load tickets:', err);
      showToast('error', 'Failed to load tickets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter]);

  const handleResolve = async (ticket: Ticket, status: 'approved' | 'rejected') => {
    try {
      setResolvingId(ticket.id);
      const updated = await resolveTicket(
        ticket.id,
        status,
        session.name,
        notes[ticket.id]
      );
      setTickets((prev) => {
        const next = prev.map((t) => (t.id === updated.id ? updated : t));
        onStatsChange?.(pendingTicketCount(next));
        return next;
      });
      showToast(
        'success',
        status === 'approved' ? `"${ticket.subject}" approved.` : `"${ticket.subject}" rejected.`
      );
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update ticket.');
    } finally {
      setResolvingId(null);
    }
  };

  const counts = {
    pending: tickets.filter((t) => t.status === 'pending').length,
    approved: tickets.filter((t) => t.status === 'approved').length,
    rejected: tickets.filter((t) => t.status === 'rejected').length,
    all: tickets.length,
  };

  return (
    <div id="teacher-tickets" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tickets</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Review student tickets. Approve or reject each request.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['pending', 'Pending', counts.pending],
            ['approved', 'Approved', counts.approved],
            ['rejected', 'Rejected', counts.rejected],
            ['all', 'All', counts.all],
          ] as [TicketFilter, string, number][]
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
              filter === id
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
            <span
              className={`min-w-[1.25rem] text-center rounded-md px-1 text-[10px] font-bold ${
                filter === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading tickets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">
              {filter === 'pending' ? 'No pending tickets' : 'No tickets in this filter'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {filter === 'pending'
                ? 'New student tickets will appear here.'
                : 'Try another filter.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((ticket) => (
              <li key={ticket.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{ticket.subject}</p>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${STATUS_STYLES[ticket.status]}`}
                      >
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ticket.studentName} · {ticket.studentEmail}
                    </p>
                    <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{ticket.message}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Posted {formatTicketTime(ticket.createdAt)}
                    </p>
                  </div>
                </div>

                {ticket.status === 'pending' ? (
                  <div className="mt-4 space-y-3">
                    <textarea
                      rows={2}
                      placeholder="Optional note for the student..."
                      value={notes[ticket.id] || ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={resolvingId === ticket.id}
                        onClick={() => handleResolve(ticket, 'approved')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={resolvingId === ticket.id}
                        onClick={() => handleResolve(ticket, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">
                    {ticket.resolvedBy ? `Resolved by ${ticket.resolvedBy}` : 'Resolved'}
                    {ticket.resolvedAt ? ` · ${formatTicketTime(ticket.resolvedAt)}` : ''}
                    {ticket.teacherNote ? (
                      <p className="mt-2 text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        Note: {ticket.teacherNote}
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
