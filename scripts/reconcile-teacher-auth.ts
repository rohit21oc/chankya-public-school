import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { StaffModel } from '../server/models/Staff';
import { UserModel } from '../server/models/User';
import { sanitizeMongoUri } from '../server/db/mongo';

function normalizePhone(p?: string): string {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function reconcileTeacherAuth() {
  const mongoUri = sanitizeMongoUri(process.env.MONGODB_URI);
  if (!mongoUri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { dbName: 'cps_school_erp' });
  console.log('Connected to MongoDB (cps_school_erp)');

  // 1. Reconcile Admin Accounts in UserModel
  const adminDataPath = path.resolve(process.cwd(), 'data/adminAccounts.json');
  if (fs.existsSync(adminDataPath)) {
    const admins = JSON.parse(fs.readFileSync(adminDataPath, 'utf-8'));
    for (const a of admins) {
      const defaultAdminHash = a.passwordHash && (a.passwordHash.startsWith('$2b$') || a.passwordHash.startsWith('$2a$'))
        ? a.passwordHash
        : bcrypt.hashSync('admin123', 10);

      const existingAdmin = await UserModel.findOne({
        $or: [{ id: a.id }, { username: a.username.toLowerCase() }],
      });

      if (existingAdmin) {
        await UserModel.updateOne(
          { _id: existingAdmin._id },
          {
            $set: {
              name: a.name,
              username: a.username.toLowerCase(),
              email: (a.email || '').toLowerCase(),
              phone: a.phone || '',
              role: a.role,
              userType: 'ADMIN',
              passwordHash: existingAdmin.passwordHash && bcrypt.compareSync('admin123', existingAdmin.passwordHash)
                ? existingAdmin.passwordHash
                : defaultAdminHash,
              status: a.status || 'ACTIVE',
              loginEnabled: true,
              failedLoginAttempts: 0,
              lockoutUntil: null,
            },
          }
        );
      } else {
        await UserModel.create({
          id: a.id,
          username: a.username.toLowerCase(),
          name: a.name,
          email: (a.email || '').toLowerCase(),
          phone: a.phone || '',
          role: a.role,
          userType: 'ADMIN',
          passwordHash: defaultAdminHash,
          status: a.status || 'ACTIVE',
          loginEnabled: true,
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
        });
      }
      console.log(`Reconciled admin user: ${a.username}`);
    }
  }

  // 2. Read staff records from data/staff.json
  const staffDataPath = path.resolve(process.cwd(), 'data/staff.json');
  const staffList = fs.existsSync(staffDataPath)
    ? JSON.parse(fs.readFileSync(staffDataPath, 'utf-8'))
    : await StaffModel.find().lean();

  console.log(`Found ${staffList.length} staff records to reconcile`);

  for (const s of staffList) {
    const cleanEmpId = String(s.employeeId || '').trim().toUpperCase();
    if (!cleanEmpId) continue;
    const cleanEmail = s.email ? String(s.email).trim().toLowerCase() : undefined;
    const cleanPhone = s.phone ? normalizePhone(s.phone) : undefined;

    // Authoritative password determination
    let passwordHash = s.passwordHash;
    if (!passwordHash || (!passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2a$'))) {
      if (s.initialPassword && typeof s.initialPassword === 'string') {
        passwordHash = bcrypt.hashSync(s.initialPassword.trim(), 10);
      } else {
        passwordHash = bcrypt.hashSync('admin123', 10);
      }
    }

    // Upsert StaffModel record in MongoDB
    const { _id, ...cleanStaffDoc } = s;
    await StaffModel.updateOne(
      { $or: [{ employeeId: cleanEmpId }, { id: s.id }] },
      {
        $set: {
          ...cleanStaffDoc,
          id: s.id,
          employeeId: cleanEmpId,
          email: cleanEmail,
          phone: cleanPhone || s.phone,
          passwordHash: passwordHash,
          loginEnabled: s.loginEnabled !== false,
          accountStatus: s.accountStatus || 'ACTIVE',
          status: s.status || 'ACTIVE',
          systemRole: s.systemRole || s.role || 'TEACHER',
        },
      },
      { upsert: true }
    );

    // Look for existing UserModel matching this staff member
    const existingUser = await UserModel.findOne({
      $or: [
        { employeeId: cleanEmpId },
        { id: s.id },
        { id: `user-staff-${s.id}` },
        { username: cleanEmpId.toLowerCase() },
      ],
    });

    if (existingUser) {
      console.log(`Updating existing UserModel for ${cleanEmpId} (${s.name})`);
      await UserModel.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            employeeId: cleanEmpId,
            username: cleanEmpId.toLowerCase(),
            name: s.name,
            email: cleanEmail || '',
            phone: cleanPhone || '',
            role: (s.systemRole || s.role || 'TEACHER') as any,
            userType: 'STAFF',
            passwordHash: passwordHash,
            status: 'ACTIVE',
            loginEnabled: true,
            failedLoginAttempts: 0,
            lockoutUntil: null,
          },
        }
      );
    } else {
      console.log(`Creating missing UserModel for ${cleanEmpId} (${s.name})`);
      await UserModel.create({
        id: `user-staff-${s.id}`,
        employeeId: cleanEmpId,
        username: cleanEmpId.toLowerCase(),
        name: s.name,
        email: cleanEmail || '',
        phone: cleanPhone || '',
        role: (s.systemRole || s.role || 'TEACHER') as any,
        userType: 'STAFF',
        passwordHash: passwordHash,
        status: 'ACTIVE',
        loginEnabled: true,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  console.log('Reconciliation complete.');
  await mongoose.disconnect();
  process.exit(0);
}

reconcileTeacherAuth().catch((err) => {
  console.error('Error during reconciliation:', err);
  process.exit(1);
});
