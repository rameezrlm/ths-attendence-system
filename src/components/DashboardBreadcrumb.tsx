import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface DashboardBreadcrumbProps {
  items: string[];
}

export const DashboardBreadcrumb: React.FC<DashboardBreadcrumbProps> = ({ items }) => {
  return (
    <nav
      id="dashboard-breadcrumb"
      aria-label="Breadcrumb"
      className="bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <li className="inline-flex items-center gap-1">
            <Home className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-600">IT Lab</span>
          </li>
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="inline-flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-slate-300" />
              <span
                className={
                  index === items.length - 1
                    ? 'font-semibold text-slate-800'
                    : 'font-medium text-slate-600'
                }
              >
                {item}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
};
