import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, BookOpen, Trophy } from 'lucide-react';
import type { GradeAssessment, GradeMark, GradeSection, Student } from '../types';
import {
  computeClassGradebookStats,
  fetchGradeAssessments,
  fetchGradeMarks,
  fetchGradeSections,
  formatGradePercent,
  getGradeColorScheme,
  markKey,
  percentToLetterGrade,
  readGradeAssessmentsLocal,
  readGradeMarksLocal,
  readGradeSectionsLocal,
} from '../services/gradebookService';
import { fetchStudents, readStudentsLocal } from '../services/studentService';

interface StudentGradebookProps {
  classId: string;
  classStudentIds: string[];
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

function displayFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export const StudentGradebook: React.FC<StudentGradebookProps> = ({
  classId,
  classStudentIds,
  studentId,
  studentName,
}) => {
  const initialSections = readGradeSectionsLocal();
  const [sections, setSections] = useState<GradeSection[]>(() => initialSections);
  const [assessments, setAssessments] = useState<GradeAssessment[]>(() => readGradeAssessmentsLocal());
  const [marks, setMarks] = useState<GradeMark[]>(() => readGradeMarksLocal());
  const [students, setStudents] = useState<Student[]>(() => readStudentsLocal());
  const [isLoading, setIsLoading] = useState(
    () =>
      initialSections.length === 0 &&
      readGradeAssessmentsLocal().length === 0 &&
      readGradeMarksLocal().length === 0
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    initialSections.forEach((s) => {
      initial[s.id] = true;
    });
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    const hasCache =
      readGradeSectionsLocal().length > 0 ||
      readGradeAssessmentsLocal().length > 0 ||
      readGradeMarksLocal().length > 0;

    const load = async (silent: boolean) => {
      if (!silent) setIsLoading(true);
      try {
        const [sectionList, assessmentList, markList, studentList] = await Promise.all([
          fetchGradeSections(),
          fetchGradeAssessments(),
          fetchGradeMarks(),
          fetchStudents(),
        ]);
        if (cancelled) return;
        const classSections = sectionList.filter((section) => section.classId === classId);
        const sectionIds = new Set(classSections.map((section) => section.id));
        setSections(classSections);
        setAssessments(assessmentList.filter((item) => sectionIds.has(item.sectionId)));
        setMarks(markList);
        setStudents(studentList);

        const initial: Record<string, boolean> = {};
        sectionList.forEach((s) => {
          initial[s.id] = true;
        });
        setExpanded(initial);
      } catch (err) {
        console.error('Failed to load student gradebook:', err);
      } finally {
        if (!cancelled && !silent) setIsLoading(false);
      }
    };

    void load(hasCache);
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const studentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach((student) => {
      map[student.id] = student.name;
    });
    return map;
  }, [students]);

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

  const classStats = useMemo(
    () => computeClassGradebookStats(classStudentIds, assessments, marks),
    [classStudentIds, assessments, marks]
  );

  const myStats = classStats.byStudentId[studentId];
  const coursePercent = myStats?.total ? myStats.percent : null;
  const courseGrade = coursePercent !== null ? percentToLetterGrade(coursePercent) : null;
  const classAverageColors = getGradeColorScheme(classStats.classAveragePercent);
  const coursePercentColors =
    coursePercent !== null ? getGradeColorScheme(coursePercent) : getGradeColorScheme(0);
  const courseGradeColors =
    coursePercent !== null ? getGradeColorScheme(coursePercent) : getGradeColorScheme(0);

  const topStudents = useMemo(() => {
    return classStats.ranked.slice(0, 2).map((entry, index) => ({
      rank: index + 1,
      name: displayFirstName(studentNameMap[entry.studentId] || 'Student'),
      percent: entry.percent,
      isCurrentStudent: entry.studentId === studentId,
    }));
  }, [classStats.ranked, studentNameMap, studentId]);

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

      {assessments.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              className={`rounded-xl border px-4 py-3 shadow-xs ${classAverageColors.card}`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${classAverageColors.label}`}
              >
                Class Average
              </p>
              <p className={`text-lg font-bold mt-1 ${classAverageColors.value}`}>
                {formatGradePercent(classStats.classAveragePercent)}
                <span className={`text-sm font-semibold ${classAverageColors.suffix}`}> / 100</span>
              </p>
            </div>
            <div
              className={`rounded-xl border px-4 py-3 shadow-xs ${coursePercentColors.card}`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${coursePercentColors.label}`}
              >
                Course Percentage
              </p>
              <p className={`text-lg font-bold mt-1 ${coursePercentColors.value}`}>
                {coursePercent !== null ? formatGradePercent(coursePercent) : '—'}
                <span className={`text-sm font-semibold ${coursePercentColors.suffix}`}> / 100</span>
              </p>
            </div>
            <div
              className={`rounded-xl border px-4 py-3 shadow-xs ${courseGradeColors.card}`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${courseGradeColors.label}`}
              >
                Course Grade
              </p>
              <p className={`text-2xl font-bold mt-0.5 ${courseGradeColors.value}`}>
                {courseGrade ?? '—'}
              </p>
            </div>
          </div>

          {topStudents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Top Performers</h3>
              </div>
              <div className="space-y-2">
                {topStudents.map((student) => (
                  <div
                    key={`top-${student.rank}-${student.name}`}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                      student.isCurrentStudent
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-800">
                      {student.name}
                      {student.isCurrentStudent && (
                        <span className="ml-1.5 text-[10px] font-medium text-indigo-600">(You)</span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      {formatGradePercent(student.percent)}%
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] uppercase tracking-wide">
                        Top
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
