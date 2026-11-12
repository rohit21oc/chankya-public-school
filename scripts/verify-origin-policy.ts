/**
 * CORS / emailed-link origin rules. Run: npx tsx scripts/verify-origin-policy.ts
 */
import { isAllowedOrigin, resetLinkBase } from '../server/services/originPolicy';

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};
check('Production site allowed', isAllowedOrigin('https://residentialpdsschool.in'));
check('School domain allowed', isAllowedOrigin('https://residentialpdssheohar.edu.in'));
check('Trailing slash tolerated', isAllowedOrigin('https://residentialpdsschool.in/'));
check('Unknown site refused', !isAllowedOrigin('https://evil.example'));
check('Look-alike suffix refused', !isAllowedOrigin('https://residentialpdsschool.in.evil.example'));
check('Path smuggling refused', !isAllowedOrigin('https://evil.example/residentialpdspublicschool.onrender.com'));
check('Non-string refused', !isAllowedOrigin(undefined) && !isAllowedOrigin(['https://x']));
check('Reset link ignores an unknown site', resetLinkBase('https://evil.example', {}) === 'https://residentialpdsschool.in');
check('Reset link keeps a known site', resetLinkBase('https://residentialpdssheohar.edu.in', {}) === 'https://residentialpdssheohar.edu.in');
check('Reset link uses FRONTEND_URL', resetLinkBase(undefined, { FRONTEND_URL: 'https://portal.example.org/' }) === 'https://portal.example.org');
process.env.CORS_ORIGINS = 'https://portal.example.org';
check('CORS_ORIGINS extends the list', isAllowedOrigin('https://portal.example.org'));
if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll origin checks passed.');
