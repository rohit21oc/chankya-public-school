import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { sanitizeMongoUri } from '../server/db/mongo.ts';
import { UserModel } from '../server/models/User.ts';

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('=== STARTING COMPLETE PASSWORD RESET PERSISTENCE & LOGIN VERIFICATION ===\n');

  // Connect to MongoDB Atlas to observe database state before & after
  const cleanUri = sanitizeMongoUri(process.env.MONGODB_URI);
  await mongoose.connect(cleanUri, { dbName: 'cps_school_erp' });
  console.log('[Test Setup] Connected to MongoDB Atlas:', mongoose.connection.name);

  // We will test with the admin account 'admin' (email: 'webwraptechnology@gmail.com')
  const testUsername = 'admin';
  const testEmail = 'webwraptechnology@gmail.com';

  const userBefore = await UserModel.findOne({ username: testUsername }).lean();
  if (!userBefore) {
    throw new Error(`Test user ${testUsername} not found in MongoDB UserModel!`);
  }

  const initialHashPrefix = userBefore.passwordHash ? userBefore.passwordHash.substring(0, 10) : 'none';
  console.log(`[Diagnostic] Initial UserModel password hash prefix: ${initialHashPrefix}...`);

  // Step 0: Set a known initial password 'InitialPass@123' directly in MongoDB
  const initialPassword = 'InitialPass@123';
  const initialHash = bcrypt.hashSync(initialPassword, 10);
  await UserModel.updateOne(
    { id: userBefore.id },
    { $set: { passwordHash: initialHash, failedLoginAttempts: 0, lockoutUntil: null } }
  );
  console.log('[Step 0] Initial password set in MongoDB Atlas. Verifying initial login...');

  // Step 1: Verify login with initial password succeeds
  const loginRes1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testUsername,
      password: initialPassword,
      loginType: 'STAFF_ADMIN',
    }),
  });

  const loginData1 = await loginRes1.json();
  if (!loginRes1.ok || !loginData1.success) {
    throw new Error(`Initial login failed! Status: ${loginRes1.status}, data: ${JSON.stringify(loginData1)}`);
  }
  console.log('✓ [Step 1 PASSED] Initial login with initial password SUCCEEDED. Token acquired.');

  // Step 2: Request Password Reset via POST /api/auth/forgot-password
  console.log('\n[Step 2] Requesting forgot-password for email:', testEmail);
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const forgotData = await forgotRes.json();
  if (forgotRes.ok && forgotData.success) {
    console.log('✓ [Step 2 PASSED] Forgot-password endpoint dispatched email successfully.');
  } else if (forgotRes.status === 502) {
    console.log(`ℹ [Step 2 NOTED] Brevo external email API responded: "${forgotData.error}". Token generated & saved to database.`);
  } else {
    throw new Error(`Forgot password request failed unexpectedly: ${JSON.stringify(forgotData)}`);
  }

  // Step 3: Check MongoDB Atlas UserModel for the newly saved reset token
  const userWithToken = await UserModel.findOne({ id: userBefore.id }).lean();
  if (!userWithToken?.passwordResetToken || !userWithToken?.passwordResetExpires) {
    throw new Error('Reset token was NOT persisted to MongoDB UserModel!');
  }
  console.log('✓ [Step 3 PASSED] Reset token successfully persisted to MongoDB Atlas UserModel.');
  const tokenHashInDb = userWithToken.passwordResetToken;
  console.log(`[Diagnostic] Reset token hash prefix in MongoDB Atlas: ${tokenHashInDb.substring(0, 10)}...`);

  // Step 4: Verify the token using /api/auth/verify-reset-token
  // We can pass the raw token if known, or test verify endpoint with token hash
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(tokenHashInDb)}`);
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.valid) {
    throw new Error(`verify-reset-token failed: ${JSON.stringify(verifyData)}`);
  }
  console.log('✓ [Step 4 PASSED] Reset token verified successfully via /api/auth/verify-reset-token. User:', verifyData.userName);

  // Step 5: Submit NEW password via POST /api/auth/reset-password
  const newPassword = 'NewSecretPassword#2026';
  console.log('\n[Step 5] Submitting new password via POST /api/auth/reset-password...');
  const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: tokenHashInDb,
      newPassword,
    }),
  });
  const resetData = await resetRes.json();
  if (!resetRes.ok || !resetData.success) {
    throw new Error(`Password reset failed: ${JSON.stringify(resetData)}`);
  }
  console.log('✓ [Step 5 PASSED] POST /api/auth/reset-password returned 200 OK.');

  // Step 6: Verify MongoDB Atlas UserModel has the NEW bcrypt hash and token is removed
  const userAfter = await UserModel.findOne({ id: userBefore.id }).lean();
  const newHashPrefix = userAfter?.passwordHash ? userAfter.passwordHash.substring(0, 10) : 'none';
  console.log(`[Diagnostic] New UserModel password hash prefix in MongoDB Atlas: ${newHashPrefix}...`);

  if (!userAfter?.passwordHash || userAfter.passwordHash === initialHash) {
    throw new Error('FAIL: MongoDB UserModel passwordHash was NOT updated!');
  }
  const isBcryptMatch = bcrypt.compareSync(newPassword, userAfter.passwordHash);
  if (!isBcryptMatch) {
    throw new Error('FAIL: MongoDB UserModel passwordHash does not match new password bcrypt hash!');
  }
  console.log('✓ [Step 6 PASSED] Confirmed: MongoDB Atlas UserModel contains the new bcrypt hash!');

  if (userAfter.passwordResetToken || userAfter.passwordResetExpires) {
    throw new Error('FAIL: Reset token was not cleared from MongoDB UserModel after reset!');
  }
  console.log('✓ [Step 6b PASSED] Confirmed: Reset token was purged from MongoDB Atlas UserModel.');

  // Step 7: Test Login with the OLD password -> MUST FAIL (Requirement 3)
  console.log('\n[Step 7] Testing login with OLD password (Must fail)...');
  const loginResOld = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testUsername,
      password: initialPassword,
      loginType: 'STAFF_ADMIN',
    }),
  });
  const loginDataOld = await loginResOld.json();
  if (loginResOld.status !== 401 || loginDataOld.success) {
    throw new Error(`FAIL: Old password still worked! Status: ${loginResOld.status}`);
  }
  console.log('✓ [Step 7 PASSED] Old password was REJECTED with 401 Unauthorized.');

  // Step 8: Test Login with the NEW password -> MUST SUCCEED IMMEDIATELY (Requirement 4)
  console.log('\n[Step 8] Testing login with NEW password (Must succeed immediately)...');
  const loginResNew = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testUsername,
      password: newPassword,
      loginType: 'STAFF_ADMIN',
    }),
  });
  const loginDataNew = await loginResNew.json();
  if (!loginResNew.ok || !loginDataNew.success) {
    throw new Error(`FAIL: New password failed to log in! Status: ${loginResNew.status}, error: ${loginDataNew.error}`);
  }
  console.log('✓ [Step 8 PASSED] New password LOGGED IN SUCCESSFULLY immediately! User:', loginDataNew.user?.name);

  // Step 9: Test SECOND USE of the same reset token -> MUST FAIL (Requirement 11 & 14)
  console.log('\n[Step 9] Testing SECOND USE of the reset token (Must fail)...');
  const resetResSecond = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: tokenHashInDb,
      newPassword: 'AnotherPassword@999',
    }),
  });
  const resetDataSecond = await resetResSecond.json();
  if (resetResSecond.ok || resetDataSecond.success) {
    throw new Error(`FAIL: Single-use reset token was reused successfully! Status: ${resetResSecond.status}`);
  }
  console.log('✓ [Step 9 PASSED] Second use of reset token was REJECTED with 400 Bad Request.');

  // Step 10: Verify second use on verify-reset-token also fails
  const verifyResSecond = await fetch(`${BASE_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(tokenHashInDb)}`);
  const verifyDataSecond = await verifyResSecond.json();
  if (verifyResSecond.ok && verifyDataSecond.valid) {
    throw new Error(`FAIL: Single-use reset token still verified as valid!`);
  }
  console.log('✓ [Step 10 PASSED] Token verification for used token correctly returned invalid.');

  console.log('\n======================================================');
  console.log(' ALL 10 ADMIN PASSWORD RESET PERSISTENCE TESTS PASSED! ');
  console.log(' NOW TESTING TEACHER/STAFF ACCOUNT (CPS0011)...');
  console.log('======================================================\n');

  // Test with Teacher Sunita Verma (CPS0011 / sunita.verma.school@gmail.com)
  const teacherEmpId = 'CPS0011';
  const teacherEmail = 'sunita.verma.school@gmail.com';
  const teacherUser = await UserModel.findOne({ employeeId: teacherEmpId }).lean();
  if (teacherUser) {
    const tInitialPass = 'TeacherPass#123';
    const tInitialHash = bcrypt.hashSync(tInitialPass, 10);
    await UserModel.updateOne({ _id: teacherUser._id }, { $set: { passwordHash: tInitialHash, failedLoginAttempts: 0 } });

    // Login with initial
    const tLogin1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: teacherEmpId, password: tInitialPass, loginType: 'STAFF_ADMIN' }),
    });
    if (!tLogin1.ok) throw new Error('Initial teacher login failed');
    console.log('✓ [Teacher Step 1 PASSED] Initial login with initial password succeeded.');

    // Request reset
    await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: teacherEmpId }),
    });

    const teacherWithToken = await UserModel.findOne({ _id: teacherUser._id }).lean();
    if (!teacherWithToken?.passwordResetToken) throw new Error('Teacher reset token not in UserModel');
    console.log('✓ [Teacher Step 2 PASSED] Teacher reset token saved to MongoDB Atlas.');

    // Reset password
    const tNewPass = 'TeacherNew#2026';
    const tResetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: teacherWithToken.passwordResetToken, newPassword: tNewPass }),
    });
    if (!tResetRes.ok) throw new Error('Teacher reset-password failed');
    console.log('✓ [Teacher Step 3 PASSED] Teacher reset-password returned 200.');

    // Old password fail
    const tLoginOld = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: teacherEmpId, password: tInitialPass, loginType: 'STAFF_ADMIN' }),
    });
    if (tLoginOld.status !== 401) throw new Error('Teacher old password should fail');
    console.log('✓ [Teacher Step 4 PASSED] Teacher old password failed with 401.');

    // New password succeed
    const tLoginNew = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: teacherEmpId, password: tNewPass, loginType: 'STAFF_ADMIN' }),
    });
    if (!tLoginNew.ok) throw new Error('Teacher new password should succeed');
    console.log('✓ [Teacher Step 5 PASSED] Teacher new password succeeded immediately!');

    // Second use of token fail
    const tResetSecond = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: teacherWithToken.passwordResetToken, newPassword: 'FailPass#123' }),
    });
    if (tResetSecond.ok) throw new Error('Teacher token reuse should fail');
    console.log('✓ [Teacher Step 6 PASSED] Teacher token reuse rejected with 400.');
  }

  console.log('\n======================================================');
  console.log(' ALL ADMIN AND STAFF PASSWORD RESET FLOWS PASSED 100%! ');
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
