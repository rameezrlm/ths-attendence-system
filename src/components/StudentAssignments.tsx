import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, Download, FileText } from 'lucide-react';
import type { AssignmentMaterial, AssignmentSubmission } from '../types';
import {
  downloadAssignment,
  fetchAssignmentSubmissions,
  fetchAssignments,
  formatAssignmentTime,
  formatFileSize,
  isAssignmentClosed,
  submitAssignmentWork,
} from '../services/assignmentService';

interface StudentAssignmentsProps {
  studentId: string;
  studentName: string;
  studentEmail: string;
}

function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
        <span>Uploading submission...</span>
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

export const StudentAssignments: React.FC<StudentAssignmentsProps> = ({
  studentId,
  studentName,
  studentEmail,
}) => {
  const [assignments, setAssignments] = useState<AssignmentMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [assignmentList, submissionList] = await Promise.all([
          fetchAssignments(),
          fetchAssignmentSubmissions(),
        ]);
        setAssignments(assignmentList);
        setSubmissions(submissionList.filter((item) => item.studentId === studentId));
      } catch (err) {
        console.error('Failed to load assignments:', err);
        setError('Failed to load assignments.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [studentId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const mySubmissionMap = useMemo(() => {
    const map: Record<string, AssignmentSubmission> = {};
    submissions.forEach((item) => {
      map[item.assignmentId] = item;
    });
    return map;
  }, [submissions]);

  const handleDownload = async (assignment: AssignmentMaterial) => {
    setError(null);
    try {
      setDownloadingId(assignment.id);
      await downloadAssignment(assignment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSubmitWork = async (assignment: AssignmentMaterial, file: File) => {
    setError(null);
    if (isAssignmentClosed(assignment, now)) {
      setError('Submission is closed for this assignment.');
      return;
    }

    try {
      setSubmittingId(assignment.id);
      setUploadPercent(1);
      const submitted = await submitAssignmentWork({
        assignment,
        studentId,
        studentName,
        studentEmail,
        file,
        onProgress: setUploadPercent,
      });
      setSubmissions((prev) => [submitted, ...prev.filter((item) => item.assignmentId !== assignment.id)]);
      setUploadPercent(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit assignment.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div id="student-assignments" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Assignments</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Download the teacher file, then submit your work before the close date and time.
        </p>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No assignments yet</p>
            <p className="text-xs text-slate-400 mt-1">Files uploaded by your teacher will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((assignment) => {
              const closed = isAssignmentClosed(assignment, now);
              const mine = mySubmissionMap[assignment.id];
              const isUploading = submittingId === assignment.id;
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
                    </div>
                    <button
                      type="button"
                      disabled={downloadingId === assignment.id}
                      onClick={() => handleDownload(assignment)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloadingId === assignment.id ? 'Downloading...' : 'Download'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 mt-3 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    {assignment.description}
                  </p>

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

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {mine && (
                      <p className="text-[11px] text-emerald-700 mb-2">
                        Submitted {formatAssignmentTime(mine.submittedAt)} · {mine.fileName}
                      </p>
                    )}

                    {closed ? (
                      <p className="text-xs font-medium text-slate-500">
                        Submission closed. You can no longer submit work for this assignment.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="block text-xs font-semibold text-slate-700 mb-1">
                            {mine ? 'Replace your submission' : 'Submit your work'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.odp,.odt,.png,.jpg,.jpeg,.zip"
                            disabled={isUploading}
                            onChange={(e) => {
                              const nextFile = e.target.files?.[0];
                              e.target.value = '';
                              if (nextFile) void handleSubmitWork(assignment, nextFile);
                            }}
                            className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                        </label>
                        {isUploading && <UploadProgress percent={uploadPercent} />}
                      </div>
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
