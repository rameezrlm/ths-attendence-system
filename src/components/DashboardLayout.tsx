import React from 'react';
import { Header } from './Header';
import { DashboardBreadcrumb } from './DashboardBreadcrumb';
import { WorkspaceTabs, type WorkspaceTab } from './WorkspaceTabs';
import type { UserSession } from '../types';

interface DashboardLayoutProps {
  session: UserSession;
  onLogout: () => void;
  todayDisplay: string;
  breadcrumb: string[];
  tabs?: WorkspaceTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  tabsId?: string;
  onOpenProfile?: () => void;
  isProfileActive?: boolean;
  onOpenNotifications?: () => void;
  isNotificationsActive?: boolean;
  notificationCount?: number;
  roleLabel?: string;
  contentMaxWidth?: '3xl' | '7xl';
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  session,
  onLogout,
  todayDisplay,
  breadcrumb,
  tabs,
  activeTab,
  onTabChange,
  tabsId,
  onOpenProfile,
  isProfileActive,
  onOpenNotifications,
  isNotificationsActive,
  notificationCount = 0,
  roleLabel,
  contentMaxWidth = '7xl',
  children,
}) => {
  const maxWidthClass = contentMaxWidth === '3xl' ? 'max-w-3xl' : 'max-w-7xl';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col antialiased">
      <Header
        session={session}
        onLogout={onLogout}
        todayDisplay={todayDisplay}
        onOpenProfile={onOpenProfile}
        isProfileActive={isProfileActive}
        onOpenNotifications={onOpenNotifications}
        isNotificationsActive={isNotificationsActive}
        notificationCount={notificationCount}
        roleLabel={roleLabel}
      />

      <DashboardBreadcrumb items={breadcrumb} />

      {tabs && activeTab && onTabChange && (
        <WorkspaceTabs
          id={tabsId}
          tabs={tabs}
          activeTab={activeTab}
          onChange={onTabChange}
        />
      )}

      <main className={`flex-1 ${maxWidthClass} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6`}>
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        IT Lab Student Attendance Management System • Taleem-O-Hunar Society
      </footer>
    </div>
  );
};
