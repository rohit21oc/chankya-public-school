/**
 * Where a tapped notification opens. Pure, so it can be tested without a phone.
 * The server sends only a type and ids; the screen is chosen here, per role.
 */
export type PushType = 'MESSAGE' | 'NOTICE' | 'FEE_DUE' | 'HOMEWORK' | 'TEST' | 'ENQUIRY' | 'CALLBACK' | 'HOSTEL';

export type ParentPushRoute = 'chat' | 'notices' | 'homework' | 'fees';

export function isPushType(value: unknown): value is PushType {
  return value === 'MESSAGE' || value === 'NOTICE' || value === 'FEE_DUE' || value === 'HOMEWORK' || value === 'TEST' || value === 'ENQUIRY' || value === 'CALLBACK' || value === 'HOSTEL';
}

/** Parent portal screen for a notification, or null to just stay where they are. */
export function parentRouteForPush(type: unknown): ParentPushRoute | null {
  if (!isPushType(type)) return null;
  switch (type) {
    case 'MESSAGE':
      return 'chat';
    case 'FEE_DUE':
      return 'fees'; // straight to the payment screen; the reminder is also in the chat
    case 'NOTICE':
      return 'notices';
    case 'HOMEWORK':
      return 'homework';
    default:
      return null;
  }
}

/** Staff / student app module for a notification (the app still checks the role's permission). */
export function moduleForPush(type: unknown, kind?: unknown): string | null {
  if (!isPushType(type)) return null;
  switch (type) {
    case 'MESSAGE':
    case 'FEE_DUE':
      return 'messages';
    case 'NOTICE':
      return 'communication';
    case 'HOMEWORK':
      return 'homework';
    case 'ENQUIRY':
    case 'CALLBACK':
      return 'enquiries';
    case 'HOSTEL':
      // A forwarded student leave opens Leave Requests; a hostel alert (absent / emergency) just opens the app.
      return kind ? null : 'leave-requests';
    default:
      return null;
  }
}

export type StudentPushRoute = 'notices' | 'homework' | 'fees';

/** Student portal screen for a notification, or null to stay where they are (students have no chat). */
export function studentRouteForPush(type: unknown): StudentPushRoute | null {
  if (!isPushType(type)) return null;
  switch (type) {
    case 'NOTICE':
      return 'notices';
    case 'HOMEWORK':
      return 'homework';
    case 'FEE_DUE':
      return 'fees';
    default:
      return null;
  }
}
