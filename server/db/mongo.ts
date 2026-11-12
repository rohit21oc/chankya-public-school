import { MongoClient, Db, Collection, Binary, ObjectId } from 'mongodb';
import type { Student, UserWithAuth, R2FileMetadata, SchoolSettings, StudyMaterial } from '../../src/types/index.ts';

export interface MongoConnectionStatus {
  configured: boolean;
  connected: boolean;
  databaseName?: string;
  error?: string;
  lastAttemptAt: string;
  activeStorage: 'MONGODB' | 'IN_MEMORY_FALLBACK';
  architecture: 'SINGLE_SCHOOL_CENTRAL_DB';
}

/**
 * Sanitizes and normalizes a MongoDB URI string.
 * Trims extraneous outer quotes, whitespace, and decodes/trims accidental trailing
 * or leading spaces in username or password (e.g. "user%20:pass@...").
 */
export function sanitizeMongoUri(rawUri?: string): string {
  if (!rawUri || !rawUri.trim()) return '';
  let uri = rawUri.trim();

  // Strip surrounding quotes if present
  if (
    (uri.startsWith('"') && uri.endsWith('"')) ||
    (uri.startsWith("'") && uri.endsWith("'"))
  ) {
    uri = uri.slice(1, -1).trim();
  }

  try {
    const parsed = new URL(uri);
    if (parsed.username) {
      const decodedUser = decodeURIComponent(parsed.username).trim();
      parsed.username = encodeURIComponent(decodedUser);
    }
    if (parsed.password) {
      const decodedPass = decodeURIComponent(parsed.password).trim();
      parsed.password = encodeURIComponent(decodedPass);
    }
    return parsed.toString();
  } catch {
    // Regex fallback if URL parsing fails on custom protocol
    return uri.replace(
      /^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/i,
      (_, proto, user, pass) => {
        const cleanUser = encodeURIComponent(decodeURIComponent(user).trim());
        const cleanPass = encodeURIComponent(decodeURIComponent(pass).trim());
        return `${proto}${cleanUser}:${cleanPass}@`;
      }
    );
  }
}

class MongoService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private status: MongoConnectionStatus = {
    configured: false,
    connected: false,
    lastAttemptAt: new Date().toISOString(),
    activeStorage: 'IN_MEMORY_FALLBACK',
    architecture: 'SINGLE_SCHOOL_CENTRAL_DB',
  };

  constructor() {
    this.init();
  }

  public async ping(): Promise<boolean> {
    if (!this.db || !this.client) return false;
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  public async ensureConnected(): Promise<boolean> {
    if (this.isConnected() && this.db && this.client) {
      const alive = await this.ping();
      if (alive) return true;
      console.warn('[MongoDB] Stale connection detected by ping. Reconnecting...');
    }
    if (this.isConnecting) {
      let waited = 0;
      while (this.isConnecting && waited < 30) {
        await new Promise((r) => setTimeout(r, 100));
        waited++;
      }
      return this.isConnected();
    }
    const stat = await this.init();
    return stat.connected;
  }

  public async init(): Promise<MongoConnectionStatus> {
    if (this.isConnecting) return this.status;
    this.isConnecting = true;
    const rawUri = process.env.MONGODB_URI;
    this.status.lastAttemptAt = new Date().toISOString();

    const sanitizedUri = sanitizeMongoUri(rawUri);

    if (!sanitizedUri) {
      this.status.configured = false;
      this.status.connected = false;
      this.status.error = 'MONGODB_URI environment variable is not defined';
      this.status.activeStorage = 'IN_MEMORY_FALLBACK';
      this.isConnecting = false;
      console.warn('[MongoDB] MONGODB_URI is not set. Operating in IN_MEMORY_FALLBACK mode for single school campus.');
      return this.status;
    }

    this.status.configured = true;

    try {
      if (this.client) {
        try {
          await this.client.close();
        } catch {}
        this.client = null;
        this.db = null;
      }

      console.log('[MongoDB] Connecting to centralized school database...');
      this.client = new MongoClient(sanitizedUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        maxPoolSize: 20,
        minPoolSize: 2,
        maxIdleTimeMS: 45000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
      });

      await this.client.connect();
      const parsedDbName =
        this.client.options.dbName && this.client.options.dbName !== 'test'
          ? this.client.options.dbName
          : 'pds_school_erp';
      this.db = this.client.db(parsedDbName);

      this.status.connected = true;
      this.status.databaseName = parsedDbName;
      this.status.error = undefined;
      this.status.activeStorage = 'MONGODB';

      // Start periodic 30-second keepalive ping to prevent idle connection closure from cloud NAT/routers
      if (!this.keepAliveTimer) {
        this.keepAliveTimer = setInterval(async () => {
          try {
            if (this.db) {
              await this.db.command({ ping: 1 });
            } else {
              await this.ensureConnected();
            }
          } catch (e: any) {
            console.warn('[MongoDB] Keepalive ping failed, triggering reconnect:', e?.message);
            await this.ensureConnected();
          }
        }, 30000);
      }

      // Ensure single-school database indexes in the background without blocking connection
      Promise.all([
        this.db.collection('students').createIndex({ id: 1 }, { unique: true, sparse: true }),
        this.db.collection('students').createIndex({ admissionNumber: 1 }, { unique: true, sparse: true }),
        this.db.collection('students').createIndex({ classId: 1, section: 1, rollNumber: 1 }),
        this.db.collection('users').createIndex({ username: 1 }, { unique: true }),
        this.db.collection('users').createIndex({ email: 1 }),
        this.db.collection('users').createIndex({ role: 1 }),
        this.db.collection('file_metadata').createIndex({ fileKey: 1 }, { unique: true }),
        this.db.collection('file_metadata').createIndex({ folder: 1 }),
        this.db.collection('file_metadata').createIndex({ 'associatedEntity.id': 1 }),
        this.db.collection('study_materials').createIndex({ id: 1 }, { unique: true }),
        this.db.collection('study_materials').createIndex({ fileKey: 1 }),
        this.db.collection('file_binaries').createIndex({ fileKey: 1 }, { unique: true }),
      ]).catch((idxErr: any) => {
        console.warn('[MongoDB] Non-critical index setup note:', idxErr?.message);
      });

      console.log(`[MongoDB] Connected successfully to single-school database: ${parsedDbName}`);
    } catch (err: any) {
      this.status.connected = false;
      this.status.error = err?.message || 'Failed to connect to MongoDB cluster';
      this.status.activeStorage = 'IN_MEMORY_FALLBACK';
      if (this.client) {
        try {
          await this.client.close();
        } catch {
          // ignore
        }
        this.client = null;
      }
      this.db = null;
      console.warn(`[MongoDB] Connection notice: ${this.status.error}. Operating with high-performance in-memory fallback.`);
    } finally {
      this.isConnecting = false;
    }

    return this.status;
  }

  public getStatus(): MongoConnectionStatus {
    return { ...this.status };
  }

  public isConnected(): boolean {
    return this.status.connected && !!this.db && !!this.client;
  }

  public async close(): Promise<void> {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.status.connected = false;
    }
  }

  public async getStudents(filter: Record<string, any> = {}): Promise<Student[] | null> {
    await this.ensureConnected();
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection: Collection<Student> = this.db.collection('students');
      const docs = await collection.find(filter).toArray();
      return docs.map((doc: any) => {
        const { _id, ...clean } = doc;
        return clean as Student;
      });
    } catch (err) {
      console.warn('[MongoDB] Error querying students:', err);
      return null;
    }
  }

  public async getStudentById(id: string): Promise<Student | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<Student>('students');
      const conditions: any[] = [{ id }, { admissionNumber: id }];
      if (ObjectId.isValid(id) && id.length === 24) {
        conditions.push({ _id: new ObjectId(id) });
      }
      const doc = await collection.findOne({
        $or: conditions
      } as any);
      if (doc) {
        const { _id, ...clean } = doc as any;
        return clean as Student;
      }
      return null;
    } catch (err) {
      console.warn('[MongoDB] Error querying student by id:', err);
      return null;
    }
  }

  public async insertStudent(student: Student): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('students');
      const { _id, ...cleanStudent } = student as any;
      const res = await collection.updateOne(
        { id: student.id },
        { $set: cleanStudent },
        { upsert: true }
      );
      return res.acknowledged;
    } catch (err) {
      console.warn('[MongoDB] Error inserting student:', err);
      return false;
    }
  }

  public async updateStudent(id: string, updates: Partial<Student>): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('students');
      const { _id, ...cleanUpdates } = updates as any;
      let res = await collection.updateOne({ id }, { $set: cleanUpdates });
      if (res.matchedCount === 0) {
        res = await collection.updateOne({ admissionNumber: id }, { $set: cleanUpdates });
      }
      if (res.matchedCount === 0 && ObjectId.isValid(id) && id.length === 24) {
        res = await collection.updateOne({ _id: new ObjectId(id) }, { $set: cleanUpdates });
      }
      if (res.matchedCount === 0) {
        await collection.updateOne({ id }, { $set: { ...cleanUpdates, id } }, { upsert: true });
      }
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error updating student:', err);
      return false;
    }
  }

  public async deleteStudent(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('students');
      const conditions: any[] = [{ id }, { admissionNumber: id }];
      if (ObjectId.isValid(id) && id.length === 24) {
        conditions.push({ _id: new ObjectId(id) });
      }
      const res = await collection.deleteOne({ $or: conditions } as any);
      return res.deletedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error deleting student:', err);
      return false;
    }
  }

  public async saveAllStudents(list: Student[]): Promise<boolean> {
    return this.saveAllCollectionItems('students', list);
  }

  // User Directory & Auth methods for single school
  public async getUsers(filter: Record<string, any> = {}): Promise<UserWithAuth[] | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<UserWithAuth>('users');
      return await collection.find(filter).toArray();
    } catch (err) {
      console.warn('[MongoDB] Error querying users:', err);
      return null;
    }
  }

  public async getUserById(id: string): Promise<UserWithAuth | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<UserWithAuth>('users');
      return await collection.findOne({ id });
    } catch (err) {
      console.warn('[MongoDB] Error querying user by id:', err);
      return null;
    }
  }

  public async getUserByUsernameOrEmail(identifier: string): Promise<UserWithAuth | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<UserWithAuth>('users');
      const raw = String(identifier || '').trim();
      const lower = raw.toLowerCase();
      const upper = raw.toUpperCase();
      const phoneDigits = raw.replace(/\D/g, '');
      const cleanPhone = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
      return await collection.findOne({
        $or: [
          { username: lower },
          { email: lower },
          { employeeId: upper },
          { employeeId: raw },
          { id: raw },
          { id: `user-staff-${raw}` },
          ...(cleanPhone.length >= 10 ? [{ phone: cleanPhone }] : []),
          { studentId: raw },
        ],
      });
    } catch (err) {
      console.warn('[MongoDB] Error querying user by identifier:', err);
      return null;
    }
  }

  public async insertUser(user: UserWithAuth): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection<UserWithAuth>('users');
      const { _id, ...cleanUser } = user as any;
      const cleanEmpId = user.employeeId ? String(user.employeeId).trim().toUpperCase() : undefined;
      const orConditions: any[] = [{ id: user.id }, { username: user.username }];
      if (cleanEmpId) orConditions.push({ employeeId: cleanEmpId });
      await collection.updateOne(
        { $or: orConditions },
        { $set: { ...cleanUser, ...(cleanEmpId ? { employeeId: cleanEmpId } : {}) } },
        { upsert: true }
      );
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error inserting user:', err);
      return false;
    }
  }

  public async updateUser(id: string, updates: Partial<UserWithAuth>): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection<UserWithAuth>('users');
      const cleanId = String(id || '').trim();
      const upperId = cleanId.toUpperCase();
      const res = await collection.updateOne(
        {
          $or: [
            { id: cleanId },
            { id: `user-staff-${cleanId}` },
            { employeeId: upperId },
            { employeeId: cleanId },
            { username: cleanId.toLowerCase() },
          ],
        },
        { $set: updates }
      );
      return res.matchedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error updating user:', err);
      return false;
    }
  }

  public async deleteUser(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection<UserWithAuth>('users');
      const cleanId = String(id || '').trim();
      const upperId = cleanId.toUpperCase();
      const res = await collection.deleteOne({
        $or: [
          { id: cleanId },
          { id: `user-staff-${cleanId}` },
          { employeeId: upperId },
          { employeeId: cleanId },
          { username: cleanId.toLowerCase() },
        ],
      });
      return res.deletedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error deleting user:', err);
      return false;
    }
  }

  // --- File Metadata Operations ---
  public async getAllFileMetadata(filter: Record<string, any> = {}): Promise<R2FileMetadata[] | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<R2FileMetadata>('file_metadata');
      return await collection.find(filter).toArray();
    } catch (err) {
      console.warn('[MongoDB] Error querying file metadata:', err);
      return null;
    }
  }

  public async getFileMetadataByKey(fileKey: string): Promise<R2FileMetadata | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<R2FileMetadata>('file_metadata');
      return await collection.findOne({ fileKey });
    } catch (err) {
      console.warn('[MongoDB] Error querying file metadata by key:', err);
      return null;
    }
  }

  public async saveFileMetadata(meta: R2FileMetadata): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection<R2FileMetadata>('file_metadata');
      await collection.updateOne(
        { fileKey: meta.fileKey },
        { $set: meta },
        { upsert: true }
      );
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving file metadata:', err);
      return false;
    }
  }

  public async deleteFileMetadata(fileKey: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection<R2FileMetadata>('file_metadata');
      const res = await collection.deleteOne({ fileKey });
      return res.deletedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error deleting file metadata:', err);
      return false;
    }
  }

  // --- School Settings Operations ---
  public async getSchoolSettings(): Promise<SchoolSettings | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<SchoolSettings>('school_settings');
      return await collection.findOne({ singleSchool: true });
    } catch (err) {
      console.warn('[MongoDB] Error querying school settings:', err);
      return null;
    }
  }

  public async saveSchoolSettings(settings: SchoolSettings): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('school_settings');
      const { _id, ...cleanSettings } = (settings || {}) as any;
      await collection.updateOne(
        { singleSchool: true },
        { $set: { ...cleanSettings, singleSchool: true } },
        { upsert: true }
      );
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving school settings:', err);
      return false;
    }
  }

  // --- Study Materials Operations ---
  public async getStudyMaterials(filter: Record<string, any> = {}): Promise<StudyMaterial[] | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection<StudyMaterial>('study_materials');
      return await collection.find(filter).toArray();
    } catch (err) {
      console.warn('[MongoDB] Error querying study materials:', err);
      return null;
    }
  }

  public async saveStudyMaterial(material: StudyMaterial): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection<StudyMaterial>('study_materials');
      await collection.updateOne(
        { id: material.id },
        { $set: material },
        { upsert: true }
      );
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving study material:', err);
      return false;
    }
  }

  public async deleteStudyMaterial(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('study_materials');
      const res = await collection.deleteOne({ id });
      return res.deletedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error deleting study material:', err);
      return false;
    }
  }

  public async saveAllStudyMaterials(materials: StudyMaterial[]): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('study_materials');
      await collection.deleteMany({});
      if (materials.length > 0) {
        await collection.insertMany(materials as any);
      }
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving all study materials:', err);
      return false;
    }
  }

  // --- Generic Collection Operations for Entities ---
  private async getCollectionItems<T>(collectionName: string): Promise<T[] | null> {
    await this.ensureConnected();
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection(collectionName);
      return (await collection.find({}).toArray()) as unknown as T[];
    } catch (err) {
      console.warn(`[MongoDB] Error querying ${collectionName}:`, err);
      return null;
    }
  }

  private async saveAllCollectionItems<T>(collectionName: string, items: T[]): Promise<boolean> {
    await this.ensureConnected();
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection(collectionName);
      if (!Array.isArray(items) || items.length === 0) {
        await collection.deleteMany({});
        return true;
      }
      const seen = new Set<string>();
      const cleanItems: any[] = [];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const { _id, ...rest } = item as any;
        const rawKey = rest.id || rest.fileKey || rest.admissionNumber || rest.invoiceNumber || rest.code || (rest.dayOfWeek !== undefined ? `${rest.dayOfWeek}_${rest.periodNumber}_${rest.classId}_${rest.section || ''}` : '');
        const key = rawKey ? String(rawKey).trim().toLowerCase() : '';
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        cleanItems.push(rest);
      }

      if (cleanItems.length === 0) {
        await collection.deleteMany({});
        return true;
      }

      const ops = cleanItems.map((item) => {
        let filter: any = {};
        if (item.id) {
          filter = { id: item.id };
        } else if (item.fileKey) {
          filter = { fileKey: item.fileKey };
        } else if (item.admissionNumber) {
          filter = { admissionNumber: item.admissionNumber };
        } else if (item.invoiceNumber) {
          filter = { invoiceNumber: item.invoiceNumber };
        } else if (item.code) {
          filter = { code: item.code };
        } else if (item.dayOfWeek !== undefined && item.periodNumber !== undefined && item.classId !== undefined) {
          filter = {
            dayOfWeek: item.dayOfWeek,
            periodNumber: item.periodNumber,
            classId: item.classId,
            section: item.section || '',
          };
        } else {
          filter = { ...item };
        }
        return {
          updateOne: {
            filter,
            update: { $set: item },
            upsert: true,
          },
        };
      });

      if (ops.length > 0) {
        await collection.bulkWrite(ops, { ordered: false });
      }

      const validIds = cleanItems
        .map((it) => it.id)
        .filter((id) => typeof id === 'string' && id.trim().length > 0);
      if (validIds.length > 0) {
        await collection.deleteMany({ id: { $nin: validIds } });
      }

      return true;
    } catch (err: any) {
      console.warn(`[MongoDB] Notice saving ${collectionName}:`, err?.message || err);
      return false;
    }
  }

  // Staff
  public async getStaff(): Promise<any[] | null> { return this.getCollectionItems('staff'); }
  public async saveAllStaff(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('staff', list); }
  public async insertStaff(staffMember: any): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('staff');
      const { _id, ...cleanStaff } = staffMember;
      await collection.updateOne({ id: staffMember.id }, { $set: cleanStaff }, { upsert: true });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error inserting staff member:', err);
      return false;
    }
  }
  public async updateStaff(id: string, updates: any): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('staff');
      const { _id, ...cleanUpdates } = updates;
      const cleanId = String(id || '').trim();
      // Exact id first: the broader match below can hit another record that shares an email or employee ID.
      const exact = await collection.updateOne({ id: cleanId }, { $set: cleanUpdates });
      if (exact.matchedCount > 0) return true;
      const strippedId = cleanId.replace(/^user-staff-/, '');
      const filterConditions: any[] = [{ id: cleanId }];
      if (strippedId && strippedId !== cleanId) {
        filterConditions.push({ id: strippedId });
      }
      filterConditions.push({ id: `user-staff-${strippedId}` });
      filterConditions.push({ employeeId: cleanId.toUpperCase() });
      filterConditions.push({ employeeId: cleanId });
      if (updates.employeeId) {
        filterConditions.push({ employeeId: String(updates.employeeId).trim().toUpperCase() });
        filterConditions.push({ employeeId: String(updates.employeeId).trim() });
      }
      if (updates.id && updates.id !== cleanId) {
        filterConditions.push({ id: updates.id });
      }
      if (updates.email) {
        filterConditions.push({ email: String(updates.email).trim().toLowerCase() });
      }
      const res = await collection.updateOne({ $or: filterConditions }, { $set: cleanUpdates });
      return res.matchedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error updating staff member:', err);
      return false;
    }
  }
  public async deleteStaff(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('staff');
      await collection.deleteOne({ id });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error deleting staff member:', err);
      return false;
    }
  }

  // Classes
  public async getClasses(): Promise<any[] | null> { return this.getCollectionItems('classes'); }
  public async saveAllClasses(list: any[]): Promise<boolean> {
    await this.ensureConnected();
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('classes');
      if (!Array.isArray(list) || list.length === 0) {
        await collection.deleteMany({});
        return true;
      }
      const seen = new Set<string>();
      const sanitized: any[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const { _id, ...clean } = item as any;
        const cId = clean.id ? String(clean.id).trim() : '';
        if (!cId) continue;
        const lowerId = cId.toLowerCase();
        if (seen.has(lowerId)) continue;
        seen.add(lowerId);
        sanitized.push(clean);
      }

      if (sanitized.length === 0) {
        await collection.deleteMany({});
        return true;
      }

      const keepIds = sanitized.map((c) => c.id);
      await collection.deleteMany({ id: { $nin: keepIds } });

      const bulkOps = sanitized.map((c) => ({
        updateOne: {
          filter: { id: c.id },
          update: { $set: c },
          upsert: true,
        },
      }));
      await collection.bulkWrite(bulkOps, { ordered: false });
      return true;
    } catch (err: any) {
      console.warn('[MongoDB] Notice saving classes:', err?.message || err);
      return false;
    }
  }
  public async deleteClass(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('classes');
      const conditions: any[] = [{ id }, { name: id }];
      if (ObjectId.isValid(id) && id.length === 24) {
        conditions.push({ _id: new ObjectId(id) });
      }
      const res = await collection.deleteMany({ $or: conditions } as any);
      return (res.deletedCount || 0) > 0;
    } catch (err) {
      console.warn('[MongoDB] Error deleting class:', err);
      return false;
    }
  }

  // Subjects
  public async getSubjects(): Promise<any[] | null> { return this.getCollectionItems('subjects'); }
  public async saveAllSubjects(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('subjects', list); }

  // Timetable
  public async getTimetable(): Promise<any[] | null> { return this.getCollectionItems('timetable'); }
  public async saveAllTimetable(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('timetable', list); }

  // Timetable Periods
  public async getTimetablePeriods(): Promise<any[] | null> { return this.getCollectionItems('timetable_periods'); }
  public async saveAllTimetablePeriods(list: any[]): Promise<boolean> {
    await this.ensureConnected();
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('timetable_periods');
      if (!Array.isArray(list) || list.length === 0) {
        await collection.deleteMany({});
        return true;
      }

      // Deduplicate strictly by periodNumber to prevent E11000 duplicate key errors
      const sanitized: any[] = [];
      const seenPeriods = new Set<number>();
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object') continue;
        const { _id, ...clean } = item as any;
        let pNum = Number(clean.periodNumber);
        if (isNaN(pNum) || pNum < 1 || seenPeriods.has(pNum)) {
          let candidate = 1;
          while (seenPeriods.has(candidate)) candidate++;
          pNum = candidate;
        }
        seenPeriods.add(pNum);
        clean.periodNumber = pNum;
        if (!clean.label && clean.name) clean.label = clean.name;
        if (!clean.name && clean.label) clean.name = clean.label;
        sanitized.push(clean);
      }

      if (sanitized.length === 0) {
        await collection.deleteMany({});
        return true;
      }

      // Remove any periods no longer present
      const keepPeriodNumbers = sanitized.map((s) => s.periodNumber);
      await collection.deleteMany({ periodNumber: { $nin: keepPeriodNumbers } });

      // Upsert all periods individually to guarantee idempotence and prevent duplicate key violations
      const bulkOps = sanitized.map((p) => ({
        updateOne: {
          filter: { periodNumber: p.periodNumber },
          update: { $set: p },
          upsert: true,
        },
      }));

      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps, { ordered: false });
      }
      return true;
    } catch (err: any) {
      console.warn('[MongoDB] Error saving timetable_periods:', err?.message || err);
      return false;
    }
  }

  // Attendance
  public async getAttendance(): Promise<any[] | null> { return this.getCollectionItems('attendance'); }
  public async saveAllAttendance(list: any[]): Promise<boolean> {
    await this.ensureConnected();
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('attendance');
      if (!Array.isArray(list) || list.length === 0) {
        await collection.deleteMany({});
        return true;
      }
      const seen = new Set<string>();
      const sanitized: any[] = [];
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        if (!item || typeof item !== 'object') continue;
        const { _id, ...clean } = item as any;
        const stuId = String(clean.studentId || '').trim();
        const d = String(clean.date || '').trim();
        if (!stuId || !d) continue;
        const key = `${stuId}_${d}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sanitized.push(clean);
      }
      const ops = sanitized.map((doc) => {
        const { id, studentId, date, ...rest } = doc;
        return {
          updateOne: {
            filter: { studentId, date },
            update: {
              $set: { ...rest, studentId, date },
              $setOnInsert: { id: id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` },
            },
            upsert: true,
          },
        };
      });
      if (ops.length > 0) {
        await collection.bulkWrite(ops, { ordered: false });
      }
      return true;
    } catch (err: any) {
      console.warn('[MongoDB] Error saving attendance:', err?.message || err);
      return false;
    }
  }

  // Staff Attendance
  public async getStaffAttendance(): Promise<any[] | null> { return this.getCollectionItems('staff_attendance'); }
  public async saveAllStaffAttendance(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('staff_attendance', list); }

  // Fee Structures
  public async getFeeStructures(): Promise<any[] | null> { return this.getCollectionItems('fee_structures'); }
  public async saveAllFeeStructures(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('fee_structures', list); }

  // Fee Payments
  public async getFeePayments(): Promise<any[] | null> { return this.getCollectionItems('fee_payments'); }
  public async saveAllFeePayments(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('fee_payments', list); }

  // Exams
  public async getExams(): Promise<any[] | null> { return this.getCollectionItems('exams'); }
  public async saveAllExams(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('exams', list); }

  // Exam Marks
  public async getExamMarks(): Promise<any[] | null> { return this.getCollectionItems('exam_marks'); }
  public async saveAllExamMarks(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('exam_marks', list); }

  // Notices
  public async getNotices(): Promise<any[] | null> { return this.getCollectionItems('notices'); }
  public async saveAllNotices(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('notices', list); }

  // Homework
  public async getHomework(): Promise<any[] | null> { return this.getCollectionItems('homework'); }
  public async saveAllHomework(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('homework', list); }

  // Hostels
  public async getHostels(): Promise<any[] | null> { return this.getCollectionItems('hostels'); }
  public async saveAllHostels(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('hostels', list); }

  // Hostel Rooms
  public async getHostelRooms(): Promise<any[] | null> { return this.getCollectionItems('hostel_rooms'); }
  public async saveAllHostelRooms(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('hostel_rooms', list); }

  // Vehicles
  public async getVehicles(): Promise<any[] | null> { return this.getCollectionItems('vehicles'); }
  public async saveAllVehicles(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('vehicles', list); }

  // Routes
  public async getRoutes(): Promise<any[] | null> { return this.getCollectionItems('routes'); }
  public async saveAllRoutes(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('routes', list); }

  // Audit Logs
  public async getAuditLogs(): Promise<any[] | null> { return this.getCollectionItems('audit_logs'); }
  public async saveAllAuditLogs(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('audit_logs', list); }

  // Fee Configurations (Class-wise)
  public async getFeeConfigurations(): Promise<any[] | null> { return this.getCollectionItems('fee_configurations'); }
  public async saveAllFeeConfigurations(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('fee_configurations', list); }
  public async saveFeeConfiguration(config: any): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('fee_configurations');
      const { _id, ...docWithoutId } = config;
      await collection.updateOne({ id: config.id }, { $set: docWithoutId }, { upsert: true });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving fee configuration:', err);
      return false;
    }
  }
  public async deleteFeeConfiguration(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('fee_configurations');
      await collection.deleteOne({ id });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error deleting fee configuration:', err);
      return false;
    }
  }

  // Transport Slabs
  public async getTransportSlabs(): Promise<any[] | null> { return this.getCollectionItems('transport_slabs'); }
  public async saveAllTransportSlabs(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('transport_slabs', list); }
  public async saveTransportSlab(slab: any): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('transport_slabs');
      const { _id, ...docWithoutId } = slab;
      await collection.updateOne({ id: slab.id }, { $set: docWithoutId }, { upsert: true });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving transport slab:', err);
      return false;
    }
  }
  public async deleteTransportSlab(id: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('transport_slabs');
      await collection.deleteOne({ id });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error deleting transport slab:', err);
      return false;
    }
  }

  // Fee Ledgers
  public async getFeeLedgers(filter: Record<string, any> = {}): Promise<any[] | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection('fee_ledgers');
      return await collection.find(filter).sort({ createdAt: -1 }).toArray();
    } catch (err) {
      console.warn('[MongoDB] Error querying fee ledgers:', err);
      return null;
    }
  }
  public async saveAllFeeLedgers(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('fee_ledgers', list); }
  public async insertFeeLedger(entry: any): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('fee_ledgers');
      await collection.updateOne({ id: entry.id }, { $set: entry }, { upsert: true });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error inserting fee ledger entry:', err);
      return false;
    }
  }
  public async updateFeeLedger(id: string, updates: Record<string, any>): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('fee_ledgers');
      const res = await collection.updateOne({ id }, { $set: updates });
      return res.matchedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error updating fee ledger entry:', err);
      return false;
    }
  }

  // Public Website Collections
  public async getFacilities(): Promise<any[] | null> { return this.getCollectionItems('facilities'); }
  public async saveAllFacilities(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('facilities', list); }

  public async getGallery(): Promise<any[] | null> { return this.getCollectionItems('gallery'); }
  public async saveAllGallery(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('gallery', list); }

  public async getAdmissionEnquiries(): Promise<any[] | null> { return this.getCollectionItems('admission_enquiries'); }
  public async saveAllAdmissionEnquiries(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('admission_enquiries', list); }

  public async getHeroSlides(): Promise<any[] | null> { return this.getCollectionItems('hero_slides'); }
  public async saveAllHeroSlides(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('hero_slides', list); }

  public async getLeadership(): Promise<any[] | null> { return this.getCollectionItems('leadership'); }
  public async saveAllLeadership(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('leadership', list); }

  public async getWebsiteEvents(): Promise<any[] | null> { return this.getCollectionItems('website_events'); }
  public async saveAllWebsiteEvents(list: any[]): Promise<boolean> { return this.saveAllCollectionItems('website_events', list); }

  public async getWebsiteContent(): Promise<any | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection('website_content');
      const doc = await collection.findOne({ key: 'main' });
      if (doc) {
        const { _id, key, ...rest } = doc as any;
        return rest;
      }
      return null;
    } catch (err) {
      console.warn('[MongoDB] Error getting website content:', err);
      return null;
    }
  }

  public async saveWebsiteContent(content: any): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('website_content');
      const { _id, ...clean } = content || {};
      await collection.updateOne({ key: 'main' }, { $set: { ...clean, key: 'main' } }, { upsert: true });
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving website content:', err);
      return false;
    }
  }

  // --- File Binary Storage (Durable Backup in MongoDB) ---
  public async saveFileBinary(fileKey: string, buffer: Buffer, contentType: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('file_binaries');
      await collection.updateOne(
        { fileKey },
        {
          $set: {
            fileKey,
            contentType,
            size: buffer.length,
            data: new Binary(buffer),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return true;
    } catch (err) {
      console.warn('[MongoDB] Error saving file binary:', err);
      return false;
    }
  }

  public async getFileBinary(fileKey: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!this.isConnected() || !this.db) return null;
    try {
      const collection = this.db.collection('file_binaries');
      const doc = await collection.findOne({ fileKey });
      if (!doc || !doc.data) return null;
      const buffer = doc.data.buffer ? doc.data.buffer : Buffer.from(doc.data);
      return {
        buffer,
        contentType: doc.contentType || 'application/octet-stream',
      };
    } catch (err) {
      console.warn('[MongoDB] Error getting file binary:', err);
      return null;
    }
  }

  public async deleteFileBinary(fileKey: string): Promise<boolean> {
    if (!this.isConnected() || !this.db) return false;
    try {
      const collection = this.db.collection('file_binaries');
      const res = await collection.deleteOne({ fileKey });
      return res.deletedCount > 0;
    } catch (err) {
      console.warn('[MongoDB] Error deleting file binary:', err);
      return false;
    }
  }
}

export const mongoService = new MongoService();
