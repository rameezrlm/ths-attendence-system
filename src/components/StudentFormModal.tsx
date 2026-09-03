import React, { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStudent: (name: string, email: string) => Promise<void>;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onAddStudent,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError('Please enter the student full name.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid student email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddStudent(cleanName, cleanEmail);
      setName('');
      setEmail('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add student. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-add-student-overlay"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="modal-add-student"
        className="bg-white rounded-lg max-w-md w-full shadow-xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Add New Student</h3>
              <p className="text-xs text-slate-500">Register student into IT Lab roster</p>
            </div>
          </div>
          <button
            id="btn-close-student-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="student-name-input" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Student Name
            </label>
            <input
              id="student-name-input"
              type="text"
              required
              placeholder="e.g. Ali Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="student-email-input" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Student Email
            </label>
            <input
              id="student-email-input"
              type="email"
              required
              placeholder="e.g. ali@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-add-student"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-add-student"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
