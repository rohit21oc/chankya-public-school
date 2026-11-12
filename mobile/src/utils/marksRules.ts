/**
 * Pure rules for the marks-entry form. UI-only validation: the backend remains
 * the authority and must re-validate against the exam's maximum marks.
 */

export interface MarksInputResult {
  /** Sanitised text to store in the field. */
  value: string;
  /** True when the typed number is above the maximum and was rejected. */
  exceeded: boolean;
}

/**
 * Keeps digits and at most one decimal point, and rejects values above `max`.
 * "1.2.3" becomes "1.2" instead of being silently parsed as a different number later.
 */
export function sanitizeMarksInput(raw: string, max: number, previous = ''): MarksInputResult {
  let clean = String(raw ?? '').replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot !== -1) {
    clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
  }
  const num = parseFloat(clean);
  if (!isNaN(num) && num > max) {
    return { value: previous, exceeded: true };
  }
  return { value: clean, exceeded: false };
}

export interface MarksRow {
  studentId: string;
  studentName?: string;
  marksObtained: string;
  isAbsent: boolean;
}

export interface MarksValidation {
  valid: Array<{ studentId: string; marksObtained: number; isAbsent: boolean }>;
  errors: string[];
}

/** Final check before a save request is sent. Blank rows are skipped, bad rows are reported. */
export function validateMarksForSave(rows: MarksRow[], max: number): MarksValidation {
  const valid: MarksValidation['valid'] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!(max > 0)) {
    return { valid, errors: ['Maximum marks is not set for this exam.'] };
  }

  for (const row of rows) {
    const label = row.studentName || row.studentId;
    if (seen.has(row.studentId)) {
      errors.push(`${label} appears more than once.`);
      continue;
    }
    seen.add(row.studentId);

    if (row.isAbsent) {
      valid.push({ studentId: row.studentId, marksObtained: 0, isAbsent: true });
      continue;
    }
    const text = (row.marksObtained ?? '').trim();
    if (text === '') continue;

    const num = Number(text);
    if (!isFinite(num) || text === '.') {
      errors.push(`${label}: "${text}" is not a valid number.`);
    } else if (num < 0) {
      errors.push(`${label}: marks cannot be negative.`);
    } else if (num > max) {
      errors.push(`${label}: marks cannot exceed ${max}.`);
    } else {
      valid.push({ studentId: row.studentId, marksObtained: num, isAbsent: false });
    }
  }
  return { valid, errors };
}

/**
 * Toggling Absent on stores "0" for display; toggling it off must clear that
 * placeholder, otherwise a present student is saved with a fake 0.
 */
export function toggleAbsentRow<T extends MarksRow>(row: T): T {
  if (row.isAbsent) return { ...row, isAbsent: false, marksObtained: '' };
  return { ...row, isAbsent: true, marksObtained: '0' };
}
