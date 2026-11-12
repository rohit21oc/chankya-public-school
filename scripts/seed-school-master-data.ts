/**
 * Puts the school master data (settings, classes, subjects) into MongoDB.
 *
 *   npx tsx scripts/seed-school-master-data.ts            # dry run: only shows what would change
 *   npx tsx scripts/seed-school-master-data.ts --apply    # writes the changes
 *
 * Data comes from data/seed/school-master-data.json; the connection from MONGODB_URI in .env.
 * Safe to run again: every record is upserted by its `id` (settings by `singleSchool: true`) with $set, so
 * fields the JSON does not mention are kept and nothing is ever deleted.
 *
 * Stop the ERP server before --apply and start it again afterwards. The server keeps these collections in
 * memory and writes them back, so a running server would not see the new data and could overwrite it.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(here, '..', 'data', 'seed', 'school-master-data.json');
const LIST_COLLECTIONS = ['classes', 'subjects'] as const;
const IGNORED_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const allowRunningServer = args.has('--allow-running-server');

type Doc = Record<string, any>;
type Plan = { collection: string; key: string; action: 'INSERT' | 'UPDATE' | 'UNCHANGED'; changed: string[]; filter: Doc; doc: Doc };

function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Top-level fields of `wanted` whose value differs from `existing`. */
function changedFields(existing: Doc | null, wanted: Doc): string[] {
  if (!existing) return Object.keys(wanted);
  return Object.keys(wanted).filter((k) => !IGNORED_FIELDS.has(k) && stable(existing[k]) !== stable(wanted[k]));
}

function loadData() {
  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  for (const name of LIST_COLLECTIONS) {
    if (!Array.isArray(raw[name])) throw new Error(`${DATA_FILE}: "${name}" must be a list`);
    const ids = new Set<string>();
    for (const doc of raw[name]) {
      if (!doc?.id) throw new Error(`${name}: every record needs an "id"`);
      if (ids.has(doc.id)) throw new Error(`${name}: duplicate id "${doc.id}"`);
      ids.add(doc.id);
    }
  }
  if (!raw.school_settings || typeof raw.school_settings !== 'object') throw new Error('"school_settings" is missing');

  // References must point at classes in the file, so the ERP never shows a subject for a missing class.
  const classIds = new Set(raw.classes.map((c: Doc) => c.id));
  for (const s of raw.subjects) {
    for (const id of s.classIds || []) if (!classIds.has(id)) throw new Error(`subject ${s.id}: unknown class "${id}"`);
  }
  return raw;
}

async function serverIsRunning(): Promise<boolean> {
  const port = process.env.PORT || '3000';
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const data = loadData();
  const uri = String(process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');
  if (!uri) throw new Error('MONGODB_URI is not set (put it in .env).');

  if (apply && !allowRunningServer && (await serverIsRunning())) {
    throw new Error(
      'The ERP server is running on this machine. Stop it first (pkill -f "dist/server.cjs"), run --apply, then start it again.'
    );
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  // Same database choice as server/db/mongo.ts: the name in the URI, else cps_school_erp.
  const named = client.options.dbName;
  const dbName = named && named !== 'test' ? named : 'cps_school_erp';
  const db = client.db(dbName);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} on database "${dbName}"\n`);

  try {
    const plans: Plan[] = [];

    const settingsFilter = { singleSchool: true };
    const settingsDoc = { ...data.school_settings, singleSchool: true };
    const currentSettings = await db.collection('school_settings').findOne(settingsFilter);
    const settingsChanged = changedFields(currentSettings, settingsDoc);
    plans.push({
      collection: 'school_settings',
      key: 'singleSchool',
      action: !currentSettings ? 'INSERT' : settingsChanged.length ? 'UPDATE' : 'UNCHANGED',
      changed: settingsChanged,
      filter: settingsFilter,
      doc: settingsDoc,
    });

    for (const name of LIST_COLLECTIONS) {
      const existing = await db.collection(name).find({}).toArray();
      const byId = new Map(existing.map((d) => [String(d.id), d]));
      for (const doc of data[name] as Doc[]) {
        const current = byId.get(doc.id) || null;
        const changed = changedFields(current, doc);
        plans.push({
          collection: name,
          key: doc.id,
          action: !current ? 'INSERT' : changed.length ? 'UPDATE' : 'UNCHANGED',
          changed,
          filter: { id: doc.id },
          doc,
        });
      }
      const seedIds = new Set((data[name] as Doc[]).map((d) => d.id));
      const others = existing.filter((d) => !seedIds.has(String(d.id)));
      if (others.length) {
        console.log(`note: ${name} has ${others.length} record(s) not in the seed file; they are left as they are: ${others.map((d) => d.id).join(', ')}`);
      }
    }

    for (const p of plans) {
      const detail = p.action === 'UPDATE' ? `  fields: ${p.changed.join(', ')}` : '';
      console.log(`${p.action.padEnd(9)} ${p.collection.padEnd(18)} ${p.key}${detail}`);
    }
    const count = (a: Plan['action']) => plans.filter((p) => p.action === a).length;
    console.log(`\n${count('INSERT')} to insert, ${count('UPDATE')} to update, ${count('UNCHANGED')} unchanged.`);

    if (!apply) {
      console.log('\nDry run only, nothing was written. Run again with --apply to write.');
      return;
    }

    const now = new Date().toISOString();
    for (const p of plans) {
      if (p.action === 'UNCHANGED') continue;
      await db.collection(p.collection).updateOne(
        p.filter,
        { $set: { ...p.doc, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
    }

    console.log('\nWritten. Records now in the database:');
    console.log(`  school_settings: ${await db.collection('school_settings').countDocuments(settingsFilter)}`);
    for (const name of LIST_COLLECTIONS) console.log(`  ${name}: ${await db.collection(name).countDocuments()}`);
    console.log('\nNow start the ERP server again so it loads the new data.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`Seed failed: ${err?.message || err}`);
  process.exit(1);
});
