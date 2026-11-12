/**
 * The sample data in data/*.json (sample students, staff, and admin accounts with a password that is
 * public in this repository) must never be copied into a production MongoDB database.
 * Checks the guard in PersistentStorageManager.loadJsonData without needing a database.
 *   npx tsx scripts/verify-no-dev-seed.ts
 */
import mongoose from 'mongoose';
import { persistentStorage } from '../server/storage/persistentStorage.ts';

const setReadyState = (n: number) =>
  Object.defineProperty(mongoose.connection, 'readyState', { get: () => n, configurable: true });
const sampleAdmins = () => (persistentStorage as any).loadJsonData('adminAccounts.json', []).length as number;

let fail = 0;
const check = (name: string, ok: boolean, got: unknown) => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → got ${got}`}`);
};

const fileCount = (() => {
  setReadyState(0);
  return sampleAdmins();
})();
check('data/adminAccounts.json has sample admins to guard against', fileCount > 0, fileCount);

process.env.NODE_ENV = 'production';
setReadyState(1);
check('Production + MongoDB connected: sample data is NOT loaded', sampleAdmins() === 0, sampleAdmins());

process.env.ALLOW_JSON_SEED = 'true';
check('ALLOW_JSON_SEED=true: sample data can be imported on purpose', sampleAdmins() === fileCount, sampleAdmins());
delete process.env.ALLOW_JSON_SEED;

setReadyState(0);
check('Production without a database: local files still work as fallback', sampleAdmins() === fileCount, sampleAdmins());

process.env.NODE_ENV = 'development';
setReadyState(1);
check('Development + MongoDB: sample data still usable', sampleAdmins() === fileCount, sampleAdmins());

console.log(fail ? `\n${fail} FAILED` : '\nAll checks passed');
process.exit(fail ? 1 : 0);
