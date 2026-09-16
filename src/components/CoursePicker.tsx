import React from 'react';
import { BookOpen, Users } from 'lucide-react';
import type { LabClass } from '../types';

interface CoursePickerProps {
  classes: LabClass[];
  roleLabel: string;
  isLoading?: boolean;
  onSelect: (classId: string) => void;
}

export const CoursePicker: React.FC<CoursePickerProps> = ({
  classes,
  roleLabel,
  isLoading = false,
  onSelect,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading your courses...</p>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center animate-zoom-in">
        <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800">No courses assigned yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Ask an administrator to add you to a class section.
        </p>
      </div>
    );
  }

  return (
    <div id="course-picker" className="space-y-5 animate-zoom-in">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Courses</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Select a course to open the {roleLabel} workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((course, index) => (
          <button
            key={course.id}
            id={`course-card-${course.id}`}
            type="button"
            onClick={() => onSelect(course.id)}
            className="animate-zoom-in text-left bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                <Users className="w-3 h-3" />
                {course.studentIds.length}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
              {course.name}
            </h3>
            {course.description ? (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description}</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Open course workspace</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
