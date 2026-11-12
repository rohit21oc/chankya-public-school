/**
 * Who may upload, attach, list and delete stored files.
 * File contents are served by unguessable keys (/api/files/content); these rules protect
 * everything that issues keys, lists keys, or changes what a key is attached to.
 * Checked by scripts/verify-file-policy.ts.
 */

const up = (r?: string) => String(r || '').trim().toUpperCase();

/** Public website content (same roles as the website management routes). */
export const WEBSITE_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
/** School identity files: logo, principal signature, payment QR. */
export const SETTINGS_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL'];
/** Staff who manage student records and documents. */
export const RECORDS_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'ACCOUNTANT', 'HR_STAFF'];
const NON_STAFF = ['STUDENT', 'PARENT'];

export const isStaffRole = (role?: string) => !!up(role) && !NON_STAFF.includes(up(role));

export function isWebsiteFolder(folder: string): boolean {
  const f = String(folder || '').toLowerCase().replace(/^school\//, '');
  return f.startsWith('public-website/') || ['hero', 'gallery', 'leadership'].includes(f);
}
function isSettingsFolder(folder: string): boolean {
  const f = String(folder || '').toLowerCase();
  return f === 'school-logo' || f === 'school/signatures' || f === 'signatures';
}

/** Folder a user may request an upload slot in. */
export function canUploadToFolder(role: string | undefined, folder: string): boolean {
  const r = up(role);
  if (!r) return false;
  if (isSettingsFolder(folder)) return SETTINGS_ROLES.includes(r);
  if (isWebsiteFolder(folder)) return WEBSITE_ROLES.includes(r);
  // Photos, documents, study material, homework: staff, plus students/parents for their own profile files.
  return true;
}

export interface FileRecordLike {
  uploadedBy?: string;
  isTemporary?: boolean;
  contentType?: string;
  fileSize?: number;
  folder?: string;
}

/** Writing bytes to a key: only the slot the same user was issued, while it is still open. */
export function canWriteSlot(userId: string | undefined, record: FileRecordLike | null | undefined): boolean {
  return !!userId && !!record && record.isTemporary === true && !!record.uploadedBy && record.uploadedBy === userId;
}

export interface Actor {
  userId?: string;
  role?: string;
  staffId?: string;
}

/** Attaching a stored file to a record (student photo, staff document, school logo …). */
export function canAttach(actor: Actor, entity: { type?: string; id?: string } | undefined, record: FileRecordLike | null | undefined): boolean {
  const r = up(actor.role);
  if (!r || !actor.userId) return false;
  const own = !!record?.uploadedBy && record.uploadedBy === actor.userId;
  // Files uploaded before ownership was recorded can only be attached by the admin tier.
  if (!own && !RECORDS_ROLES.includes(r)) return false;
  const t = up(entity?.type);
  if (!t) return true;
  if (t === 'SCHOOL_LOGO' || t === 'PRINCIPAL_SIGNATURE' || t === 'EXAM_CONTROLLER_SIGNATURE') return SETTINGS_ROLES.includes(r);
  if (t.startsWith('STUDENT')) return isStaffRole(r);
  if (t === 'STAFF' || t === 'STAFF_DOCUMENT') return RECORDS_ROLES.includes(r) || (!!actor.staffId && actor.staffId === entity?.id);
  return isStaffRole(r);
}

/** Deleting a stored file: its uploader, the admin tier, or website roles for website media. */
export function canDeleteFile(actor: Actor, record: FileRecordLike | null | undefined): boolean {
  const r = up(actor.role);
  if (!r || !actor.userId) return false;
  if (RECORDS_ROLES.includes(r)) return true;
  if (record?.folder && isWebsiteFolder(record.folder) && WEBSITE_ROLES.includes(r)) return true;
  return !!record?.uploadedBy && record.uploadedBy === actor.userId && isStaffRole(r);
}

/** Content types that could run script if opened directly; served as downloads in a sandbox. */
export function isActiveContentType(ct?: string): boolean {
  const c = String(ct || '').toLowerCase();
  return c.includes('html') || c.includes('svg') || c.includes('xml') || c.includes('javascript');
}
