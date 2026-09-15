import React, { useEffect, useState } from 'react';
import { AlertCircle, Megaphone, Trash2 } from 'lucide-react';
import type { Announcement, UserSession } from '../types';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  formatAnnouncementTime,
  subscribeAnnouncementUpdates,
} from '../services/announcementService';

interface TeacherAnnouncementsProps {
  session: UserSession;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const TeacherAnnouncements: React.FC<TeacherAnnouncementsProps> = ({
  session,
  showToast,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      setAnnouncements(await fetchAnnouncements());
    } catch (err) {
      console.error('Failed to load announcements:', err);
      if (!silent) showToast('error', 'Failed to load announcements.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);
      const created = await createAnnouncement({
        title,
        message,
        createdBy: session.name,
      });
      setAnnouncements((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setTitle('');
      setMessage('');
      showToast('success', 'Announcement posted for students.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (announcement: Announcement) => {
    try {
      setDeletingId(announcement.id);
      await deleteAnnouncement(announcement.id);
      setAnnouncements((prev) => prev.filter((item) => item.id !== announcement.id));
      showToast('success', `"${announcement.title}" removed.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to delete announcement.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div id="teacher-announcements" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Announcements</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Post a notice for students. They can view it in their Announcements tab.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Megaphone className="w-4 h-4 text-indigo-600" />
          New announcement
        </h3>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="announcement-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Title
            </label>
            <input
              id="announcement-title"
              type="text"
              required
              placeholder="e.g. Lab closed on Friday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="announcement-message" className="block text-xs font-semibold text-slate-700 mb-1">
              Message
            </label>
            <textarea
              id="announcement-message"
              required
              rows={4}
              placeholder="Write the announcement students should see..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>
          <div className="flex justify-end">
            <button
              id="btn-post-announcement"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Posting...' : 'Post announcement'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Posted announcements</h3>
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No announcements yet</p>
            <p className="text-xs text-slate-400 mt-1">Post one above and students will see it.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{announcement.title}</p>
                    <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{announcement.message}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {announcement.createdBy} · {formatAnnouncementTime(announcement.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === announcement.id}
                    onClick={() => handleDelete(announcement)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-50"
                    title={`Delete ${announcement.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
