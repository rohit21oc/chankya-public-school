/**
 * A student's fee profile (the fee heads chosen at admission, step 4) and how editing it later works.
 * Shared by the website (Edit Student → Fee structure) and the server (PUT /api/students/:id),
 * so the preview the office sees and what the server bills are the same. No browser / React imports.
 *
 * Billing of the heads (unchanged rules, see server.ts):
 * - Monthly heads → every monthly fee bill from now on.
 * - One-time and yearly / quarterly / half-yearly / event heads are not part of the monthly bill.
 *   At admission they were billed in the admission invoice. When one is ADDED (or switched on) by
 *   editing, it is billed once right away, in a separate bill (newlyBillableHeads).
 * - Late fee / surcharge: only on late payment.
 * - Exam fee: billed when the Annual Examination is published. Books & Stationery: at admission and
 *   at each promotion. Transport / hostel / mess: follow the facility settings. These have their own
 *   rules and are never billed by an edit.
 */

export type FeeHeadCategory = 'ONE_TIME' | 'MONTHLY' | 'YEARLY' | 'EXAMINATION' | 'FACILITY' | 'OTHER';
export type FeeHeadFrequency = 'One Time' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'Event/Exam Based';

export interface EditableFeeHead {
  id: string;
  head: string;
  category: FeeHeadCategory;
  frequency: FeeHeadFrequency;
  amount: number;
  selected: boolean;
  isDefault?: boolean;
  remarks?: string;
}

const CATEGORIES: FeeHeadCategory[] = ['ONE_TIME', 'MONTHLY', 'YEARLY', 'EXAMINATION', 'FACILITY', 'OTHER'];
const FREQUENCIES: FeeHeadFrequency[] = ['One Time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Event/Exam Based'];
export const MAX_FEE_HEADS = 60;
export const MAX_FEE_AMOUNT = 10_000_000;

export const isExamHead = (name: string) => /\bexam/i.test(String(name || ''));
/** Late fee / surcharge / fine: applied by the late-payment rules, never billed by an edit. */
export const isLateFeeHead = (name: string) => /late fee|surcharge|\bfine\b/i.test(String(name || ''));
export const isBooksHead = (name: string) => /\bbooks?\b|stationery/i.test(String(name || '')) && !isExamHead(name);
export function facilityKindOf(name: string): 'transport' | 'hostel' | 'mess' | null {
  const h = String(name || '').toLowerCase();
  if (/late fee|fine/.test(h)) return null;
  if (/\bmess\b|dining|meal/.test(h)) return 'mess';
  if (/hostel|residen|accommodation|boarding/.test(h)) return 'hostel';
  if (/transport|\bbus\b|\bvan\b|vehicle/.test(h)) return 'transport';
  return null;
}

/** Same test the monthly bill uses (server: calculateStudentMonthlyBreakdownServer). */
export function isMonthlyHead(h: Pick<EditableFeeHead, 'head' | 'category' | 'frequency'>): boolean {
  const name = String(h.head || '').toLowerCase();
  return h.category === 'MONTHLY' || h.frequency === 'Monthly' || name.includes('monthly') || name.includes('tuition');
}

/** Frequency a category implies when the office picks a category for a custom head. */
export function defaultFrequencyFor(category: FeeHeadCategory): FeeHeadFrequency {
  if (category === 'MONTHLY') return 'Monthly';
  if (category === 'ONE_TIME') return 'One Time';
  if (category === 'EXAMINATION') return 'Event/Exam Based';
  if (category === 'FACILITY') return 'Monthly';
  return 'Yearly';
}

/** Cleans heads coming from a form: trims names, drops empty names, clamps amounts, fixes unknown values. */
export function normalizeFeeHeads(input: unknown): EditableFeeHead[] {
  if (!Array.isArray(input)) return [];
  const out: EditableFeeHead[] = [];
  const seenIds = new Set<string>();
  for (const raw of input.slice(0, MAX_FEE_HEADS)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const head = String(r.head ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!head) continue;
    const category = CATEGORIES.includes(r.category as FeeHeadCategory) ? (r.category as FeeHeadCategory) : 'OTHER';
    const frequency = FREQUENCIES.includes(r.frequency as FeeHeadFrequency) ? (r.frequency as FeeHeadFrequency) : defaultFrequencyFor(category);
    const amt = Number(r.amount);
    const amount = Number.isFinite(amt) ? Math.min(MAX_FEE_AMOUNT, Math.max(0, Math.round(amt * 100) / 100)) : 0;
    let id = String(r.id ?? '').trim().slice(0, 80) || `head-${out.length}-${head.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    while (seenIds.has(id)) id = `${id}-x`;
    seenIds.add(id);
    out.push({
      id,
      head,
      category,
      frequency,
      amount,
      selected: r.selected === true,
      isDefault: r.isDefault === true,
      remarks: typeof r.remarks === 'string' ? r.remarks.slice(0, 200) : undefined,
    });
  }
  return out;
}

/** Totals in the same shape the fee profile stores (books count with the one-time charges). */
export function feeProfileTotals(heads: EditableFeeHead[]) {
  let oneTime = 0;
  let monthly = 0;
  let yearly = 0;
  for (const h of heads) {
    if (!h.selected) continue;
    const amt = Number(h.amount) || 0;
    if (h.category === 'ONE_TIME' || h.frequency === 'One Time' || isBooksHead(h.head)) oneTime += amt;
    else if (isMonthlyHead(h)) monthly += amt;
    else yearly += amt;
  }
  return {
    totalOneTimeFee: oneTime,
    totalMonthlyFee: monthly,
    totalYearlyFee: yearly,
    monthlyPayableAmount: monthly,
    totalApplicableFee: oneTime + monthly * 12 + yearly,
  };
}

const key = (name: string) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Heads an edit should bill right away: switched on, amount above 0, not monthly, and not a head with
 * its own billing rule (exam, books, transport / hostel / mess), that were not switched on before
 * (matched by name). An amount change on a head that was already on is not billed again.
 */
export function newlyBillableHeads(before: EditableFeeHead[] | undefined | null, after: EditableFeeHead[]): { head: string; amount: number }[] {
  const wasOn = new Set((before || []).filter((h) => h && h.selected).map((h) => key(h.head)));
  const result: { head: string; amount: number }[] = [];
  for (const h of after) {
    if (!h.selected || !(Number(h.amount) > 0)) continue;
    if (isMonthlyHead(h) || isExamHead(h.head) || isBooksHead(h.head) || isLateFeeHead(h.head) || facilityKindOf(h.head)) continue;
    if (wasOn.has(key(h.head))) continue;
    result.push({ head: h.head, amount: Number(h.amount) });
  }
  return result;
}

/**
 * The fee heads the admission form starts with for a class (amounts from the class fee settings,
 * school defaults where the class has none), plus the class's own extra items. Transport / hostel /
 * mess heads are switched on when the student uses that facility.
 */
export function buildDefaultFeeHeads(
  cfg: any,
  facility: { transportRequired?: boolean; transportMonthlyFee?: number; hostelRequired?: boolean; hostelMonthlyFee?: number; messMonthlyFee?: number } = {}
): EditableFeeHead[] {
  const formData = facility;
  const heads: EditableFeeHead[] = [
      {
        id: 'head-adm',
        head: 'Admission Fee',
        category: 'ONE_TIME',
        frequency: 'One Time',
        amount: Number(cfg?.admissionFee ?? 5000),
        selected: true,
        isDefault: true,
        remarks: 'One-time institutional onboarding fee',
      },
      {
        id: 'head-school',
        head: 'School Fee',
        category: 'MONTHLY',
        frequency: 'Monthly',
        amount: Number(cfg?.monthlySchoolFee ?? 1800),
        selected: true,
        isDefault: true,
        remarks: 'Monthly academic maintenance & campus fee',
      },
      {
        id: 'head-tuition',
        head: 'Tuition Fee',
        category: 'MONTHLY',
        frequency: 'Monthly',
        amount: Number(cfg?.monthlyTuitionFee ?? 0),
        selected: false,
        isDefault: false,
        remarks: 'Specialized curricular instruction',
      },
      {
        id: 'head-exam',
        head: 'Exam Fee',
        category: 'EXAMINATION',
        frequency: 'Yearly',
        amount: Number(cfg?.examFee ?? 1000),
        selected: true,
        isDefault: true,
        remarks: 'Yearly. Not charged at admission: added when the Annual Exam is published',
      },
      {
        id: 'head-computer',
        head: 'Computer / Smart Class',
        category: 'MONTHLY',
        frequency: 'Monthly',
        amount: Number(cfg?.computerFee ?? cfg?.computerSmartClassFee ?? 250),
        selected: false,
        isDefault: false,
        remarks: 'ICT lab access and interactive digital classrooms',
      },
      {
        id: 'head-sports',
        head: 'Sports Fee',
        category: 'YEARLY',
        frequency: 'Yearly',
        amount: Number(cfg?.sportsFee ?? 150),
        selected: false,
        isDefault: false,
        remarks: 'Physical education equipment, tournaments & athletics',
      },
      {
        id: 'head-uniform',
        head: 'Uniform / Dress Code',
        category: 'ONE_TIME',
        frequency: 'One Time',
        amount: Number(cfg?.dressCodeFee ?? 2200),
        selected: true,
        isDefault: true,
        remarks: 'Official school uniform set & winter pullover',
      },
      {
        id: 'head-books',
        head: 'Books & Stationery',
        category: 'YEARLY',
        frequency: 'Yearly',
        amount: Number(cfg?.booksFee ?? cfg?.booksStationeryFee ?? 1500),
        selected: true,
        isDefault: true,
        remarks: 'Yearly. Paid at admission, then at each promotion at the new class rate',
      },
      {
        id: 'head-idcard',
        head: 'ID Card Fee',
        category: 'ONE_TIME',
        frequency: 'One Time',
        amount: Number(cfg?.idCardFee ?? 200),
        selected: true,
        isDefault: true,
        remarks: 'Digital RFID/Barcode student badge with lanyard',
      },
      {
        id: 'head-medical',
        head: 'Medical / Health Care',
        category: 'YEARLY',
        frequency: 'Yearly',
        amount: Number(cfg?.medicalFee ?? 100),
        selected: false,
        isDefault: false,
        remarks: 'Annual health checkup, first aid & infirmary access',
      },
      {
        id: 'head-transport',
        head: 'Transport Fee',
        category: 'FACILITY',
        frequency: 'Monthly',
        amount: Number(formData.transportMonthlyFee || 800),
        selected: !!formData.transportRequired,
        isDefault: false,
        remarks: 'School bus transit route service',
      },
      {
        id: 'head-hostel',
        head: 'Hostel Residency Fee',
        category: 'FACILITY',
        frequency: 'Monthly',
        amount: Number(formData.hostelMonthlyFee || cfg?.hostelFee || 5500),
        selected: !!formData.hostelRequired,
        isDefault: false,
        remarks: 'Campus boarding room & amenities',
      },
      {
        id: 'head-mess',
        head: 'Hostel Mess Fee',
        category: 'FACILITY',
        frequency: 'Monthly',
        amount: Number(formData.messMonthlyFee || cfg?.messFee || 3000),
        selected: !!formData.hostelRequired,
        isDefault: false,
        remarks: 'Nutritious daily meals & dining hall service',
      },
      {
        id: 'head-late',
        head: 'Late Fee / Surcharge',
        category: 'OTHER',
        frequency: 'Event/Exam Based',
        amount: 0,
        selected: false,
        isDefault: false,
        remarks: 'Applicable solely upon delayed installment clearance',
      },
    ];

    // If existing ClassFeeConfiguration has custom structured items, append them
    if (cfg?.items && Array.isArray(cfg.items)) {
      for (const item of cfg.items) {
        if (!heads.some((h) => h.head.toLowerCase() === item.name.toLowerCase())) {
          heads.push({
            id: `head-custom-${item.id || item.name}`,
            head: item.name,
            category: item.category || 'MONTHLY',
            frequency: item.frequency || 'Monthly',
            amount: Number(item.amount || 0),
            selected: !!item.mandatory,
            isDefault: false,
            remarks: item.description || 'Class fee schedule item',
          });
        }
      }
    }

  return heads;
}
