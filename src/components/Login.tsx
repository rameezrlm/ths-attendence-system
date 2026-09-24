import React, { useState } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Pencil,
  Award,
  Microscope,
  Lightbulb,
  Calculator,
  School,
} from 'lucide-react';
import { loginUser } from '../services/teacherService';
import type { UserSession } from '../types';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

const FLOATING_ICONS = [
  { Icon: BookOpen, className: 'login-float-icon login-float-1', size: 28 },
  { Icon: GraduationCap, className: 'login-float-icon login-float-2', size: 32 },
  { Icon: Pencil, className: 'login-float-icon login-float-3', size: 24 },
  { Icon: Award, className: 'login-float-icon login-float-4', size: 26 },
  { Icon: Microscope, className: 'login-float-icon login-float-5', size: 30 },
  { Icon: Lightbulb, className: 'login-float-icon login-float-6', size: 24 },
  { Icon: Calculator, className: 'login-float-icon login-float-7', size: 26 },
  { Icon: School, className: 'login-float-icon login-float-8', size: 28 },
  { Icon: BookOpen, className: 'login-float-icon login-float-9', size: 22 },
  { Icon: GraduationCap, className: 'login-float-icon login-float-10', size: 34 },
  { Icon: Pencil, className: 'login-float-icon login-float-11', size: 20 },
  { Icon: Lightbulb, className: 'login-float-icon login-float-12', size: 28 },
];

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const session = await loginUser(cleanId, cleanPass);
      onLoginSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="login-page-container"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white p-4 sm:p-6"
    >
      {/* Soft green wash — still white-first */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16, 185, 129, 0.08), transparent 55%)',
        }}
        aria-hidden="true"
      />

      {/* Flying education icons */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {FLOATING_ICONS.map(({ Icon, className, size }, index) => (
          <span key={index} className={className}>
            <Icon style={{ width: size, height: size }} strokeWidth={1.5} />
          </span>
        ))}
      </div>

      {/* Glass login card */}
      <div className="relative z-10 w-full max-w-[380px]">
        <div className="login-glass-card rounded-3xl border border-white/70 bg-white/55 p-7 sm:p-8 shadow-[0_8px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="text-center mb-7">
            <div className="w-[84px] h-[84px] rounded-full border border-emerald-100 bg-white/80 shadow-sm mx-auto mb-4 flex items-center justify-center overflow-hidden p-2">
              <img
                src="/ths-logo.png"
                alt="Taleem-O-Hunar Society"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.src.includes('ths-logo')) {
                    el.src = '/logo.png';
                    return;
                  }
                  el.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              IT Lab Attendance
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Taleem-O-Hunar Society
            </p>
          </div>

          {error && (
            <div
              id="login-error-alert"
              className="mb-5 p-3 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identifier" className="sr-only">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter Username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/70 border border-slate-200/90 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/25 focus:border-emerald-700 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/70 border border-slate-200/90 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/25 focus:border-emerald-700 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-semibold text-sm rounded-full shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-400 leading-relaxed">
            Teachers, students, and admin can sign in with their registered credentials.
          </p>
        </div>
      </div>
    </div>
  );
};
