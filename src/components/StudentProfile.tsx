import React, { useEffect, useState } from 'react';
import { AlertCircle, Mail, Phone, User } from 'lucide-react';
import type { Student, UserSession } from '../types';
import { getStudentById, getStudentByIdLocal } from '../services/studentService';

interface StudentProfileProps {
  studentId: string;
  session: UserSession;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({
  studentId,
  session,
}) => {
  const [student, setStudent] = useState<Student | null>(() => getStudentByIdLocal(studentId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getStudentById(studentId);
        if (cancelled) return;
        setStudent(data);
        if (!data) setError('Profile could not be found.');
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (!cancelled && !getStudentByIdLocal(studentId)) {
          setError('Failed to load your profile.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const name = student?.name || session.name;
  const email = student?.email || session.email;
  const contact = student?.contact || '';

  return (
    <div id="student-profile" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Your profile details are locked. If you forget your password, ask an administrator to reset it.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
            {(name.charAt(0) || 'S').toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{name}</p>
            <p className="text-[11px] text-slate-400">Student profile</p>
          </div>
        </div>

        <dl className="space-y-4">
          <div>
            <dt className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
              <User className="w-3.5 h-3.5" />
              Full Name
            </dt>
            <dd className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
              {name || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5" />
              Email
            </dt>
            <dd className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
              {email || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1">
              <Phone className="w-3.5 h-3.5" />
              Contact
            </dt>
            <dd className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
              {contact || '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
