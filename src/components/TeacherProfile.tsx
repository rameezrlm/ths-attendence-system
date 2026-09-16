import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Mail, User } from 'lucide-react';
import type { Teacher, UserSession } from '../types';
import {
  fetchTeachers,
  getTeacherById,
  getTeacherByIdLocal,
  updateTeacher,
} from '../services/teacherService';

interface TeacherProfileProps {
  teacherId: string;
  session: UserSession;
  onSessionUpdated: (session: UserSession) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const TeacherProfile: React.FC<TeacherProfileProps> = ({
  teacherId,
  session,
  onSessionUpdated,
  showToast,
}) => {
  const [teacher, setTeacher] = useState<Teacher | null>(() => getTeacherByIdLocal(teacherId));
  const [name, setName] = useState(session.name);
  const [email, setEmail] = useState(session.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getTeacherById(teacherId);
        if (cancelled) return;
        if (data) {
          setTeacher(data);
          setName(data.name);
          setEmail(data.email);
        } else {
          setLoadError('Profile could not be found.');
        }
      } catch (err) {
        console.error('Failed to load teacher profile:', err);
        if (!cancelled && !getTeacherByIdLocal(teacherId)) {
          setLoadError('Failed to load your profile.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedName || !trimmedEmail) {
      setError('Please fill in name and email.');
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    try {
      const allTeachers = await fetchTeachers();
      if (allTeachers.some((t) => t.id !== teacherId && t.email.toLowerCase() === trimmedEmail)) {
        setError('Another account is already using this email.');
        return;
      }

      setIsSaving(true);
      const updated = await updateTeacher(
        teacherId,
        trimmedName,
        trimmedEmail,
        trimmedPassword || undefined
      );
      setTeacher(updated);
      setPassword('');

      const nextSession: UserSession = {
        ...session,
        name: updated.name,
        email: updated.email,
      };
      onSessionUpdated(nextSession);
      showToast('success', 'Profile updated successfully.');
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = teacher?.name || session.name;

  return (
    <div id="teacher-profile" className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Update your name, login email, or password.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        {loadError && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center text-sm font-bold">
            {(displayName.charAt(0) || 'T').toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{displayName}</p>
            <p className="text-[11px] text-slate-400">Teacher profile</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="teacher-profile-name"
              className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1"
            >
              <User className="w-3.5 h-3.5" />
              Full Name
            </label>
            <input
              id="teacher-profile-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="teacher-profile-email"
              className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1"
            >
              <Mail className="w-3.5 h-3.5" />
              Email / Login
            </label>
            <input
              id="teacher-profile-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="teacher-profile-password"
              className="block text-xs font-semibold text-slate-500 mb-1"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="teacher-profile-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                minLength={4}
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Minimum 4 characters. Only fill in if you want to change your password.
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-save-teacher-profile"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
