/**
 * CORS / emailed-link origin rules. Run: npx tsx scripts/verify-origin-policy.ts
 */
import { isAllowedOrigin, resetLinkBase } from '../server/services/originPolicy';

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};
check('Production site allowed', isAllowedOrigin('https://your-school-domain.example'));
check('School domain allowed', isAllowedOrigin('https://your-school-domain.example'));
check('Trailing slash tolerated', isAllowedOrigin('https://your-school-domain.example/'));
check('Unknown site refused', !isAllowedOrigin('https://evil.example'));
check('Look-alike suffix refused', !isAllowedOrigin('https://your-school-domain.example.evil.example'));
check('Path smuggling refused', !isAllowedOrigin('https://evil.example/your-backend.example'));
check('Non-string refused', !isAllowedOrigin(undefined) && !isAllowedOrigin(['https://x']));
check('Reset link ignores an unknown site', resetLinkBase('https://evil.example', {}) === 'https://your-school-domain.example');
check('Reset link keeps a known site', resetLinkBase('https://your-school-domain.example', {}) === 'https://your-school-domain.example');
check('Reset link uses FRONTEND_URL', resetLinkBase(undefined, { FRONTEND_URL: 'https://portal.example.org/' }) === 'https://portal.example.org');
process.env.CORS_ORIGINS = 'https://portal.example.org';
check('CORS_ORIGINS extends the list', isAllowedOrigin('https://portal.example.org'));
if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll origin checks passed.');
