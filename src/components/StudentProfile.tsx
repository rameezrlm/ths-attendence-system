import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Save } from 'lucide-react';
import type { Student, UserSession } from '../types';
import { getStudentById, updateStudentProfile } from '../services/studentService';

interface StudentProfileProps {
  studentId: string;
  session: UserSession;
  onProfileUpdated: (student: Student) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({
  studentId,
  session,
  onProfileUpdated,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [email, setEmail] = useState(session.email || '');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const student = await getStudentById(studentId);
        if (cancelled) return;
        if (student) {
          setEmail(student.email);
          setContact(student.contact || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (!cancelled) setError('Failed to load your profile.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanContact = contact.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (cleanContact && cleanContact.replace(/[\s()-]/g, '').length < 7) {
      setError('Please enter a valid contact number.');
      return;
    }

    if (cleanPassword) {
      if (cleanPassword.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      if (cleanPassword !== confirmPassword.trim()) {
        setError('New password and confirmation do not match.');
        return;
      }
    }

    try {
      setIsSaving(true);
      const updated = await updateStudentProfile(studentId, {
        email: cleanEmail,
        contact: cleanContact,
        password: cleanPassword || undefined,
      });
      setPassword('');
      setConfirmPassword('');
      setSuccess('Profile updated successfully.');
      onProfileUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div id="student-profile" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Update your email, contact number, and password.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
            {(session.name.charAt(0) || 'S').toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{session.name}</p>
            <p className="text-[11px] text-slate-400">Name is managed by the administrator</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="profile-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="profile-contact" className="block text-xs font-semibold text-slate-700 mb-1">
              Contact
            </label>
            <input
              id="profile-contact"
              type="tel"
              placeholder="e.g. 0300 1234567"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="profile-password" className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="profile-password"
                type={showPassword ? 'text' : 'password'}
                minLength={4}
                placeholder="Leave blank to keep current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="profile-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="profile-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              id="btn-save-student-profile"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
