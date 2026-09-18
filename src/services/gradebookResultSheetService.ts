import * as XLSX from 'xlsx';
import type { GradeAssessment, GradeSection, Student } from '../types';
import {
  computeClassGradebookStats,
  formatGradePercent,
  markKey,
  percentToLetterGrade,
} from './gradebookService';

export interface GradebookResultSheetInput {
  className: string;
  teacherName: string;
  students: Student[];
  sections: GradeSection[];
  assessments: GradeAssessment[];
  marksMap: Record<string, string>;
}

function orderedAssessments(
  sections: GradeSection[],
  assessments: GradeAssessment[]
): GradeAssessment[] {
  const grouped: Record<string, GradeAssessment[]> = {};
  assessments.forEach((item) => {
    if (!grouped[item.sectionId]) grouped[item.sectionId] = [];
    grouped[item.sectionId].push(item);
  });
  const result: GradeAssessment[] = [];
  sections.forEach((section) => {
    (grouped[section.id] || []).forEach((item) => result.push(item));
  });
  return result;
}

function getMarkValue(
  marksMap: Record<string, string>,
  assessmentId: string,
  studentId: string
): number | null {
  const raw = marksMap[markKey(assessmentId, studentId)]?.trim() ?? '';
  if (raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function safeFilePart(value: string): string {
  return value.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40);
}

function formatGeneratedDate(): string {
  return new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/ths-logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function triggerDownload(content: Blob, filename: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function buildStudentRows(input: GradebookResultSheetInput, assessmentList: GradeAssessment[]) {
  const draftMarks: { id: string; assessmentId: string; studentId: string; marks: number }[] = [];
  assessmentList.forEach((assessment) => {
    input.students.forEach((student) => {
      const value = getMarkValue(input.marksMap, assessment.id, student.id);
      if (value === null) return;
      draftMarks.push({
        id: markKey(assessment.id, student.id),
        assessmentId: assessment.id,
        studentId: student.id,
        marks: value,
      });
    });
  });

  const classStats = computeClassGradebookStats(
    input.students.map((s) => s.id),
    assessmentList,
    draftMarks.map((item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
    }))
  );

  const sortedStudents = [...input.students].sort((a, b) => a.name.localeCompare(b.name));
  const rows = sortedStudents.map((student, index) => {
    const stats = classStats.byStudentId[student.id];
    const overallPercent = stats && stats.total > 0 ? stats.percent : null;
    const assessmentCells = assessmentList.map((assessment) => {
      const value = getMarkValue(input.marksMap, assessment.id, student.id);
      return value === null ? '—' : `${value}/${assessment.totalMarks}`;
    });

    return {
      serial: index + 1,
      name: student.name,
      email: student.email,
      contact: student.contact || '—',
      overallPercent: overallPercent !== null ? `${formatGradePercent(overallPercent)}%` : '—',
      grade: overallPercent !== null ? percentToLetterGrade(overallPercent) : '—',
      obtained: stats?.obtained ?? 0,
      total: stats?.total ?? 0,
      totalDisplay:
        stats && stats.total > 0 ? `${stats.obtained}/${stats.total}` : '—',
      assessmentCells,
    };
  });

  return { rows, classStats, assessmentList };
}

export function exportGradebookResultSheetExcel(input: GradebookResultSheetInput): void {
  const assessmentList = orderedAssessments(input.sections, input.assessments);
  if (assessmentList.length === 0) {
    throw new Error('Add at least one assessment before downloading the result sheet.');
  }
  if (input.students.length === 0) {
    throw new Error('No students enrolled in this class.');
  }

  const { rows, classStats } = buildStudentRows(input, assessmentList);
  const generatedOn = formatGeneratedDate();
  const sheetRows: (string | number)[][] = [];

  sheetRows.push(['TALEEM-O-HUNAR SOCIETY']);
  sheetRows.push(['IT Lab — Gradebook Result Sheet']);
  sheetRows.push([`Course / Class: ${input.className}`]);
  sheetRows.push([`Teacher: ${input.teacherName}`]);
  sheetRows.push([`Generated: ${generatedOn}`]);
  sheetRows.push([
    `Class Average: ${formatGradePercent(classStats.classAveragePercent)}%`,
    `Students: ${input.students.length}`,
    `Assessments: ${assessmentList.length}`,
  ]);
  sheetRows.push([]);

  const headerRow: (string | number)[] = [
    'S.No',
    'Student Name',
    'Email',
    'Contact',
    'Overall %',
    'Grade',
  ];
  assessmentList.forEach((assessment) => {
    headerRow.push(`${assessment.name} / ${assessment.totalMarks}`);
  });
  headerRow.push('Total Obtained / Total Marks');
  sheetRows.push(headerRow);

  rows.forEach((row) => {
    sheetRows.push([
      row.serial,
      row.name,
      row.email,
      row.contact,
      row.overallPercent,
      row.grade,
      ...row.assessmentCells,
      row.totalDisplay,
    ]);
  });

  sheetRows.push([]);
  sheetRows.push(['Section Summary']);
  input.sections.forEach((section) => {
    const sectionAssessments = assessmentList.filter((a) => a.sectionId === section.id);
    if (sectionAssessments.length === 0) return;
    const total = sectionAssessments.reduce((sum, a) => sum + a.totalMarks, 0);
    const names = sectionAssessments.map((a) => `${a.name} (${a.totalMarks})`).join(', ');
    sheetRows.push([section.name, `${sectionAssessments.length} assessment(s)`, `${total} marks`, names]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 8 },
    ...assessmentList.map(() => ({ wch: 14 })),
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = safeFilePart(input.className).slice(0, 31) || 'ResultSheet';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const datePart = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `ResultSheet_${safeFilePart(input.className)}_${datePart}.xlsx`);
}

export async function exportGradebookResultSheetHtml(
  input: GradebookResultSheetInput
): Promise<void> {
  const assessmentList = orderedAssessments(input.sections, input.assessments);
  if (assessmentList.length === 0) {
    throw new Error('Add at least one assessment before downloading the result sheet.');
  }
  if (input.students.length === 0) {
    throw new Error('No students enrolled in this class.');
  }

  const { rows, classStats } = buildStudentRows(input, assessmentList);
  const logoDataUrl = await loadLogoDataUrl();
  const generatedOn = formatGeneratedDate();
  const datePart = new Date().toISOString().slice(0, 10);

  const sectionHeaders = input.sections
    .map((section) => {
      const cols = assessmentList.filter((a) => a.sectionId === section.id).length;
      if (cols === 0) return '';
      return `<th colspan="${cols}" class="section-head">${escapeHtml(section.name)}</th>`;
    })
    .join('');

  const assessmentHeaders = assessmentList
    .map(
      (assessment) =>
        `<th>${escapeHtml(assessment.name)}<span class="muted"> / ${assessment.totalMarks}</span></th>`
    )
    .join('');

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td class="center">${row.serial}</td>
        <td class="name">${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.email)}</td>
        <td>${escapeHtml(row.contact)}</td>
        <td class="center strong">${escapeHtml(row.overallPercent)}</td>
        <td class="center strong">${escapeHtml(row.grade)}</td>
        ${row.assessmentCells.map((cell) => `<td class="center">${escapeHtml(cell)}</td>`).join('')}
        <td class="center strong">${escapeHtml(row.totalDisplay)}</td>
      </tr>`
    )
    .join('');

  const sectionSummary = input.sections
    .map((section) => {
      const sectionAssessments = assessmentList.filter((a) => a.sectionId === section.id);
      if (sectionAssessments.length === 0) return '';
      const total = sectionAssessments.reduce((sum, a) => sum + a.totalMarks, 0);
      return `<li><strong>${escapeHtml(section.name)}:</strong> ${sectionAssessments.length} assessment(s), ${total} total marks</li>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Result Sheet — ${escapeHtml(input.className)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 3px solid #166534;
      padding-bottom: 16px;
      margin-bottom: 18px;
    }
    .logo {
      width: 96px;
      height: 96px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .org { flex: 1; }
    .org h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.04em;
      color: #14532d;
    }
    .org h2 {
      margin: 4px 0 0;
      font-size: 16px;
      font-weight: 600;
      color: #334155;
    }
    .org p {
      margin: 6px 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 12px;
    }
    .meta div strong { color: #334155; }
    .summary {
      margin: 0 0 16px 18px;
      padding: 0;
      font-size: 12px;
      color: #475569;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    thead th {
      background: #14532d;
      color: #fff;
      padding: 8px 6px;
      border: 1px solid #0f5132;
      text-align: center;
      vertical-align: middle;
    }
    thead tr:nth-child(2) th {
      background: #166534;
      font-weight: 600;
    }
    .section-head {
      background: #15803d !important;
      font-size: 11px;
      letter-spacing: 0.03em;
    }
    tbody td {
      border: 1px solid #e2e8f0;
      padding: 7px 6px;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .center { text-align: center; }
    .name { font-weight: 600; white-space: nowrap; }
    .strong { font-weight: 700; color: #0f172a; }
    .muted { color: #cbd5e1; font-weight: 500; }
    .footer {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }
    @media print {
      body { padding: 12px; }
      .header { page-break-inside: avoid; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="header">
    ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Taleem-O-Hunar Society Logo" />` : ''}
    <div class="org">
      <h1>TALEEM-O-HUNAR SOCIETY</h1>
      <h2>IT Lab — Gradebook Result Sheet</h2>
      <p>Official course result summary for enrolled students</p>
    </div>
  </header>

  <div class="meta">
    <div><strong>Course / Class:</strong> ${escapeHtml(input.className)}</div>
    <div><strong>Teacher:</strong> ${escapeHtml(input.teacherName)}</div>
    <div><strong>Generated:</strong> ${escapeHtml(generatedOn)}</div>
    <div><strong>Class Average:</strong> ${formatGradePercent(classStats.classAveragePercent)}%</div>
    <div><strong>Students:</strong> ${input.students.length}</div>
    <div><strong>Assessments:</strong> ${assessmentList.length}</div>
  </div>

  <ul class="summary">${sectionSummary}</ul>

  <table>
    <thead>
      <tr>
        <th rowspan="2">S.No</th>
        <th rowspan="2">Student Name</th>
        <th rowspan="2">Email</th>
        <th rowspan="2">Contact</th>
        <th rowspan="2">Overall %</th>
        <th rowspan="2">Grade</th>
        ${sectionHeaders}
        <th rowspan="2">Total<br />Obtained / Total</th>
      </tr>
      <tr>${assessmentHeaders}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="footer">
    Taleem-O-Hunar Society · IT Lab Attendance System · Result Sheet generated on ${escapeHtml(generatedOn)}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `ResultSheet_${safeFilePart(input.className)}_${datePart}.html`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Printable HTML result sheet with logo and full gradebook details. */
export async function exportGradebookResultSheet(input: GradebookResultSheetInput): Promise<void> {
  await exportGradebookResultSheetHtml(input);
}
