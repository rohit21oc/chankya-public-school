import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

// Configure Mongoose globally to fail fast and never hang with buffer timeouts
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 0);

import {
  R2FileMetadata,
  SchoolSettings,
  Student,
  StudyMaterial,
  TeacherStaff,
  AcademicClass,
  Subject,
  TimetableSlot,
  TimetablePeriodConfig,
  AttendanceRecord,
  StaffAttendanceRecord,
  FeeStructure,
  FeePayment,
  ClassFeeConfiguration,
  TransportSlab,
  FeeLedgerEntry,
  Exam,
  ExamMark,
  Notice,
  Homework,
  Hostel,
  HostelRoom,
  HostelAllocation,
  TransportVehicle,
  TransportRoute,
  AuditLog,
  AdminAccount,
  ParentAccount,
  StaffLeave,
  StaffPayrollRecord,
  Holiday,
} from '../../src/types/index.ts';
import { sanitizeMongoUri, mongoService } from '../db/mongo.ts';
import { OFFICIAL_GRADING_SYSTEM } from '../../src/utils/grading.ts';
import { r2StorageService } from './R2StorageService.ts';
import {
  SchoolSettingsModel,
  UserModel,
  ClassModel,
  SubjectModel,
  StudentModel,
  StaffModel,
  StaffLeaveModel,
  StaffPayrollModel,
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
  HostelAllocationModel,
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
  PaymentOrderModel,
  PaymentWebhookEventModel,
} from '../models/index.ts';

class PersistentStorageManager {
  private inMemoryCache = new Map<string, { data: Buffer; contentType: string }>();
  private fileMetadataMap = new Map<string, R2FileMetadata>();
  private initialized = false;
  private keepAliveTimer: any = null;
  private mongoFailedPermanently = false;
  private lastConnectAttempt = 0;
  private isConnecting = false;

  public isReady(): boolean {
    return !this.mongoFailedPermanently && mongoose.connection.readyState === 1;
  }

  /**
   * The JSON files in data/ are development sample data (sample students, staff, and admin accounts with a
   * password that is public in the repository). In production with MongoDB connected, an empty collection
   * must stay empty: falling back to these files would copy the sample data into the real database.
   * Set ALLOW_JSON_SEED=true only to deliberately import data/ into a database.
   */
  private jsonSeedBlocked(): boolean {
    const isProduction =
      process.env.NODE_ENV === 'production' || (typeof __filename !== 'undefined' && __filename.endsWith('.cjs'));
    return isProduction && mongoose.connection.readyState === 1 && process.env.ALLOW_JSON_SEED !== 'true';
  }

  public loadJsonData<T>(fileName: string, defaultValue: T): T {
    if (this.jsonSeedBlocked()) return defaultValue;
    try {
      const filePath = path.resolve(process.cwd(), 'data', fileName);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch (e: any) {
      console.warn(`[PersistentStorage] Notice reading data/${fileName}:`, e?.message);
    }
    return defaultValue;
  }

  public saveJsonData(fileName: string, data: any): void {
    try {
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const filePath = path.join(dataDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn(`[PersistentStorage] Notice writing data/${fileName}:`, e?.message);
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    mongoose.set('bufferCommands', false); // CRITICAL: fail fast, don't hang
    mongoose.set('bufferTimeoutMS', 0);

    const rawUri = process.env.MONGODB_URI;
    if (!rawUri || !rawUri.trim()) {
      console.warn('[PersistentStorage] MONGODB_URI is not set. Operating in local JSON & in-memory storage fallback mode.');
      this.initialized = true;
      return;
    }

    try {
      const cleanUri = sanitizeMongoUri(rawUri);
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(cleanUri, {
          dbName: 'cps_school_erp',
          maxPoolSize: 20,
          minPoolSize: 2,
          maxIdleTimeMS: 45000,
          socketTimeoutMS: 45000,
          serverSelectionTimeoutMS: 3000,
          heartbeatFrequencyMS: 10000,
          autoIndex: false,
        });
        console.log('[PersistentStorage] Mongoose connected successfully to database:', mongoose.connection.name);
      }
    } catch (connErr: any) {
      this.mongoFailedPermanently = true;
      console.warn('[PersistentStorage] MongoDB connection attempt failed, operating in reliable local JSON fallback mode:', connErr?.message);
    }

    if (this.isReady()) {
      mongoose.connection.on('disconnected', () => {
        console.warn('[PersistentStorage] Mongoose connection disconnected.');
      });
      mongoose.connection.on('error', (err) => {
        console.error('[PersistentStorage] Mongoose connection error:', err?.message);
      });

      // Start background database keep-alive ping loop every 30s only when connected
      if (!this.keepAliveTimer) {
        this.keepAliveTimer = setInterval(async () => {
          try {
            if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
              await mongoose.connection.db.command({ ping: 1 });
            }
          } catch (e: any) {
            console.warn('[PersistentStorage] Database keep-alive ping note:', e?.message);
          }
        }, 30000);
      }
    }

    // Connect native MongoService
    try {
      await mongoService.init();
    } catch (e: any) {
      console.warn('[PersistentStorage] Native MongoService init notice:', e?.message);
    }

    // Preload file metadata cache from MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const metas = await FileMetadataModel.find().lean();
        metas.forEach((m) => {
          const { _id, __v, ...clean } = m as any;
          this.fileMetadataMap.set(clean.fileKey, clean as R2FileMetadata);
        });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice loading file metadata from MongoDB:', err?.message);
      }
    }

    this.initialized = true;
    console.log(
      `[PersistentStorage] Persistent storage ready with ${this.fileMetadataMap.size} files tracked.`
    );
  }

  public deduplicateById<T>(items: T[]): T[] {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
      const id = (item as any)?.id || (item as any)?._id;
      if (id) {
        const idStr = String(id);
        if (seen.has(idStr)) continue;
        seen.add(idStr);
      }
      result.push(item);
    }
    return result;
  }

  public cleanDoc<T>(doc: any): T {
    if (!doc) return doc;
    const { _id, __v, ...clean } = doc;
    return clean as T;
  }

  // --- Binary File Storage (Cloudflare R2 + In-Memory Cache) ---

  public async saveFile(
    fileKey: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ success: boolean; filePath: string }> {
    const sanitizedKey = fileKey.replace(/^\/+/, '');

    // In-memory fast cache for recent requests
    this.inMemoryCache.set(sanitizedKey, { data: buffer, contentType });

    // Upload to live Cloudflare R2 if configured
    if (r2StorageService.isConfigured) {
      try {
        await r2StorageService.uploadObjectBuffer(sanitizedKey, buffer, contentType);
      } catch (e: any) {
        console.warn(`[PersistentStorage] Live R2 upload notice for ${sanitizedKey}:`, e?.message);
      }
    }

    return { success: true, filePath: sanitizedKey };
  }

  public async getFile(
    fileKey: string
  ): Promise<{ data: Buffer; contentType: string } | null> {
    if (!fileKey || typeof fileKey !== 'string') return null;
    const sanitizedKey = fileKey.replace(/^\/+/, '');

    // 1. Check in-memory fast cache
    if (this.inMemoryCache.has(sanitizedKey)) {
      return this.inMemoryCache.get(sanitizedKey)!;
    }

    // 2. Fetch from live Cloudflare R2 if configured
    if (r2StorageService.isConfigured) {
      try {
        const r2Item = await r2StorageService.getObjectBuffer(sanitizedKey);
        if (r2Item && r2Item.buffer) {
          const result = { data: r2Item.buffer, contentType: r2Item.contentType || 'application/octet-stream' };
          this.inMemoryCache.set(sanitizedKey, result);
          return result;
        }
      } catch {
        // Fall through
      }
    }

    // 3. Check MongoDB binary store if present
    try {
      const mongoBinary = await mongoService.getFileBinary(sanitizedKey);
      if (mongoBinary && mongoBinary.buffer) {
        const result = { data: mongoBinary.buffer, contentType: mongoBinary.contentType || 'application/octet-stream' };
        this.inMemoryCache.set(sanitizedKey, result);
        return result;
      }
    } catch {
      // ignore
    }

    // 4. Check local filesystem storage (e.g. data/storage/, public/, etc.)
    try {
      const fs = await import('fs');
      const path = await import('path');
      const possiblePaths = [
        path.resolve(process.cwd(), sanitizedKey),
        path.resolve(process.cwd(), 'data/storage', sanitizedKey),
        path.resolve(process.cwd(), 'data', sanitizedKey),
        path.resolve(process.cwd(), 'public', sanitizedKey),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const stat = fs.statSync(p);
          if (stat.isFile() && stat.size > 0) {
            const data = fs.readFileSync(p);
            let contentType = 'application/octet-stream';
            if (p.toLowerCase().endsWith('.png')) contentType = 'image/png';
            else if (p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg')) contentType = 'image/jpeg';
            else if (p.toLowerCase().endsWith('.webp')) contentType = 'image/webp';
            else if (p.toLowerCase().endsWith('.pdf')) contentType = 'application/pdf';
            else if (p.toLowerCase().endsWith('.svg')) contentType = 'image/svg+xml';
            const result = { data, contentType };
            this.inMemoryCache.set(sanitizedKey, result);
            return result;
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  public async deleteFile(fileKey: string): Promise<boolean> {
    const sanitizedKey = fileKey.replace(/^\/+/, '');
    this.inMemoryCache.delete(sanitizedKey);
    if (r2StorageService.isConfigured) {
      await r2StorageService.deleteObject(sanitizedKey).catch(() => {});
    }
    await this.deleteFileMetadata(sanitizedKey).catch(() => {});
    await mongoService.deleteFileBinary(sanitizedKey).catch(() => {});
    return true;
  }

  // --- File Metadata (MongoDB FileMetadata collection) ---

  public async saveFileMetadata(meta: R2FileMetadata): Promise<void> {
    this.fileMetadataMap.set(meta.fileKey, meta);
    const { _id, ...clean } = meta as any;
    if (mongoose.connection.readyState !== 1) return; // kept in memory until the database is available
    await FileMetadataModel.findOneAndUpdate(
      { fileKey: clean.fileKey },
      { $set: clean },
      { upsert: true, returnDocument: 'after' }
    );
  }

  public async deleteFileMetadata(fileKey: string): Promise<boolean> {
    this.fileMetadataMap.delete(fileKey);
    if (mongoose.connection.readyState !== 1) return true;
    const res = await FileMetadataModel.deleteOne({ fileKey });
    return res.deletedCount > 0;
  }

  public getFileMetadata(fileKey: string): R2FileMetadata | null {
    return this.fileMetadataMap.get(fileKey) || null;
  }

  public getAllFileMetadata(folder?: string): R2FileMetadata[] {
    const all = Array.from(this.fileMetadataMap.values());
    if (folder) {
      return all.filter((m) => m.folder === folder);
    }
    return all;
  }

  public async loadAllFileMetadata(folder?: string): Promise<R2FileMetadata[]> {
    if (this.isReady()) {
      try {
        const metas = await FileMetadataModel.find().lean();
        this.fileMetadataMap.clear();
        metas.forEach((m) => {
          const { _id, __v, ...clean } = m as any;
          this.fileMetadataMap.set(clean.fileKey, clean as R2FileMetadata);
        });
      } catch (e: any) {
        console.warn('[PersistentStorage] Failed to refresh file metadata from MongoDB:', e?.message);
      }
    }
    return this.getAllFileMetadata(folder);
  }

  // --- Students ---

  public async loadStudents(): Promise<Student[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await StudentModel.find().lean();
        if (docs && docs.length > 0) {
          return this.deduplicateById(docs.map((d) => this.cleanDoc<Student>(d)));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying students from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Student[]>('students.json', []);
  }

  public async saveStudents(students: Student[]): Promise<void> {
    if (!Array.isArray(students) || students.length === 0) return;
    this.saveJsonData('students.json', students);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = students.map((s) => {
          const { _id, ...clean } = s as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await StudentModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving students to MongoDB:', err?.message);
      }
    }
  }

  public saveStudentsToDisk(students: Student[], _syncToMongo = true): void {
    this.saveJsonData('students.json', students);
    this.saveStudents(students).catch((err) => {
      console.error('[PersistentStorage] Error saving students to MongoDB:', err);
    });
  }

  public async saveStudent(student: Student): Promise<void> {
    const { _id, ...clean } = student as any;
    try {
      const current = this.loadJsonData<Student[]>('students.json', []);
      const idx = current.findIndex((s) => s.id === clean.id);
      if (idx !== -1) {
        current[idx] = { ...current[idx], ...clean };
      } else {
        current.push(clean as Student);
      }
      this.saveJsonData('students.json', current);
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await StudentModel.updateOne({ id: clean.id }, { $set: clean }, { upsert: true }).maxTimeMS(5000);
      } catch (err: any) {
        console.warn('[PersistentStorage] saveStudent notice:', err?.message);
      }
    }
  }

  // --- School Settings ---

  public async loadSchoolSettings(): Promise<SchoolSettings> {
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await SchoolSettingsModel.findOne({ singleSchool: true }).lean();
        if (doc) {
          return this.cleanDoc<SchoolSettings>(doc);
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying school settings from MongoDB:', err?.message);
      }
    }
    const fromJson = this.loadJsonData<SchoolSettings | null>('schoolSettings.json', null);
    if (fromJson) {
      return fromJson;
    }
    // No saved settings anywhere: identity only, no invented contact / principal details.
    return {
      schoolName: 'CHANAKYA PUBLIC SCHOOL & COACHING CENTRE',
      currentAcademicSession: '2026-2027',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      gradingSystem: OFFICIAL_GRADING_SYSTEM,
    } as SchoolSettings;
  }

  public async saveSchoolSettings(settings: SchoolSettings): Promise<void> {
    const { _id, ...clean } = settings as any;
    this.saveJsonData('schoolSettings.json', clean);
    if (mongoose.connection.readyState === 1) {
      try {
        await SchoolSettingsModel.findOneAndUpdate(
          { singleSchool: true },
          { $set: { ...clean, singleSchool: true } },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving school settings to MongoDB:', err?.message);
      }
    }
  }

  public saveSchoolSettingsToDisk(settings: SchoolSettings): void {
    this.saveJsonData('schoolSettings.json', settings);
    this.saveSchoolSettings(settings).catch((err) => {
      console.error('[PersistentStorage] Error saving school settings to MongoDB:', err);
    });
  }

  // --- Study Materials ---

  public async loadStudyMaterials(): Promise<StudyMaterial[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await StudyMaterialModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<StudyMaterial>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying study materials from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<StudyMaterial[]>('studyMaterials.json', []);
  }

  public async saveStudyMaterials(materials: StudyMaterial[]): Promise<void> {
    if (!Array.isArray(materials) || materials.length === 0) return;
    this.saveJsonData('studyMaterials.json', materials);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = materials.map((m) => {
          const { _id, ...clean } = m as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await StudyMaterialModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving study materials to MongoDB:', err?.message);
      }
    }
  }

  public saveStudyMaterialsToDisk(materials: StudyMaterial[]): void {
    this.saveJsonData('studyMaterials.json', materials);
    this.saveStudyMaterials(materials).catch((err) => {
      console.error('[PersistentStorage] Error saving study materials to MongoDB:', err);
    });
  }

  // --- Staff ---

  public async loadStaff(): Promise<TeacherStaff[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await StaffModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => {
            const item = this.cleanDoc<TeacherStaff>(d);
            if (item.designation && /head of department|\bhod\b/i.test(item.designation)) {
              item.designation = 'PGT Teacher';
            }
            if (!item.portalRole && item.systemRole) {
              item.portalRole = item.systemRole;
            }
            return item;
          });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying staff from MongoDB:', err?.message);
      }
    }
    const fromJson = this.loadJsonData<TeacherStaff[]>('staff.json', []);
    return fromJson.map((d) => {
      const item = { ...d };
      if (item.designation && /head of department|\bhod\b/i.test(item.designation)) {
        item.designation = 'PGT Teacher';
      }
      if (!item.portalRole && item.systemRole) {
        item.portalRole = item.systemRole;
      }
      return item;
    });
  }

  public async saveStaff(staffList: TeacherStaff[]): Promise<void> {
    if (!Array.isArray(staffList) || staffList.length === 0) return;
    this.saveJsonData('staff.json', staffList);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = staffList.map((s) => {
          const { _id, ...clean } = s as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await StaffModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving staff to MongoDB:', err?.message);
      }
    }
  }

  public saveStaffToDisk(staffList: TeacherStaff[]): void {
    this.saveJsonData('staff.json', staffList);
    this.saveStaff(staffList).catch((err) => {
      console.error('[PersistentStorage] Error saving staff to MongoDB:', err);
    });
  }

  // --- Classes ---

  public async loadClasses(): Promise<AcademicClass[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await ClassModel.find().sort({ numericOrder: 1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<AcademicClass>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying classes from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<AcademicClass[]>('classes.json', []);
  }

  public async saveClasses(classesList: AcademicClass[]): Promise<void> {
    if (!Array.isArray(classesList)) return;
    this.saveJsonData('classes.json', classesList);
    if (mongoose.connection.readyState === 1) {
      try {
        if (classesList.length === 0) {
          await ClassModel.deleteMany({});
          return;
        }
        const seenIds = new Set<string>();
        const uniqueClasses: AcademicClass[] = [];
        for (const c of classesList) {
          if (!c || !c.id) continue;
          const lower = String(c.id).trim().toLowerCase();
          if (seenIds.has(lower)) continue;
          seenIds.add(lower);
          uniqueClasses.push(c);
        }
        const currentIds = uniqueClasses.map((c) => c.id).filter(Boolean);
        if (currentIds.length > 0) {
          await ClassModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = uniqueClasses.map((c) => {
          const { _id, ...clean } = c as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        if (ops.length > 0) {
          await ClassModel.bulkWrite(ops, { ordered: false });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving classes to MongoDB:', err?.message || err);
      }
    }
  }

  public async deleteClass(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<AcademicClass[]>('classes.json', []);
      this.saveJsonData('classes.json', current.filter((c) => c.id !== id && c.name !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        const conditions: any[] = [{ id }, { name: id }];
        if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
          conditions.push({ _id: new mongoose.Types.ObjectId(id) });
        }
        const res = await ClassModel.deleteMany({ $or: conditions });
        return (res.deletedCount || 0) > 0;
      } catch (err) {
        console.warn('[PersistentStorage] Error deleting class from MongoDB:', err);
        return false;
      }
    }
    return true;
  }

  public saveClassesToDisk(classesList: AcademicClass[]): void {
    this.saveJsonData('classes.json', classesList);
    this.saveClasses(classesList).catch((err) => {
      console.warn('[PersistentStorage] Notice saving classes to MongoDB in background:', err?.message || err);
    });
  }

  // --- Subjects ---

  public async loadSubjects(): Promise<Subject[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await SubjectModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<Subject>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying subjects from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Subject[]>('subjects.json', []);
  }

  public async saveSubjects(subjectsList: Subject[]): Promise<void> {
    if (!Array.isArray(subjectsList) || subjectsList.length === 0) return;
    this.saveJsonData('subjects.json', subjectsList);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = subjectsList.map((s) => {
          const { _id, ...clean } = s as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await SubjectModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving subjects to MongoDB:', err?.message);
      }
    }
  }

  /** Removes one subject from Mongo as well as the JSON mirror; saveSubjects only upserts, so without this a deleted subject comes back. */
  public async deleteSubject(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<Subject[]>('subjects.json', []);
      this.saveJsonData('subjects.json', current.filter((s) => s.id !== id));
    } catch {}
    if (mongoose.connection.readyState === 1) {
      try {
        await SubjectModel.deleteOne({ id });
      } catch (e) {
        console.warn('[PersistentStorage] Error deleting subject from MongoDB:', e);
      }
    }
  }

  public saveSubjectsToDisk(subjectsList: Subject[]): void {
    this.saveJsonData('subjects.json', subjectsList);
    this.saveSubjects(subjectsList).catch((err) => {
      console.error('[PersistentStorage] Error saving subjects to MongoDB:', err);
    });
  }

  // --- Timetable ---

  public async loadTimetable(): Promise<TimetableSlot[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await TimetableSlotModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<TimetableSlot>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying timetable from MongoDB via Mongoose:', err?.message);
      }
    }
    if (mongoService.isConnected()) {
      try {
        const docs = await mongoService.getTimetable();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<TimetableSlot>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying timetable via mongoService:', err?.message);
      }
    }
    return this.loadJsonData<TimetableSlot[]>('timetable.json', []);
  }

  public async saveTimetable(slots: TimetableSlot[]): Promise<void> {
    if (!Array.isArray(slots)) return;
    this.saveJsonData('timetable.json', slots);

    let mongoSaved = false;
    let mongoError: Error | null = null;

    if (mongoService.isConnected()) {
      try {
        const ok = await mongoService.saveAllTimetable(slots);
        if (ok) mongoSaved = true;
      } catch (err: any) {
        mongoError = err;
        console.warn('[PersistentStorage] Notice saving timetable to MongoDB via mongoService:', err?.message);
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await TimetableSlotModel.deleteMany({});
        if (slots.length > 0) {
          const ops = slots.map((s) => {
            const { _id, ...clean } = s as any;
            const normDay = clean.dayOfWeek || clean.day || 'Monday';
            const periodNum = Number(clean.periodNumber !== undefined ? clean.periodNumber : clean.period || 1);
            return {
              updateOne: {
                filter: { id: clean.id },
                update: {
                  $set: {
                    ...clean,
                    dayOfWeek: normDay,
                    day: normDay,
                    periodNumber: periodNum,
                    period: periodNum,
                  },
                },
                upsert: true,
              },
            };
          });
          await TimetableSlotModel.bulkWrite(ops, { ordered: false });
          mongoSaved = true;
        }
      } catch (err: any) {
        if (!mongoSaved) mongoError = err;
        console.warn('[PersistentStorage] Notice saving timetable to MongoDB via Mongoose:', err?.message);
      }
    }

    if (!mongoSaved && (mongoService.isConnected() || mongoose.connection.readyState === 1) && mongoError) {
      throw mongoError;
    }
  }

  public async saveTimetableAsync(slots: TimetableSlot[]): Promise<void> {
    return this.saveTimetable(slots);
  }

  public saveTimetableToDisk(slots: TimetableSlot[]): void {
    this.saveJsonData('timetable.json', slots);
    this.saveTimetable(slots).catch((err) => {
      console.error('[PersistentStorage] Error saving timetable to MongoDB:', err);
    });
  }

  public async loadTimetablePeriods(): Promise<TimetablePeriodConfig[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await TimetablePeriodModel.find().sort({ periodNumber: 1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => {
            const clean = this.cleanDoc<TimetablePeriodConfig>(d);
            return {
              ...clean,
              name: clean.name || (clean as any).label || `Period ${clean.periodNumber}`,
            };
          });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying timetable periods from MongoDB via Mongoose:', err?.message);
      }
    }
    if (mongoService.isConnected()) {
      try {
        const docs = await mongoService.getTimetablePeriods();
        if (docs && docs.length > 0) {
          return docs.map((d) => {
            const clean = this.cleanDoc<TimetablePeriodConfig>(d);
            return {
              ...clean,
              name: clean.name || (clean as any).label || `Period ${clean.periodNumber}`,
            };
          });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying timetable periods via mongoService:', err?.message);
      }
    }
    return this.loadJsonData<TimetablePeriodConfig[]>('timetablePeriods.json', []);
  }

  public async saveTimetablePeriods(periods: TimetablePeriodConfig[]): Promise<void> {
    if (!Array.isArray(periods) || periods.length === 0) return;
    this.saveJsonData('timetablePeriods.json', periods);

    if (mongoService.isConnected()) {
      try {
        await mongoService.saveAllTimetablePeriods(periods);
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving timetable periods to MongoDB via mongoService:', err?.message);
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const seen = new Set<number>();
        const ops: any[] = [];
        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          if (!p || typeof p !== 'object') continue;
          const { _id, ...clean } = p as any;
          let pNum = Number(clean.periodNumber);
          if (isNaN(pNum) || pNum < 1 || seen.has(pNum)) {
            let candidate = 1;
            while (seen.has(candidate)) candidate++;
            pNum = candidate;
          }
          seen.add(pNum);
          clean.periodNumber = pNum;
          if (!clean.label && clean.name) clean.label = clean.name;
          if (!clean.name && clean.label) clean.name = clean.label;
          ops.push({
            updateOne: {
              filter: { periodNumber: clean.periodNumber },
              update: { $set: clean },
              upsert: true,
            },
          });
        }
        if (ops.length > 0) {
          await TimetablePeriodModel.bulkWrite(ops, { ordered: false });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving timetable periods to MongoDB via Mongoose:', err?.message);
      }
    }
  }

  public saveTimetablePeriodsToDisk(periods: TimetablePeriodConfig[]): void {
    this.saveJsonData('timetablePeriods.json', periods);
    this.saveTimetablePeriods(periods).catch((err) => {
      console.error('[PersistentStorage] Error saving timetable periods to MongoDB:', err);
    });
  }

  // --- Attendance ---

  public async loadAttendance(): Promise<AttendanceRecord[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await AttendanceModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<AttendanceRecord>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying attendance from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<AttendanceRecord[]>('attendance.json', []);
  }

  public async saveAttendance(records: AttendanceRecord[]): Promise<void> {
    if (!Array.isArray(records) || records.length === 0) return;
    try {
      const existing = this.loadJsonData<AttendanceRecord[]>('attendance.json', []);
      const map = new Map<string, AttendanceRecord>();
      existing.forEach((e) => map.set(`${e.studentId}-${e.date}`, e));
      records.forEach((r) => map.set(`${r.studentId}-${r.date}`, r));
      this.saveJsonData('attendance.json', Array.from(map.values()));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        const seenStuDate = new Set<string>();
        const seenIds = new Set<string>();
        const sanitized: AttendanceRecord[] = [];

        // Deduplicate records from newest to oldest
        for (let i = records.length - 1; i >= 0; i--) {
          const r = records[i];
          if (!r || typeof r !== 'object') continue;
          const { _id, ...clean } = r as any;
          const stuId = String(clean.studentId || '').trim();
          const d = String(clean.date || '').trim();
          if (!stuId || !d) continue;

          const key = `${stuId}_${d}`;
          if (seenStuDate.has(key)) continue;
          seenStuDate.add(key);

          let rId = String(clean.id || '').trim();
          if (!rId || seenIds.has(rId)) {
            rId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          }
          seenIds.add(rId);

          sanitized.push({
            ...clean,
            id: rId,
            studentId: stuId,
            date: d,
          });
        }

        const ops = sanitized.map((r) => {
          const { id, studentId, date, ...rest } = r as any;
          return {
            updateOne: {
              filter: { studentId, date },
              update: {
                $set: {
                  ...rest,
                  studentId,
                  date,
                },
                $setOnInsert: {
                  id,
                },
              },
              upsert: true,
            },
          };
        });

        if (ops.length > 0) {
          await AttendanceModel.bulkWrite(ops, { ordered: false });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving attendance to MongoDB:', err?.message);
      }
    }
  }

  public saveAttendanceToDisk(records: AttendanceRecord[]): void {
    try {
      const existing = this.loadJsonData<AttendanceRecord[]>('attendance.json', []);
      const map = new Map<string, AttendanceRecord>();
      existing.forEach((e) => map.set(`${e.studentId}-${e.date}`, e));
      records.forEach((r) => map.set(`${r.studentId}-${r.date}`, r));
      this.saveJsonData('attendance.json', Array.from(map.values()));
    } catch {
      this.saveJsonData('attendance.json', records);
    }
  }

  public async loadStaffAttendance(): Promise<StaffAttendanceRecord[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await StaffAttendanceModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<StaffAttendanceRecord>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying staff attendance from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<StaffAttendanceRecord[]>('staffAttendance.json', []);
  }

  public async saveStaffAttendance(records: StaffAttendanceRecord[]): Promise<void> {
    if (!Array.isArray(records) || records.length === 0) return;
    this.saveJsonData('staffAttendance.json', records);
    if (mongoose.connection.readyState === 1) {
      try {
        const seenStaffDate = new Set<string>();
        const seenIds = new Set<string>();
        const sanitized: StaffAttendanceRecord[] = [];

        for (let i = records.length - 1; i >= 0; i--) {
          const r = records[i];
          if (!r || typeof r !== 'object') continue;
          const { _id, ...clean } = r as any;
          const staffId = String(clean.staffId || clean.employeeId || '').trim();
          const d = String(clean.date || '').trim();
          if (!staffId || !d) continue;

          const key = `${staffId}_${d}`;
          if (seenStaffDate.has(key)) continue;
          seenStaffDate.add(key);

          let rId = String(clean.id || '').trim();
          if (!rId || seenIds.has(rId)) {
            rId = `sa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          }
          seenIds.add(rId);

          sanitized.push({
            ...clean,
            id: rId,
            staffId: clean.staffId || staffId,
            employeeId: clean.employeeId || staffId,
            date: d,
          });
        }

        const ops = sanitized.map((r) => {
          const { id, staffId, employeeId, date, ...rest } = r as any;
          return {
            updateOne: {
              filter: { staffId, date },
              update: {
                $set: {
                  ...rest,
                  staffId,
                  employeeId,
                  date,
                },
                $setOnInsert: {
                  id,
                },
              },
              upsert: true,
            },
          };
        });

        if (ops.length > 0) {
          await StaffAttendanceModel.bulkWrite(ops, { ordered: false });
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving staff attendance to MongoDB:', err?.message);
      }
    }
  }

  public saveStaffAttendanceToDisk(records: StaffAttendanceRecord[]): void {
    this.saveJsonData('staffAttendance.json', records);
  }

  // --- Holidays ---

  public async loadHolidays(): Promise<Holiday[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await HolidayModel.find().sort({ date: 1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<Holiday>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying holidays from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Holiday[]>('holidays.json', []);
  }

  public async saveHolidays(holidaysList: Holiday[]): Promise<void> {
    if (!Array.isArray(holidaysList) || holidaysList.length === 0) return;
    this.saveJsonData('holidays.json', holidaysList);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = holidaysList.map((h) => {
          const { _id, ...clean } = h as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await HolidayModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving holidays to MongoDB:', err?.message);
      }
    }
  }

  public saveHolidaysToDisk(holidaysList: Holiday[]): void {
    this.saveJsonData('holidays.json', holidaysList);
    this.saveHolidays(holidaysList).catch((err) => {
      console.error('[PersistentStorage] Error saving holidays to MongoDB:', err);
    });
  }

  public async deleteHoliday(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<Holiday[]>('holidays.json', []);
      this.saveJsonData('holidays.json', current.filter((h) => h.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await HolidayModel.deleteOne({ id });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting holiday from MongoDB:', err?.message);
      }
    }
  }

  // --- Staff Leaves ---

  public async loadStaffLeaves(): Promise<StaffLeave[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await StaffLeaveModel.find().sort({ appliedAt: -1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<StaffLeave>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying staff leaves from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<StaffLeave[]>('staffLeaves.json', []);
  }

  public async saveStaffLeaves(leaves: StaffLeave[]): Promise<void> {
    if (!Array.isArray(leaves) || leaves.length === 0) return;
    this.saveJsonData('staffLeaves.json', leaves);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = leaves.map((l) => {
          const { _id, ...clean } = l as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await StaffLeaveModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving staff leaves to MongoDB:', err?.message);
      }
    }
  }

  public saveStaffLeavesToDisk(leaves: StaffLeave[]): void {
    this.saveJsonData('staffLeaves.json', leaves);
    this.saveStaffLeaves(leaves).catch((err) => {
      console.error('[PersistentStorage] Error saving staff leaves to MongoDB:', err);
    });
  }

  // --- Staff Payroll ---

  public async loadStaffPayroll(): Promise<StaffPayrollRecord[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await StaffPayrollModel.find().sort({ year: -1, createdAt: -1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<StaffPayrollRecord>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying staff payroll from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<StaffPayrollRecord[]>('staffPayroll.json', []);
  }

  public async saveStaffPayroll(payroll: StaffPayrollRecord[]): Promise<void> {
    if (!Array.isArray(payroll) || payroll.length === 0) return;
    this.saveJsonData('staffPayroll.json', payroll);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = payroll.map((p) => {
          const { _id, ...clean } = p as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await StaffPayrollModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving staff payroll to MongoDB:', err?.message);
      }
    }
  }

  public saveStaffPayrollToDisk(payroll: StaffPayrollRecord[]): void {
    this.saveJsonData('staffPayroll.json', payroll);
    this.saveStaffPayroll(payroll).catch((err) => {
      console.error('[PersistentStorage] Error saving staff payroll to MongoDB:', err);
    });
  }

  // --- Fees ---

  public async loadFeeStructures(): Promise<FeeStructure[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await FeeStructureModel.find().lean();
        if (docs && docs.length > 0) {
          return this.deduplicateById(docs.map((d) => this.cleanDoc<FeeStructure>(d)));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying fee structures from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<FeeStructure[]>('feeStructures.json', []);
  }

  public async saveFeeStructures(structures: FeeStructure[]): Promise<void> {
    if (!Array.isArray(structures) || structures.length === 0) return;
    this.saveJsonData('feeStructures.json', structures);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = structures.map((s) => {
          const { _id, ...clean } = s as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await FeeStructureModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving fee structures to MongoDB:', err?.message);
      }
    }
  }

  public saveFeeStructuresToDisk(structures: FeeStructure[]): void {
    this.saveJsonData('feeStructures.json', structures);
    this.saveFeeStructures(structures).catch((err) => {
      console.error('[PersistentStorage] Error saving fee structures to MongoDB:', err);
    });
  }

  public async loadFeePayments(): Promise<FeePayment[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await FeePaymentModel.find().lean();
        if (docs && docs.length > 0) {
          return this.deduplicateById(docs.map((d) => this.cleanDoc<FeePayment>(d)));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying fee payments from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<FeePayment[]>('feePayments.json', []);
  }

  public async saveFeePayments(payments: FeePayment[], writeLocalCopy = true): Promise<void> {
    if (!Array.isArray(payments) || payments.length === 0) return;
    if (writeLocalCopy) this.saveJsonData('feePayments.json', payments);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = payments.map((p) => {
          const { _id, ...clean } = p as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await FeePaymentModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.error('[PersistentStorage] Fee payment NOT saved to MongoDB:', err?.message);
      }
    }
  }

  public saveFeePaymentsToDisk(payments: FeePayment[]): void {
    this.saveJsonData('feePayments.json', payments);
    this.saveFeePayments(payments).catch((err) => {
      console.error('[PersistentStorage] Error saving fee payments to MongoDB:', err);
    });
  }

  public async loadFeeConfigurations(): Promise<ClassFeeConfiguration[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await ClassFeeConfigModel.find().lean();
        if (docs && docs.length > 0) {
          return this.deduplicateById(docs.map((d) => this.cleanDoc<ClassFeeConfiguration>(d)));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying fee configurations from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<ClassFeeConfiguration[]>('feeConfigurations.json', []);
  }

  public async saveFeeConfigurations(configs: ClassFeeConfiguration[]): Promise<void> {
    if (!Array.isArray(configs) || configs.length === 0) return;
    this.saveJsonData('feeConfigurations.json', configs);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = configs.map((c) => {
          const { _id, ...clean } = c as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await ClassFeeConfigModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving fee configurations to MongoDB:', err?.message);
      }
    }
  }

  public saveFeeConfigurationsToDisk(configs: ClassFeeConfiguration[]): void {
    this.saveJsonData('feeConfigurations.json', configs);
    this.saveFeeConfigurations(configs).catch((err) => {
      console.error('[PersistentStorage] Error saving fee configurations to MongoDB:', err);
    });
  }

  public async loadTransportSlabs(): Promise<TransportSlab[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await TransportSlabModel.find().lean();
        if (docs && docs.length > 0) {
          return this.deduplicateById(docs.map((d) => this.cleanDoc<TransportSlab>(d)));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying transport slabs from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<TransportSlab[]>('transportSlabs.json', []);
  }

  public async saveTransportSlabs(slabs: TransportSlab[]): Promise<void> {
    if (!Array.isArray(slabs) || slabs.length === 0) return;
    this.saveJsonData('transportSlabs.json', slabs);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = slabs.map((s) => {
          const { _id, ...clean } = s as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await TransportSlabModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving transport slabs to MongoDB:', err?.message);
      }
    }
  }

  public saveTransportSlabsToDisk(slabs: TransportSlab[]): void {
    this.saveJsonData('transportSlabs.json', slabs);
    this.saveTransportSlabs(slabs).catch((err) => {
      console.error('[PersistentStorage] Error saving transport slabs to MongoDB:', err);
    });
  }

  public async loadFeeLedgers(): Promise<FeeLedgerEntry[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await FeeLedgerModel.find().lean();
        if (docs && docs.length > 0) {
          return this.deduplicateById(docs.map((d) => this.cleanDoc<FeeLedgerEntry>(d)));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying fee ledgers from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<FeeLedgerEntry[]>('feeLedgers.json', []);
  }

  public async saveFeeLedgers(ledgers: FeeLedgerEntry[], writeLocalCopy = true): Promise<void> {
    if (!Array.isArray(ledgers) || ledgers.length === 0) return;
    if (writeLocalCopy) this.saveJsonData('feeLedgers.json', ledgers);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = ledgers.map((l) => {
          const { _id, ...clean } = l as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await FeeLedgerModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.error('[PersistentStorage] Fee ledger NOT saved to MongoDB:', err?.message);
      }
    }
  }

  public saveFeeLedgersToDisk(ledgers: FeeLedgerEntry[]): void {
    this.saveJsonData('feeLedgers.json', ledgers);
    this.saveFeeLedgers(ledgers).catch((err) => {
      console.error('[PersistentStorage] Error saving fee ledgers to MongoDB:', err);
    });
  }

  // --- Exams ---

  public async loadExams(): Promise<Exam[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await ExamModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<Exam>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying exams from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Exam[]>('exams.json', []);
  }

  public async saveExams(examsList: Exam[]): Promise<void> {
    if (!Array.isArray(examsList) || examsList.length === 0) return;
    this.saveJsonData('exams.json', examsList);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = examsList.map((e) => {
          const { _id, ...clean } = e as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await ExamModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving exams to MongoDB:', err?.message);
      }
    }
  }

  public saveExamsToDisk(examsList: Exam[]): void {
    this.saveJsonData('exams.json', examsList);
    this.saveExams(examsList).catch((err) => {
      console.error('[PersistentStorage] Error saving exams to MongoDB:', err);
    });
  }

  public async deleteExam(id: string): Promise<void> {
    try {
      const currentExams = this.loadJsonData<Exam[]>('exams.json', []);
      this.saveJsonData('exams.json', currentExams.filter((e) => e.id !== id));
      const currentMarks = this.loadJsonData<ExamMark[]>('examMarks.json', []);
      this.saveJsonData('examMarks.json', currentMarks.filter((m) => m.examId !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await ExamModel.deleteOne({ id });
        await ExamMarkModel.deleteMany({ examId: id });
        const { NoticeModel } = await import('../models/Notice');
        await NoticeModel.deleteMany({ id: { $in: [`notice-exam-${id}`, `notice-result-${id}`] } });
      } catch (e) {
        console.warn('[PersistentStorage] Error deleting exam from MongoDB:', e);
      }
    }
  }

  public async loadExamMarks(): Promise<ExamMark[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await ExamMarkModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<ExamMark>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying exam marks from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<ExamMark[]>('examMarks.json', []);
  }

  public async saveExamMarks(marks: ExamMark[]): Promise<void> {
    if (!Array.isArray(marks) || marks.length === 0) return;
    this.saveJsonData('examMarks.json', marks);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = marks.map((m) => {
          const { _id, ...clean } = m as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await ExamMarkModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving exam marks to MongoDB:', err?.message);
      }
    }
  }

  public saveExamMarksToDisk(marks: ExamMark[]): void {
    this.saveJsonData('examMarks.json', marks);
    this.saveExamMarks(marks).catch((err) => {
      console.error('[PersistentStorage] Error saving exam marks to MongoDB:', err);
    });
  }

  // --- Notices ---

  public async loadNotices(): Promise<Notice[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await NoticeModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<Notice>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying notices from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Notice[]>('notices.json', []);
  }

  public async saveNotices(noticesList: Notice[]): Promise<void> {
    if (!Array.isArray(noticesList) || noticesList.length === 0) return;
    this.saveJsonData('notices.json', noticesList);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = noticesList.map((n) => {
          const { _id, ...clean } = n as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await NoticeModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving notices to MongoDB:', err?.message);
      }
    }
  }

  public async deleteNotice(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<Notice[]>('notices.json', []);
      this.saveJsonData('notices.json', current.filter((n) => n.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        const res = await NoticeModel.deleteMany({ id });
        return (res.deletedCount || 0) > 0;
      } catch (err) {
        console.warn('[PersistentStorage] Error deleting notice from MongoDB:', err);
        return false;
      }
    }
    return true;
  }

  public async deduplicateNoticesInDb(): Promise<number> {
    try {
      if (mongoose.connection.readyState === 1) {
        const all = await NoticeModel.find().lean();
        const seenTitles = new Set<string>();
        const toDeleteIds: string[] = [];
        const sorted = (all as any[]).sort((a, b) => new Date(b.createdAt || b.publishDate || b.date || 0).getTime() - new Date(a.createdAt || a.publishDate || a.date || 0).getTime());

        for (const n of sorted) {
          const cleanTitle = (n.title || '').trim().toLowerCase();
          if (cleanTitle.includes('authoritative db verification notice') || cleanTitle.includes('unauthorized parent notice')) {
            toDeleteIds.push(n.id);
            continue;
          }
          if (
            cleanTitle.includes('annual sports meet 2026 scheduled') ||
            cleanTitle.includes('examination notice: cbse mid-term evaluation 2026') ||
            cleanTitle.includes('official results declared: cbse mid-term evaluation 2026')
          ) {
            if (seenTitles.has(cleanTitle)) {
              toDeleteIds.push(n.id);
              continue;
            }
            seenTitles.add(cleanTitle);
            continue;
          }
          if (cleanTitle) {
            if (seenTitles.has(cleanTitle)) {
              toDeleteIds.push(n.id);
              continue;
            }
            seenTitles.add(cleanTitle);
          }
        }

        if (toDeleteIds.length > 0) {
          await NoticeModel.deleteMany({ id: { $in: toDeleteIds } });
          console.log(`[PersistentStorage] Cleaned up ${toDeleteIds.length} duplicate test notices from MongoDB.`);
        }
        return toDeleteIds.length;
      }
      return 0;
    } catch (err) {
      console.warn('[PersistentStorage] Error deduplicating notices in MongoDB:', err);
      return 0;
    }
  }

  public saveNoticesToDisk(noticesList: Notice[]): void {
    this.saveJsonData('notices.json', noticesList);
    this.saveNotices(noticesList).catch((err) => {
      console.error('[PersistentStorage] Error saving notices to MongoDB:', err);
    });
  }

  // --- Homework ---

  public async loadHomework(): Promise<Homework[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await HomeworkModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<Homework>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying homework from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Homework[]>('homework.json', []);
  }

  public async saveHomework(hwList: Homework[]): Promise<void> {
    if (!Array.isArray(hwList) || hwList.length === 0) return;
    this.saveJsonData('homework.json', hwList);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = hwList.map((h) => {
          const { _id, ...clean } = h as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await HomeworkModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving homework to MongoDB:', err?.message);
      }
    }
  }

  public saveHomeworkToDisk(hwList: Homework[]): void {
    this.saveJsonData('homework.json', hwList);
    this.saveHomework(hwList).catch((err) => {
      console.error('[PersistentStorage] Error saving homework to MongoDB:', err);
    });
  }

  // --- Hostels ---

  public async loadHostels(): Promise<Hostel[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await HostelModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<Hostel>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying hostels from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<Hostel[]>('hostels.json', []);
  }

  public async saveHostels(list: Hostel[]): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    this.saveJsonData('hostels.json', list);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = list.map((h) => {
          const { _id, ...clean } = h as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await HostelModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving hostels to MongoDB:', err?.message);
      }
    }
  }

  public saveHostelsToDisk(list: Hostel[]): void {
    this.saveJsonData('hostels.json', list);
    this.saveHostels(list).catch((err) => {
      console.error('[PersistentStorage] Error saving hostels to MongoDB:', err);
    });
  }

  public async loadHostelRooms(): Promise<HostelRoom[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await HostelRoomModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<HostelRoom>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying hostel rooms from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<HostelRoom[]>('hostelRooms.json', []);
  }

  public async saveHostelRooms(list: HostelRoom[]): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    this.saveJsonData('hostelRooms.json', list);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = list.map((r) => {
          const { _id, ...clean } = r as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await HostelRoomModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving hostel rooms to MongoDB:', err?.message);
      }
    }
  }

  public saveHostelRoomsToDisk(list: HostelRoom[]): void {
    this.saveJsonData('hostelRooms.json', list);
    this.saveHostelRooms(list).catch((err) => {
      console.error('[PersistentStorage] Error saving hostel rooms to MongoDB:', err);
    });
  }

  public async deleteHostel(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<Hostel[]>('hostels.json', []);
      this.saveJsonData('hostels.json', current.filter((h) => h.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await HostelModel.deleteOne({ id });
        await HostelRoomModel.deleteMany({ hostelId: id });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting hostel from MongoDB:', err?.message);
      }
    }
  }

  public async deleteHostelRoom(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<HostelRoom[]>('hostelRooms.json', []);
      this.saveJsonData('hostelRooms.json', current.filter((r) => r.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await HostelRoomModel.deleteOne({ id });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting hostel room from MongoDB:', err?.message);
      }
    }
  }

  // --- Hostel Allocations ---

  public async loadHostelAllocations(): Promise<HostelAllocation[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await HostelAllocationModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<HostelAllocation>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying hostel allocations from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<HostelAllocation[]>('hostelAllocations.json', []);
  }

  public async saveHostelAllocations(list: HostelAllocation[]): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    this.saveJsonData('hostelAllocations.json', list);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = list.map((a) => {
          const { _id, ...clean } = a as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await HostelAllocationModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving hostel allocations to MongoDB:', err?.message);
      }
    }
  }

  public saveHostelAllocationsToDisk(list: HostelAllocation[]): void {
    this.saveJsonData('hostelAllocations.json', list);
    this.saveHostelAllocations(list).catch((err) => {
      console.error('[PersistentStorage] Error saving hostel allocations to MongoDB:', err);
    });
  }

  // --- Transport Vehicles & Routes ---

  public async loadVehicles(): Promise<TransportVehicle[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await TransportVehicleModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<TransportVehicle>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying vehicles from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<TransportVehicle[]>('vehicles.json', []);
  }

  public async saveVehicle(vehicle: TransportVehicle): Promise<void> {
    const { _id, ...clean } = vehicle as any;
    try {
      const current = this.loadJsonData<TransportVehicle[]>('vehicles.json', []);
      const idx = current.findIndex((v) => v.id === clean.id);
      if (idx !== -1) current[idx] = { ...current[idx], ...clean };
      else current.push(clean);
      this.saveJsonData('vehicles.json', current);
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await TransportVehicleModel.updateOne({ id: clean.id }, { $set: clean }, { upsert: true }).maxTimeMS(5000);
      } catch (err: any) {
        console.warn('[PersistentStorage] saveVehicle notice:', err?.message);
      }
    }
  }

  public async deleteVehicle(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<TransportVehicle[]>('vehicles.json', []);
      this.saveJsonData('vehicles.json', current.filter((v) => v.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await TransportVehicleModel.deleteMany({
          $or: [
            { id },
            ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
          ],
        }).maxTimeMS(10000);
        await TransportRouteModel.updateMany(
          { vehicleId: id },
          { $set: { vehicleId: '', vehicleNumber: '', vehicleRegNumber: '', driverName: '', driverPhone: '' } }
        ).maxTimeMS(10000).catch(() => {});
      } catch (err: any) {
        console.warn('[PersistentStorage] deleteVehicle notice:', err?.message);
      }
    }
  }

  public async saveVehicles(list: TransportVehicle[]): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    this.saveJsonData('vehicles.json', list);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = list.map((v) => {
          const { _id, ...clean } = v as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await TransportVehicleModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving vehicles to MongoDB:', err?.message);
      }
    }
  }

  public saveVehiclesToDisk(list: TransportVehicle[]): void {
    this.saveJsonData('vehicles.json', list);
    this.saveVehicles(list).catch((err) => {
      console.error('[PersistentStorage] Error saving vehicles to MongoDB:', err);
    });
  }

  public async loadRoutes(): Promise<TransportRoute[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await TransportRouteModel.find().lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<TransportRoute>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying routes from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<TransportRoute[]>('routes.json', []);
  }

  public async saveRoute(route: TransportRoute): Promise<void> {
    const { _id, ...clean } = route as any;
    try {
      const current = this.loadJsonData<TransportRoute[]>('routes.json', []);
      const idx = current.findIndex((r) => r.id === clean.id);
      if (idx !== -1) current[idx] = { ...current[idx], ...clean };
      else current.push(clean);
      this.saveJsonData('routes.json', current);
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await TransportRouteModel.updateOne({ id: clean.id }, { $set: clean }, { upsert: true }).maxTimeMS(5000);
      } catch (err: any) {
        console.warn('[PersistentStorage] saveRoute notice:', err?.message);
      }
    }
  }

  public async deleteRoute(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<TransportRoute[]>('routes.json', []);
      this.saveJsonData('routes.json', current.filter((r) => r.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await TransportRouteModel.deleteMany({
          $or: [
            { id },
            ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
          ],
        }).maxTimeMS(10000);
      } catch (err: any) {
        console.warn('[PersistentStorage] deleteRoute notice:', err?.message);
      }
    }
  }

  public async saveRoutes(list: TransportRoute[]): Promise<void> {
    if (!Array.isArray(list) || list.length === 0) return;
    this.saveJsonData('routes.json', list);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = list.map((r) => {
          const { _id, ...clean } = r as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await TransportRouteModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving routes to MongoDB:', err?.message);
      }
    }
  }

  public saveRoutesToDisk(list: TransportRoute[]): void {
    this.saveJsonData('routes.json', list);
    this.saveRoutes(list).catch((err) => {
      console.error('[PersistentStorage] Error saving routes to MongoDB:', err);
    });
  }

  // --- Audit Logs ---

  public cleanAuditLog(d: any): AuditLog {
    const raw = this.cleanDoc<any>(d);
    return {
      id: raw.id || (raw._id ? raw._id.toString() : `log-${Date.now()}`),
      timestamp: raw.timestamp || raw.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
      userName: raw.userName || raw.performedByName || 'System User',
      role: (raw.role || raw.userRole || 'SUPER_ADMIN') as any,
      action: raw.action || 'OPERATION',
      entity: raw.entity || 'System',
      entityId: raw.entityId || 'general',
      ipAddress: raw.ipAddress || '127.0.0.1',
      details: raw.details || '',
    };
  }

  public async loadAuditLogs(): Promise<AuditLog[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await AuditLogModel.find().sort({ timestamp: -1 }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanAuditLog(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying audit logs from MongoDB:', err?.message);
      }
    }
    const diskLogs = this.loadJsonData<AuditLog[]>('auditLogs.json', []);
    return diskLogs.map((l) => this.cleanAuditLog(l));
  }

  public async getAuditLogsPaginated(options: {
    page?: number;
    pageSize?: number;
    search?: string;
    entity?: string;
    action?: string;
    role?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: AuditLog[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = Math.max(1, Number(options.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(options.pageSize) || 25));
    const skip = (page - 1) * pageSize;
    const sortBy = options.sortBy || 'timestamp';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (options.entity && options.entity !== 'ALL') {
          filter.entity = options.entity;
        }
        if (options.action && options.action !== 'ALL') {
          filter.action = options.action;
        }
        if (options.role && options.role !== 'ALL') {
          filter.$or = [{ role: options.role }, { userRole: options.role }];
        }
        if (options.dateFrom) {
          filter.timestamp = { ...(filter.timestamp || {}), $gte: options.dateFrom };
        }
        if (options.dateTo) {
          filter.timestamp = { ...(filter.timestamp || {}), $lte: options.dateTo + ' 23:59:59' };
        }
        if (options.search && options.search.trim()) {
          const searchRegex = new RegExp(options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const searchClause = [
            { userName: searchRegex },
            { action: searchRegex },
            { entity: searchRegex },
            { details: searchRegex },
            { ipAddress: searchRegex },
          ];
          if (filter.$or) {
            filter.$and = [{ $or: filter.$or }, { $or: searchClause }];
            delete filter.$or;
          } else {
            filter.$or = searchClause;
          }
        }

        const total = await AuditLogModel.countDocuments(filter);
        const docs = await AuditLogModel.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(pageSize)
          .lean();

        const data = (docs || []).map((d) => this.cleanAuditLog(d));
        const totalPages = Math.ceil(total / pageSize) || 1;

        return {
          data,
          pagination: {
            total,
            page,
            pageSize,
            limit: pageSize,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice in MongoDB paginated audit logs query:', err?.message);
      }
    }

    // Fallback to memory / disk store with identical logic
    const allLogs = this.loadJsonData<AuditLog[]>('auditLogs.json', []);
    let filtered = [...allLogs].map((l) => this.cleanAuditLog(l));

    if (options.entity && options.entity !== 'ALL') {
      filtered = filtered.filter((l) => l.entity === options.entity);
    }
    if (options.action && options.action !== 'ALL') {
      filtered = filtered.filter((l) => l.action === options.action);
    }
    if (options.role && options.role !== 'ALL') {
      filtered = filtered.filter((l) => (l.role || (l as any).userRole) === options.role);
    }
    if (options.dateFrom) {
      filtered = filtered.filter((l) => (l.timestamp || '') >= options.dateFrom!);
    }
    if (options.dateTo) {
      const dateToBoundary = options.dateTo + ' 23:59:59';
      filtered = filtered.filter((l) => (l.timestamp || '') <= dateToBoundary);
    }
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          (l.userName || '').toLowerCase().includes(q) ||
          (l.action || '').toLowerCase().includes(q) ||
          (l.entity || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q) ||
          (l.ipAddress || '').toLowerCase().includes(q)
      );
    }

    filtered.sort((a: any, b: any) => {
      const valA = String(a[sortBy] || '');
      const valB = String(b[sortBy] || '');
      return sortOrder === 1 ? valA.localeCompare(valB) : valB.localeCompare(a[sortBy] || '');
    });

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + pageSize);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: paginated,
      pagination: {
        total,
        page,
        pageSize,
        limit: pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public async saveAuditLogs(logs: AuditLog[]): Promise<void> {
    if (!Array.isArray(logs) || logs.length === 0) return;
    this.saveJsonData('auditLogs.json', logs);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = logs.map((l) => {
          const { _id, ...clean } = l as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await AuditLogModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving audit logs to MongoDB:', err?.message);
      }
    }
  }

  public saveAuditLogsToDisk(logs: AuditLog[]): void {
    if (!Array.isArray(logs) || logs.length === 0) return;
    // With MongoDB (production) only the NEW entries are written. Rewriting every log to the JSON file and
    // re-upserting all of them into MongoDB on each new entry made every action slower as the log grew.
    if (mongoose.connection.readyState === 1) {
      const ops = logs.map((l) => {
        // The full entry, including metadata (category, severity, before / after changes).
        const { _id, ...clean } = { ...(l as any), ...this.cleanAuditLog(l), ...((l as any).metadata ? { metadata: (l as any).metadata } : {}) };
        return { updateOne: { filter: { id: clean.id }, update: { $set: clean }, upsert: true } };
      });
      AuditLogModel.bulkWrite(ops, { ordered: false }).catch((err: any) => {
        console.error('[PersistentStorage] Error saving audit logs to MongoDB:', err?.message || err);
      });
      return;
    }
    // Local preview without MongoDB: the JSON file is the store. Merge so past logs are never lost.
    const existing = this.loadJsonData<AuditLog[]>('auditLogs.json', []);
    const mergedMap = new Map<string, AuditLog>();
    for (const l of existing) {
      if (l && l.id) mergedMap.set(l.id, this.cleanAuditLog(l));
    }
    for (const l of logs) {
      if (l && l.id) mergedMap.set(l.id, this.cleanAuditLog(l));
    }
    const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
      (b.timestamp || '').localeCompare(a.timestamp || '')
    );
    this.saveJsonData('auditLogs.json', mergedList);
  }

  /** Removes archived audit entries (by id) from the local JSON store. MongoDB is cleaned by the caller. */
  public removeAuditLogsFromDisk(ids: Set<string>): void {
    if (!ids.size) return;
    const existing = this.loadJsonData<AuditLog[]>('auditLogs.json', []);
    const kept = existing.filter((l) => l && !ids.has(l.id));
    if (kept.length !== existing.length) this.saveJsonData('auditLogs.json', kept);
  }

  // --- Admin & Parent Accounts ---

  public async loadAdminAccounts(): Promise<AdminAccount[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await UserModel.find({ userType: 'ADMIN' }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<AdminAccount>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying admin accounts from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<AdminAccount[]>('adminAccounts.json', []);
  }

  public async saveAdminAccounts(admins: AdminAccount[]): Promise<void> {
    if (!Array.isArray(admins) || admins.length === 0) return;
    this.saveJsonData('adminAccounts.json', admins);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = admins.map((a) => {
          const { _id, ...clean } = a as any;
          if (!clean.passwordHash) {
            delete clean.passwordHash;
          }
          return {
            updateOne: {
              filter: { id: clean.id },
              update: {
                $set: {
                  ...clean,
                  userType: 'ADMIN',
                  status: clean.status || 'ACTIVE',
                  loginEnabled: clean.loginEnabled !== false,
                },
              },
              upsert: true,
            },
          };
        });
        await UserModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving admin accounts to MongoDB:', err?.message);
      }
    }
  }

  public saveAdminAccountsToDisk(admins: AdminAccount[]): void {
    this.saveJsonData('adminAccounts.json', admins);
    this.saveAdminAccounts(admins).catch((err) => {
      console.error('[PersistentStorage] Error saving admin accounts to MongoDB:', err);
    });
  }

  public async deleteAdminAccount(id: string): Promise<void> {
    try {
      const current = this.loadJsonData<AdminAccount[]>('adminAccounts.json', []);
      this.saveJsonData('adminAccounts.json', current.filter((a) => a.id !== id));
    } catch {}

    if (mongoose.connection.readyState === 1) {
      try {
        await UserModel.deleteOne({ userType: 'ADMIN', id });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting admin account from MongoDB:', err?.message);
      }
    }
  }

  public deleteAdminAccountFromDisk(id: string): void {
    this.deleteAdminAccount(id).catch((err) => {
      console.error('[PersistentStorage] Error deleting admin account from MongoDB:', err);
    });
  }

  public async loadParentAccounts(): Promise<ParentAccount[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await UserModel.find({ userType: 'PARENT' }).lean();
        if (docs && docs.length > 0) {
          return docs.map((d) => this.cleanDoc<ParentAccount>(d));
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying parent accounts from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<ParentAccount[]>('parentAccounts.json', []);
  }

  public async saveParentAccounts(parents: ParentAccount[]): Promise<void> {
    if (!Array.isArray(parents) || parents.length === 0) return;
    this.saveJsonData('parentAccounts.json', parents);
    if (mongoose.connection.readyState === 1) {
      try {
        const ops = parents.map((p) => {
          const { _id, ...clean } = p as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: { ...clean, userType: 'PARENT' } },
              upsert: true,
            },
          };
        });
        await UserModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving parent accounts to MongoDB:', err?.message);
      }
    }
  }

  public saveParentAccountsToDisk(parents: ParentAccount[]): void {
    this.saveJsonData('parentAccounts.json', parents);
    this.saveParentAccounts(parents).catch((err) => {
      console.error('[PersistentStorage] Error saving parent accounts to MongoDB:', err);
    });
  }

  // --- Connection Resilience & Auto-Reconnect ---
  public async ensureConnected(): Promise<void> {
    if (this.isReady() || this.mongoFailedPermanently) return;
    if (this.isConnecting) return;

    const rawUri = process.env.MONGODB_URI;
    if (!rawUri || !rawUri.trim()) return;

    const now = Date.now();
    if (now - this.lastConnectAttempt < 60000) return;
    this.lastConnectAttempt = now;

    this.isConnecting = true;
    try {
      const cleanUri = sanitizeMongoUri(rawUri);
      if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
        await mongoose.connect(cleanUri, {
          dbName: 'cps_school_erp',
          maxPoolSize: 20,
          minPoolSize: 2,
          maxIdleTimeMS: 45000,
          socketTimeoutMS: 45000,
          serverSelectionTimeoutMS: 2500,
          heartbeatFrequencyMS: 10000,
          autoIndex: false,
        });
        console.log('[PersistentStorage] Reconnected to MongoDB Atlas successfully.');
      }
      await mongoService.ensureConnected().catch(() => {});
    } catch (e: any) {
      if (e?.message?.includes('Authentication failed') || e?.message?.includes('bad auth')) {
        this.mongoFailedPermanently = true;
      }
      console.warn('[PersistentStorage] Background reconnect note:', e?.message);
    } finally {
      this.isConnecting = false;
    }
  }

  // --- Public Website Models ---

  public async loadFacilities(): Promise<any[]> {
    if (this.isReady()) {
      try {
        const docs = await FacilityModel.find().sort({ displayOrder: 1 }).lean();
        if (docs && docs.length > 0) return docs.map((d) => this.cleanDoc(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying facilities from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('facilities.json', []);
  }

  public async saveFacilities(facilities: any[]): Promise<void> {
    if (!Array.isArray(facilities)) return;
    this.saveJsonData('facilities.json', facilities);
    if (this.isReady()) {
      try {
        if (facilities.length === 0) {
          await FacilityModel.deleteMany({});
          return;
        }
        const currentIds = facilities.map((f) => f.id).filter(Boolean);
        if (currentIds.length > 0) {
          await FacilityModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = facilities.map((f) => {
          const { _id, __v, ...clean } = f as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await FacilityModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving facilities to MongoDB:', err?.message);
      }
    }
  }

  public saveFacilitiesToDisk(facilities: any[]): void {
    this.saveJsonData('facilities.json', facilities);
    this.saveFacilities(facilities).catch((err) => {
      console.error('[PersistentStorage] Error saving facilities to MongoDB:', err);
    });
  }

  public async deleteFacility(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<any[]>('facilities.json', []);
      this.saveJsonData('facilities.json', current.filter((f) => f.id !== id));
    } catch {}

    if (this.isReady()) {
      try {
        const res = await FacilityModel.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting facility from MongoDB:', err?.message);
      }
    }
    return true;
  }

  public async loadGallery(): Promise<any[]> {
    if (this.isReady()) {
      try {
        const docs = await GalleryItemModel.find().sort({ displayOrder: 1 }).lean();
        if (docs && docs.length > 0) return docs.map((d) => this.cleanDoc(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying gallery from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('gallery.json', []);
  }

  public async saveGallery(gallery: any[]): Promise<void> {
    if (!Array.isArray(gallery)) return;
    this.saveJsonData('gallery.json', gallery);
    if (this.isReady()) {
      try {
        if (gallery.length === 0) {
          await GalleryItemModel.deleteMany({});
          return;
        }
        const currentIds = gallery.map((g) => g.id).filter(Boolean);
        if (currentIds.length > 0) {
          await GalleryItemModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = gallery.map((g) => {
          const { _id, __v, ...clean } = g as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await GalleryItemModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving gallery to MongoDB:', err?.message);
      }
    }
  }

  public saveGalleryToDisk(gallery: any[]): void {
    this.saveJsonData('gallery.json', gallery);
    this.saveGallery(gallery).catch((err) => {
      console.error('[PersistentStorage] Error saving gallery to MongoDB:', err);
    });
  }

  public async deleteGalleryItem(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<any[]>('gallery.json', []);
      this.saveJsonData('gallery.json', current.filter((g) => g.id !== id));
    } catch {}

    if (this.isReady()) {
      try {
        const res = await GalleryItemModel.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting gallery item from MongoDB:', err?.message);
      }
    }
    return true;
  }

  public async loadAdmissionEnquiries(): Promise<any[]> {
    if (this.isReady()) {
      try {
        const docs = await AdmissionEnquiryModel.find().sort({ submittedAt: -1 }).lean();
        if (docs && docs.length > 0) return docs.map((d) => this.cleanDoc(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying admission enquiries from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('admissionEnquiries.json', []);
  }

  public async saveAdmissionEnquiries(enquiries: any[]): Promise<void> {
    if (!Array.isArray(enquiries)) return;
    this.saveJsonData('admissionEnquiries.json', enquiries);
    if (this.isReady()) {
      try {
        if (enquiries.length === 0) {
          await AdmissionEnquiryModel.deleteMany({});
          return;
        }
        const currentIds = enquiries.map((e) => e.id).filter(Boolean);
        if (currentIds.length > 0) {
          await AdmissionEnquiryModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = enquiries.map((e) => {
          const { _id, __v, ...clean } = e as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await AdmissionEnquiryModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving admission enquiries to MongoDB:', err?.message);
      }
    }
  }

  public saveAdmissionEnquiriesToDisk(enquiries: any[]): void {
    this.saveJsonData('admissionEnquiries.json', enquiries);
    this.saveAdmissionEnquiries(enquiries).catch((err) => {
      console.error('[PersistentStorage] Error saving admission enquiries to MongoDB:', err);
    });
  }

  public async deleteAdmissionEnquiry(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<any[]>('admissionEnquiries.json', []);
      this.saveJsonData('admissionEnquiries.json', current.filter((e) => e.id !== id));
    } catch {}

    if (this.isReady()) {
      try {
        const res = await AdmissionEnquiryModel.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting enquiry from MongoDB:', err?.message);
      }
    }
    return true;
  }

  public async loadHeroSlides(): Promise<any[]> {
    if (this.isReady()) {
      try {
        const docs = await HeroSlideModel.find().sort({ displayOrder: 1 }).lean();
        if (docs && docs.length > 0) return docs.map((d) => this.cleanDoc(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying hero slides from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('heroSlides.json', []);
  }

  public async saveHeroSlides(slides: any[]): Promise<void> {
    if (!Array.isArray(slides)) return;
    this.saveJsonData('heroSlides.json', slides);
    if (this.isReady()) {
      try {
        if (slides.length === 0) {
          await HeroSlideModel.deleteMany({});
          return;
        }
        const currentIds = slides.map((s) => s.id).filter(Boolean);
        if (currentIds.length > 0) {
          await HeroSlideModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = slides.map((s) => {
          const { _id, __v, ...clean } = s as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await HeroSlideModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving hero slides to MongoDB:', err?.message);
      }
    }
  }

  public saveHeroSlidesToDisk(slides: any[]): void {
    this.saveJsonData('heroSlides.json', slides);
    this.saveHeroSlides(slides).catch((err) => {
      console.error('[PersistentStorage] Error saving hero slides to MongoDB:', err);
    });
  }

  public async deleteHeroSlide(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<any[]>('heroSlides.json', []);
      this.saveJsonData('heroSlides.json', current.filter((s) => s.id !== id));
    } catch {}

    if (this.isReady()) {
      try {
        const res = await HeroSlideModel.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting hero slide from MongoDB:', err?.message);
      }
    }
    return true;
  }

  public async loadLeadership(): Promise<any[]> {
    if (this.isReady()) {
      try {
        const docs = await LeadershipProfileModel.find().sort({ displayOrder: 1 }).lean();
        if (docs && docs.length > 0) return docs.map((d) => this.cleanDoc(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying leadership from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('leadership.json', []);
  }

  public async saveLeadership(leadership: any[]): Promise<void> {
    if (!Array.isArray(leadership)) return;
    this.saveJsonData('leadership.json', leadership);
    if (this.isReady()) {
      try {
        if (leadership.length === 0) {
          await LeadershipProfileModel.deleteMany({});
          return;
        }
        const currentIds = leadership.map((l) => l.id).filter(Boolean);
        if (currentIds.length > 0) {
          await LeadershipProfileModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = leadership.map((l) => {
          const { _id, __v, ...clean } = l as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await LeadershipProfileModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving leadership to MongoDB:', err?.message);
      }
    }
  }

  public saveLeadershipToDisk(leadership: any[]): void {
    this.saveJsonData('leadership.json', leadership);
    this.saveLeadership(leadership).catch((err) => {
      console.error('[PersistentStorage] Error saving leadership to MongoDB:', err);
    });
  }

  public async deleteLeadership(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<any[]>('leadership.json', []);
      this.saveJsonData('leadership.json', current.filter((l) => l.id !== id));
    } catch {}

    if (this.isReady()) {
      try {
        const res = await LeadershipProfileModel.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting leadership profile from MongoDB:', err?.message);
      }
    }
    return true;
  }

  public async loadEvents(): Promise<any[]> {
    if (this.isReady()) {
      try {
        let docs = await WebsiteEventModel.find().sort({ displayOrder: 1 }).lean();
        if (docs && docs.length > 0) return docs.map((d) => this.cleanDoc(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying events from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('events.json', []);
  }

  public async saveEvents(events: any[]): Promise<void> {
    if (!Array.isArray(events)) return;
    this.saveJsonData('events.json', events);
    if (this.isReady()) {
      try {
        if (events.length === 0) {
          await WebsiteEventModel.deleteMany({});
          return;
        }
        const currentIds = events.map((e) => e.id).filter(Boolean);
        if (currentIds.length > 0) {
          await WebsiteEventModel.deleteMany({ id: { $nin: currentIds } });
        }
        const ops = events.map((e) => {
          const { _id, __v, ...clean } = e as any;
          return {
            updateOne: {
              filter: { id: clean.id },
              update: { $set: clean },
              upsert: true,
            },
          };
        });
        await WebsiteEventModel.bulkWrite(ops, { ordered: false });
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving events to MongoDB:', err?.message);
      }
    }
  }

  public saveEventsToDisk(events: any[]): void {
    this.saveJsonData('events.json', events);
    this.saveEvents(events).catch((err) => {
      console.error('[PersistentStorage] Error saving events to MongoDB:', err);
    });
  }

  public async deleteEvent(id: string): Promise<boolean> {
    try {
      const current = this.loadJsonData<any[]>('events.json', []);
      this.saveJsonData('events.json', current.filter((e) => e.id !== id));
    } catch {}

    if (this.isReady()) {
      try {
        const res = await WebsiteEventModel.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice deleting event from MongoDB:', err?.message);
      }
    }
    return true;
  }

  public async loadWebsiteContent(): Promise<any> {
    if (this.isReady()) {
      try {
        const doc = await WebsiteContentModel.findOne({ singleRecord: true }).lean();
        if (doc) {
          return this.cleanDoc(doc);
        }
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying website content from MongoDB:', err?.message);
      }
    }
    const fromJson = this.loadJsonData<any>('websiteContent.json', null);
    if (fromJson) {
      return fromJson;
    }
    return {
      singleRecord: true,
      aboutSchool: 'A co-educational school in Kushahar, Sheohar, Bihar, offering Classes 1 to 8.',
      vision: 'To foster visionary leaders grounded in values, curiosity, and global perspective.',
      visionStatement: 'To foster visionary leaders grounded in values, curiosity, and global perspective.',
      visionPoints: [
        'Academic excellence through holistic and inquiry-based pedagogy.',
        'Character building anchored in discipline, empathy, and integrity.',
        'Modern scientific acumen with traditional Indian moral values.'
      ],
      mission: 'To empower students through holistic education and rigorous scholarship.',
      missionStatement: 'To empower students through holistic education and rigorous scholarship.',
      missionPoints: [
        'Strong basics in Mathematics, Science and Social Science.',
        'Computer education, Music, Dance and Yoga alongside academics.',
        'Caring teachers and a safe, supportive school environment.'
      ],
      chairmanMessage: '',
      principalMessage: '',
      academicsOverview: 'Classes 1 to 8, following the State curriculum in primary classes and NCERT in upper primary classes.',
      hostelOverview: '',
    };
  }

  public async saveWebsiteContent(content: any): Promise<void> {
    const { _id, ...clean } = content as any;
    this.saveJsonData('websiteContent.json', clean);
    if (this.isReady()) {
      try {
        await WebsiteContentModel.findOneAndUpdate(
          { singleRecord: true },
          { $set: { ...clean, singleRecord: true } },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice saving website content to MongoDB:', err?.message);
      }
    }
  }

  public saveWebsiteContentToDisk(content: any): void {
    this.saveJsonData('websiteContent.json', content);
    this.saveWebsiteContent(content).catch((err) => {
      console.error('[PersistentStorage] Error saving website content to MongoDB:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Online payments (PhonePe): payment orders, webhook events, and the atomic settlement write
  // ---------------------------------------------------------------------------

  private stripMongo<T>(doc: any): T {
    const { _id, __v, dbCreatedAt, dbUpdatedAt, ...rest } = doc || {};
    return rest as T;
  }

  public async loadPaymentOrders(): Promise<any[]> {
    if (this.isReady()) {
      try {
        const docs = await PaymentOrderModel.find().lean();
        return docs.map((d: any) => this.stripMongo(d));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying payment orders from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('paymentOrders.json', []);
  }

  /** Upserts one payment-order record. Never downgrades a SUCCESS/REFUNDED order in the database. */
  public async savePaymentOrder(order: any): Promise<void> {
    if (!this.isReady()) return;
    const clean = this.stripMongo<any>(order);
    try {
      const terminal = clean.status === 'SUCCESS' || clean.status === 'REFUNDED';
      const filter: any = terminal ? { orderId: clean.orderId } : { orderId: clean.orderId, status: { $nin: ['SUCCESS', 'REFUNDED'] } };
      const r = await PaymentOrderModel.updateOne(filter, { $set: clean }, { upsert: false });
      if (r.matchedCount === 0) {
        await PaymentOrderModel.updateOne({ orderId: clean.orderId }, { $setOnInsert: clean }, { upsert: true });
      }
    } catch (err: any) {
      console.error('[PersistentStorage] Payment order NOT saved to MongoDB:', err?.message);
    }
  }

  public async findPaymentOrderInDb(orderId: string): Promise<any | null> {
    if (!this.isReady()) return null;
    try {
      const doc = await PaymentOrderModel.findOne({ orderId }).lean();
      return doc ? this.stripMongo(doc) : null;
    } catch {
      return null;
    }
  }

  public async loadProcessedWebhookEventIds(): Promise<string[]> {
    if (this.isReady()) {
      try {
        const docs = await PaymentWebhookEventModel.find({}, { eventId: 1 }).sort({ receivedAt: -1 }).limit(20000).lean();
        return docs.map((d: any) => String(d.eventId));
      } catch (err: any) {
        console.warn('[PersistentStorage] Notice querying webhook events from MongoDB:', err?.message);
      }
    }
    return this.loadJsonData<any[]>('paymentWebhookEvents.json', []).map((e: any) => String(e.eventId));
  }

  public async isWebhookEventProcessed(eventId: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      return !!(await PaymentWebhookEventModel.exists({ eventId }));
    } catch {
      return false;
    }
  }

  /** Records a processed webhook event. Returns false if it was already recorded (a retry or a duplicate). */
  public async recordWebhookEvent(event: any, jsonLog: any[]): Promise<boolean> {
    this.saveJsonData('paymentWebhookEvents.json', jsonLog.slice(-5000));
    if (!this.isReady()) return true;
    try {
      await PaymentWebhookEventModel.create(this.stripMongo(event));
      return true;
    } catch (err: any) {
      if (err?.code === 11000) return false;
      console.error('[PersistentStorage] Webhook event NOT saved to MongoDB:', err?.message);
      return true;
    }
  }

  /**
   * Indexes that stop the same payment order / completed transaction / webhook delivery from being stored twice.
   * Built without touching existing data: if old duplicates already exist, the index is skipped and logged for
   * the accounts office instead of anything being deleted. Old receipts keep their own fields untouched.
   */
  public async ensureOnlinePaymentIndexes(): Promise<void> {
    if (!this.isReady()) return;
    const attempt = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        console.log(`[PersistentStorage] Index ready: ${label}`);
      } catch (err: any) {
        console.error(`[PersistentStorage] Index NOT created (${label}): ${err?.message}. Existing records were left untouched; check for duplicates.`);
      }
    };
    await attempt('payment_orders', () => PaymentOrderModel.createIndexes());
    await attempt('payment_webhook_events', () => PaymentWebhookEventModel.createIndexes());
    await attempt('fee_payments.merchantOrderId (unique)', () =>
      FeePaymentModel.collection.createIndex(
        { merchantOrderId: 1 },
        { unique: true, name: 'uniq_merchant_order', partialFilterExpression: { merchantOrderId: { $type: 'string', $gt: '' } } }
      )
    );
  }

  /**
   * Writes one verified online payment in a single MongoDB transaction when the cluster supports it (Atlas
   * replica sets do): the order is claimed for this payment id, the bills are updated, the receipt is
   * inserted. Any duplicate (same payment id already booked) aborts the whole write.
   * On a standalone server without transactions, the same steps run in order, guarded by the conditional
   * claim on the order and the unique indexes, and reconciliation repairs anything left half-written.
   */
  public async commitOnlineSettlement(input: { order: any; ledgers: any[]; payment: any | null }): Promise<'transaction' | 'sequential' | 'local'> {
    if (!this.isReady()) return 'local';
    const order = this.stripMongo<any>(input.order);
    const run = async (session?: mongoose.ClientSession) => {
      const opts: any = session ? { session } : {};
      const claim = await PaymentOrderModel.updateOne(
        {
          orderId: order.orderId,
          status: { $ne: 'REFUNDED' },
          $or: [{ paymentId: { $exists: false } }, { paymentId: null }, { paymentId: order.paymentId }],
        },
        { $set: order },
        opts
      );
      if (claim.matchedCount === 0) {
        const existing = await PaymentOrderModel.findOne({ orderId: order.orderId }, null, opts).lean();
        if (existing) {
          const err: any = new Error(`Order ${order.orderId} was already settled by payment ${(existing as any).paymentId}`);
          err.code = 'SETTLEMENT_CONFLICT';
          throw err;
        }
        await PaymentOrderModel.create([order], opts);
      }
      if (input.ledgers.length) {
        await FeeLedgerModel.bulkWrite(
          input.ledgers.map((l) => {
            const clean = this.stripMongo<any>(l);
            return { updateOne: { filter: { id: clean.id }, update: { $set: clean }, upsert: true } };
          }),
          { ordered: true, ...opts }
        );
      }
      if (input.payment) {
        const { merchantOrderId, ...rest } = this.stripMongo<any>(input.payment);
        const r = await FeePaymentModel.updateOne({ merchantOrderId }, { $setOnInsert: rest }, { upsert: true, ...opts });
        if (!r.upsertedCount) {
          const err: any = new Error(`Order ${merchantOrderId} already has a receipt`);
          err.code = 'SETTLEMENT_CONFLICT';
          throw err;
        }
      }
    };
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(() => run(session!));
      return 'transaction';
    } catch (err: any) {
      const msg = String(err?.message || '');
      const unsupported = err?.code === 20 || /Transaction numbers are only allowed|replica set|does not support transactions/i.test(msg);
      if (!unsupported) throw err;
    } finally {
      try { await session?.endSession(); } catch { /* ignore */ }
    }
    await run();
    return 'sequential';
  }

}

export const persistentStorage = new PersistentStorageManager();
