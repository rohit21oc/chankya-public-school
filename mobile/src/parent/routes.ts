/** Parent portal destinations. Tabs are top level; the rest open on top of a tab. */
export type ParentTab = 'home' | 'attendance' | 'fees' | 'results' | 'more';
export type ParentStackRoute = 'children' | 'timetable' | 'exams' | 'homework' | 'notices' | 'documents' | 'profile' | 'chat';
export type ParentRoute = ParentTab | ParentStackRoute;

export const PARENT_TABS: ParentTab[] = ['home', 'attendance', 'fees', 'results', 'more'];

export const isParentTab = (r: ParentRoute): r is ParentTab => (PARENT_TABS as string[]).includes(r);

/**
 * Android back for the parent portal: close the open screen first, then return to
 * Home, and only exit from Home. Pure so it can be tested.
 */
export function parentBackAction(stack: ParentStackRoute[], tab: ParentTab): 'pop' | 'home' | 'exit' {
  if (stack.length > 0) return 'pop';
  if (tab !== 'home') return 'home';
  return 'exit';
}
