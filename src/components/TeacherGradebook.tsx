import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Save,
  Search,
  X,
  AlertCircle,
  Trash2,
  BookOpen,
  ClipboardList,
  Pencil,
} from 'lucide-react';
import type { GradeAssessment, GradeSection, Student } from '../types';
import {
  addGradeAssessment,
  createGradeSection,
  deleteGradeAssessment,
  deleteGradeSection,
  fetchGradeAssessments,
  fetchGradeMarks,
  fetchGradeSections,
  markKey,
  marksToMap,
  nextAssessmentName,
  saveGradeMarks,
  updateGradeAssessment,
} from '../services/gradebookService';

interface TeacherGradebookProps {
  students: Student[];
  showToast: (type: 'success' | 'error', message: string) => void;
}

function parseMarksInput(raw: string, max: number): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { value: null, error: null };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { value: null, error: 'Enter a number' };
  }
  if (num < 0) {
    return { value: null, error: 'Cannot be negative' };
  }
  if (num > max) {
    return { value: null, error: `Max is ${max}` };
  }
  return { value: num, error: null };
}

export const TeacherGradebook: React.FC<TeacherGradebookProps> = ({
  students,
  showToast,
}) => {
  const [sections, setSections] = useState<GradeSection[]>([]);
  const [assessments, setAssessments] = useState<GradeAssessment[]>([]);
  const [draftMarks, setDraftMarks] = useState<Record<string, string>>({});
  const [savedMarks, setSavedMarks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [addTarget, setAddTarget] = useState<GradeSection | null>(null);
  const [assessmentName, setAssessmentName] = useState('');
  const [assessmentTotal, setAssessmentTotal] = useState('');
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [isAddingAssessment, setIsAddingAssessment] = useState(false);

  const [assessmentToEdit, setAssessmentToEdit] = useState<GradeAssessment | null>(null);
  const [editAssessmentName, setEditAssessmentName] = useState('');
  const [editAssessmentTotal, setEditAssessmentTotal] = useState('');
  const [editAssessmentError, setEditAssessmentError] = useState<string | null>(null);
  const [isUpdatingAssessment, setIsUpdatingAssessment] = useState(false);

  const [sectionToDelete, setSectionToDelete] = useState<GradeSection | null>(null);
  const [assessmentToDelete, setAssessmentToDelete] = useState<GradeAssessment | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadGradebook = async () => {
      setIsLoading(true);
      try {
        const [sectionList, assessmentList, markList] = await Promise.all([
          fetchGradeSections(),
          fetchGradeAssessments(),
          fetchGradeMarks(),
        ]);
        if (cancelled) return;
        setSections(sectionList);
        setAssessments(assessmentList);

        const map = marksToMap(markList);
        const asStrings: Record<string, string> = {};
        Object.entries(map).forEach(([key, value]) => {
          asStrings[key] = String(value);
        });
        setDraftMarks(asStrings);
        setSavedMarks(asStrings);
      } catch (err) {
        console.error('Failed to load gradebook:', err);
        if (!cancelled) showToast('error', 'Failed to load gradebook.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadGradebook();
    return () => {
      cancelled = true;
    };
  }, []);

  const assessmentsBySection = useMemo(() => {
    const grouped: Record<string, GradeAssessment[]> = {};
    assessments.forEach((a) => {
      if (!grouped[a.sectionId]) grouped[a.sectionId] = [];
      grouped[a.sectionId].push(a);
    });
    return grouped;
  }, [assessments]);

  const orderedAssessments = useMemo(() => {
    const result: GradeAssessment[] = [];
    sections.forEach((section) => {
      (assessmentsBySection[section.id] || []).forEach((a) => result.push(a));
    });
    return result;
  }, [sections, assessmentsBySection]);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [students, searchTerm]
  );

  const dirtyCount = useMemo(() => {
    const keys = new Set([...Object.keys(draftMarks), ...Object.keys(savedMarks)]);
    let count = 0;
    keys.forEach((key) => {
      if ((draftMarks[key] ?? '') !== (savedMarks[key] ?? '')) count += 1;
    });
    return count;
  }, [draftMarks, savedMarks]);

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionError(null);

    const name = sectionName.trim();

    if (!name) {
      setSectionError('Please enter a section name.');
      return;
    }

    try {
      setIsCreating(true);
      const created = await createGradeSection(name);
      setSections((prev) => [...prev, created]);
      setSectionName('');
      setIsCreateOpen(false);
      showToast('success', `"${created.name}" section created. Add assessments with + Add ${created.name}.`);
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : 'Failed to create section.');
    } finally {
      setIsCreating(false);
    }
  };

  const openAddAssessment = (section: GradeSection) => {
    const existing = assessmentsBySection[section.id] || [];
    setAddTarget(section);
    setAssessmentName(nextAssessmentName(section.name, existing));
    setAssessmentTotal('');
    setAssessmentError(null);
  };

  const handleAddAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTarget) return;
    setAssessmentError(null);

    const total = Number(assessmentTotal);
    if (!Number.isFinite(total) || total <= 0) {
      setAssessmentError('Enter total marks for this assessment, for example 10 or 15.');
      return;
    }

    try {
      setIsAddingAssessment(true);
      const created = await addGradeAssessment(addTarget, total, assessmentName);
      setAssessments((prev) => [...prev, created]);
      setAddTarget(null);
      showToast('success', `${created.name} added (${created.totalMarks} marks).`);
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Failed to add assessment.');
    } finally {
      setIsAddingAssessment(false);
    }
  };

  const openEditAssessment = (assessment: GradeAssessment) => {
    setAssessmentToEdit(assessment);
    setEditAssessmentName(assessment.name);
    setEditAssessmentTotal(String(assessment.totalMarks));
    setEditAssessmentError(null);
  };

  const handleEditAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentToEdit) return;
    setEditAssessmentError(null);

    const total = Number(editAssessmentTotal);
    if (!Number.isFinite(total) || total <= 0) {
      setEditAssessmentError('Total marks must be greater than 0.');
      return;
    }

    try {
      setIsUpdatingAssessment(true);
      const updated = await updateGradeAssessment(assessmentToEdit.id, {
        name: editAssessmentName,
        totalMarks: total,
      });
      setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setAssessmentToEdit(null);
      showToast('success', `${updated.name} updated (${updated.totalMarks} marks).`);
    } catch (err) {
      setEditAssessmentError(err instanceof Error ? err.message : 'Failed to update assessment.');
    } finally {
      setIsUpdatingAssessment(false);
    }
  };

  const handleConfirmDeleteSection = async () => {
    if (!sectionToDelete) return;
    try {
      await deleteGradeSection(sectionToDelete.id);
      const removedIds = new Set(
        assessments.filter((a) => a.sectionId === sectionToDelete.id).map((a) => a.id)
      );
      setSections((prev) => prev.filter((s) => s.id !== sectionToDelete.id));
      setAssessments((prev) => prev.filter((a) => a.sectionId !== sectionToDelete.id));
      const clearRemoved = (prev: Record<string, string>) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if ([...removedIds].some((id) => key.startsWith(`${id}_`))) {
            delete next[key];
          }
        });
        return next;
      };
      setDraftMarks(clearRemoved);
      setSavedMarks(clearRemoved);
      showToast('success', `"${sectionToDelete.name}" section removed.`);
    } catch {
      showToast('error', 'Failed to delete section.');
    } finally {
      setSectionToDelete(null);
    }
  };

  const handleConfirmDeleteAssessment = async () => {
    if (!assessmentToDelete) return;
    try {
      await deleteGradeAssessment(assessmentToDelete.id);
      setAssessments((prev) => prev.filter((a) => a.id !== assessmentToDelete.id));
      const prefix = `${assessmentToDelete.id}_`;
      setDraftMarks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(prefix)) delete next[key];
        });
        return next;
      });
      setSavedMarks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(prefix)) delete next[key];
        });
        return next;
      });
      showToast('success', `${assessmentToDelete.name} removed.`);
    } catch {
      showToast('error', 'Failed to delete assessment.');
    } finally {
      setAssessmentToDelete(null);
    }
  };

  const handleMarkChange = (assessmentId: string, studentId: string, value: string) => {
    const key = markKey(assessmentId, studentId);
    setDraftMarks((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveMarks = async () => {
    const entries: { assessmentId: string; studentId: string; marks: number | null }[] = [];
    const errors: string[] = [];

    orderedAssessments.forEach((assessment) => {
      students.forEach((student) => {
        const key = markKey(assessment.id, student.id);
        const raw = draftMarks[key] ?? '';
        const saved = savedMarks[key] ?? '';
        if (raw === saved) return;

        const parsed = parseMarksInput(raw, assessment.totalMarks);
        if (parsed.error) {
          errors.push(`${student.name} · ${assessment.name}: ${parsed.error}`);
          return;
        }
        entries.push({
          assessmentId: assessment.id,
          studentId: student.id,
          marks: parsed.value,
        });
      });
    });

    if (errors.length > 0) {
      showToast('error', errors[0]);
      return;
    }

    if (entries.length === 0) {
      showToast('success', 'No mark changes to save.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await saveGradeMarks(entries);
      const map = marksToMap(updated);
      const asStrings: Record<string, string> = {};
      Object.entries(map).forEach(([key, value]) => {
        asStrings[key] = String(value);
      });
      setSavedMarks(asStrings);
      setDraftMarks((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          const key = markKey(entry.assessmentId, entry.studentId);
          if (entry.marks === null) {
            delete next[key];
          } else {
            next[key] = String(entry.marks);
          }
        });
        return next;
      });
      showToast('success', 'Marks saved successfully.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save marks.');
    } finally {
      setIsSaving(false);
    }
  };

  const cellError = (assessment: GradeAssessment, studentId: string): string | null => {
    const key = markKey(assessment.id, studentId);
    return parseMarksInput(draftMarks[key] ?? '', assessment.totalMarks).error;
  };

  return (
    <div id="teacher-gradebook" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Gradebook</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create sections once, then add assessments. Marks are entered per student in the table below.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-500">Loading gradebook...</p>
        </div>
      ) : (
        <>
          {sections.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">No grade sections yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a section such as Quiz, Assignment, or Project. After that, add Quiz 1, Quiz 2, and so on.
              </p>
              <button
                id="btn-open-create-section"
                type="button"
                onClick={() => {
                  setSectionError(null);
                  setIsCreateOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Section</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
              {sections.map((section) => {
                const sectionAssessments = assessmentsBySection[section.id] || [];
                return (
                  <div key={section.id} id={`grade-section-${section.id}`} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{section.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {sectionAssessments.length}{' '}
                          {sectionAssessments.length === 1 ? 'assessment' : 'assessments'}
                          {sectionAssessments.length > 0
                            ? ` · ${sectionAssessments.reduce((sum, a) => sum + a.totalMarks, 0)} marks total`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          id={`btn-add-assessment-${section.id}`}
                          type="button"
                          onClick={() => openAddAssessment(section)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add {section.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSectionToDelete(section)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={`Delete ${section.name} section`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {sectionAssessments.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          No assessments yet. Click + Add {section.name} and set marks for {section.name} 1.
                        </p>
                      ) : (
                        sectionAssessments.map((assessment) => (
                          <span
                            key={assessment.id}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
                          >
                            <span>
                              {assessment.name}
                              <span className="text-slate-400 font-normal"> / {assessment.totalMarks}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditAssessment(assessment)}
                              className="p-0.5 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                              title={`Edit ${assessment.name} marks`}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAssessmentToDelete(assessment)}
                              className="p-0.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title={`Remove ${assessment.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sections.length > 0 && (
            <button
              id="btn-open-create-section"
              type="button"
              onClick={() => {
                setSectionError(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Create New Section</span>
            </button>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  <span>Student Marks</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Each assessment has its own total, for example Assignment 1 / 10 and Assignment 2 / 15.
                </p>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {students.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No students enrolled. Ask an administrator to add students first.
              </div>
            ) : orderedAssessments.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Add at least one assessment to start entering marks.
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No matching students found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table id="gradebook-marks-table" className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-slate-800 text-white text-[11px] font-semibold">
                      <th
                        scope="col"
                        className="py-2.5 px-4 sticky left-0 bg-slate-800 z-10 min-w-[160px]"
                      >
                        Student
                      </th>
                      {sections.map((section) => {
                        const cols = assessmentsBySection[section.id]?.length || 0;
                        if (cols === 0) return null;
                        return (
                          <th
                            key={section.id}
                            colSpan={cols}
                            className="py-2.5 px-3 text-center border-l border-slate-700 font-semibold"
                          >
                            {section.name}
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2 px-4 sticky left-0 bg-slate-50 z-10" />
                      {orderedAssessments.map((assessment) => (
                        <th
                          key={assessment.id}
                          className="py-2 px-3 text-center whitespace-nowrap min-w-[110px] border-l border-slate-100"
                        >
                          {assessment.name} / {assessment.totalMarks}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 font-semibold text-slate-900 whitespace-nowrap">
                          {student.name}
                        </td>
                        {orderedAssessments.map((assessment) => {
                          const key = markKey(assessment.id, student.id);
                          const error = cellError(assessment, student.id);
                          return (
                            <td key={assessment.id} className="py-1.5 px-2 border-l border-slate-50">
                              <input
                                id={`mark-${assessment.id}-${student.id}`}
                                type="number"
                                min={0}
                                max={assessment.totalMarks}
                                step="any"
                                inputMode="decimal"
                                placeholder="—"
                                value={draftMarks[key] ?? ''}
                                onChange={(e) =>
                                  handleMarkChange(assessment.id, student.id, e.target.value)
                                }
                                className={`w-full min-w-[72px] px-2 py-1.5 text-center rounded-md border text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                                  error
                                    ? 'border-red-300 bg-red-50 focus:ring-red-400'
                                    : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-indigo-500'
                                }`}
                                title={error || `${student.name} · ${assessment.name}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {students.length > 0 && orderedAssessments.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {dirtyCount > 0 ? (
                    <span className="text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                      {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
                    </span>
                  ) : (
                    <span className="text-slate-400">All marks saved</span>
                  )}
                </p>
                <button
                  id="btn-save-marks"
                  type="button"
                  disabled={isSaving || dirtyCount === 0}
                  onClick={handleSaveMarks}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Marks'}</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create New Section</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  A section is created once. Then add Assignment 1, Assignment 2, each with its own marks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sectionError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sectionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Section Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-create-section"
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreating ? 'Creating...' : 'Create Section'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add {addTarget.name}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Set this assessment's own total, for example A1 = 10 and A2 = 15.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assessmentError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assessmentError}</span>
              </div>
            )}

            <form onSubmit={handleAddAssessmentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${addTarget.name} 1 or A1`}
                  value={assessmentName}
                  onChange={(e) => setAssessmentName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Marks</label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  placeholder="e.g. 10"
                  value={assessmentTotal}
                  onChange={(e) => setAssessmentTotal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-add-assessment"
                  type="submit"
                  disabled={isAddingAssessment}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingAssessment ? 'Adding...' : 'Add Assessment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assessmentToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Assessment</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Change the name or this assessment's total marks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssessmentToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editAssessmentError && (
              <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editAssessmentError}</span>
              </div>
            )}

            <form onSubmit={handleEditAssessmentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editAssessmentName}
                  onChange={(e) => setEditAssessmentName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Marks</label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={editAssessmentTotal}
                  onChange={(e) => setEditAssessmentTotal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssessmentToEdit(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-assessment"
                  type="submit"
                  disabled={isUpdatingAssessment}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <span>{isUpdatingAssessment ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sectionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Delete section?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Removing <strong>{sectionToDelete.name}</strong> will also delete its assessments and all
              student marks in this section.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSection}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Delete Section
              </button>
            </div>
          </div>
        </div>
      )}

      {assessmentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Delete assessment?</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Remove <strong>{assessmentToDelete.name}</strong> and all marks entered for it?
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setAssessmentToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAssessment}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Delete Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
