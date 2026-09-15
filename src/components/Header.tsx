import React from 'react';
import { LogOut } from 'lucide-react';
import type { UserSession } from '../types';

interface HeaderProps {
  session: UserSession;
  onLogout: () => void;
  onOpenTeacherManagement?: () => void;
  todayDisplay: string;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  onLogout,
  todayDisplay,
}) => {
  const displayName = session.name || session.email;
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-slate-200 p-1 bg-white shadow-xs flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              IT Lab Attendance
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Taleem-O-Hunar Society
            </p>
          </div>
        </div>

        {/* Right: Date, Profile Avatar, Logout */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Today Date */}
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            {todayDisplay}
          </span>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Profile Icon as in professional sites */}
          <div
            id="user-profile-menu"
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {initial}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-700 max-w-[130px] truncate leading-tight">
                {displayName}
              </p>
              {session.role === 'student' && (
                <p className="text-[10px] text-slate-400 font-medium">Student</p>
              )}
            </div>
          </div>

          {/* Clean Logout */}
          <button
            id="btn-logout"
            type="button"
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
