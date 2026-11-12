/**
 * Responsive UI check for Dashboard, Students, Admission, Teachers & Staff and Staff Salary.
 *
 * Signs in through the real staff login page, opens each screen at phone, tablet and desktop widths and
 * reports: page-level horizontal scrolling, visible text that still mentions internal technology, and
 * buttons smaller than 32 px. Saves a screenshot of every screen/width.
 *
 * Needs a running server (UI_AUDIT_BASE_URL, default http://localhost:3000), a staff account to sign in
 * with (UI_AUDIT_USER / UI_AUDIT_PASSWORD) and Playwright with Chromium. Playwright is not a project
 * dependency; point NODE_PATH at an existing install, e.g.
 *   NODE_PATH=$(npm root -g) UI_AUDIT_USER=PDS0001 UI_AUDIT_PASSWORD=... npx tsx scripts/verify-responsive-ui.ts ./ui-shots
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let playwright: any;
try {
  playwright = require('playwright');
} catch {
  console.error('Playwright is not available. Install it or set NODE_PATH to a folder that contains it.');
  process.exit(2);
}

const BASE = process.env.UI_AUDIT_BASE_URL || 'http://localhost:3000';
const USER = process.env.UI_AUDIT_USER || '';
const PASSWORD = process.env.UI_AUDIT_PASSWORD || '';
const OUT = process.argv[2] || 'ui-shots';
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1366];
const PAGES = [
  { name: 'dashboard', path: '/dashboard', ready: 'text=Quick' },
  { name: 'students', path: '/students', ready: 'text=Student' },
  { name: 'admission', path: '/students/admission', ready: 'text=Admission' },
  { name: 'teachers', path: '/teachers', ready: 'text=Staff' },
  { name: 'salary', path: '/salary', ready: 'text=Salary' },
];
const TECH_WORDS = /\b(mongo(db)?|atlas|sync db|database|backend|collection name|stack trace|cloudflare r2)\b/i;

type Finding = { page: string; width: number; kind: string; detail: string };

async function main() {
  if (!USER || !PASSWORD) throw new Error('Set UI_AUDIT_USER and UI_AUDIT_PASSWORD.');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('pageerror', (e: Error) => consoleErrors.push(e.message));

  await page.goto(`${BASE}/login/staff`, { waitUntil: 'domcontentloaded' });
  await page.fill('#staff-id-input', USER);
  await page.fill('#staff-password-input', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { timeout: 30000 });

  const findings: Finding[] = [];
  for (const target of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto(`${BASE}${target.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(target.ready, { timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(1200);

      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
        // Elements wider than the viewport that are not inside an intentional horizontal scroller.
        const offenders: string[] = [];
        if (overflow > 1) {
          const all = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
          for (const el of all) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.right <= window.innerWidth + 1) continue;
            let p: HTMLElement | null = el.parentElement;
            let contained = false;
            while (p && p !== document.body) {
              const ox = getComputedStyle(p).overflowX;
              if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
                contained = true;
                break;
              }
              p = p.parentElement;
            }
            if (!contained) {
              offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || '').toString().split(' ').slice(0, 3).join('.')} (${Math.round(r.right)}px)`);
              if (offenders.length >= 5) break;
            }
          }
        }
        const text = document.body.innerText || '';
        const smallButtons = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]'))
          .filter((b) => {
            const r = b.getBoundingClientRect();
            const visible = r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden';
            return visible && r.top < window.innerHeight * 3 && (r.height < 32 && r.width < 32);
          })
          .map((b) => (b.getAttribute('aria-label') || b.textContent || b.tagName).trim().slice(0, 30))
          .slice(0, 6);
        return { overflow, offenders, text, smallButtons };
      });

      const file = path.join(OUT, `${target.name}-${width}.png`);
      await page.screenshot({ path: file, fullPage: false });
      if (result.overflow > 1) {
        findings.push({ page: target.name, width, kind: 'horizontal-overflow', detail: `${result.overflow}px; ${result.offenders.join(', ')}` });
      }
      const tech = result.text.match(TECH_WORDS);
      if (tech) findings.push({ page: target.name, width, kind: 'technical-text', detail: tech[0] });
      if (width <= 430 && result.smallButtons.length) {
        findings.push({ page: target.name, width, kind: 'small-touch-target', detail: result.smallButtons.join(' | ') });
      }
    }
  }
  await browser.close();

  const overflow = findings.filter((f) => f.kind === 'horizontal-overflow');
  const tech = findings.filter((f) => f.kind === 'technical-text');
  for (const f of findings) console.log(`${f.kind === 'small-touch-target' ? 'NOTE' : 'FAIL'}  ${f.page} @${f.width}px  ${f.kind}: ${f.detail}`);
  if (consoleErrors.length) console.log(`\nPage errors:\n  ${[...new Set(consoleErrors)].join('\n  ')}`);
  console.log(`\nScreens checked: ${PAGES.length * WIDTHS.length}. Overflow: ${overflow.length}. Technical text: ${tech.length}. Page errors: ${consoleErrors.length}.`);
  console.log(`Screenshots: ${path.resolve(OUT)}`);
  process.exit(overflow.length || tech.length || consoleErrors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Responsive UI check could not run:', err?.message || err);
  process.exit(2);
});
