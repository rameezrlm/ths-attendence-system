import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import type { Announcement } from '../types';
import {
  fetchAnnouncements,
  formatAnnouncementTime,
  subscribeAnnouncementUpdates,
} from '../services/announcementService';

export const StudentAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      setAnnouncements(await fetchAnnouncements());
      setError(null);
    } catch (err) {
      console.error('Failed to load announcements:', err);
      if (!silent) setError('Failed to load announcements.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnnouncements();
    return subscribeAnnouncementUpdates(() => {
      void loadAnnouncements(true);
    });
  }, []);

  return (
    <div id="student-announcements" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Announcements</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Notices posted by your teacher appear here.
        </p>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No announcements yet</p>
            <p className="text-xs text-slate-400 mt-1">When your teacher posts one, it will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="p-5">
                <p className="text-sm font-bold text-slate-900">{announcement.title}</p>
                <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  {announcement.message}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  {announcement.createdBy} · {formatAnnouncementTime(announcement.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
