import React from 'react';
import { Users, UserCheck, UserX, Clock, LogOut as EarlyLeftIcon } from 'lucide-react';
import type { AttendanceSummary } from '../types';

interface SummaryCardsProps {
  summary: AttendanceSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const cards = [
    {
      id: 'card-total-students',
      label: 'Enrolled',
      count: summary.totalStudents,
      icon: Users,
      iconColor: 'text-slate-500',
      bgColor: 'bg-slate-50',
    },
    {
      id: 'card-present-count',
      label: 'Present',
      count: summary.present,
      icon: UserCheck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      id: 'card-absent-count',
      label: 'Absent',
      count: summary.absent,
      icon: UserX,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      id: 'card-late-count',
      label: 'Late',
      count: summary.late,
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      id: 'card-early-left-count',
      label: 'Early Left',
      count: summary.earlyLeft,
      icon: EarlyLeftIcon,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
  ];

  return (
    <div id="summary-cards-container" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            id={card.id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900 leading-tight">{card.count}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${card.bgColor} ${card.iconColor} flex items-center justify-center shrink-0`}>
              <IconComponent className="w-4 h-4" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
