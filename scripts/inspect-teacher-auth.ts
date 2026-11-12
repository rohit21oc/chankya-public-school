import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { sanitizeMongoUri } from '../server/db/mongo.ts';
dotenv.config();

async function main() {
  const uri = sanitizeMongoUri(process.env.MONGODB_URI);
  if (!uri) {
    console.error('MONGODB_URI not found in env');
    return;
  }
  await mongoose.connect(uri, { dbName: 'pds_school_erp' });
  const db = mongoose.connection.db;
  if (!db) {
    console.error('Failed to get database handle');
    return;
  }

  const staffList = await db.collection('staff').find({}).toArray();
  console.log(`\n=== STAFF COLLECTION (${staffList.length} records) ===`);
  for (const s of staffList) {
    console.log({
      id: s.id,
      employeeId: s.employeeId,
      name: s.name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      systemRole: s.systemRole,
      portalRole: s.portalRole,
      accountStatus: s.accountStatus,
      status: s.status,
      loginEnabled: s.loginEnabled,
      hasPasswordHash: !!s.passwordHash,
      passwordHash: s.passwordHash,
    });
  }

  const usersList = await db.collection('users').find({}).toArray();
  console.log(`\n=== USERS COLLECTION (${usersList.length} records) ===`);
  for (const u of usersList) {
    console.log({
      id: u.id,
      employeeId: u.employeeId,
      username: u.username,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      userType: u.userType,
      status: u.status,
      accountStatus: u.accountStatus,
      loginEnabled: u.loginEnabled,
      hasPasswordHash: !!u.passwordHash,
      passwordHash: u.passwordHash,
    });
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(console.error);
