import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Ticket as TicketIcon } from 'lucide-react';
import type { Ticket } from '../types';
import {
  createTicket,
  fetchStudentTickets,
  formatTicketTime,
  readTicketsLocal,
  subscribeTicketUpdates,
} from '../services/ticketService';
import { TicketProgress, TicketStatusBadge } from './TicketStatusBadge';

interface StudentTicketsProps {
  classId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  onTicketsChanged?: () => void;
}

export const StudentTickets: React.FC<StudentTicketsProps> = ({
  classId,
  studentId,
  studentName,
  studentEmail,
  onTicketsChanged,
}) => {
  const [tickets, setTickets] = useState(() =>
    readTicketsLocal().filter(
      (ticket) => ticket.studentId === studentId && ticket.classId === classId
    )
  );
  const [isLoading, setIsLoading] = useState(
    () => readTicketsLocal().filter((ticket) => ticket.studentId === studentId).length === 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTickets = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const list = (await fetchStudentTickets(studentId)).filter(
        (ticket) => ticket.classId === classId
      );
      setTickets(list);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      if (!silent) setError('Failed to load tickets.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const hasCache = readTicketsLocal().some((ticket) => ticket.studentId === studentId);
    void loadTickets(hasCache);
    return subscribeTicketUpdates(() => {
      void loadTickets(true);
    });
  }, [studentId, classId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setIsSubmitting(true);
      const created = await createTicket({
        studentId,
        studentName,
        studentEmail,
        subject,
        message,
        classId,
      });
      setTickets((prev) => [created, ...prev]);
      setSubject('');
      setMessage('');
      setSuccess('Ticket submitted as a new issue. You will get updates as it moves forward.');
      onTicketsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="student-tickets" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tickets</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Post an issue. Admin will move it through Issue approved, In progress, then Work done.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-indigo-600" />
          New Ticket
        </h3>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="ticket-subject" className="block text-xs font-semibold text-slate-700 mb-1">
              Subject
            </label>
            <input
              id="ticket-subject"
              type="text"
              required
              placeholder="e.g. Lab PC not turning on"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="ticket-message" className="block text-xs font-semibold text-slate-700 mb-1">
              Message
            </label>
            <textarea
              id="ticket-message"
              required
              rows={4}
              placeholder="Describe the issue..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>
          <div className="flex justify-end">
            <button
              id="btn-submit-ticket"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Post Ticket'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">My Tickets</h3>
        </div>
        {isLoading ? (
          <div className="p-10 text-center">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center">
            <TicketIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No tickets yet</p>
            <p className="text-xs text-slate-400 mt-1">Post a ticket above to send it to admin.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{ticket.message}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{formatTicketTime(ticket.createdAt)}</p>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </div>
                <TicketProgress status={ticket.status} />
                {ticket.status !== 'open' && ticket.teacherNote && (
                  <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    Note: {ticket.teacherNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
