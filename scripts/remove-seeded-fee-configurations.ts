/**
 * Removes the 10 class fee configurations that the first version of seed-school-master-data.ts added.
 * Only these exact ids are touched; any fee configuration created in the ERP is left alone.
 *
 *   npx tsx scripts/remove-seeded-fee-configurations.ts            # dry run: lists what would be removed
 *   npx tsx scripts/remove-seeded-fee-configurations.ts --apply    # removes them
 *
 * Stop the ERP server before --apply and start it again afterwards (it keeps fee configurations in memory
 * and would write them back).
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const SEEDED_IDS = [
  'fc-c-nur-all-2026-2027',
  'fc-c-1790998355737-all-2026-2027',
  'fc-c-1',
  'fc-c-2',
  'fc-c-3',
  'fc-c-4',
  'fc-c-5',
  'fc-c-6',
  'fc-c-7',
  'fc-c-8',
];

const apply = process.argv.includes('--apply');

async function serverIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.PORT || '3000'}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');
  if (!uri) throw new Error('MONGODB_URI is not set (put it in .env).');
  if (apply && (await serverIsRunning())) {
    throw new Error('The ERP server is running. Stop it first (pkill -f "dist/server.cjs"), run --apply, then start it again.');
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const named = client.options.dbName;
  const db = client.db(named && named !== 'test' ? named : 'pds_school_erp');
  try {
    const col = db.collection('fee_configurations');
    const found = await col.find({ id: { $in: SEEDED_IDS } }, { projection: { id: 1, className: 1 } }).toArray();
    console.log(`${apply ? 'APPLY' : 'DRY RUN'} on database "${db.databaseName}"`);
    for (const d of found) console.log(`REMOVE    ${d.id}  (${d.className || d.classId || ''})`);
    console.log(`${found.length} seeded fee configuration(s) found; ${(await col.countDocuments()) - found.length} other(s) kept.`);
    if (!apply) {
      console.log('Dry run only, nothing was removed. Run again with --apply to remove.');
      return;
    }
    const res = await col.deleteMany({ id: { $in: SEEDED_IDS } });
    console.log(`Removed ${res.deletedCount}. Fee configurations left: ${await col.countDocuments()}. Now start the ERP server again.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`Failed: ${err?.message || err}`);
  process.exit(1);
});
