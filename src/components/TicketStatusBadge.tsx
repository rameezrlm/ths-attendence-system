import React from 'react';
import type { TicketStatus } from '../types';
import {
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
} from '../services/ticketService';

interface TicketStatusBadgeProps {
  status: TicketStatus;
}

export const TicketStatusBadge: React.FC<TicketStatusBadgeProps> = ({ status }) => (
  <span
    className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${TICKET_STATUS_STYLES[status]}`}
  >
    {TICKET_STATUS_LABELS[status]}
  </span>
);

interface TicketProgressProps {
  status: TicketStatus;
}

export const TicketProgress: React.FC<TicketProgressProps> = ({ status }) => {
  const currentIndex = TICKET_STATUSES.indexOf(status);

  return (
    <ol className="mt-3 grid grid-cols-4 gap-1">
      {TICKET_STATUSES.map((step, index) => {
        const reached = index <= currentIndex;
        return (
          <li key={step} className="min-w-0">
            <div
              className={`h-1.5 rounded-full ${
                reached ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            />
            <p
              className={`mt-1.5 text-[10px] leading-tight font-medium truncate ${
                index === currentIndex ? 'text-slate-800' : 'text-slate-400'
              }`}
              title={TICKET_STATUS_LABELS[step]}
            >
              {TICKET_STATUS_LABELS[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
};
