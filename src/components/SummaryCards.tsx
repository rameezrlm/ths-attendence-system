import React from 'react';
import { Users, UserCheck, UserX, Clock, LogOut as EarlyLeftIcon } from 'lucide-react';
import type { AttendanceFilter, AttendanceSummary } from '../types';

interface SummaryCardsProps {
  summary: AttendanceSummary;
  activeFilter?: AttendanceFilter;
  onFilterChange?: (filter: AttendanceFilter) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  activeFilter = 'all',
  onFilterChange,
}) => {
  const cards = [
    {
      id: 'card-total-students',
      filter: 'all' as AttendanceFilter,
      label: 'Enrolled',
      count: summary.totalStudents,
      icon: Users,
      iconColor: 'text-slate-500',
      bgColor: 'bg-slate-50',
      activeClasses: 'border-slate-800 ring-2 ring-slate-800/15',
    },
    {
      id: 'card-present-count',
      filter: 'present' as AttendanceFilter,
      label: 'Present',
      count: summary.present,
      icon: UserCheck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      activeClasses: 'border-green-500 ring-2 ring-green-500/20',
    },
    {
      id: 'card-absent-count',
      filter: null,
      label: 'Absent',
      count: summary.absent,
      icon: UserX,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      activeClasses: '',
    },
    {
      id: 'card-late-count',
      filter: 'late' as AttendanceFilter,
      label: 'Late',
      count: summary.late,
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      activeClasses: 'border-amber-500 ring-2 ring-amber-500/20',
    },
    {
      id: 'card-early-left-count',
      filter: null,
      label: 'Early Left',
      count: summary.earlyLeft,
      icon: EarlyLeftIcon,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      activeClasses: '',
    },
  ];

  return (
    <div id="summary-cards-container" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isClickable = Boolean(onFilterChange && card.filter !== null);
        const isActive = card.filter !== null && activeFilter === card.filter;

        const content = (
          <>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900 leading-tight">{card.count}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${card.bgColor} ${card.iconColor} flex items-center justify-center shrink-0`}>
              <IconComponent className="w-4 h-4" />
            </div>
          </>
        );

          const className = `bg-white rounded-xl border p-4 shadow-xs flex items-center justify-between transition-all w-full text-left ${
            isActive ? card.activeClasses : 'border-slate-200'
          } ${isClickable ? 'cursor-pointer hover:border-slate-300' : ''}`;

        if (isClickable && card.filter) {
          return (
            <button
              key={card.id}
              id={card.id}
              type="button"
              onClick={() =>
                onFilterChange?.(activeFilter === card.filter ? 'all' : card.filter)
              }
              className={className}
              title={`Show ${card.label.toLowerCase()} students`}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={card.id} id={card.id} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
};
