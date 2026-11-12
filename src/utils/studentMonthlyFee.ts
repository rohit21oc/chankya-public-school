import { Student, ClassFeeConfiguration, TransportSlab } from '../types';

export interface MonthlyFeeLine {
  head: string;
  amount: number;
  isOneTime?: boolean;
}

type FacilityKind = 'transport' | 'hostel' | 'mess';

function facilityKindOfHead(head: string): FacilityKind | null {
  const h = String(head || '').toLowerCase();
  if (/late fee|fine/.test(h)) return null;
  if (/\bmess\b|dining|meal/.test(h)) return 'mess';
  if (/hostel|residen|accommodation|boarding/.test(h)) return 'hostel';
  if (/transport|\bbus\b|\bvan\b|vehicle/.test(h)) return 'transport';
  return null;
}

/**
 * The student's regular monthly fee, worked out the same way the server builds the monthly bill
 * (calculateStudentMonthlyBreakdownServer in server.ts). Keep the two in step.
 *
 * - When the student has a fee profile (Step 4 of admission), its switched-on monthly heads are the bill,
 *   at exactly the amounts typed there. Nothing is taken from the class fee schedule.
 * - Older records without a fee profile fall back to the class fee schedule.
 * - Transport / hostel / mess from the student's facility settings are added only when the profile
 *   does not already list them.
 */
export function buildStudentMonthlyBreakdown(
  student: Student,
  classConfig: ClassFeeConfiguration | null | undefined,
  transportSlabs: TransportSlab[] = []
): MonthlyFeeLine[] {
  const lines: MonthlyFeeLine[] = [];
  const profileHeads = Array.isArray(student.feeProfile?.feeHeads) ? student.feeProfile!.feeHeads : [];
  const hasFeeProfile = profileHeads.length > 0;

  if (hasFeeProfile) {
    for (const h of profileHeads) {
      const isMonthly =
        h.category === 'MONTHLY' ||
        (h.frequency as string) === 'Monthly' ||
        h.head.toLowerCase().includes('monthly') ||
        h.head.toLowerCase().includes('tuition');
      if (h.selected && Number(h.amount) > 0 && isMonthly) {
        lines.push({ head: h.head, amount: Number(h.amount) || 0 });
      }
    }
  } else {
    const cfg: any = classConfig || {};
    const monthlySchoolFee = Number(cfg.monthlySchoolFee || cfg.monthlyTuitionFee || 0);
    const monthlyTuitionFee = Number(cfg.monthlyTuitionFee || 0);
    if (monthlySchoolFee > 0) lines.push({ head: 'Monthly School Fee', amount: monthlySchoolFee });
    if (monthlyTuitionFee > 0 && monthlyTuitionFee !== monthlySchoolFee) lines.push({ head: 'Tuition Fee', amount: monthlyTuitionFee });
    if (Number(cfg.computerFee) > 0) lines.push({ head: 'Computer / Smart Class Fee', amount: Number(cfg.computerFee) });
    if (Number(cfg.sportsFee) > 0) lines.push({ head: 'Sports & Fitness Fee', amount: Number(cfg.sportsFee) });
    (cfg.items || [])
      .filter((it: any) => it.category === 'MONTHLY' && it.active)
      .forEach((it: any) => lines.push({ head: it.name, amount: Number(it.amount) || 0 }));
  }

  // Facilities the profile does not already carry
  const covered = new Set<FacilityKind>();
  for (const l of lines) {
    const k = facilityKindOfHead(l.head);
    if (k) covered.add(k);
  }
  for (const h of profileHeads) {
    const k = facilityKindOfHead(h.head);
    if (k) covered.add(k);
  }

  if (student.transportRequired && !covered.has('transport')) {
    let transportAmt = Number(student.transportMonthlyFee || 0);
    if (!transportAmt) {
      const slab = transportSlabs.find((s) => s.id === student.transportSlabId || s.id === student.transportRouteId);
      transportAmt = slab ? Number((slab as any).monthlyFee || (slab as any).monthlyAmount || 0) : 0;
    }
    if (transportAmt > 0) lines.push({ head: `Transport Fee (${student.transportStopName || 'Bus Route'})`, amount: transportAmt });
  }

  if (student.hostelRequired) {
    const cfg: any = classConfig || {};
    if (!covered.has('hostel')) {
      const hostelAmt = Number(student.hostelMonthlyFee ?? cfg.hostelFee ?? 0);
      if (hostelAmt > 0) lines.push({ head: `Hostel Accommodation (${student.hostelName || 'Hostel'})`, amount: hostelAmt });
    }
    if (!covered.has('mess')) {
      const messAmt = Number(student.messMonthlyFee ?? cfg.messFee ?? 0);
      if (messAmt > 0) lines.push({ head: 'Mess & Dining Charges', amount: messAmt });
    }
  }

  if (!hasFeeProfile && lines.length === 0) {
    lines.push({ head: 'Monthly Tuition Fee', amount: 2500 });
  }

  return lines;
}
