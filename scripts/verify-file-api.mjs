/**
 * File storage API checks against a running server (default http://localhost:3000, or BASE_URL).
 * Upload slot → upload → attach → serve → delete, plus the refusals that protect it.
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const S = process.env.JWT_SECRET || 'residential_pds_sheohar_jwt_production_secret_key_2026';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const admin = read('adminAccounts.json').find((a) => a.role === 'SUPER_ADMIN');
const teacher = read('staff.json').find((s) => s.role === 'TEACHER');
const tok = (id, role) => jwt.sign({ userId: id, role }, S, { expiresIn: '10m' });
const A = tok(admin.id, admin.role);
const T = tok(teacher.id, 'TEACHER');

let fail = 0;
const check = (n, ok, x = '') => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || !x ? '' : `  → ${x}`}`);
};
const call = async (method, path, { token, body, raw, type } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  if (raw) headers['Content-Type'] = type || 'application/octet-stream';
  const r = await fetch(`${BASE}${path}`, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { s: r.status, j: json, h: r.headers, text };
};
// 1x1 PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const slotReq = (folder, contentType = 'image/png', size = png.length) => ({ fileName: 'x.png', contentType, fileSize: size, folder });

let r = await call('POST', '/api/files/presign-upload', { body: slotReq('students/photos') });
check('Anonymous upload slot refused', r.s === 401, r.s);
r = await call('POST', '/api/files/presign-upload', { token: T, body: slotReq('public-website/hero') });
check('Teacher cannot upload website banners', r.s === 403, r.s);
r = await call('POST', '/api/files/presign-upload', { token: T, body: slotReq('students/photos', 'text/html') });
check('HTML upload refused by type check', r.s === 400, r.s);

r = await call('POST', '/api/files/presign-upload', { token: T, body: slotReq('students/photos') });
check('Teacher gets a photo upload slot', r.s === 200 && r.j?.fileKey, r.s);
const key = r.j?.fileKey;
const put = `/api/files/stream-upload/${encodeURIComponent(key)}`;
r = await call('PUT', put, { raw: png, type: 'image/png' });
check('Anonymous cannot fill the slot', r.s === 401, r.s);
r = await call('PUT', put, { token: A, raw: png, type: 'image/png' });
check('Another user cannot fill the slot', r.s === 403, r.s);
r = await call('PUT', put, { token: T, raw: Buffer.alloc(png.length * 50), type: 'image/png' });
check('Oversized body refused', r.s === 400, r.s);
r = await call('PUT', put, { token: T, raw: png, type: 'text/html' });
check('Different content type refused', r.s === 400, r.s);
r = await call('PUT', put, { token: T, raw: png, type: 'image/png' });
check('Uploader fills the slot', r.s === 200, r.s);
r = await call('PUT', put, { token: T, raw: png, type: 'image/png' });
check('Slot cannot be overwritten', r.s === 403, r.s);

r = await call('GET', `/api/files/content?key=${encodeURIComponent(key)}`);
check('File is served with nosniff', r.s === 200 && r.h.get('x-content-type-options') === 'nosniff', r.s);

r = await call('POST', '/api/files/confirm', { body: { fileKey: key, associatedEntity: { type: 'SCHOOL_LOGO', id: '' } } });
check('Anonymous cannot change the school logo', r.s === 401, r.s);
r = await call('POST', '/api/files/confirm', { token: T, body: { fileKey: key, associatedEntity: { type: 'SCHOOL_LOGO', id: '' } } });
check('Teacher cannot change the school logo', r.s === 403, r.s);

r = await call('GET', '/api/files/metadata');
check('File list needs sign-in', r.s === 401, r.s);
r = await call('GET', '/api/files/metadata', { token: T });
check('Teacher cannot list all files', r.s === 403, r.s);
r = await call('GET', '/api/public/media-library');
check('Media library needs sign-in', r.s === 401, r.s);
r = await call('GET', '/api/public/media-library', { token: A });
check('Media library lists website media only', r.s === 200 && Array.isArray(r.j) && r.j.every((m) => !/students\/|staff\/|teachers\//.test(m.fileKey)), r.s);
r = await call('GET', `/api/files/presign-download?key=${encodeURIComponent(key)}`);
check('Download link needs sign-in', r.s === 401, r.s);

r = await call('DELETE', '/api/files', { body: { fileKey: key } });
check('Anonymous delete refused', r.s === 401, r.s);
r = await call('DELETE', '/api/files', { token: T, body: { fileKey: 'school/school-logo/anything.png' } });
check('Teacher cannot delete files they did not upload', r.s === 403, r.s);
r = await call('DELETE', '/api/files', { token: T, body: { fileKey: key } });
check('Uploader deletes own file', r.s === 200, r.s);

console.log(`\n${fail ? `${fail} failed` : 'All file API checks passed.'}`);
process.exit(fail ? 1 : 0);
