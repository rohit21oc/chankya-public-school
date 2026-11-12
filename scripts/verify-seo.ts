import assert from 'node:assert/strict';
import { pageSeo, parseAddress, siteBaseUrl, renderSeoHead, injectSeo, renderNoscript, buildSitemapXml, buildRobotsTxt, normalizeSeoPath, buildJsonLd, buildLlmsTxt } from '../src/utils/seo';

const s: any = {
  schoolName: 'TEST PUBLIC SCHOOL', schoolAddress: 'BRC Near Shahpur Road, Sheohar, Bihar - 843329', contactNumber: '95075 95491',
  headerContacts: ['9507595491'], email: 'a@b.in', classesOffered: 'Nursery to 8', currentAcademicSession: '2026-2027',
  latitude: 26.5, longitude: 85.2, website: 'https://school.example.in/',
};
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

t('address is split into street / locality / region / PIN', () => {
  const a = parseAddress(s.schoolAddress);
  assert.deepEqual([a.street, a.locality, a.region, a.postalCode], ['BRC Near Shahpur Road', 'Sheohar', 'Bihar', '843329']);
});
t('home title and description use saved settings and stay short', () => {
  const p = pageSeo('/', s);
  assert.ok(p.title.includes('TEST PUBLIC SCHOOL') && p.title.includes('Sheohar') && p.title.length <= 66, p.title);
  assert.ok(p.description.length <= 160 && p.description.includes('2026-2027') && p.description.includes('Nursery to Class 8'), p.description);
});
t('aliases resolve to one canonical page', () => {
  assert.equal(normalizeSeoPath('/admissions/'), '/admission');
  assert.equal(pageSeo('/about-us', s).canonicalPath, '/about');
});
t('every public page has a different title', () => {
  const titles = ['/', '/about', '/admission', '/facilities', '/gallery', '/contact', '/notices', '/results'].map((p) => pageSeo(p, s).title);
  assert.equal(new Set(titles).size, titles.length);
});
t('login, portal and reset pages are noindex', () => {
  for (const p of ['/login', '/dashboard', '/students/12', '/reset-password']) assert.equal(pageSeo(p, s).robots, 'noindex,nofollow', p);
  // Logged in: private pages show only the school name; sign-in pages and anonymous visitors keep "Sign in | ..."
  for (const p of ['/dashboard', '/students', '/students/12']) {
    assert.equal(pageSeo(p, s, { signedIn: true }).title, pageSeo('/x', s).title.replace(/^Sign in \| /, ''), p);
    assert.equal(pageSeo(p, s, { signedIn: true }).robots, 'noindex,nofollow', p);
    assert.ok(pageSeo(p, s).title.startsWith('Sign in | '), p);
  }
  for (const p of ['/login', '/reset-password']) assert.ok(pageSeo(p, s, { signedIn: true }).title.startsWith('Sign in | '), p);
  assert.ok(pageSeo('/about', s, { signedIn: true }).title.startsWith('About Us | '));
});
t('site base url: env, then saved website, then request; bad values ignored', () => {
  assert.equal(siteBaseUrl(s, 'http://localhost:3000', ''), 'https://school.example.in');
  assert.equal(siteBaseUrl(s, 'http://localhost:3000', 'https://env.example.in/x'), 'https://env.example.in');
  assert.equal(siteBaseUrl({ website: 'not a url' }, 'https://req.example.in'), 'https://req.example.in');
});
t('head tags: canonical, Open Graph, JSON-LD School, no missing school data invented', () => {
  const head = renderSeoHead(pageSeo('/contact', s), s, 'https://school.example.in', { verification: 'abc123' });
  assert.ok(head.includes('rel="canonical" href="https://school.example.in/contact"'));
  assert.ok(head.includes('og:title') && head.includes('google-site-verification" content="abc123"'));
  const ld = buildJsonLd(pageSeo('/contact', s), s, 'https://school.example.in') as any[];
  assert.equal(ld[0]['@type'], 'School');
  assert.equal(ld[0].address.postalCode, '843329');
  assert.ok(ld.some((x) => x['@type'] === 'BreadcrumbList'));
  const bare = buildJsonLd(pageSeo('/', { schoolName: 'X' }), { schoolName: 'X' }, 'https://x.in')[0] as any;
  assert.ok(!bare.address && !bare.telephone && !bare.geo);
});
t('noindex pages get no structured data', () => {
  assert.ok(!renderSeoHead(pageSeo('/login', s), s, 'https://school.example.in').includes('ld+json'));
});
t('JSON-LD cannot break out of its script tag', () => {
  const evil = { ...s, schoolName: '</script><script>alert(1)</script>' };
  const head = renderSeoHead(pageSeo('/', evil), evil, 'https://school.example.in');
  assert.ok(!/<\/script><script>alert/.test(head));
});
t('injectSeo replaces generic tags, keeps scripts, adds noscript', () => {
  const html = '<html><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"><meta name="theme-color" content="#000"></head><body><div id="root"></div><script src="/a.js"></script></body></html>';
  const out = injectSeo(html, renderSeoHead(pageSeo('/', s), s, 'https://school.example.in'), renderNoscript(pageSeo('/', s), s));
  assert.equal((out.match(/<title>/g) || []).length, 1);
  assert.equal((out.match(/name="description"/g) || []).length, 1);
  assert.equal((out.match(/theme-color/g) || []).length, 1);
  assert.ok(out.includes('<noscript>') && out.includes('<script src="/a.js">'));
});
t('sitemap lists only public pages; robots blocks API and portal and points to the sitemap', () => {
  const sm = buildSitemapXml('https://school.example.in');
  assert.ok(sm.includes('<loc>https://school.example.in/</loc>') && sm.includes('/results') && !sm.includes('/login') && !sm.includes('/dashboard'));
  const rb = buildRobotsTxt('https://school.example.in');
  assert.ok(rb.includes('Disallow: /api/') && rb.includes('Disallow: /login') && rb.includes('Sitemap: https://school.example.in/sitemap.xml') && rb.includes('Allow: /api/school-logo/'));
});
t('llms.txt: Markdown with saved facts, public pages, and a privacy note', () => {
  const l = buildLlmsTxt(s, 'https://school.example.in');
  assert.ok(l.startsWith('# TEST PUBLIC SCHOOL\n\n> '));
  assert.ok(l.includes('Address: BRC Near Shahpur Road, Sheohar, Bihar - 843329') && l.includes('[Admissions](https://school.example.in/admission)'));
  assert.ok(l.includes('Do not try to look them up') && l.includes('Sitemap: https://school.example.in/sitemap.xml'));
  const bare = buildLlmsTxt({ schoolName: 'X' }, 'https://x.in');
  assert.ok(!bare.includes('Address:') && !bare.includes('Phone:') && !bare.includes('Email:'));
});
t('Open Graph uses a wide photo when given, else the logo; card type follows', () => {
  const withPhoto = renderSeoHead(pageSeo('/', s), s, 'https://school.example.in', { ogImage: 'https://img.example.in/campus.jpg' });
  assert.ok(withPhoto.includes('og:image" content="https://img.example.in/campus.jpg"') && withPhoto.includes('summary_large_image') && withPhoto.includes('og:image:alt'));
  const noPhoto = renderSeoHead(pageSeo('/', s), s, 'https://school.example.in');
  assert.ok(noPhoto.includes('/api/school-logo/favicon') && noPhoto.includes('content="summary"'));
});
console.log(`\n${n} passed`);
