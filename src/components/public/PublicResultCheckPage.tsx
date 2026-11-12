import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, GraduationCap, Loader2, Printer, Search, RotateCcw } from 'lucide-react';
import { Exam, ExamMark, SchoolSettings, Student, Subject } from '../../types';
import { api } from '../../services/api';
import { fileUploadService } from '../../services/fileUploadService';
import { getSchoolLogoSrc, handleLogoError } from '../../constants/schoolLogo';
import { getGradeRemark } from '../../utils/grading';
import { buildMarksheet } from '../../utils/marksheetModel';
import { schoolIdentity } from '../../utils/schoolIdentity';

interface PublicResultCheckPageProps {
  settings: SchoolSettings;
  onBackToHome: () => void;
  onGoToLogin: () => void;
}

type PublicExam = { id: string; name: string; examType: string; academicSession: string; classIds: string[] };

const inputCls =
  'w-full min-h-11 px-3 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20';
const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5';

export const PublicResultCheckPage: React.FC<PublicResultCheckPageProps> = ({ settings, onBackToHome }) => {
  const sid = schoolIdentity(settings);
  const logo = getSchoolLogoSrc(settings.schoolLogo);
  const resultRef = useRef<HTMLDivElement>(null);

  const [optionsState, setOptionsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [exams, setExams] = useState<PublicExam[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const [queryId, setQueryId] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [exporting, setExporting] = useState(false);

  const loadOptions = async () => {
    setOptionsState('loading');
    const res = await api.getPublicResultOptions();
    if (!res.ok) {
      setOptionsState('error');
      return;
    }
    setExams(res.exams);
    setClasses(res.classes);
    setExamId((cur) => cur || res.exams[0]?.id || '');
    setOptionsState('ready');
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const activeExam = exams.find((e) => e.id === examId);
  const classChoices = useMemo(() => {
    const ids = activeExam?.classIds || [];
    return ids.length ? classes.filter((c) => ids.includes(c.id)) : classes;
  }, [activeExam, classes]);

  // Keep the class valid for the chosen exam.
  useEffect(() => {
    if (!classChoices.some((c) => c.id === classId)) setClassId(classChoices[0]?.id || '');
  }, [classChoices, classId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching || !activeExam) return;
    setError(null);
    const q = queryId.trim();
    if (!q) return setError('Enter the Admission Number or Roll Number.');
    if (!dob) return setError("Enter the student's date of birth.");

    setSearching(true);
    const res = await api.lookupPublicResult({ examId: activeExam.id, classId: classId || undefined, query: q, dob });
    setSearching(false);

    if (!res.ok) {
      setStudent(null);
      setMarks([]);
      setSubjectList([]);
      setError(
        res.status === 404
          ? 'No result found for these details. Check the number and date of birth, and that the class and exam are correct.'
          : res.error || 'Something went wrong. Please try again.'
      );
      return;
    }
    setStudent(res.student as Student);
    setMarks(res.marks);
    setSubjectList(res.subjects);
  };

  // Bring the marksheet into view once it has loaded (phones show the form first).
  useEffect(() => {
    if (student) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [student]);

  const reset = () => {
    setStudent(null);
    setMarks([]);
    setQueryId('');
    setDob('');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The same model the school's own marksheet uses: one row per subject of the student's class.
  const sheet = useMemo(() => buildMarksheet(subjectList, marks), [subjectList, marks]);
  const isPass = sheet.result === 'PASS';
  const resultText = sheet.result === 'NO MARKS' ? 'Not available' : sheet.result === 'INCOMPLETE' ? 'Incomplete' : sheet.result;

  const downloadPdf = async () => {
    if (!student || !activeExam || exporting) return;
    setExporting(true);
    try {
      // A text-based A4 PDF (sharp at any zoom, small file) with no signatures.
      // Loaded on demand so the public site doesn't download the PDF library up front.
      const { exportReportCardToPdf } = await import('../../utils/reportCardPdfExporter');
      const ok = await exportReportCardToPdf({
        variant: 'public',
        settings,
        student: { ...student, id: 'public-result' } as Student,
        exam: { id: activeExam.id, title: activeExam.name, name: activeExam.name, academicSession: activeExam.academicSession } as unknown as Exam,
        subjects: subjectList,
        marksList: marks.map((m) => ({ ...m, studentId: 'public-result' })),
      });
      if (!ok) throw new Error('export failed');
    } catch {
      setError('Could not create the PDF. Use Print and choose "Save as PDF" instead.');
    } finally {
      setExporting(false);
    }
  };

  const cell = 'px-3 py-2.5 border border-slate-300';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 -ml-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Website</span>
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            {logo && <img src={logo} onError={handleLogoError} alt="" className="h-8 w-8 shrink-0 object-contain" />}
            <span className="truncate text-sm font-semibold text-slate-900">{settings.schoolName}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check Result</h1>
          <p className="mt-1.5 text-sm text-slate-600">Select the exam, then enter the student&apos;s Admission or Roll Number and date of birth. You can print the marksheet or save it as a PDF.</p>
        </div>

        <section aria-labelledby="search-title" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 print:hidden">
          <h2 id="search-title" className="sr-only">Find a result</h2>

          {optionsState === 'loading' && (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-600" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Loading published results…</span>
            </div>
          )}

          {optionsState === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-2" role="alert">
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span>Could not reach the school server. Check your connection and try again.</span>
              </p>
              <button type="button" onClick={loadOptions} className="min-h-10 rounded-lg border border-slate-300 px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50">Try again</button>
            </div>
          )}

          {optionsState === 'ready' && exams.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-slate-900">No results have been published yet</p>
              <p className="mt-1 text-sm text-slate-600">Please check again after the school announces the result.</p>
            </div>
          )}

          {optionsState === 'ready' && exams.length > 0 && (
            <form onSubmit={handleSearch} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rc-exam" className={labelCls}>Examination</label>
                  <select id="rc-exam" value={examId} onChange={(e) => setExamId(e.target.value)} className={inputCls}>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.name}{ex.academicSession ? ` (${ex.academicSession})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rc-class" className={labelCls}>Class</label>
                  <select id="rc-class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
                    {classChoices.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rc-id" className={labelCls}>Admission Number or Roll Number</label>
                  <input id="rc-id" type="text" inputMode="text" autoComplete="off" value={queryId} onChange={(e) => setQueryId(e.target.value)} className={inputCls} aria-describedby="rc-id-help" />
                  <p id="rc-id-help" className="mt-1.5 text-xs text-slate-500">Printed on the ID card and fee receipt.</p>
                </div>
                <div>
                  <label htmlFor="rc-dob" className={labelCls}>Date of Birth</label>
                  <input id="rc-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} aria-describedby="rc-dob-help" />
                  <p id="rc-dob-help" className="mt-1.5 text-xs text-slate-500">As registered with the school.</p>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={searching}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-5 text-sm font-semibold text-white hover:bg-blue-950 disabled:opacity-60 sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                <span>{searching ? 'Checking…' : 'View Marksheet'}</span>
              </button>
            </form>
          )}
        </section>

        {student && (
          <div ref={resultRef} className="mt-8 scroll-mt-20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Result found</span>
              </p>
              {sheet.result !== 'NO MARKS' && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={downloadPdf} disabled={exporting} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-900 px-4 text-[13px] font-semibold text-white hover:bg-blue-950 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    <span>{exporting ? 'Preparing…' : 'Download PDF'}</span>
                  </button>
                  <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    <span>Print</span>
                  </button>
                  <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Check another</span>
                  </button>
                </div>
              )}
            </div>

            {sheet.result === 'NO MARKS' ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm font-medium text-slate-900">{student.name}</p>
                <p className="mt-1 text-sm text-slate-600">Marks for this examination have not been entered yet. Please check again later or contact the school office.</p>
                <button type="button" onClick={reset} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50">Check another</button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-300 bg-white p-5 sm:p-8 print:border-none print:p-0">
                <div className="border-b-2 border-slate-900 pb-4 text-center">
                  {logo ? (
                    <img src={logo} onError={handleLogoError} alt={settings.schoolName} className="mx-auto h-20 w-20 object-contain" crossOrigin="anonymous" />
                  ) : (
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-blue-900 text-amber-300"><GraduationCap className="h-8 w-8" aria-hidden="true" /></div>
                  )}
                  <h2 className="mt-2 text-xl font-bold uppercase tracking-tight text-slate-900 sm:text-2xl">{settings.schoolName}</h2>
                  {sid.address && <p className="mt-0.5 text-xs text-slate-700">{sid.address}</p>}
                  <p className="mt-1 text-xs text-slate-600">
                    {[sid.affiliationNo && `${sid.board ? `${sid.board} ` : ''}Affiliation Code: ${sid.affiliationNo}`, sid.schoolCode && `School Code: ${sid.schoolCode}`, (sid.helpline || sid.phones[0]) && `Phone: ${sid.helpline || sid.phones[0]}`].filter(Boolean).join('  •  ')}
                  </p>
                  <p className="mt-3 inline-block rounded-full border border-slate-300 bg-slate-100 px-4 py-1 text-xs font-bold uppercase tracking-wide text-slate-800">
                    Statement of Marks — {activeExam?.name}{activeExam?.academicSession ? ` (${activeExam.academicSession})` : ''}
                  </p>
                </div>

                <div className="mt-5 flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start">
                  {student.photo && fileUploadService.getFileUrl(student.photo) ? (
                    <img src={fileUploadService.getFileUrl(student.photo)} alt="" className="h-24 w-20 shrink-0 rounded-md border border-slate-300 bg-white object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  ) : (
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-100 text-2xl font-bold text-blue-900">{student.name?.charAt(0)}</div>
                  )}
                  <dl className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                    {[
                      ['Student Name', student.name],
                      ['Admission No', student.admissionNumber],
                      ['Class & Section', [student.className, student.section].filter(Boolean).join(' - ')],
                      ['Roll Number', student.rollNumber],
                      ["Father's Name", student.fatherName || student.parentName],
                      ["Mother's Name", student.motherName],
                      ['Date of Birth', student.dob],
                      ['Registration No', student.registrationNumber],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-[11px] text-slate-500">{k}</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900 break-words">{(v as string) || 'Not recorded'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse border border-slate-300 text-left text-xs">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th scope="col" className={`${cell} border-slate-700 font-semibold`}>Subject</th>
                        <th scope="col" className={`${cell} border-slate-700 text-center font-semibold`}>Max</th>
                        <th scope="col" className={`${cell} border-slate-700 text-center font-semibold`}>Obtained</th>
                        <th scope="col" className={`${cell} border-slate-700 text-center font-semibold`}>Grade</th>
                        <th scope="col" className={`${cell} border-slate-700 font-semibold`}>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.map((r) => {
                        const sub = subjectList.find((x) => x.id === r.subjectId);
                        return (
                          <tr key={r.subjectId}>
                            <td className={`${cell} font-semibold text-slate-900`}>{r.subjectName}{sub?.code ? <span className="ml-1.5 font-mono font-normal text-slate-500">{sub.code}</span> : null}</td>
                            <td className={`${cell} text-center tabular-nums`}>{r.maxMarks}</td>
                            <td className={`${cell} text-center font-semibold tabular-nums text-slate-900`}>{r.result === 'PENDING' ? '-' : r.isAbsent ? 'AB' : r.obtained}</td>
                            <td className={`${cell} text-center font-semibold ${r.result === 'FAIL' ? 'text-red-700' : 'text-slate-900'}`}>{r.result === 'PENDING' || r.isAbsent ? '-' : r.grade}</td>
                            <td className={`${cell} ${r.result === 'FAIL' || r.isAbsent ? 'text-red-700' : 'text-slate-600'}`}>{r.result === 'PENDING' ? 'Pending' : r.isAbsent ? 'Absent' : r.result === 'FAIL' ? 'Not cleared' : getGradeRemark(r.grade)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-semibold text-slate-900">
                      <tr>
                        <td className={`${cell} text-right`}>Grand Total</td>
                        <td className={`${cell} text-center tabular-nums`}>{sheet.totalMax}</td>
                        <td className={`${cell} text-center tabular-nums`}>{sheet.totalObtained}</td>
                        <td className={`${cell} text-center ${isPass ? '' : 'text-red-700'}`}>{sheet.grade}</td>
                        <td className={`${cell} uppercase ${isPass ? 'text-emerald-700' : 'text-red-700'}`}>{resultText}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {sheet.pendingCount > 0 && (
                  <p className="mt-3 text-xs text-slate-600">Marks for {sheet.pendingCount} subject{sheet.pendingCount > 1 ? 's' : ''} have not been entered yet, so the result is incomplete.</p>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  {[
                    ['Total Marks', `${sheet.totalObtained} / ${sheet.totalMax}`, ''],
                    ['Percentage', `${sheet.percentage.toFixed(1)}%`, isPass ? '' : 'text-red-700'],
                    ['Overall Grade', sheet.grade, isPass ? '' : 'text-red-700'],
                    ['Result', resultText, isPass ? 'text-emerald-700' : 'text-red-700'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-500">{k}</p>
                      <p className={`mt-0.5 text-base font-bold tabular-nums text-slate-900 ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-6 text-center text-[11px] text-slate-500">
                  Computer-generated marksheet issued by {sid.name || settings.schoolName}.{sid.phones[0] ? ` For verification, contact the school office at ${sid.phones[0]}.` : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
