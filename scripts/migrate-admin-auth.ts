/**
 * Idempotent Admin Authentication Migration Script
 * CHANAKYA PUBLIC SCHOOL & COACHING CENTRE ERP
 *
 * Requirements:
 * 1. Replace hardcoded login ID 'admin' with 'chanakyapublicschool'.
 * 2. Set initial admin password from INITIAL_ADMIN_PASSWORD (.env) and eliminate 'admin123'.
 * 3. Store password only as strong salted bcrypt hash in MongoDB.
 * 4. Idempotent: Never overwrite an existing production password on subsequent runs.
 * 5. Never print actual passwords or hashes into public logs.
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { sanitizeMongoUri } from '../server/db/mongo.ts';
import { UserModel } from '../server/models/User.ts';

const INITIAL_ADMIN_USERNAME = process.env.INITIAL_ADMIN_USERNAME || 'chanakyapublicschool';
const INITIAL_ADMIN_PASSWORD = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
if (!INITIAL_ADMIN_PASSWORD) {
  console.error('[Migration] Set INITIAL_ADMIN_PASSWORD in .env before running this script.');
  process.exit(1);
}

async function migrateAdminAuth() {
  console.log('====================================================');
  console.log('[Migration] Starting Admin Authentication Migration');
  console.log('====================================================');

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    console.error('[Migration] Error: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  const cleanUri = sanitizeMongoUri(rawUri);
  console.log('[Migration] Connecting to MongoDB Atlas cluster...');
  await mongoose.connect(cleanUri, {
    dbName: 'cps_school_erp',
    serverSelectionTimeoutMS: 10000,
  });
  console.log('[Migration] Connected to database:', mongoose.connection.name);

  // 1. Inspect existing admin accounts in MongoDB
  const existingMigratedAdmin = await UserModel.findOne({
    $or: [
      { username: INITIAL_ADMIN_USERNAME.toLowerCase() },
      { id: 'admin-1' },
    ],
    userType: 'ADMIN',
  });

  const legacyAdminDoc = await UserModel.findOne({
    username: 'admin',
    userType: 'ADMIN',
  });

  let migratedHash = '';
  let actionTaken = '';

  if (existingMigratedAdmin) {
    console.log('[Migration] Found existing admin account with id:', existingMigratedAdmin.id);
    const hasValidHash =
      existingMigratedAdmin.passwordHash &&
      (existingMigratedAdmin.passwordHash.startsWith('$2b$') || existingMigratedAdmin.passwordHash.startsWith('$2a$'));

    const isOldAdmin123 = hasValidHash && bcrypt.compareSync('admin123', existingMigratedAdmin.passwordHash);

    if (!hasValidHash || isOldAdmin123) {
      console.log('[Migration] Updating password hash to secure new initial admin credential...');
      migratedHash = bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, 10);
      actionTaken = 'UPDATED_PASSWORD_HASH';
    } else {
      console.log('[Migration] Password hash is already set and valid. Preserving existing production password.');
      migratedHash = existingMigratedAdmin.passwordHash;
      actionTaken = 'PRESERVED_EXISTING_PRODUCTION_PASSWORD';
    }

    await UserModel.updateOne(
      { _id: existingMigratedAdmin._id },
      {
        $set: {
          id: 'admin-1',
          username: INITIAL_ADMIN_USERNAME.toLowerCase(),
          userType: 'ADMIN',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          loginEnabled: true,
          passwordHash: migratedHash,
          failedLoginAttempts: 0,
          lockoutUntil: null,
          updatedAt: new Date(),
        },
      }
    );

    // Clean up any lingering separate legacy 'admin' document if present
    if (legacyAdminDoc && String(legacyAdminDoc._id) !== String(existingMigratedAdmin._id)) {
      console.log('[Migration] Removing duplicate obsolete legacy admin document...');
      await UserModel.deleteOne({ _id: legacyAdminDoc._id });
    }
  } else if (legacyAdminDoc) {
    console.log('[Migration] Found legacy admin document (admin). Migrating to chanakyapublicschool...');
    const isOldAdmin123 = legacyAdminDoc.passwordHash && bcrypt.compareSync('admin123', legacyAdminDoc.passwordHash);
    migratedHash = (!legacyAdminDoc.passwordHash || isOldAdmin123)
      ? bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, 10)
      : legacyAdminDoc.passwordHash;

    await UserModel.updateOne(
      { _id: legacyAdminDoc._id },
      {
        $set: {
          id: 'admin-1',
          username: INITIAL_ADMIN_USERNAME.toLowerCase(),
          name: legacyAdminDoc.name || 'Shri Ramakant Saxena',
          userType: 'ADMIN',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          loginEnabled: true,
          passwordHash: migratedHash,
          failedLoginAttempts: 0,
          lockoutUntil: null,
          updatedAt: new Date(),
        },
      }
    );
    actionTaken = 'MIGRATED_LEGACY_ADMIN';
  } else {
    console.log('[Migration] No existing admin found. Provisioning root admin account...');
    migratedHash = bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, 10);
    await UserModel.create({
      id: 'admin-1',
      name: 'Shri Ramakant Saxena',
      username: INITIAL_ADMIN_USERNAME.toLowerCase(),
      email: process.env.BREVO_SENDER_EMAIL || 'cpskushahar@gmail.com',
      phone: '8207870192',
      role: 'SUPER_ADMIN',
      userType: 'ADMIN',
      status: 'ACTIVE',
      accountStatus: 'ACTIVE',
      loginEnabled: true,
      passwordHash: migratedHash,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    actionTaken = 'INITIALIZED_NEW_ADMIN';
  }

  // Also verify admin-2 (schooladmin) - if still using old default admin123, update to new initial password
  const admin2 = await UserModel.findOne({ id: 'admin-2', userType: 'ADMIN' });
  if (admin2 && admin2.passwordHash && bcrypt.compareSync('admin123', admin2.passwordHash)) {
    console.log('[Migration] Updating admin-2 default password hash away from admin123...');
    await UserModel.updateOne(
      { _id: admin2._id },
      { $set: { passwordHash: bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, 10), failedLoginAttempts: 0, lockoutUntil: null } }
    );
  }

  // Ensure any lingering 'admin' username is completely removed
  await UserModel.deleteMany({ username: 'admin', id: { $ne: 'admin-1' } });

  // 2. Sync local data/adminAccounts.json for persistent offline/fallback parity
  const adminJsonPath = path.resolve(process.cwd(), 'data/adminAccounts.json');
  if (fs.existsSync(adminJsonPath)) {
    try {
      const accounts = JSON.parse(fs.readFileSync(adminJsonPath, 'utf-8'));
      const rootIdx = accounts.findIndex((a: any) => a.id === 'admin-1' || a.username === 'admin' || a.username === INITIAL_ADMIN_USERNAME);
      if (rootIdx !== -1) {
        accounts[rootIdx].username = INITIAL_ADMIN_USERNAME.toLowerCase();
        accounts[rootIdx].passwordHash = migratedHash;
        accounts[rootIdx].status = 'ACTIVE';
        accounts[rootIdx].accountStatus = 'ACTIVE';
        accounts[rootIdx].loginEnabled = true;
        accounts[rootIdx].failedLoginAttempts = 0;
        accounts[rootIdx].lockoutUntil = null;
      }
      const schoolAdminIdx = accounts.findIndex((a: any) => a.id === 'admin-2');
      if (schoolAdminIdx !== -1 && accounts[schoolAdminIdx].passwordHash && bcrypt.compareSync('admin123', accounts[schoolAdminIdx].passwordHash)) {
        accounts[schoolAdminIdx].passwordHash = bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, 10);
      }
      fs.writeFileSync(adminJsonPath, JSON.stringify(accounts, null, 2), 'utf-8');
      console.log('[Migration] Successfully synced data/adminAccounts.json with updated credentials.');
    } catch (e: any) {
      console.warn('[Migration] Note updating adminAccounts.json:', e?.message);
    }
  }

  // 3. Verification of state (without logging passwords or hashes)
  console.log('\n--- Verification Checks ---');
  const finalDoc = await UserModel.findOne({ username: INITIAL_ADMIN_USERNAME.toLowerCase() }).lean();
  if (!finalDoc) {
    throw new Error(`CRITICAL: Migrated admin account ${INITIAL_ADMIN_USERNAME} was not found in MongoDB!`);
  }
  console.log('✓ Found migrated admin in MongoDB Atlas: username =', finalDoc.username, '| role =', finalDoc.role);

  const legacyCheck = await UserModel.findOne({ username: 'admin' }).lean();
  if (legacyCheck) {
    throw new Error('CRITICAL: Obsolete username "admin" still exists in database!');
  }
  console.log('✓ Legacy username "admin" is confirmed removed from database.');

  const isHashBcrypt = finalDoc.passwordHash && (finalDoc.passwordHash.startsWith('$2b$') || finalDoc.passwordHash.startsWith('$2a$'));
  if (!isHashBcrypt) {
    throw new Error('CRITICAL: Stored password is not a valid bcrypt hash!');
  }
  console.log('✓ Stored password is confirmed to be a strong salted bcrypt hash.');

  const rejectsOldPassword = !bcrypt.compareSync('admin123', finalDoc.passwordHash);
  if (!rejectsOldPassword) {
    throw new Error('CRITICAL: Password hash still accepts admin123!');
  }
  console.log('✓ Verified: Old credential "admin123" is strictly REJECTED.');

  const acceptsNewPassword = bcrypt.compareSync(INITIAL_ADMIN_PASSWORD, finalDoc.passwordHash);
  if (!acceptsNewPassword) {
    throw new Error('CRITICAL: Password hash does not match new initial admin password!');
  }
  console.log('✓ Verified: New initial password correctly matches salted bcrypt hash.');

  console.log('\n====================================================');
  console.log(`[Migration] SUCCESS: Admin migration completed (${actionTaken})`);
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

migrateAdminAuth().catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
