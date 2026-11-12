/**
 * Realtime events (SSE /api/realtime/events and the /api/realtime/poll replay buffer)
 * reach every connected client, including signed-out website visitors. Only
 * school-level data may travel in them. For personal records (students, fees,
 * attendance, marks, staff, payroll, documents...) the event is only a "changed"
 * signal: each client refetches that slice with its own token, and the server
 * applies the caller's scope on that request.
 */
/** Entities whose payload is school-level information and safe for any viewer. */
export const PUBLIC_REALTIME_ENTITIES = new Set<string>([
  'WEBSITE', 'CLASS', 'SUBJECT', 'TIMETABLE', 'FEE_STRUCTURE', 'EXAM', 'HOLIDAY', 'STUDY_MATERIAL',
]);

export function toBroadcastSafePayload(
  entity: string,
  action: string,
  data: any,
  description?: string
): { data: any; description?: string } {
  if (PUBLIC_REALTIME_ENTITIES.has(entity)) return { data, description };
  if (entity === 'SETTINGS' || entity === 'SESSION') {
    // Clients only read the session fields; never ship the whole settings object.
    const out: any = {};
    if (data && typeof data === 'object') {
      if (data.id !== undefined && entity === 'SESSION') out.id = data.id;
      if (data.name !== undefined && entity === 'SESSION') out.name = data.name;
      if (data.currentAcademicSession !== undefined) out.currentAcademicSession = data.currentAcademicSession;
      if (Array.isArray(data.academicSessions)) out.academicSessions = data.academicSessions;
    }
    return { data: out, description: undefined };
  }
  // Personal / operational records: keep only the id needed to drop a deleted row.
  if (action === 'DELETE' && data && typeof data === 'object' && data.id !== undefined) {
    return { data: { id: data.id }, description: undefined };
  }
  return { data: undefined, description: undefined };
}

