import { SingleFlightCache } from '../src/utils/requestCache';

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`  PASS: ${name}`); } else { failed++; console.log(`  FAIL: ${name} ${detail}`); }
};

(async () => {
  let t = 0;
  const now = () => t;
  const mk = () => new SingleFlightCache<{ ok: boolean; n: number }>(60_000, (r) => r.ok, now);
  let calls = 0;
  const slowOk = () => new Promise<{ ok: boolean; n: number }>((r) => setTimeout(() => r({ ok: true, n: ++calls }), 20));

  console.log('--- Request cache ---');
  let c = mk(); calls = 0;
  const [a, b] = await Promise.all([c.get('tok', slowOk), c.get('tok', slowOk)]);
  check('concurrent callers share one request', calls === 1 && a.value.n === b.value.n);

  const again = await c.get('tok', slowOk);
  check('second call within TTL is served from cache', again.fromCache && calls === 1);

  t += 61_000;
  const expired = await c.get('tok', slowOk);
  check('expired entry triggers a fresh request', !expired.fromCache && calls === 2);

  const forced = await c.get('tok', slowOk, true);
  check('force bypasses the cache', !forced.fromCache && calls === 3);

  const other = await c.get('other-user-token', slowOk);
  check("another session's token never gets cached data", !other.fromCache && calls === 4);

  console.log('--- Failures are not cached ---');
  c = mk(); calls = 0;
  let fail = true;
  const flaky = async () => (fail ? { ok: false, n: ++calls } : { ok: true, n: ++calls });
  await c.get('t', flaky);
  fail = false;
  const retry = await c.get('t', flaky);
  check('a failed result is retried, not cached', !retry.fromCache && retry.value.ok && calls === 2);

  fail = true;
  await c.get('t', flaky, true);
  fail = false;
  const afterFail = await c.get('t', flaky);
  check('a failed refresh drops older data (fail closed)', !afterFail.fromCache);

  c = mk();
  await c.get('t', async () => ({ ok: true, n: 1 }));
  c.clear();
  check('clear() removes cached data (logout)', !(await c.get('t', async () => ({ ok: true, n: 2 }))).fromCache);

  console.log(`\nREQUEST CACHE: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
