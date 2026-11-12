/** Hostel warden portal destinations. Tabs are top level; the rest open on top of a tab. */
export type WardenTab = 'home' | 'students' | 'attendance' | 'more';
export type WardenStackRoute = 'student' | 'leaves' | 'mess' | 'alerts' | 'history' | 'messages' | 'profile' | 'idcard' | 'payroll';
export type WardenRoute = WardenTab | WardenStackRoute;

export const WARDEN_TABS: WardenTab[] = ['home', 'students', 'attendance', 'more'];

export const isWardenTab = (r: WardenRoute): r is WardenTab => (WARDEN_TABS as string[]).includes(r);

/** A stack entry may carry a parameter (the student being viewed, or the chat to open). */
export interface WardenStackEntry {
  route: WardenStackRoute;
  studentId?: string;
  chatStudent?: { id: string; name?: string; photo?: string };
}

/** Android back: close the open screen, then go Home, and only exit from Home. */
export function wardenBackAction(stackLength: number, tab: WardenTab): 'pop' | 'home' | 'exit' {
  if (stackLength > 0) return 'pop';
  if (tab !== 'home') return 'home';
  return 'exit';
}

/** Which portal a signed-in role uses. Only HOSTEL_WARDEN opens the warden portal; other roles are unchanged. */
export const usesWardenPortal = (role?: string) => role === 'HOSTEL_WARDEN';
