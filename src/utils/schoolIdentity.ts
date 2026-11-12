import type { SchoolSettings } from '../types';

/**
 * The school's identity as saved in School Settings (the single source of truth).
 * Nothing here is invented: a missing value stays empty and screens show
 * NOT_CONFIGURED (or leave the line out) instead of a demo value.
 */
export const NOT_CONFIGURED = 'Not configured';

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export interface SchoolIdentity {
  name: string;
  board: string; // e.g. "BSEB"
  affiliationNo: string;
  schoolCode: string;
  registrationNo: string;
  address: string;
  phones: string[];
  helpline: string;
  email: string;
  website: string;
  session: string;
  logoKey: string;
  principalName: string;
}

export function schoolIdentity(s?: Partial<SchoolSettings> | null): SchoolIdentity {
  const x: any = s || {};
  const phones = [
    ...(Array.isArray(x.headerContacts) ? x.headerContacts : []),
    x.contactNumber,
    x.phone,
  ]
    .map(clean)
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex((q) => q.replace(/\D/g, '') === p.replace(/\D/g, '')) === i);
  return {
    name: clean(x.schoolName),
    board: clean(x.affiliatedBoard),
    affiliationNo: clean(x.affiliationNumber) || clean(x.affiliationCode),
    schoolCode: clean(x.schoolCode),
    registrationNo: clean(x.registrationNumber),
    address: clean(x.schoolAddress) || clean(x.address),
    phones,
    helpline: clean(x.helplineNumber),
    email: clean(x.email),
    website: clean(x.website),
    session: clean(x.currentAcademicSession) || clean(x.academicYear),
    logoKey: clean(x.logoFileKey) || clean(x.schoolLogo),
    principalName: clean(x.principalName),
  };
}

/** "BSEB Affiliation No: 123" / "Affiliation No: 123" / "" when not saved. */
export function affiliationText(id: SchoolIdentity, label = 'Affiliation No'): string {
  if (!id.affiliationNo) return '';
  return `${id.board ? `${id.board} ` : ''}${label}: ${id.affiliationNo}`;
}

/** One line for letterheads: affiliation • school code • phone. Missing parts are left out. */
export function letterheadLine(id: SchoolIdentity, opts: { phone?: boolean; email?: boolean; session?: string } = {}): string {
  return [
    affiliationText(id),
    id.schoolCode ? `School Code: ${id.schoolCode}` : '',
    opts.phone && id.phones.length ? `Phone: ${id.phones.join(' | ')}` : '',
    opts.email && id.email ? id.email : '',
    opts.session ? `Session: ${opts.session}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

export const orNotConfigured = (v?: string) => (v && v.trim() ? v : NOT_CONFIGURED);
