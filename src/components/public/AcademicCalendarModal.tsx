import React from 'react';
import { X, Calendar, Clock, BookOpen, Award, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { schoolIdentity } from '../../utils/schoolIdentity';

/** School identity from saved School Settings (hidden when a value is not saved). */
const pub = () => schoolIdentity(api.getSettings());
const pubContacts = () => [pub().phones.join(' | '), pub().helpline ? `(Helpline: ${pub().helpline})` : ''].filter(Boolean).join(' ');
const pubNameLine = () => pub().name;

interface AcademicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEnquiry: () => void;
}

export const AcademicCalendarModal: React.FC<AcademicCalendarModalProps> = ({
  isOpen,
  onClose,
  onOpenEnquiry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Academic Calendar & Examination Schedule (2026 - 2027)
              </h3>
              <p className="text-xs text-slate-500">
                {pubNameLine()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto py-4 space-y-6 text-xs text-slate-700">
          {/* Term 1 */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-700" />
                <span>Term I: April 2026 – September 2026</span>
              </h4>
              <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                Semester 1
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                <span className="font-mono text-[10px] text-blue-600 font-bold block">APRIL 2026</span>
                <strong className="text-slate-900 block mt-0.5">Commencement of Academic Session</strong>
                <p className="text-[11px] text-slate-500">Welcome orientation & distribution of study kits</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                <span className="font-mono text-[10px] text-blue-600 font-bold block">MAY – JUNE 2026</span>
                <strong className="text-slate-900 block mt-0.5">Summer Vacation & Creative Projects</strong>
                <p className="text-[11px] text-slate-500">Holistic holiday homework and self-paced learning</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                <span className="font-mono text-[10px] text-blue-600 font-bold block">JULY 2026</span>
                <strong className="text-slate-900 block mt-0.5">Periodic Assessment 1 (PA-1)</strong>
                <p className="text-[11px] text-slate-500">Unit evaluation across all wings (Pre-Primary to 10th)</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                <span className="font-mono text-[10px] text-blue-600 font-bold block">SEPTEMBER 2026</span>
                <strong className="text-slate-900 block mt-0.5">Half-Yearly Examination (Term I)</strong>
                <p className="text-[11px] text-slate-500">Comprehensive syllabus evaluation & PTM meet</p>
              </div>
            </div>
          </div>

          {/* Term 2 */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-700" />
                <span>Term II: October 2026 – March 2027</span>
              </h4>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Semester 2
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-white border border-amber-100">
                <span className="font-mono text-[10px] text-amber-600 font-bold block">OCTOBER 2026</span>
                <strong className="text-slate-900 block mt-0.5">Dussehra & Diwali Celebrations</strong>
                <p className="text-[11px] text-slate-500">Festive cultural programmes and moral storytelling</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-amber-100">
                <span className="font-mono text-[10px] text-amber-600 font-bold block">NOVEMBER 2026</span>
                <strong className="text-slate-900 block mt-0.5">Periodic Assessment 2 (PA-2) & Sports Meet</strong>
                <p className="text-[11px] text-slate-500">Annual athletic track events, yoga and quiz contests</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-amber-100">
                <span className="font-mono text-[10px] text-amber-600 font-bold block">JANUARY 2027</span>
                <strong className="text-slate-900 block mt-0.5">Term-2 Pre-Annual Evaluations (Classes 6th - 8th)</strong>
                <p className="text-[11px] text-slate-500">Full syllabus revision mock drills and personalized doubt clinics</p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-amber-100">
                <span className="font-mono text-[10px] text-amber-600 font-bold block">FEBRUARY – MARCH 2027</span>
                <strong className="text-slate-900 block mt-0.5">Annual Examination & Results</strong>
                <p className="text-[11px] text-slate-500">Final annual examinations, report cards and new session promotions</p>
              </div>
            </div>
          </div>

          {/* Dynamic Published Examination Timetable Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-700" />
                <span>Published Examination Timetables & Schedules</span>
              </h4>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                Live Timetables
              </span>
            </div>

            {(() => {
              const publishedExams = api.getExams().filter((e) => e.status !== 'DRAFT');
              if (publishedExams.length === 0) {
                return (
                  <div className="p-4 text-center bg-white rounded-lg border border-slate-200 text-slate-500 text-xs">
                    No active examinations scheduled for this period. Formal circulars will appear here when scheduled.
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {publishedExams.map((ex) => (
                    <div key={ex.id} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="text-slate-900 text-xs">{ex.name || ex.title}</strong>
                          <span className="text-slate-500 text-[11px] ml-2">
                            ({ex.startDate} to {ex.endDate})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {ex.examType?.replace('_', ' ') || 'EXAMINATION'}
                        </span>
                      </div>

                      {ex.schedule && ex.schedule.length > 0 ? (
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left text-[11px] font-sans">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-2">Class</th>
                                <th className="p-2">Subject</th>
                                <th className="p-2">Date</th>
                                <th className="p-2">Timing</th>
                                <th className="p-2">Room / Hall</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {ex.schedule.map((paper, pIdx) => (
                                <tr key={paper.id || pIdx} className="hover:bg-slate-50">
                                  <td className="p-2 font-semibold text-slate-800">
                                    {paper.className}{paper.section && paper.section !== 'ALL' ? ` (${paper.section})` : ''}
                                  </td>
                                  <td className="p-2 font-bold text-blue-900">{paper.subjectName}</td>
                                  <td className="p-2 text-slate-700">{paper.date}</td>
                                  <td className="p-2 text-slate-600">{paper.startTime} - {paper.endTime}</td>
                                  <td className="p-2 text-slate-500">{paper.roomNumber || 'Exam Center'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">Class-wise detailed timetable will be issued shortly.</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Note */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Detailed circulars regarding exam dates and holiday timetables are issued in the Notice Board section.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEnquiry();
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Apply for Admission
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Calendar
          </button>
        </div>
      </div>
    </div>
  );
};
