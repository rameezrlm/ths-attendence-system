import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { loginUser } from '../services/teacherService';
import type { UserSession } from '../types';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

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
      className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4"
    >
      <div className="max-w-sm w-full">
        {/* Brand Card */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-7 sm:p-8">
          {/* Logo & Title */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl border border-slate-200 p-2 bg-white shadow-xs mx-auto mb-3 flex items-center justify-center">
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

            <h1 className="text-lg font-bold text-slate-900">
              IT Lab Attendance
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Taleem-O-Hunar Society
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div
              id="login-error-alert"
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter your email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-5 text-center text-xs text-slate-400">
          IT Lab Student Attendance Management System
        </p>
      </div>
    </div>
  );
};
