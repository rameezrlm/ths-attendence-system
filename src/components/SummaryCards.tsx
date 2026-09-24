import React from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  LogOut as EarlyLeftIcon,
  Plane,
  CircleDashed,
} from 'lucide-react';
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
  const cards: {
    id: string;
    filter: AttendanceFilter;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    bgColor: string;
    activeClasses: string;
  }[] = [
    {
      id: 'card-total-students',
      filter: 'all',
      label: 'Enrolled',
      count: summary.totalStudents,
      icon: Users,
      iconColor: 'text-slate-500',
      bgColor: 'bg-slate-50',
      activeClasses: 'border-slate-800 ring-2 ring-slate-800/15',
    },
    {
      id: 'card-present-count',
      filter: 'present',
      label: 'Present',
      count: summary.present,
      icon: UserCheck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      activeClasses: 'border-green-500 ring-2 ring-green-500/20',
    },
    {
      id: 'card-absent-count',
      filter: 'absent',
      label: 'Absent',
      count: summary.absent,
      icon: UserX,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      activeClasses: 'border-red-500 ring-2 ring-red-500/20',
    },
    {
      id: 'card-late-count',
      filter: 'late',
      label: 'Late',
      count: summary.late,
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      activeClasses: 'border-amber-500 ring-2 ring-amber-500/20',
    },
    {
      id: 'card-early-left-count',
      filter: 'early_left',
      label: 'Early Left',
      count: summary.earlyLeft,
      icon: EarlyLeftIcon,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      activeClasses: 'border-teal-500 ring-2 ring-teal-500/20',
    },
    {
      id: 'card-leave-count',
      filter: 'leave',
      label: 'Leave',
      count: summary.leave,
      icon: Plane,
      iconColor: 'text-violet-600',
      bgColor: 'bg-violet-50',
      activeClasses: 'border-violet-500 ring-2 ring-violet-500/20',
    },
    {
      id: 'card-unmarked-count',
      filter: 'unmarked',
      label: 'Unmarked',
      count: summary.unmarked,
      icon: CircleDashed,
      iconColor: 'text-slate-500',
      bgColor: 'bg-slate-50',
      activeClasses: 'border-slate-500 ring-2 ring-slate-500/20',
    },
  ];

  return (
    <div
      id="summary-cards-container"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4"
    >
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isClickable = Boolean(onFilterChange);
        const isActive = activeFilter === card.filter;

        const content = (
          <>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900 leading-tight">{card.count}</p>
            </div>
            <div
              className={`w-9 h-9 rounded-lg ${card.bgColor} ${card.iconColor} flex items-center justify-center shrink-0`}
            >
              <IconComponent className="w-4 h-4" />
            </div>
          </>
        );

        const className = `bg-white rounded-xl border p-4 shadow-xs flex items-center justify-between transition-all w-full text-left ${
          isActive ? card.activeClasses : 'border-slate-200'
        } ${isClickable ? 'cursor-pointer hover:border-slate-300' : ''}`;

        if (isClickable) {
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
