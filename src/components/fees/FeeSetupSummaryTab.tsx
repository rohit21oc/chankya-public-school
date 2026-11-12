import React from 'react';
import {
  FileCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Layers,
  Bus,
  Building,
  GraduationCap,
  ShieldCheck,
  CreditCard,
  Printer,
} from 'lucide-react';
import { ClassFeeConfiguration, TransportSlab } from '../../types';

interface FeeSetupSummaryTabProps {
  config: Partial<ClassFeeConfiguration>;
  className: string;
  section: string;
  transportSlabs: TransportSlab[];
}

export const FeeSetupSummaryTab: React.FC<FeeSetupSummaryTabProps> = ({
  config,
  className,
  section,
  transportSlabs,
}) => {
  // 1. One-Time Items
  const admissionFee = Number(config.admissionFee) || 0;
  const uniformFee = Number(config.dressCodeFee) || 0;
  const customOneTime = (config.items || [])
    .filter((it) => it.category === 'ONE_TIME' && it.active)
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalOneTime = admissionFee + uniformFee + customOneTime;

  // 2. Monthly Items
  const schoolFee = Number(config.monthlySchoolFee) || 0;
  const tuitionFee = Number(config.monthlyTuitionFee) || 0;
  const computerFee = Number(config.computerFee) || 0;
  const sportsFee = Number(config.sportsFee) || 0;
  const customMonthly = (config.items || [])
    .filter((it) => it.category === 'MONTHLY' && it.active)
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalMonthly = schoolFee + tuitionFee + computerFee + sportsFee + customMonthly;

  // 3. Yearly Items
  const booksFee = Number(config.booksFee || config.booksStationeryFee) || 0;
  const idCardFee = Number(config.idCardFee) || 0;
  const annualCharges = Number(config.annualCharges) || 0;
  const customYearly = (config.items || [])
    .filter((it) => it.category === 'YEARLY' && it.active)
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalYearly = booksFee + idCardFee + annualCharges + customYearly;

  // 4. Exams
  const activeExams = (config.examinationFees || []).filter((e) => e.active);
  const totalExams = activeExams.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // 5. Full Year Calculations
  const newAdmissionFullYear = totalOneTime + totalMonthly * 12 + totalYearly + totalExams;
  const continuingStudentFullYear = totalMonthly * 12 + totalYearly + totalExams;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-300 border border-blue-400/30">
              {section === 'ALL' ? 'Class-Wide Default Fee Matrix' : `Section ${section} Specific Override`}
            </span>
            <span className="text-xs text-slate-300">Session {config.academicSession || '2026-2027'}</span>
          </div>
          <h3 className="text-xl font-extrabold mt-1.5 text-white">
            {className} {section !== 'ALL' ? `• Section ${section}` : '• All Sections'} Fee Summary
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            Complete financial breakdown applied to new admissions and monthly billing schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2.5 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">Monthly Rate</span>
            <span className="text-xl font-black text-emerald-400">₹{totalMonthly.toLocaleString('en-IN')}/mo</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2.5 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">One-Time Total</span>
            <span className="text-xl font-black text-blue-300">₹{totalOneTime.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* 3-Column Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: One-Time Heads */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h5 className="font-bold text-xs text-slate-900">One-Time Fees</h5>
            </div>
            <span className="font-extrabold text-xs text-blue-700">₹{totalOneTime.toLocaleString('en-IN')}</span>
          </div>
          <ul className="space-y-2 text-xs divide-y divide-slate-100">
            <li className="flex items-center justify-between pt-1 text-slate-700">
              <span>Admission Fee</span>
              <span className="font-bold">₹{admissionFee.toLocaleString('en-IN')}</span>
            </li>
            <li className="flex items-center justify-between pt-2 text-slate-700">
              <span>Uniform / Dress Kit</span>
              <span className="font-bold">₹{uniformFee.toLocaleString('en-IN')}</span>
            </li>
            {(config.items || [])
              .filter((it) => it.category === 'ONE_TIME' && it.active)
              .map((it) => (
                <li key={it.id} className="flex items-center justify-between pt-2 text-slate-700">
                  <span className="truncate pr-2">{it.name}</span>
                  <span className="font-bold">₹{Number(it.amount).toLocaleString('en-IN')}</span>
                </li>
              ))}
          </ul>
          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            Charged only once when candidate takes fresh admission.
          </p>
        </div>

        {/* Column 2: Monthly Recurring Heads */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h5 className="font-bold text-xs text-slate-900">Monthly Routine Fees</h5>
            </div>
            <span className="font-extrabold text-xs text-emerald-700">₹{totalMonthly.toLocaleString('en-IN')}/mo</span>
          </div>
          <ul className="space-y-2 text-xs divide-y divide-slate-100">
            <li className="flex items-center justify-between pt-1 text-slate-700">
              <span>School Academic Fee</span>
              <span className="font-bold">₹{schoolFee.toLocaleString('en-IN')}</span>
            </li>
            {tuitionFee > 0 && (
              <li className="flex items-center justify-between pt-2 text-slate-700">
                <span>Tuition Fee</span>
                <span className="font-bold">₹{tuitionFee.toLocaleString('en-IN')}</span>
              </li>
            )}
            {computerFee > 0 && (
              <li className="flex items-center justify-between pt-2 text-slate-700">
                <span>Computer / Smart Class</span>
                <span className="font-bold">₹{computerFee.toLocaleString('en-IN')}</span>
              </li>
            )}
            {sportsFee > 0 && (
              <li className="flex items-center justify-between pt-2 text-slate-700">
                <span>Sports & Physical Training</span>
                <span className="font-bold">₹{sportsFee.toLocaleString('en-IN')}</span>
              </li>
            )}
            {(config.items || [])
              .filter((it) => it.category === 'MONTHLY' && it.active)
              .map((it) => (
                <li key={it.id} className="flex items-center justify-between pt-2 text-slate-700">
                  <span className="truncate pr-2">{it.name}</span>
                  <span className="font-bold">₹{Number(it.amount).toLocaleString('en-IN')}</span>
                </li>
              ))}
          </ul>
          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            Generated automatically each month on the 10th.
          </p>
        </div>

        {/* Column 3: Yearly & Periodic Heads */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h5 className="font-bold text-xs text-slate-900">Yearly & Exams</h5>
            </div>
            <span className="font-extrabold text-xs text-purple-700">
              ₹{(totalYearly + totalExams).toLocaleString('en-IN')}
            </span>
          </div>
          <ul className="space-y-2 text-xs divide-y divide-slate-100">
            <li className="flex items-center justify-between pt-1 text-slate-700">
              <span>Books & Stationery Kit</span>
              <span className="font-bold">₹{booksFee.toLocaleString('en-IN')}</span>
            </li>
            <li className="flex items-center justify-between pt-2 text-slate-700">
              <span>Student ID Card & Belt</span>
              <span className="font-bold">₹{idCardFee.toLocaleString('en-IN')}</span>
            </li>
            <li className="flex items-center justify-between pt-2 text-slate-700">
              <span>Annual Development Charges</span>
              <span className="font-bold">₹{annualCharges.toLocaleString('en-IN')}</span>
            </li>
            {activeExams.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between pt-2 text-slate-700">
                <span className="truncate pr-2">{ex.examName}</span>
                <span className="font-bold">₹{Number(ex.amount).toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            Billed annually or scheduled event-wise.
          </p>
        </div>
      </div>

      {/* Transport & Hostel Dynamic Add-On Slabs Reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Transport Slabs Box */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
            <Bus className="w-4 h-4 text-amber-600" />
            <span>Transport Fee Note (Distance Slabs)</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Transport is <strong>NOT</strong> a flat fee. It is charged dynamically based on student pickup distance:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {transportSlabs
              .filter((s) => s.active !== false)
              .map((s) => (
                <span
                  key={s.id}
                  className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold"
                >
                  {s.slabName}: <strong>₹{Number(s.monthlyFee || s.monthlyAmount || 0)}/mo</strong>
                </span>
              ))}
          </div>
        </div>

        {/* Hostel Box */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
            <Building className="w-4 h-4 text-purple-600" />
            <span>Hostel & Mess Note (Residential Boarders Only)</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Only applied if candidate chose hostel residency during admission and is assigned a bed:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold">
              Hostel Rent: <strong>₹{Number(config.hostelFee || 5500)}/mo</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold">
              Mess Charges: <strong>₹{Number(config.messFee || 3000)}/mo</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Projected Annual Estimate Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
        <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <span>Full Academic Year Financial Projection (Day Scholar Basis)</span>
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1">
            <span className="text-[11px] font-semibold text-blue-800 block">
              New Admission Candidate (1st Year)
            </span>
            <div className="text-2xl font-black text-blue-950">
              ₹{newAdmissionFullYear.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-blue-800/80">
              Includes One-Time Admission (₹{totalOneTime.toLocaleString('en-IN')}) + 12 Months Tuition (₹{(totalMonthly * 12).toLocaleString('en-IN')}) + Annual & Exam Heads (₹{(totalYearly + totalExams).toLocaleString('en-IN')}).
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-800 block">
              Continuing Student (Subsequent Years)
            </span>
            <div className="text-2xl font-black text-emerald-950">
              ₹{continuingStudentFullYear.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-emerald-800/80">
              Excludes one-time admission charge. Comprises 12 months tuition + annual development & exam heads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
