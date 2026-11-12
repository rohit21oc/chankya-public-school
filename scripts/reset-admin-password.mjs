/**
 * Check / reset the main admin login from the environment.
 *
 * INITIAL_ADMIN_PASSWORD only creates the admin on an EMPTY database; an existing admin keeps its old
 * password. Run this once (on the server shell, where MONGODB_URI and INITIAL_ADMIN_* are set) to see why
 * the admin can't sign in, and optionally apply the .env values to the existing admin.
 *
 *   node scripts/reset-admin-password.mjs            # check only, changes nothing
 *   node scripts/reset-admin-password.mjs --confirm  # set password (+ phone/email/name if given) from env
 *
 * Plain Node (no tsx needed), so it works on a production install. Never prints passwords or hashes.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const env = (k) => (process.env[k] || '').trim();
const uri = env('MONGODB_URI').replace(/^['"]|['"]$/g, '');
const username = (env('INITIAL_ADMIN_USERNAME') || 'chanakyapublicschool').toLowerCase();
const password = env('INITIAL_ADMIN_PASSWORD');
const phone = env('INITIAL_ADMIN_PHONE').replace(/\D/g, '').slice(-10);
const email = env('INITIAL_ADMIN_EMAIL').toLowerCase();
const name = env('INITIAL_ADMIN_NAME');
const confirm = process.argv.includes('--confirm');

if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(1); }
if (!password) { console.error('INITIAL_ADMIN_PASSWORD is not set.'); process.exit(1); }

await mongoose.connect(uri, { dbName: 'cps_school_erp', serverSelectionTimeoutMS: 15000 });
const users = mongoose.connection.db.collection('users');

const admins = await users.find({ userType: 'ADMIN', $or: [{ id: 'admin-1' }, { username }] }).toArray();
const fmt = (u) => {
  const locked = u.lockoutUntil && new Date(u.lockoutUntil).getTime() > Date.now();
  return [
    `  id=${u.id} username=${u.username} role=${u.role} phone=${u.phone || '-'} email=${u.email || '-'}`,
    `  status=${u.status || u.accountStatus || '-'} loginEnabled=${u.loginEnabled !== false} locked=${locked ? 'YES until ' + new Date(u.lockoutUntil).toISOString() : 'no'} failedAttempts=${u.failedLoginAttempts || 0}`,
    `  .env password works for this account: ${u.passwordHash && bcrypt.compareSync(password, u.passwordHash) ? 'YES' : 'NO'}`,
  ].join('\n');
};

console.log(`Database: ${mongoose.connection.name}`);
if (admins.length === 0) {
  console.log(`No admin with id admin-1 or username "${username}". Restart the server once: it creates the admin from .env on an empty database.`);
} else {
  console.log('Main admin account:');
  admins.forEach((u) => console.log(fmt(u)));
}

// Older builds copied the repository's sample admins (e.g. "schooladmin") into a new, empty database.
const others = await users.find({ userType: 'ADMIN', id: { $nin: admins.map((a) => a.id) } }).toArray();
if (others.length) {
  console.log('\nOther admin accounts (check you know each one; sample accounts like "schooladmin" should be disabled or removed):');
  others.forEach((u) => console.log(`  id=${u.id} username=${u.username} role=${u.role} phone=${u.phone || '-'} loginEnabled=${u.loginEnabled !== false}`));
}

// The login matches username OR phone OR email; another account with the same phone/email can win the match.
if (phone || email) {
  const clash = await users.find({
    userType: { $in: ['ADMIN', 'STAFF'] },
    $or: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
    id: { $nin: admins.map((a) => a.id) },
  }).toArray();
  if (clash.length) {
    console.log('\nWARNING: other staff/admin accounts use the same phone/email, so signing in with it may pick them instead:');
    clash.forEach((u) => console.log(`  id=${u.id} username=${u.username} role=${u.role} phone=${u.phone || '-'} email=${u.email || '-'}`));
    console.log(`Sign in with the username "${username}" instead, or change their phone/email.`);
  }
}

if (!confirm) {
  console.log('\nCheck only. Run again with --confirm to apply the .env password (and phone/email/name if set) to the main admin.');
} else if (admins.length !== 1) {
  console.log('\nNot changed: expected exactly one main admin account.');
} else {
  const set = {
    passwordHash: bcrypt.hashSync(password, 10),
    failedLoginAttempts: 0,
    lockoutUntil: null,
    loginEnabled: true,
    status: 'ACTIVE',
    accountStatus: 'ACTIVE',
  };
  if (phone) set.phone = phone;
  if (email) set.email = email;
  if (name) set.name = name;
  await users.updateOne({ _id: admins[0]._id }, { $set: set });
  console.log(`\nDone. Sign in with "${admins[0].username}"${phone ? ` or ${phone}` : ''} and the INITIAL_ADMIN_PASSWORD value. Then restart the server so it reloads the account.`);
}

await mongoose.disconnect();
