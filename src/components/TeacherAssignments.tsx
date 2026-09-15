import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, FileText, Trash2, Upload } from 'lucide-react';
import type { AssignmentMaterial, AssignmentSubmission, UserSession } from '../types';
import {
  createAssignment,
  defaultClosesAtLocal,
  deleteAssignment,
  downloadAssignment,
  downloadSubmission,
  fetchAssignmentSubmissions,
  fetchAssignments,
  formatAssignmentTime,
  formatFileSize,
  isAssignmentClosed,
} from '../services/assignmentService';

interface TeacherAssignmentsProps {
  session: UserSession;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
        <span>Uploading file...</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-[width] duration-150"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

export const TeacherAssignments: React.FC<TeacherAssignmentsProps> = ({
  session,
  showToast,
}) => {
  const [assignments, setAssignments] = useState<AssignmentMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState(defaultClosesAtLocal);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadAssignments = async () => {
    setIsLoading(true);
    try {
      const [assignmentList, submissionList] = await Promise.all([
        fetchAssignments(),
        fetchAssignmentSubmissions(),
      ]);
      setAssignments(assignmentList);
      setSubmissions(submissionList);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      showToast('error', 'Failed to load assignments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const submissionsByAssignment = useMemo(() => {
    const map: Record<string, AssignmentSubmission[]> = {};
    submissions.forEach((item) => {
      map[item.assignmentId] = map[item.assignmentId] || [];
      map[item.assignmentId].push(item);
    });
    return map;
  }, [submissions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please choose a document or slides file to upload.');
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadPercent(1);
      const created = await createAssignment({
        title,
        description,
        file,
        uploadedBy: session.name,
        closesAt,
        onProgress: setUploadPercent,
      });
      setAssignments((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setClosesAt(defaultClosesAtLocal());
      setFile(null);
      setUploadPercent(0);
      showToast('success', `"${created.title}" uploaded for students.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (assignment: AssignmentMaterial) => {
    try {
      await downloadAssignment(assignment);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to download file.');
    }
  };

  const handleDownloadSubmission = async (submission: AssignmentSubmission) => {
    try {
      await downloadSubmission(submission);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to download submission.');
    }
  };

  const handleDelete = async (assignment: AssignmentMaterial) => {
    try {
      setDeletingId(assignment.id);
      await deleteAssignment(assignment.id);
      setAssignments((prev) => prev.filter((item) => item.id !== assignment.id));
      setSubmissions((prev) => prev.filter((item) => item.assignmentId !== assignment.id));
      showToast('success', `"${assignment.title}" removed.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to delete assignment.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div id="teacher-assignments" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Assignments</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload a document or slides, add a description, and set when student submission closes.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Upload className="w-4 h-4 text-indigo-600" />
          Upload assignment
        </h3>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="assignment-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Title
            </label>
            <input
              id="assignment-title"
              type="text"
              required
              placeholder="e.g. Week 3 Lab Assignment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="assignment-file" className="block text-xs font-semibold text-slate-700 mb-1">
              Document or slides
            </label>
            <label
              htmlFor="assignment-file"
              className="flex items-center justify-between gap-3 w-full px-3 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100"
            >
              <span className="text-xs text-slate-600 truncate">
                {file ? `${file.name} · ${formatFileSize(file.size)}` : 'Choose PDF, Word, or PowerPoint'}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-indigo-700">Browse</span>
            </label>
            <input
              id="assignment-file"
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.odp,.odt,.png,.jpg,.jpeg,.zip"
              className="sr-only"
              disabled={isSubmitting}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <label htmlFor="assignment-closes-at" className="block text-xs font-semibold text-slate-700 mb-1">
              Student submission closes
            </label>
            <input
              id="assignment-closes-at"
              type="datetime-local"
              required
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              After this date and time students cannot submit their work.
            </p>
          </div>

          <div>
            <label htmlFor="assignment-description" className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              id="assignment-description"
              required
              rows={4}
              placeholder="Tell students what to do with this file..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y disabled:opacity-60"
            />
          </div>

          {isSubmitting && <UploadProgress percent={uploadPercent} />}

          <div className="flex justify-end">
            <button
              id="btn-upload-assignment"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isSubmitting ? `Uploading ${uploadPercent}%` : 'Upload assignment'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Uploaded files</h3>
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No assignments yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload a document or slides file for students to download.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((assignment) => {
              const closed = isAssignmentClosed(assignment, now);
              const related = submissionsByAssignment[assignment.id] || [];
              return (
                <li key={assignment.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">{assignment.title}</p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                            closed
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {closed ? 'Closed' : 'Open'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {assignment.fileName} · {formatFileSize(assignment.fileSize)}
                      </p>
                      <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{assignment.description}</p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <p className="flex items-start gap-1.5 text-slate-600">
                          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            <span className="font-semibold text-slate-800">Created:</span>{' '}
                            {formatAssignmentTime(assignment.createdAt)}
                          </span>
                        </p>
                        <p className="flex items-start gap-1.5 text-slate-600">
                          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            <span className="font-semibold text-slate-800">Submission closes:</span>{' '}
                            {assignment.closesAt ? formatAssignmentTime(assignment.closesAt) : 'Not set'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownload(assignment)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === assignment.id}
                        onClick={() => handleDelete(assignment)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-50"
                        title={`Delete ${assignment.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-700">
                      Student submissions ({related.length})
                    </p>
                    {related.length === 0 ? (
                      <p className="text-[11px] text-slate-400 mt-1">No student work submitted yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {related.map((submission) => (
                          <li key={submission.id} className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-slate-600 truncate">
                              {submission.studentName} · {submission.fileName} ·{' '}
                              {formatAssignmentTime(submission.submittedAt)}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleDownloadSubmission(submission)}
                              className="text-[11px] font-semibold text-indigo-700 hover:underline cursor-pointer"
                            >
                              Download
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
