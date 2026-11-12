/**
 * Image proxy URL rules. Run: npx tsx scripts/verify-url-safety.ts
 */
import { isPrivateAddress, isSafePublicUrl, parsePublicHttpUrl } from '../server/services/urlSafety';

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};
const fakeLookup = (map: Record<string, string[]>) => (async (host: string) => (map[host] || []).map((address) => ({ address, family: 4 }))) as any;

for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) {
  check(`Private ${ip}`, isPrivateAddress(ip));
}
check('Public 8.8.8.8', !isPrivateAddress('8.8.8.8'));
check('No file: URLs', !parsePublicHttpUrl('file:///etc/passwd'));
check('No localhost', !parsePublicHttpUrl('http://localhost:3000/api/health'));
check('No odd ports', !parsePublicHttpUrl('http://example.com:6379/'));
check('No credentials in URL', !parsePublicHttpUrl('https://user:pw@example.com/a.png'));
check('No metadata IP', !parsePublicHttpUrl('http://169.254.169.254/latest/meta-data'));
check('Normal https image ok', !!parsePublicHttpUrl('https://images.example.com/a.jpg'));

(async () => {
  check('Host resolving to public IP ok', await isSafePublicUrl('https://img.example.com/a.png', fakeLookup({ 'img.example.com': ['93.184.216.34'] })));
  check('Host resolving to private IP refused', !(await isSafePublicUrl('https://evil.example.com/a.png', fakeLookup({ 'evil.example.com': ['10.0.0.5'] }))));
  check('Mixed answers refused', !(await isSafePublicUrl('https://mix.example.com/a.png', fakeLookup({ 'mix.example.com': ['93.184.216.34', '127.0.0.1'] }))));
  check('Unresolvable refused', !(await isSafePublicUrl('https://none.example.com/a.png', fakeLookup({}))));
  if (failed) {
    console.log(`\n${failed} failed`);
    process.exit(1);
  }
  console.log('\nAll URL safety checks passed.');
})();
