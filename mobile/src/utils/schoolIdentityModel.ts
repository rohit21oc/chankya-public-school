import { SchoolSettings } from '../types';

/**
 * Pure part of the school identity (no React Native imports, so node tests can use it).
 * Values come only from saved School Settings; nothing is invented.
 */
export const NOT_CONFIGURED = 'Not configured';

export interface SchoolIdentity {
  name: string;
  board: string;
  affiliationNo: string;
  schoolCode: string;
  address: string;
  phones: string[];
  helpline: string;
  email: string;
  session: string;
  logoKey: string;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export function toIdentity(s: Partial<SchoolSettings> | null | undefined): SchoolIdentity {
  const x: any = s || {};
  const phones = [...(Array.isArray(x.headerContacts) ? x.headerContacts : []), x.contactNumber, x.phone]
    .map(clean)
    .filter(Boolean)
    .filter((p: string, i: number, a: string[]) => a.findIndex((q) => q.replace(/\D/g, '') === p.replace(/\D/g, '')) === i);
  return {
    name: clean(x.schoolName),
    board: clean(x.affiliatedBoard),
    affiliationNo: clean(x.affiliationNumber) || clean(x.affiliationCode),
    schoolCode: clean(x.schoolCode),
    address: clean(x.schoolAddress) || clean(x.address),
    phones,
    helpline: clean(x.helplineNumber),
    email: clean(x.email),
    session: clean(x.currentAcademicSession) || clean(x.academicYear),
    logoKey: clean(x.logoFileKey) || clean(x.schoolLogo),
  };
}

/** "BSEB Affiliation: 123 • Code: 6400" with missing parts left out. */
export function affiliationLine(id: SchoolIdentity): string {
  return [id.affiliationNo ? `${id.board ? `${id.board} ` : ''}Affiliation: ${id.affiliationNo}` : '', id.schoolCode ? `Code: ${id.schoolCode}` : ''].filter(Boolean).join(' • ');
}


let current: SchoolIdentity = toIdentity(null);
const listeners = new Set<(id: SchoolIdentity) => void>();

export function getSchoolIdentity(): SchoolIdentity {
  return current;
}
export function setSchoolIdentity(id: SchoolIdentity): void {
  current = id;
  listeners.forEach((l) => l(id));
}
export function subscribeSchoolIdentity(fn: (id: SchoolIdentity) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
