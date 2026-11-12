import { SchoolSettings, Student, Subject, Exam, ExamMark, AcademicClass } from '../types';
import { getSchoolLogoSrc } from '../constants/schoolLogo';
import { fileUploadService } from '../services/fileUploadService';
import { calculateEvaluation } from './grading';
import { NOT_CONFIGURED, letterheadLine, schoolIdentity } from './schoolIdentity';

interface ResultSheetOptions {
  settings: SchoolSettings;
  exam: Exam;
  selectedClass?: AcademicClass | null;
  section: string;
  subjects: Subject[];
  students: Student[];
  marksList: ExamMark[];
}

interface SingleMarksheetOptions {
  settings: SchoolSettings;
  exam: Exam;
  student: Student;
  subjects: Subject[];
  marksList: ExamMark[];
  attendancePercentage?: number;
}

interface BulkMarksheetOptions {
  settings: SchoolSettings;
  exam: Exam;
  students: Student[];
  marksList: ExamMark[];
  getStudentSubjects: (student: Student) => Subject[];
  getStudentAttendance?: (studentId: string) => { percentage: number };
}

/**
 * Generate full standalone HTML for Class-Wise Tabulation & Result Sheet
 */
export function generateResultSheetHtml(options: ResultSheetOptions): string {
  const { settings, exam, selectedClass, section, subjects, students, marksList } = options;

  const schoolName = settings.schoolName || NOT_CONFIGURED;
  const schoolAddress = settings.schoolAddress || NOT_CONFIGURED;
  const affiliationText = letterheadLine(schoolIdentity(settings)) || 'School details not configured';
  const examTitle = exam?.name || exam?.title || 'Academic Assessment';
  const session = exam?.academicSession || settings.currentAcademicSession || '2026-2027';
  const className = selectedClass?.name || 'Class';
  const sectionLabel = section === 'ALL' || !section ? 'All Sections' : `Section ${section}`;
  const logoSrc = getSchoolLogoSrc(settings.schoolLogo) || '';

  // Check if students exist
  const hasStudents = students && students.length > 0;
  const studentIds = new Set(students.map((s) => s.id));
  const relevantMarks = marksList.filter((m) => m.examId === exam.id && studentIds.has(m.studentId));

  let totalAppeared = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  const studentRows = students.map((st) => {
    const stMarks = relevantMarks.filter((m) => m.studentId === st.id);
    let stObtained = 0;
    let stMax = 0;

    const subjectCells = subjects.map((sub) => {
      const markEntry = stMarks.find((m) => m.subjectId === sub.id);
      if (!markEntry) {
        return { display: '—', isAbsent: false, obtained: 0, max: sub.maxMarks || 100 };
      }
      const max = markEntry.maxMarks || sub.maxMarks || 100;
      stMax += max;
      if (markEntry.isAbsent) {
        return { display: 'AB', isAbsent: true, obtained: 0, max };
      }
      const obt = markEntry.marksObtained ?? 0;
      stObtained += obt;
      return { display: String(obt), isAbsent: false, obtained: obt, max };
    });

    if (stMarks.length > 0) {
      totalAppeared++;
    }

    const evalRes = stMax > 0 ? calculateEvaluation(stObtained, stMax) : null;
    if (evalRes) {
      if (evalRes.status === 'PASS') totalPassed++;
      else if (evalRes.status === 'FAIL') totalFailed++;
    }

    return {
      student: st,
      subjectCells,
      totalObtained: stMax > 0 ? stObtained : 0,
      totalMax: stMax,
      percentage: evalRes ? evalRes.percentage : '—',
      grade: evalRes ? evalRes.grade : '—',
      status: evalRes ? evalRes.status : 'Pending',
    };
  });

  const passPercentage = totalAppeared > 0 ? Math.round((totalPassed / totalAppeared) * 1000) / 10 : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${schoolName} - Result Sheet - ${className} ${sectionLabel} - ${examTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #ffffff; color: #0f172a; line-height: 1.3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet-wrapper { width: 100%; max-width: 1100px; margin: 0 auto; padding: 12px; }
    .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .school-logo { width: 55px; height: 55px; object-fit: contain; }
    .institution-name { font-size: 16px; font-weight: 800; text-transform: uppercase; color: #0b1f4b; letter-spacing: 0.5px; }
    .institution-sub { font-size: 10px; color: #475569; margin-top: 1px; }
    .doc-badge { text-align: right; }
    .doc-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
    .doc-meta { font-size: 10px; font-weight: 600; color: #334155; margin-top: 2px; }
    
    .meta-bar { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 12px; font-size: 11px; margin-bottom: 10px; border-radius: 4px; }
    .meta-item strong { color: #0f172a; }

    table.result-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
    table.result-table th, table.result-table td { border: 1px solid #334155; padding: 5px 6px; }
    table.result-table thead tr { background: #e2e8f0; font-weight: bold; text-transform: uppercase; }
    table.result-table th { text-align: center; }
    table.result-table th.th-left { text-align: left; }
    table.result-table td.td-center { text-align: center; }
    table.result-table td.td-left { text-align: left; }
    table.result-table tbody tr:nth-child(even) { background: #f8fafc; }
    
    .grade-pass { color: #15803d; font-weight: bold; }
    .grade-fail { color: #b91c1c; font-weight: bold; }
    .absent-mark { color: #b91c1c; font-weight: bold; }

    .summary-box { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; font-size: 10px; }
    .stat-card { border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px; background: #f8fafc; text-align: center; }
    .stat-label { color: #64748b; text-transform: uppercase; font-size: 9px; display: block; }
    .stat-val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }

    .signatures-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin-top: 20px; font-size: 10px; text-align: center; }
    .sig-line { height: 32px; border-bottom: 1px dashed #64748b; margin-bottom: 4px; }
    .sig-title { color: #334155; font-weight: 600; text-transform: uppercase; font-size: 9px; }

    .empty-msg { text-align: center; padding: 30px; font-size: 13px; font-weight: 600; color: #64748b; }

    @media print {
      body { background: transparent; }
      .sheet-wrapper { max-width: none; width: 100%; padding: 0; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="sheet-wrapper">
    <div class="header-box">
      <div class="header-left">
        ${logoSrc ? `<img src="${logoSrc}" class="school-logo" alt="${schoolName}" />` : ''}
        <div>
          <h1 class="institution-name">${schoolName}</h1>
          <p class="institution-sub">${schoolAddress}</p>
          <p class="institution-sub font-semibold">${affiliationText}</p>
        </div>
      </div>
      <div class="doc-badge">
        <h2 class="doc-title">Official Tabulation & Result Sheet</h2>
        <p class="doc-meta">${examTitle} • Session ${session}</p>
      </div>
    </div>

    <div class="meta-bar">
      <div class="meta-item">Class: <strong>${className}</strong></div>
      <div class="meta-item">Section: <strong>${sectionLabel}</strong></div>
      <div class="meta-item">Total Candidates: <strong>${students.length}</strong></div>
      <div class="meta-item">Assigned Subjects: <strong>${subjects.length}</strong></div>
      <div class="meta-item">Generated: <strong>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
    </div>

    ${
      !hasStudents
        ? `<div class="empty-msg">No enrolled students found in this class</div>`
        : `
    <table class="result-table">
      <thead>
        <tr>
          <th style="width: 35px;">Roll</th>
          <th class="th-left" style="width: 140px;">Student Name</th>
          <th style="width: 75px;">Admission No</th>
          ${subjects
            .map(
              (sub) => `<th>${sub.code || sub.name}<br/><span style="font-weight:normal; font-size:8.5px;">(${sub.maxMarks || 100})</span></th>`
            )
            .join('')}
          <th style="width: 65px;">Total Marks</th>
          <th style="width: 45px;">%</th>
          <th style="width: 45px;">Grade</th>
          <th style="width: 55px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${studentRows
          .map(
            (row) => `
          <tr>
            <td class="td-center"><strong>${row.student.rollNumber || '—'}</strong></td>
            <td class="td-left"><strong>${row.student.name}</strong></td>
            <td class="td-center" style="font-family: monospace;">${row.student.admissionNumber}</td>
            ${row.subjectCells
              .map(
                (sc) => `
              <td class="td-center ${sc.isAbsent ? 'absent-mark' : ''}">
                ${sc.display}
              </td>
            `
              )
              .join('')}
            <td class="td-center font-bold">
              ${row.totalMax > 0 ? `${row.totalObtained} / ${row.totalMax}` : '—'}
            </td>
            <td class="td-center font-semibold">
              ${row.percentage !== '—' ? `${row.percentage}%` : '—'}
            </td>
            <td class="td-center ${row.status === 'PASS' ? 'grade-pass' : row.status === 'FAIL' ? 'grade-fail' : ''}">
              ${row.grade}
            </td>
            <td class="td-center ${row.status === 'PASS' ? 'grade-pass' : row.status === 'FAIL' ? 'grade-fail' : ''}">
              ${row.status}
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="summary-box">
      <div class="stat-card">
        <span class="stat-label">Total Enrolled</span>
        <div class="stat-val">${students.length}</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Appeared</span>
        <div class="stat-val">${totalAppeared}</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Passed</span>
        <div class="stat-val" style="color: #15803d;">${totalPassed}</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Failed / Repeat</span>
        <div class="stat-val" style="color: #b91c1c;">${totalFailed}</div>
      </div>
      <div class="stat-card">
        <span class="stat-label">Pass Percentage</span>
        <div class="stat-val" style="color: #1e3a8a;">${passPercentage}%</div>
      </div>
    </div>
    `
    }

    <div class="signatures-row">
      <div>
        <div class="sig-line"></div>
        <span class="sig-title">Class Teacher</span>
      </div>
      <div>
        <div class="sig-line"></div>
        <span class="sig-title">Tabulator</span>
      </div>
      <div>
        <div class="sig-line"></div>
        <span class="sig-title">Examination Incharge</span>
      </div>
      <div>
        <div class="sig-line"></div>
        <span class="sig-title">Principal</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Trigger immediate client download of Class-Wise Result Sheet
 */
export function downloadResultSheet(options: ResultSheetOptions): void {
  const html = generateResultSheetHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const schoolClean = (options.settings.schoolName || 'PDS_School').replace(/[^a-zA-Z0-9]/g, '_');
  const classClean = (options.selectedClass?.name || 'Class').replace(/[^a-zA-Z0-9]/g, '_');
  const secClean = (options.section || 'ALL').replace(/[^a-zA-Z0-9]/g, '_');
  const examClean = (options.exam?.name || options.exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `${schoolClean}_Result_Sheet_${classClean}_${secClean}_${examClean}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Render single marksheet HTML page block
 */
function renderSingleMarksheetHtml(options: SingleMarksheetOptions): string {
  const { settings, exam, student, subjects, marksList, attendancePercentage } = options;

  const schoolName = settings.schoolName || NOT_CONFIGURED;
  const schoolAddress = settings.schoolAddress || NOT_CONFIGURED;
  const affiliationText = letterheadLine(schoolIdentity(settings)) || 'School details not configured';
  const examTitle = exam?.name || exam?.title || 'Academic Assessment';
  const session = exam?.academicSession || settings.currentAcademicSession || '2026-2027';

  const logoSrc = getSchoolLogoSrc(settings.schoolLogo) || '';
  const studentPhotoSrc = student.photo ? fileUploadService.getFileUrl(student.photo) : '';
  const principalSigSrc = settings.principalSignature ? fileUploadService.getFileUrl(settings.principalSignature) : '';

  const stMarks = marksList.filter((m) => m.examId === exam.id && m.studentId === student.id);

  let totalMax = 0;
  let totalObtained = 0;
  let recordedCount = 0;

  const subjectRows = subjects.map((sub) => {
    const markEntry = stMarks.find((m) => m.subjectId === sub.id);
    const maxMarks = markEntry?.maxMarks || sub.maxMarks || 100;
    const isRecorded = Boolean(markEntry);
    const isAbsent = markEntry?.isAbsent || false;
    const marksObtained = isRecorded ? (isAbsent ? 0 : markEntry?.marksObtained || 0) : null;
    const evalRes = marksObtained !== null ? calculateEvaluation(marksObtained, maxMarks) : null;

    if (isRecorded) {
      recordedCount++;
      totalMax += maxMarks;
      totalObtained += isAbsent ? 0 : marksObtained || 0;
    }

    return {
      subject: sub,
      isRecorded,
      isAbsent,
      maxMarks,
      marksObtained,
      grade: evalRes?.grade || '—',
      remark: isAbsent ? 'Absent' : evalRes?.remark || 'Pending',
      status: evalRes?.status || 'N/A',
    };
  });

  const overallEval =
    totalMax > 0
      ? calculateEvaluation(totalObtained, totalMax)
      : { grade: 'N/A', gradePoint: 0, status: 'N/A' as const, percentage: 0, remark: 'No marks recorded' };

  return `
    <div class="report-card-page">
      <div class="school-header">
        <div class="header-content">
          ${logoSrc ? `<img src="${logoSrc}" class="school-logo" alt="${schoolName}" />` : ''}
          <div class="school-info">
            <h1 class="school-name">${schoolName}</h1>
            <p class="school-address">${schoolAddress}</p>
            <p class="school-affiliation">${affiliationText}</p>
          </div>
        </div>
        <div class="report-badge">
          Official Examination Marksheet • Academic Session ${session}
        </div>
      </div>

      <div class="student-particulars">
        ${
          studentPhotoSrc
            ? `<img src="${studentPhotoSrc}" class="student-photo" alt="${student.name}" />`
            : `<div class="student-avatar-placeholder">${student.name.charAt(0)}</div>`
        }
        <div class="particulars-grid">
          <div class="particular-item"><span class="label">Student Name:</span> <strong class="val">${student.name}</strong></div>
          <div class="particular-item"><span class="label">Class & Section:</span> <strong class="val">${student.className || 'Class'} - ${student.section || 'A'}</strong></div>
          <div class="particular-item"><span class="label">Admission No:</span> <strong class="val">${student.admissionNumber}</strong></div>
          <div class="particular-item"><span class="label">Roll No:</span> <strong class="val">${student.rollNumber || '—'}</strong></div>
          <div class="particular-item"><span class="label">Registration No:</span> <strong class="val">${student.registrationNumber || '—'}</strong></div>
          <div class="particular-item"><span class="label">Date of Birth:</span> <strong class="val">${student.dob || '—'}</strong></div>
          <div class="particular-item"><span class="label">Parent / Guardian:</span> <strong class="val">${student.parentName || student.fatherName || '—'}</strong></div>
          <div class="particular-item"><span class="label">Attendance:</span> <strong class="val" style="color: #15803d;">${typeof attendancePercentage === 'number' ? `${attendancePercentage}%` : 'Not recorded'}</strong></div>
        </div>
      </div>

      <h3 class="section-title">Scholastic Performance (${examTitle})</h3>

      <table class="marks-table">
        <thead>
          <tr>
            <th style="width: 38%;">Subject</th>
            <th style="width: 15%; text-align: center;">Max Marks</th>
            <th style="width: 15%; text-align: center;">Marks Obtained</th>
            <th style="width: 14%; text-align: center;">Grade</th>
            <th style="width: 18%; text-align: center;">Performance</th>
          </tr>
        </thead>
        <tbody>
          ${
            subjectRows.length === 0
              ? `<tr><td colspan="5" class="empty-state">No subjects assigned</td></tr>`
              : subjectRows
                  .map((row) => {
                    const isPass = row.status === 'PASS';
                    return `
              <tr>
                <td><strong>${row.subject.name}</strong></td>
                <td style="text-align: center;">${row.maxMarks}</td>
                <td style="text-align: center; font-weight: bold;">
                  ${row.isRecorded ? (row.isAbsent ? '<span style="color:#b91c1c;">AB</span>' : row.marksObtained) : '—'}
                </td>
                <td style="text-align: center; font-weight: bold; color: ${isPass ? '#1e3a8a' : '#b91c1c'};">${row.grade}</td>
                <td style="text-align: center; color: #475569;">${row.remark}</td>
              </tr>
            `;
                  })
                  .join('')
          }
          <tr class="total-row">
            <td>GRAND TOTAL / OVERALL</td>
            <td style="text-align: center;">${totalMax}</td>
            <td style="text-align: center;">${totalObtained}</td>
            <td style="text-align: center; color: ${overallEval.status === 'PASS' ? '#15803d' : '#b91c1c'};">${overallEval.grade}</td>
            <td style="text-align: center; color: ${overallEval.status === 'PASS' ? '#15803d' : '#b91c1c'};">${overallEval.percentage}% (${overallEval.status})</td>
          </tr>
        </tbody>
      </table>

      <div class="remarks-grid">
        <div class="remark-box">
          <span class="remark-label">Class Teacher's Remarks:</span>
          <p class="remark-text">
            ${
              overallEval.status === 'PASS'
                ? '"Displays commendable academic diligence, active classroom participation, and disciplined conduct."'
                : '"Essential repeat required. Needs focused remedial guidance and academic re-assessment."'
            }
          </p>
        </div>
        <div class="remark-box">
          <span class="remark-label">Promotional Status & Remarks:</span>
          <p class="remark-text">
            ${
              overallEval.status === 'PASS'
                ? 'PASSED & PROMOTED • Commendable academic progress.'
                : 'FAIL / ESSENTIAL REPEAT • Intensive remedial guidance required.'
            }
          </p>
        </div>
      </div>

      <div class="signatures-row">
        <div class="sig-block">
          <div class="sig-line"></div>
          <span class="sig-title">Class Teacher</span>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <span class="sig-title">Parent / Guardian</span>
        </div>
        <div class="sig-block">
          <div class="sig-line" style="display: flex; align-items: flex-end; justify-content: center;">
            ${principalSigSrc ? `<img src="${principalSigSrc}" style="max-height: 38px; object-contain;" alt="Principal" />` : ''}
          </div>
          <span class="sig-title"><strong>${settings.principalName || 'Principal'}</strong><br/>Principal</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate full standalone HTML for Bulk Marksheets (1 student per page)
 */
export function generateBulkMarksheetHtml(options: BulkMarksheetOptions): string {
  const { settings, exam, students, marksList, getStudentSubjects, getStudentAttendance } = options;

  const schoolName = settings.schoolName || NOT_CONFIGURED;
  const examTitle = exam?.name || exam?.title || 'Assessment';

  if (!students || students.length === 0) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>No Students</title></head>
<body style="font-family:sans-serif; text-align:center; padding:50px;">
  <h2>No result data available</h2>
</body></html>`;
  }

  // Deduplicate students strictly
  const seen = new Set<string>();
  const uniqueStudents: Student[] = [];
  for (const s of students) {
    const key = s.id || s.admissionNumber;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueStudents.push(s);
    }
  }

  const pagesHtml = uniqueStudents
    .map((st) => {
      const subs = getStudentSubjects(st);
      const attSummary = getStudentAttendance ? getStudentAttendance(st.id) : undefined;
      // No records means "not recorded", not 100%.
      const att = attSummary && (attSummary as any).total !== 0 && typeof attSummary.percentage === 'number' ? attSummary.percentage : undefined;
      return renderSingleMarksheetHtml({
        settings,
        exam,
        student: st,
        subjects: subs,
        marksList,
        attendancePercentage: att,
      });
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${schoolName} - Marksheets - ${examTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; background: #ffffff; color: #0f172a; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-card-page { width: 100%; max-width: 800px; margin: 0 auto 30px auto; padding: 24px; border: 1.5px solid #0f172a; background: #ffffff; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
    .report-card-page:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
    .school-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
    .header-content { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
    .school-logo { width: 75px; height: 75px; object-fit: contain; }
    .school-info { text-align: center; }
    .school-name { font-size: 19px; font-weight: bold; text-transform: uppercase; color: #0b1f4b; letter-spacing: 0.5px; }
    .school-address { font-size: 11px; font-family: sans-serif; color: #475569; margin-top: 2px; }
    .school-affiliation { font-size: 10px; font-family: sans-serif; font-weight: bold; color: #334155; margin-top: 2px; }
    .report-badge { display: inline-block; border: 1px solid #0f172a; padding: 4px 14px; font-size: 11px; font-weight: bold; font-family: sans-serif; text-transform: uppercase; background: #f8fafc; letter-spacing: 0.5px; margin-top: 4px; }
    .student-particulars { display: flex; align-items: center; gap: 14px; border: 1px solid #cbd5e1; padding: 10px 14px; margin-bottom: 14px; background: #f8fafc; }
    .student-photo { width: 70px; height: 85px; object-fit: cover; border: 1px solid #94a3b8; border-radius: 4px; }
    .student-avatar-placeholder { width: 70px; height: 85px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #475569; border: 1px solid #94a3b8; border-radius: 4px; }
    .particulars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-family: sans-serif; font-size: 11px; flex: 1; }
    .particular-item .label { color: #64748b; }
    .particular-item .val { color: #0f172a; }
    .section-title { font-size: 12px; font-weight: bold; font-family: sans-serif; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: #1e293b; }
    .marks-table { width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; font-family: sans-serif; font-size: 11px; margin-bottom: 14px; }
    .marks-table th, .marks-table td { border: 1px solid #0f172a; padding: 6px 8px; }
    .marks-table thead tr { background: #e2e8f0; color: #0f172a; font-weight: bold; }
    .total-row { background: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; }
    .empty-state { text-align: center; padding: 16px; color: #64748b; font-style: italic; }
    .remarks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-family: sans-serif; font-size: 11px; margin-bottom: 16px; }
    .remark-box { border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 4px; }
    .remark-label { font-weight: bold; color: #334155; display: block; margin-bottom: 3px; }
    .remark-text { font-style: italic; color: #0f172a; font-size: 10.5px; }
    .signatures-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-family: sans-serif; font-size: 11px; border-top: 1px solid #94a3b8; padding-top: 14px; margin-top: 10px; }
    .sig-line { height: 38px; border-bottom: 1px dashed #64748b; margin: 0 16px 6px 16px; }
    .sig-title { color: #334155; font-size: 10.5px; }
    @media print {
      body { background: transparent; }
      .report-card-page { border: 1.5px solid #0f172a !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/**
 * Trigger immediate client download of Bulk Marksheets (1 per page)
 */
export function downloadBulkMarksheets(options: BulkMarksheetOptions): void {
  const html = generateBulkMarksheetHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const schoolClean = (options.settings.schoolName || 'PDS_School').replace(/[^a-zA-Z0-9]/g, '_');
  const examClean = (options.exam?.name || options.exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `${schoolClean}_All_Marksheets_${examClean}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger download of single student marksheet
 */
export function downloadSingleMarksheet(options: SingleMarksheetOptions): void {
  const pageHtml = renderSingleMarksheetHtml(options);
  const schoolName = options.settings.schoolName || NOT_CONFIGURED;
  const examTitle = options.exam?.name || options.exam?.title || 'Assessment';

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${schoolName} - Marksheet - ${options.student.name} - ${examTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; background: #ffffff; color: #0f172a; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-card-page { width: 100%; max-width: 800px; margin: 0 auto; padding: 24px; border: 1.5px solid #0f172a; background: #ffffff; }
    .school-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
    .header-content { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
    .school-logo { width: 75px; height: 75px; object-fit: contain; }
    .school-info { text-align: center; }
    .school-name { font-size: 19px; font-weight: bold; text-transform: uppercase; color: #0b1f4b; letter-spacing: 0.5px; }
    .school-address { font-size: 11px; font-family: sans-serif; color: #475569; margin-top: 2px; }
    .school-affiliation { font-size: 10px; font-family: sans-serif; font-weight: bold; color: #334155; margin-top: 2px; }
    .report-badge { display: inline-block; border: 1px solid #0f172a; padding: 4px 14px; font-size: 11px; font-weight: bold; font-family: sans-serif; text-transform: uppercase; background: #f8fafc; letter-spacing: 0.5px; margin-top: 4px; }
    .student-particulars { display: flex; align-items: center; gap: 14px; border: 1px solid #cbd5e1; padding: 10px 14px; margin-bottom: 14px; background: #f8fafc; }
    .student-photo { width: 70px; height: 85px; object-fit: cover; border: 1px solid #94a3b8; border-radius: 4px; }
    .student-avatar-placeholder { width: 70px; height: 85px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #475569; border: 1px solid #94a3b8; border-radius: 4px; }
    .particulars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-family: sans-serif; font-size: 11px; flex: 1; }
    .particular-item .label { color: #64748b; }
    .particular-item .val { color: #0f172a; }
    .section-title { font-size: 12px; font-weight: bold; font-family: sans-serif; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: #1e293b; }
    .marks-table { width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; font-family: sans-serif; font-size: 11px; margin-bottom: 14px; }
    .marks-table th, .marks-table td { border: 1px solid #0f172a; padding: 6px 8px; }
    .marks-table thead tr { background: #e2e8f0; color: #0f172a; font-weight: bold; }
    .total-row { background: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; }
    .empty-state { text-align: center; padding: 16px; color: #64748b; font-style: italic; }
    .remarks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-family: sans-serif; font-size: 11px; margin-bottom: 16px; }
    .remark-box { border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 4px; }
    .remark-label { font-weight: bold; color: #334155; display: block; margin-bottom: 3px; }
    .remark-text { font-style: italic; color: #0f172a; font-size: 10.5px; }
    .signatures-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-family: sans-serif; font-size: 11px; border-top: 1px solid #94a3b8; padding-top: 14px; margin-top: 10px; }
    .sig-line { height: 38px; border-bottom: 1px dashed #64748b; margin: 0 16px 6px 16px; }
    .sig-title { color: #334155; font-size: 10.5px; }
    @media print {
      body { background: transparent; }
      .report-card-page { border: 1.5px solid #0f172a !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
    }
  </style>
</head>
<body>
  ${pageHtml}
</body>
</html>`;

  const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stClean = options.student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const examClean = (options.exam?.name || options.exam?.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `${stClean}_Marksheet_${examClean}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
