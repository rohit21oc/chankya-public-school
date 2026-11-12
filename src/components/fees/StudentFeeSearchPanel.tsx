import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Student, FeeLedgerEntry, SchoolSettings } from '../../types';
import { api } from '../../services/api';
import { fileUploadService } from '../../services/fileUploadService';
import { classLabel, inr } from './feeFormat';

interface StudentFeeSearchPanelProps {
  onSelectStudent: (studentId: string) => void;
  settings: SchoolSettings;
}

export const StudentFeeSearchPanel: React.FC<StudentFeeSearchPanelProps> = ({
  onSelectStudent,
  settings,
}) => {
  const students = api.getStudents();
  const classes = api.getClasses();
  const allLedgers = api.getFeeLedgersSync();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [duesFilter, setDuesFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  // Compute pending balance per student from real MongoDB ledger data
  const studentBalances = useMemo(() => {
    const balances: Record<string, { totalBilled: number; totalPaid: number; pending: number }> =
      {};

    allLedgers.forEach((l) => {
      if (!balances[l.studentId]) {
        balances[l.studentId] = { totalBilled: 0, totalPaid: 0, pending: 0 };
      }
      const billed = Number(l.total ?? l.amount ?? 0);
      const paid = Number(l.paidAmount ?? 0);
      const pend = Number(l.pendingAmount ?? Math.max(0, billed - paid));

      balances[l.studentId].totalBilled += billed;
      balances[l.studentId].totalPaid += paid;
      balances[l.studentId].pending += pend;
    });

    return balances;
  }, [allLedgers]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalPending = 0;
    let studentsWithDues = 0;

    students.forEach((s) => {
      const bal = studentBalances[s.id]?.pending || 0;
      if (bal > 0) {
        totalPending += bal;
        studentsWithDues++;
      }
    });

    return {
      totalStudents: students.length,
      studentsWithDues,
      fullyPaidStudents: students.length - studentsWithDues,
      totalPendingAmount: totalPending,
    };
  }, [students, studentBalances]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (!student) return false;
      // Dues filter
      const bal = (student.id && studentBalances[student.id]?.pending) || 0;
      if (duesFilter === 'PENDING' && bal <= 0) return false;
      if (duesFilter === 'PAID' && bal > 0) return false;

      // Class filter
      if (selectedClassId !== 'ALL' && student.classId !== selectedClassId) return false;

      // Search query filter (Name, Admission No, Registration No)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = student.name ? student.name.toLowerCase().includes(q) : false;
        const matchesAdm = student.admissionNumber ? student.admissionNumber.toLowerCase().includes(q) : false;
        const matchesReg = student.registrationNumber
          ? student.registrationNumber.toLowerCase().includes(q)
          : false;
        const matchesMobile = student.mobile ? student.mobile.includes(q) : false;
        const matchesParent = student.fatherName
          ? student.fatherName.toLowerCase().includes(q)
          : student.parentName
          ? student.parentName.toLowerCase().includes(q)
          : false;

        if (!matchesName && !matchesAdm && !matchesReg && !matchesMobile && !matchesParent) {
          return false;
        }
      }

      return true;
    });
  }, [students, searchQuery, selectedClassId, duesFilter, studentBalances]);

  const chip = (active: boolean) =>
    `h-9 px-3 rounded-md text-sm transition-colors ${active ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Students" value={String(stats.totalStudents)} />
        <SummaryCard label="Outstanding" value={inr(stats.totalPendingAmount)} tone={stats.totalPendingAmount > 0 ? 'danger' : undefined} />
        <SummaryCard label="With dues" value={String(stats.studentsWithDues)} />
        <SummaryCard label="Fully paid" value={String(stats.fullyPaidStudents)} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="input-student-fee-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, admission no., registration no. or mobile"
              aria-label="Search students"
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            )}
          </div>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            aria-label="Class"
            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          >
            <option value="ALL">All classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {classLabel(cls.name)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg" role="group" aria-label="Dues filter">
            <button type="button" onClick={() => setDuesFilter('ALL')} className={chip(duesFilter === 'ALL')}>
              All ({students.length})
            </button>
            <button type="button" onClick={() => setDuesFilter('PENDING')} className={chip(duesFilter === 'PENDING')}>
              With dues ({stats.studentsWithDues})
            </button>
            <button type="button" onClick={() => setDuesFilter('PAID')} className={chip(duesFilter === 'PAID')}>
              Paid ({stats.fullyPaidStudents})
            </button>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-600">
            {students.length === 0 ? 'No students have been admitted yet.' : 'No student matches this search or filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Parent</th>
                  <th className="px-4 py-3 font-medium text-right">Billed</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                  <th className="px-4 py-3 font-medium text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const bal = studentBalances[student.id];
                  const pending = bal?.pending || 0;
                  const photoKey = student.photo || student.photoFileKey || (student as any)?.avatar;
                  const photoUrl = photoKey ? fileUploadService.getFileUrl(photoKey) : '';
                  const facilities = [student.transportRequired && 'Bus', student.hostelRequired && 'Hostel'].filter(Boolean).join(' · ');
                  return (
                    <tr
                      key={student.id}
                      onClick={() => onSelectStudent(student.id)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.name} url={photoUrl} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudent(student.id);
                              }}
                              className="font-medium text-slate-900 hover:text-emerald-700 hover:underline text-left"
                            >
                              {student.name}
                            </button>
                            <span className="block text-xs text-slate-500">
                              Adm. no. {student.admissionNumber}
                              {facilities ? ` · ${facilities}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{classLabel(student.className, student.section)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.fatherName || student.parentName || ''}
                        <span className="block text-xs text-slate-500">{student.fatherMobile || student.parentPhone || student.mobile || ''}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">{inr(bal?.totalBilled || 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">{inr(bal?.totalPaid || 0)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {pending > 0 ? (
                          <span className="font-semibold tabular-nums text-rose-700">{inr(pending)}</span>
                        ) : (
                          <span className="text-emerald-700">Paid up</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-3 border-t border-slate-200 text-sm text-slate-500">
          Showing {filteredStudents.length} of {students.length} students
        </p>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; tone?: 'danger' }> = ({ label, value, tone }) => (
  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
    <p className="text-sm text-slate-600">{label}</p>
    <p className={`text-xl font-semibold tabular-nums ${tone === 'danger' ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p>
  </div>
);

const Avatar: React.FC<{ name: string; url: string }> = ({ name, url }) => {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-semibold shrink-0">
      {(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
    </div>
  );
};
