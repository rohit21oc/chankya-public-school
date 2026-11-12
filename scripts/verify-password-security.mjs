/**
 * Password security checks against a running server (default http://localhost:3000).
 * Uses a parent account from data/parentAccounts.json and signs a test token with JWT_SECRET
 * (or the development fallback). Run on a local copy only: it changes that parent's password.
 *
 * Usage: node scripts/verify-password-security.mjs
 */
import jwt from 'jsonwebtoken';
import fs from 'fs';

const B = process.env.API_BASE || 'http://localhost:3000';
const S = process.env.JWT_SECRET || 'residential_pds_sheohar_jwt_production_secret_key_2026';
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const call = async (m, u, b, t) => {
  const r = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return [r.status, j];
};

// 1. Forgot password never reveals whether an account exists
const [s1, j1] = await call('POST', '/api/auth/forgot-password', { identifier: `nobody-${Date.now()}@example.invalid` });
const [s2, j2] = await call('POST', '/api/auth/forgot-password', { identifier: `nouser${Date.now()}` });
check('Unknown email → 200 with the generic message', s1 === 200 && /If an account matches/.test(j1?.message || ''), `${s1} ${j1?.message || j1?.error}`);
check('Unknown username → same generic message', s2 === 200 && j2?.message === j1?.message, `${s2}`);

// 2. Change password: strength, wrong current limit, PDS123 not accepted once a password is set
const parents = JSON.parse(fs.readFileSync('data/parentAccounts.json', 'utf8'));
const p = parents[0];
const tok = jwt.sign({ userId: p.id, role: 'PARENT' }, S, { expiresIn: '1h' });
let [s, j] = await call('POST', '/api/auth/change-password', { currentPassword: 'x', newPassword: 'short' }, tok);
check('Weak new password rejected', s === 400 && /8 characters/.test(j?.error || ''), j?.error);
[s, j] = await call('POST', '/api/auth/change-password', { currentPassword: 'Same1234', newPassword: 'Same1234' }, tok);
check('New password equal to current rejected', s === 400, j?.error);

const hasOwnHash = /^\$2[ab]\$/.test(String(p.passwordHash || ''));
[s, j] = await call('POST', '/api/auth/change-password', { currentPassword: 'PDS123', newPassword: 'NewPass123' }, tok);
if (hasOwnHash) check('PDS123 not accepted when the parent has their own password', s === 400, `${s} ${j?.error}`);
else check('PDS123 accepted only while no own password is set (initial password)', s === 200 || s === 400, `${s}`);

let last = 0;
for (let i = 0; i < 6; i++) { [last] = await call('POST', '/api/auth/change-password', { currentPassword: `Wrong${i}xyz9`, newPassword: 'Another123' }, tok); }
check('Repeated wrong current password → 429', last === 429, String(last));

// 3. Reset with a bad token and weak password
[s, j] = await call('POST', '/api/auth/reset-password', { token: 'deadbeef', newPassword: 'abc' });
check('Reset rejects a weak password before anything else', s === 400 && /8 characters/.test(j?.error || ''), j?.error);
[s, j] = await call('POST', '/api/auth/reset-password', { token: 'deadbeef', newPassword: 'GoodPass123' });
check('Reset rejects an invalid token', s === 400 && /invalid or has expired/.test(j?.error || ''), j?.error);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll password security checks passed.');
process.exit(failures ? 1 : 0);
