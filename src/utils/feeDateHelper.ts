/**
 * Utility helper functions for Enrollment Date and Fee Billing Date calculations.
 *
 * Core Rule: Fee starts from Enrollment Date.
 * - Before Enrollment Date -> No fee
 * - From Enrollment Date -> applicable monthly fee starts
 * - Fee Start Date = Enrollment Date automatically
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

/**
 * Extracts year and month (1-12) from various date/month string representations:
 * e.g. "2025-01-15", "15-01-2025", "2025-01", "January 2025", "Oct 2026"
 */
export function parseYearMonth(str?: string | null): { year: number; month: number } | null {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;

  // Check ISO format YYYY-MM-DD or YYYY-MM
  const isoMatch = s.match(/^(\d{4})[/-](\d{1,2})(?:[/-]\d{1,2})?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      return { year: y, month: m };
    }
  }

  // Check Indian format DD-MM-YYYY or DD/MM/YYYY
  const inMatch = s.match(/^\d{1,2}[/-](\d{1,2})[/-](\d{4})/);
  if (inMatch) {
    const m = parseInt(inMatch[1], 10);
    const y = parseInt(inMatch[2], 10);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      return { year: y, month: m };
    }
  }

  // Check Name of month + Year (e.g., "January 2025" or "Oct 2026" or "2025 January")
  const namedMatch = s.match(/([a-zA-Z]+)[\s,.-]+(\d{4})/);
  if (namedMatch) {
    const namePart = namedMatch[1].toLowerCase();
    const y = parseInt(namedMatch[2], 10);
    const m = MONTH_MAP[namePart];
    if (m && !isNaN(y)) {
      return { year: y, month: m };
    }
  }

  const reverseNamedMatch = s.match(/(\d{4})[\s,.-]+([a-zA-Z]+)/);
  if (reverseNamedMatch) {
    const y = parseInt(reverseNamedMatch[1], 10);
    const namePart = reverseNamedMatch[2].toLowerCase();
    const m = MONTH_MAP[namePart];
    if (m && !isNaN(y)) {
      return { year: y, month: m };
    }
  }

  // Check any recognized month word + 4-digit year in string (e.g. "Monthly School Fee (October 2026)")
  const monthWordMatch = s.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/i
  );
  const yearWordMatch = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (monthWordMatch && yearWordMatch) {
    const m = MONTH_MAP[monthWordMatch[1].toLowerCase()];
    const y = parseInt(yearWordMatch[1], 10);
    if (m && !isNaN(y)) {
      return { year: y, month: m };
    }
  }

  return null;
}

/**
 * Checks if a monthly fee can be billed for the target month.
 * Rules:
 * - Monthly fee billing starts from the student's actual Enrollment Date.
 * - No monthly fee should be charged for any period before enrollment.
 * - The enrollment month is billed at admission and paid on admission day
 *   (e.g. Enrolled 01 Nov 2026 -> November paid at admission, December bill on 1 Dec 2026).
 */
export function isMonthOnOrAfterEnrollmentDate(
  targetMonthOrDate: string,
  enrollmentDateStr?: string | null
): boolean {
  if (!enrollmentDateStr) return true; // If unknown, default allow

  const targetYM = parseYearMonth(targetMonthOrDate);
  const enrollYM = parseYearMonth(enrollmentDateStr);

  if (!targetYM || !enrollYM) return true; // fallback if unparseable

  const targetCode = targetYM.year * 12 + targetYM.month;
  const enrollCode = enrollYM.year * 12 + enrollYM.month;

  // The enrollment month itself is billable (collected at admission)
  return targetCode >= enrollCode;
}

/**
 * Returns the first month the automatic 1st-of-month run bills (the month after enrollment;
 * the enrollment month itself is billed at admission).
 * E.g., enrolled on 11-09-2026 -> returns October 2026 (year: 2026, month: 10).
 */
export function getFirstMonthlyBillingCycle(
  enrollmentDateStr?: string | null
): { year: number; month: number; display: string } {
  const ym = parseYearMonth(enrollmentDateStr) || { year: new Date().getFullYear(), month: 4 };
  let y = ym.year;
  let m = ym.month + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return {
    year: y,
    month: m,
    display: getMonthYearDisplay(y, m),
  };
}

/**
 * Monthly fee due date is strictly the 10th of the applicable month: YYYY-MM-10
 */
export function getMonthlyInvoiceDueDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-10`;
}

/**
 * Checks if a monthly fee invoice is overdue as of a given date (in Asia/Kolkata timezone).
 * Due window: 1st through 10th (not overdue). Starting on the 11th: overdue.
 */
export function isMonthlyInvoiceOverdue(
  dueDate: string,
  asOfDateInput?: Date | string
): boolean {
  const asOf = asOfDateInput
    ? asOfDateInput instanceof Date
      ? asOfDateInput
      : new Date(asOfDateInput)
    : new Date();

  // Evaluate date in Asia/Kolkata timezone
  const kolkataDateStr = asOf.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return kolkataDateStr > dueDate;
}

/**
 * Returns human-friendly month and year e.g. "January 2025"
 */
export function getMonthYearDisplay(year: number, month: number): string {
  const mName = MONTH_NAMES[month - 1] || 'Month';
  return `${mName} ${year}`;
}

/**
 * Formats a date into DD-MM-YYYY display for consistent Indian educational ERP standards
 */
export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const ym = parseYearMonth(dateStr);
  if (!ym) return dateStr;

  // If day is present
  const isoMatch = dateStr.match(/^\d{4}-\d{2}-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(ym.month).padStart(2, '0')}-${ym.year}`;
  }
  const inMatch = dateStr.match(/^(\d{2})-\d{2}-\d{4}/);
  if (inMatch) {
    return dateStr;
  }
  return `${String(ym.month).padStart(2, '0')}/${ym.year}`;
}

/**
 * Generates an array of selectable billing months starting from the student's enrollment month
 * up through current date + next academic cycle.
 */
export function getApplicableBillingMonths(
  enrollmentDateStr?: string | null,
  futureMonthsCount: number = 6
): string[] {
  const now = new Date();
  const currentYM = { year: now.getFullYear(), month: now.getMonth() + 1 };

  const enrollYM = parseYearMonth(enrollmentDateStr) || { year: currentYM.year, month: 4 };

  // Billing begins from the enrollment month (collected at admission)
  const startCode = enrollYM.year * 12 + enrollYM.month;
  const standardEndCode = currentYM.year * 12 + currentYM.month + futureMonthsCount;
  const endCode = Math.max(standardEndCode, startCode + 3);

  const result: string[] = [];

  for (let c = startCode; c <= endCode; c++) {
    const y = Math.floor((c - 1) / 12);
    const m = ((c - 1) % 12) + 1;
    result.push(getMonthYearDisplay(y, m));
  }

  // Reverse so newest/current is first, but keep all available down to enrollment
  return result.reverse();
}

/**
 * "November 2026" for an enrollment date of 2026-11-01: the month whose fee is paid at admission.
 */
export function getEnrollmentMonthLabel(enrollmentDateStr?: string | null): string | null {
  const ym = parseYearMonth(enrollmentDateStr || '');
  return ym ? getMonthYearDisplay(ym.year, ym.month) : null;
}

/**
 * "01-12-2026" for an enrollment date of 2026-11-01: the day the next monthly bill is added.
 */
export function getNextMonthlyBillDate(enrollmentDateStr?: string | null): string | null {
  const ym = parseYearMonth(enrollmentDateStr || '');
  if (!ym) return null;
  let y = ym.year;
  let m = ym.month + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `01-${String(m).padStart(2, '0')}-${y}`;
}
