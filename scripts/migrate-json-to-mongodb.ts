import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { sanitizeMongoUri, mongoService } from '../server/db/mongo.ts';
import {
  SchoolSettingsModel,
  UserModel,
  ClassModel,
  SubjectModel,
  StudentModel,
  StaffModel,
  TimetableSlotModel,
  TimetablePeriodModel,
  AttendanceModel,
  StaffAttendanceModel,
  FeeStructureModel,
  ClassFeeConfigModel,
  FeePaymentModel,
  FeeLedgerModel,
  TransportVehicleModel,
  TransportRouteModel,
  TransportSlabModel,
  HostelModel,
  HostelRoomModel,
  ExamModel,
  ExamMarkModel,
  HomeworkModel,
  NoticeModel,
  StudyMaterialModel,
  FacilityModel,
  GalleryItemModel,
  HeroSlideModel,
  LeadershipProfileModel,
  WebsiteEventModel,
  AdmissionEnquiryModel,
  WebsiteContentModel,
  AuditLogModel,
  FileMetadataModel,
  HolidayModel,
} from '../server/models/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');

interface MigrationStats {
  entity: string;
  sourceFile: string;
  totalFound: number;
  migrated: number;
  failed: number;
  errors: string[];
}

function readJsonFile<T>(filename: string): T | null {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    console.error(`[Migration] Error reading ${filename}:`, err?.message);
    return null;
  }
}

async function runMigration() {
  console.log('====================================================');
  console.log('  STARTING ONE-TIME JSON TO MONGODB DATA MIGRATION  ');
  console.log('====================================================');

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    console.error('FATAL: MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  const cleanUri = sanitizeMongoUri(rawUri);
  console.log('[Migration] Connecting to MongoDB Atlas via Mongoose...');
  await mongoose.connect(cleanUri, {
    dbName: 'pds_school_erp',
    serverSelectionTimeoutMS: 15000,
  });
  console.log('[Migration] Connected successfully to database:', mongoose.connection.name);

  const stats: MigrationStats[] = [];

  // Helper for batch upserts using bulkWrite for speed and atomicity
  async function migrateCollection<T extends Record<string, any>>(
    entityName: string,
    filename: string,
    model: mongoose.Model<any>,
    idField: string = 'id',
    transform?: (item: T) => any
  ) {
    const result: MigrationStats = {
      entity: entityName,
      sourceFile: filename,
      totalFound: 0,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    const data = readJsonFile<T[] | Record<string, any>>(filename);
    if (!data) {
      console.warn(`[Migration] Skipping ${entityName}: ${filename} not found or empty`);
      stats.push(result);
      return;
    }

    if (Array.isArray(data)) {
      result.totalFound = data.length;
      if (data.length === 0) {
        stats.push(result);
        return;
      }
      try {
        const ops = data.map((item) => {
          const docData = transform ? transform(item) : item;
          const { _id, ...cleanDoc } = docData;
          return {
            updateOne: {
              filter: { [idField]: cleanDoc[idField] },
              update: { $set: cleanDoc },
              upsert: true,
            },
          };
        });
        const bulkRes = await model.bulkWrite(ops, { ordered: false });
        result.migrated = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);
      } catch (err: any) {
        result.failed++;
        result.errors.push(err?.message || 'Bulk write error');
      }
    } else if (typeof data === 'object') {
      result.totalFound = 1;
      try {
        const docData = transform ? transform(data as T) : data;
        const { _id, ...cleanDoc } = docData;
        const filter =
          idField === 'singleSchool'
            ? { singleSchool: true }
            : idField === 'singleRecord'
            ? { singleRecord: true }
            : { [idField]: (cleanDoc as any)[idField] };
        await model.findOneAndUpdate(
          filter,
          { $set: cleanDoc },
          { upsert: true, returnDocument: 'after', runValidators: false }
        );
        result.migrated = 1;
      } catch (err: any) {
        result.failed++;
        result.errors.push(err?.message || 'Single record update error');
      }
    }

    stats.push(result);
    console.log(`[Migration] -> ${entityName}: ${result.migrated}/${result.totalFound} migrated (${result.failed} failed)`);
  }

  // 1. School Settings
  await migrateCollection(
    'SchoolSettings',
    'schoolSettings.json',
    SchoolSettingsModel,
    'singleSchool',
    (s: any) => ({ ...s, singleSchool: true })
  );

  // 2. Admin Accounts -> Users collection
  await migrateCollection(
    'AdminAccounts',
    'adminAccounts.json',
    UserModel,
    'id',
    (a: any) => ({
      ...a,
      userType: 'ADMIN',
      status: a.status || 'ACTIVE',
      loginEnabled: a.loginEnabled !== false,
      role: a.role || 'SCHOOL_ADMIN',
    })
  );

  // 3. Classes
  await migrateCollection('Classes', 'classes.json', ClassModel, 'id');

  // 4. Subjects
  await migrateCollection('Subjects', 'subjects.json', SubjectModel, 'id');

  // 5. Staff
  await migrateCollection('Staff', 'staff.json', StaffModel, 'id', (s: any) => ({
    ...s,
    status: s.status || 'ACTIVE',
    loginEnabled: s.loginEnabled !== false,
    systemRole: s.systemRole || s.role || 'TEACHER',
  }));

  // Also sync staff into Users collection for auth
  const staffList = readJsonFile<any[]>('staff.json');
  if (Array.isArray(staffList) && staffList.length > 0) {
    try {
      const staffOps = staffList.map((s) => {
        const { _id, ...cleanStaff } = s;
        return {
          updateOne: {
            filter: { employeeId: cleanStaff.employeeId },
            update: {
              $set: {
                id: `user-staff-${cleanStaff.id}`,
                employeeId: cleanStaff.employeeId,
                username: cleanStaff.employeeId?.toLowerCase(),
                name: cleanStaff.name,
                email: cleanStaff.email,
                phone: cleanStaff.phone,
                role: cleanStaff.systemRole || cleanStaff.role || 'TEACHER',
                passwordHash: cleanStaff.passwordHash || bcrypt.hashSync(cleanStaff.initialPassword || 'admin123', 10),
                userType: 'STAFF',
                status: cleanStaff.status === 'ACTIVE' || cleanStaff.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
                loginEnabled: cleanStaff.loginEnabled !== false,
              },
            },
            upsert: true,
          },
        };
      });
      await UserModel.bulkWrite(staffOps, { ordered: false });
    } catch (err: any) {
      console.warn(`[Migration] Notice during staff user sync:`, err?.message);
    }
  }

  // 6. Students
  await migrateCollection('Students', 'students.json', StudentModel, 'id');

  // 7. Timetable Slots
  await migrateCollection('TimetableSlots', 'timetable.json', TimetableSlotModel, 'id');

  // 8. Timetable Periods
  await migrateCollection('TimetablePeriods', 'timetablePeriods.json', TimetablePeriodModel, 'periodNumber');

  // 9. Attendance
  await migrateCollection('StudentAttendance', 'attendance.json', AttendanceModel, 'id');

  // 10. Staff Attendance
  await migrateCollection('StaffAttendance', 'staffAttendance.json', StaffAttendanceModel, 'id');

  // 11. Fee Structures
  await migrateCollection('FeeStructures', 'feeStructures.json', FeeStructureModel, 'id');

  // 12. Fee Configurations
  await migrateCollection('FeeConfigurations', 'feeConfigurations.json', ClassFeeConfigModel, 'id');

  // 13. Fee Payments
  await migrateCollection('FeePayments', 'feePayments.json', FeePaymentModel, 'id');

  // 14. Fee Ledgers
  await migrateCollection('FeeLedgers', 'feeLedgers.json', FeeLedgerModel, 'id');

  // 15. Transport Vehicles
  await migrateCollection('TransportVehicles', 'vehicles.json', TransportVehicleModel, 'id');

  // 16. Transport Routes
  await migrateCollection('TransportRoutes', 'routes.json', TransportRouteModel, 'id');

  // 17. Transport Slabs
  await migrateCollection('TransportSlabs', 'transportSlabs.json', TransportSlabModel, 'id');

  // 18. Hostels
  await migrateCollection('Hostels', 'hostels.json', HostelModel, 'id');

  // 19. Hostel Rooms
  await migrateCollection('HostelRooms', 'hostelRooms.json', HostelRoomModel, 'id');

  // 20. Exams
  await migrateCollection('Exams', 'exams.json', ExamModel, 'id');

  // 21. Exam Marks
  await migrateCollection('ExamMarks', 'examMarks.json', ExamMarkModel, 'id');

  // 22. Homework
  await migrateCollection('Homework', 'homework.json', HomeworkModel, 'id');

  // 23. Notices
  await migrateCollection('Notices', 'notices.json', NoticeModel, 'id');

  // 24. Study Materials
  await migrateCollection('StudyMaterials', 'studyMaterials.json', StudyMaterialModel, 'id');

  // 25. Facilities
  await migrateCollection('Facilities', 'facilities.json', FacilityModel, 'id');

  // 26. Gallery Items
  await migrateCollection('Gallery', 'gallery.json', GalleryItemModel, 'id');

  // 27. Hero Slides
  await migrateCollection('HeroSlides', 'heroSlides.json', HeroSlideModel, 'id');

  // 28. Leadership
  await migrateCollection('Leadership', 'leadership.json', LeadershipProfileModel, 'id');

  // 29. Events
  await migrateCollection('Events', 'events.json', WebsiteEventModel, 'id');

  // 30. Admission Enquiries
  await migrateCollection('AdmissionEnquiries', 'admissionEnquiries.json', AdmissionEnquiryModel, 'id');

  // 31. Website Content
  await migrateCollection('WebsiteContent', 'websiteContent.json', WebsiteContentModel, 'singleRecord', (c: any) => ({
    ...c,
    singleRecord: true,
  }));

  // 32. Audit Logs
  await migrateCollection('AuditLogs', 'auditLogs.json', AuditLogModel, 'id');

  // 33. File Metadata
  await migrateCollection('FileMetadata', 'fileMetadata.json', FileMetadataModel, 'fileKey');

  // 34. Holidays
  await migrateCollection('Holidays', 'holidays.json', HolidayModel, 'id');

  console.log('\n====================================================');
  console.log('             MIGRATION EXECUTION SUMMARY            ');
  console.log('====================================================');
  let totalSourceRecords = 0;
  let totalMigratedRecords = 0;
  let totalFailedRecords = 0;

  for (const s of stats) {
    totalSourceRecords += s.totalFound;
    totalMigratedRecords += s.migrated;
    totalFailedRecords += s.failed;
    console.log(
      `${s.entity.padEnd(22)} | Source: ${String(s.totalFound).padStart(4)} | Migrated: ${String(s.migrated).padStart(4)} | Failed: ${String(s.failed).padStart(2)}`
    );
    if (s.errors.length > 0) {
      console.warn(`  ↳ Sample error: ${s.errors[0]}`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL RECORDS FOUND IN JSON:  ${totalSourceRecords}`);
  console.log(`TOTAL RECORDS IN MONGODB:     ${totalMigratedRecords}`);
  console.log(`TOTAL FAILED RECORDS:         ${totalFailedRecords}`);
  console.log('====================================================');

  await mongoService.close();
  await mongoose.disconnect();
  console.log('[Migration] Disconnected from MongoDB. Migration completed successfully!\n');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('[Migration] Fatal error during migration:', err);
  process.exit(1);
});
