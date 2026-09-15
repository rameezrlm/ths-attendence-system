import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, BookOpen } from 'lucide-react';
import type { GradeAssessment, GradeMark, GradeSection } from '../types';
import {
  fetchGradeAssessments,
  fetchGradeMarks,
  fetchGradeSections,
  markKey,
} from '../services/gradebookService';

interface StudentGradebookProps {
  studentId: string;
  studentName: string;
}

interface SectionView {
  section: GradeSection;
  assessments: {
    assessment: GradeAssessment;
    marks: number | null;
  }[];
  obtained: number;
  total: number;
}

export const StudentGradebook: React.FC<StudentGradebookProps> = ({
  studentId,
  studentName,
}) => {
  const [sections, setSections] = useState<GradeSection[]>([]);
  const [assessments, setAssessments] = useState<GradeAssessment[]>([]);
  const [marks, setMarks] = useState<GradeMark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [sectionList, assessmentList, markList] = await Promise.all([
          fetchGradeSections(),
          fetchGradeAssessments(),
          fetchGradeMarks(),
        ]);
        setSections(sectionList);
        setAssessments(assessmentList);
        setMarks(markList);

        const initial: Record<string, boolean> = {};
        sectionList.forEach((s) => {
          initial[s.id] = true;
        });
        setExpanded(initial);
      } catch (err) {
        console.error('Failed to load student gradebook:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const marksMap = useMemo(() => {
    const map: Record<string, number> = {};
    marks.forEach((m) => {
      if (m.studentId === studentId) {
        map[m.id] = m.marks;
      }
    });
    return map;
  }, [marks, studentId]);

  const sectionViews: SectionView[] = useMemo(() => {
    return sections
      .map((section) => {
        const sectionAssessments = assessments.filter((a) => a.sectionId === section.id);
        const rows = sectionAssessments.map((assessment) => {
          const key = markKey(assessment.id, studentId);
          const value = marksMap[key];
          return {
            assessment,
            marks: typeof value === 'number' ? value : null,
          };
        });
        const obtained = rows.reduce((sum, row) => sum + (row.marks ?? 0), 0);
        const total = rows.reduce((sum, row) => sum + row.assessment.totalMarks, 0);
        return { section, assessments: rows, obtained, total };
      })
      .filter((view) => view.assessments.length > 0);
  }, [sections, assessments, marksMap, studentId]);

  const overallObtained = sectionViews.reduce((sum, view) => sum + view.obtained, 0);
  const overallTotal = sectionViews.reduce((sum, view) => sum + view.total, 0);
  const overallPercent =
    overallTotal > 0 ? ((overallObtained / overallTotal) * 100).toFixed(1) : null;

  const toggle = (sectionId: string) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading your marks...</p>
      </div>
    );
  }

  return (
    <div id="student-gradebook" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Gradebook</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Marks for {studentName}, grouped by section.
        </p>
      </div>

      {overallPercent !== null && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Overall
            </p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {overallObtained}
              <span className="text-slate-400 font-semibold text-sm"> / {overallTotal}</span>
            </p>
          </div>
          <span className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
            {overallPercent}%
          </span>
        </div>
      )}

      {sectionViews.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No marks published yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Your teacher has not added any assessments to the gradebook.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sectionViews.map((view) => {
            const isOpen = !!expanded[view.section.id];
            return (
              <div
                key={view.section.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                <button
                  type="button"
                  id={`btn-toggle-section-${view.section.id}`}
                  onClick={() => toggle(view.section.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-bold text-slate-900">{view.section.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-slate-700">
                      {view.obtained}/{view.total}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-2">
                    {view.assessments.map((row) => (
                      <div
                        key={row.assessment.id}
                        className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-b-0"
                      >
                        <span className="text-xs font-medium text-slate-600">
                          {row.assessment.name}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          {row.marks === null ? (
                            <span className="text-slate-400 font-medium">Not marked</span>
                          ) : (
                            <>
                              {row.marks}
                              <span className="text-slate-400 font-medium">
                                /{row.assessment.totalMarks}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
