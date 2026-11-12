import assert from 'node:assert/strict';

// A fake localStorage stands in for the phone's persistent store (SecureStore is not loadable in node).
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (expSecFromNow: number) => `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecFromNow })}.sig`;
const user: any = { id: 'u1', name: 'Test', role: 'TEACHER', employeeId: 'PDS0002' };

let n = 0;
const t = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log('PASS', name); };

(async () => {
  // --- restart simulation: values saved by an earlier launch exist before the module loads ---
  const good = jwt(3600);
  mem.set('pds_mobile_token', good);
  mem.set('pds_mobile_user', JSON.stringify(user));
  const { authStorage } = await import('../src/services/authStorage');
  const { apiService } = await import('../src/services/apiService');

  await t('a saved, unexpired sign-in is restored after an app restart', async () => {
    await authStorage.init();
    assert.equal(authStorage.getToken(), good);
    assert.equal(authStorage.getUser()?.id, 'u1');
    assert.equal(authStorage.isAuthenticated(), true);
  });

  await t('setSession with remember-me writes the sign-in to the persistent store', async () => {
    const tok = jwt(7200);
    await authStorage.setSession(tok, user, true);
    assert.equal(mem.get('pds_mobile_token'), tok);
    assert.ok(mem.get('pds_mobile_user')!.includes('PDS0002'));
  });

  await t('updateUser and active child are persisted too', () => {
    authStorage.updateUser({ name: 'Renamed' } as any);
    assert.ok(mem.get('pds_mobile_user')!.includes('Renamed'));
    authStorage.setActiveStudentId('st-9');
    assert.equal(mem.get('pds_mobile_active_student_id'), 'st-9');
  });

  await t('network failure while verifying does NOT sign the user out', async () => {
    (globalThis as any).fetch = async () => { throw new Error('Network request failed'); };
    const r = await apiService.verifyCurrentSession();
    assert.equal(r.valid, true);
    assert.ok(authStorage.getToken());
    assert.ok(mem.get('pds_mobile_token'));
  });

  await t('server error (500) while verifying does NOT sign the user out', async () => {
    (globalThis as any).fetch = async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } });
    const r = await apiService.verifyCurrentSession();
    assert.equal(r.valid, true);
    assert.ok(authStorage.getToken());
  });

  await t('an explicit 401 signs out and wipes the saved sign-in', async () => {
    (globalThis as any).fetch = async () => new Response(JSON.stringify({ error: 'expired' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const r = await apiService.verifyCurrentSession();
    assert.equal(r.valid, false);
    assert.equal(authStorage.getToken(), null);
    assert.equal(mem.has('pds_mobile_token'), false);
    assert.equal(mem.has('pds_mobile_user'), false);
  });

  await t('without remember-me nothing is saved (and an older save is removed)', async () => {
    mem.set('pds_mobile_token', 'old');
    await authStorage.setSession(jwt(3600), user, false);
    assert.equal(mem.has('pds_mobile_token'), false);
    assert.ok(authStorage.getToken());
  });

  await t('an expired token is never treated as signed in and clearSession empties the store', async () => {
    await authStorage.setSession(jwt(-60), user, true);
    assert.equal(authStorage.getToken(), null);
    assert.equal(authStorage.isAuthenticated(), false);
    await authStorage.clearSession();
    assert.equal(mem.size, 0);
  });

  console.log(`\n${n} passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
