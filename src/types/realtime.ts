export type RealtimeEntityType =
  | 'STUDENT'
  | 'PARENT'
  | 'TEACHER'
  | 'STAFF'
  | 'CLASS'
  | 'SUBJECT'
  | 'TIMETABLE'
  | 'ATTENDANCE'
  | 'STAFF_ATTENDANCE'
  | 'FEE'
  | 'FEE_PAYMENT'
  | 'FEE_STRUCTURE'
  | 'FEE_LEDGER'
  | 'FEE_CONFIG'
  | 'EXAM'
  | 'EXAM_MARK'
  | 'NOTICE'
  | 'HOMEWORK'
  | 'STUDY_MATERIAL'
  | 'DOCUMENT'
  | 'HOSTEL'
  | 'TRANSPORT'
  | 'TRANSPORT_VEHICLE'
  | 'TRANSPORT_ROUTE'
  | 'SETTINGS'
  | 'SESSION'
  | 'AUDIT_LOG'
  | 'STAFF_LEAVE'
  | 'STAFF_PAYROLL'
  | 'ADMIN_ACCOUNT'
  | 'WEBSITE'
  | 'HOLIDAY'
  | 'SMS';

export type RealtimeAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE' | 'ALLOCATE' | 'DEALLOCATE' | 'DISPATCH';

export type RealtimeConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'FALLBACK_POLLING';

export interface RealtimeEvent {
  id: string;
  entity: RealtimeEntityType;
  action: RealtimeAction;
  data?: any;
  targetRole?: string;
  studentId?: string;
  classId?: string;
  section?: string;
  academicSession?: string;
  timestamp: string;
  senderId?: string;
  description?: string;
}

export interface RealtimePollResponse {
  success: boolean;
  events: RealtimeEvent[];
  currentTimestamp: string;
  activeSession?: string;
}
