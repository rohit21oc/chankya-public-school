/** Student portal destinations. Three tabs sit in the bottom bar; everything else opens on top of them. */
export type StudentTab = 'home' | 'attendance' | 'timetable';
export type StudentStackRoute = 'marks' | 'exams' | 'fees' | 'homework' | 'documents' | 'notices' | 'events' | 'profile' | 'settings';
export type StudentRoute = StudentTab | StudentStackRoute;

export const STUDENT_TABS: StudentTab[] = ['home', 'attendance', 'timetable'];

export const isStudentTab = (r: StudentRoute): r is StudentTab => (STUDENT_TABS as string[]).includes(r);

/**
 * Android back for the student portal: close the menu first, then the open screen, then go to Home,
 * and only exit from Home. Pure so it can be tested.
 */
export function studentBackAction(stack: StudentStackRoute[], tab: StudentTab, drawerOpen: boolean): 'close-menu' | 'pop' | 'home' | 'exit' {
  if (drawerOpen) return 'close-menu';
  if (stack.length > 0) return 'pop';
  if (tab !== 'home') return 'home';
  return 'exit';
}
