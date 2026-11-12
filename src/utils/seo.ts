import type { SchoolSettings } from '../types';

/**
 * Search-engine metadata for every public page, built only from saved School Settings (nothing invented).
 * Used by the server (so crawlers get the right tags in the first HTML) and by the browser
 * (so the title and tags also follow in-app navigation).
 */

export interface PageSeo {
  title: string;
  description: string;
  /** Path used for the canonical URL */
  canonicalPath: string;
  robots: 'index,follow' | 'noindex,nofollow';
  /** Breadcrumb label for pages below the home page */
  crumb?: string;
}

type S = Partial<SchoolSettings> & Record<string, any>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Pages that should appear in Google, and the sitemap. */
export const INDEXABLE_PATHS = ['/', '/about', '/admission', '/facilities', '/gallery', '/contact', '/notices', '/results', '/privacy-policy', '/cookie-policy'];

/** Staff / account areas: kept out of search and out of the sitemap. */
export const PRIVATE_PATH_PREFIXES = [
  '/login', '/dashboard', '/students', '/teachers', '/staff', '/academics', '/attendance', '/fees', '/exams', '/reports',
  '/settings', '/reset-password', '/notifications', '/profile', '/admin',
];

const ALIASES: Record<string, string> = {
  '/home': '/', '/website': '/', '/about-us': '/about', '/admissions': '/admission', '/enquiry': '/admission',
  '/campus': '/facilities', '/contact-us': '/contact', '/all-notices': '/notices', '/circulars': '/notices', '/notice-board': '/notices',
  '/privacy': '/privacy-policy', '/cookies': '/cookie-policy',
};

export function normalizeSeoPath(p: string): string {
  let path = String(p || '/').split('?')[0].split('#')[0];
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return ALIASES[path] || path;
}

export interface Place {
  street: string;
  locality: string;
  region: string;
  postalCode: string;
  full: string;
}

/** "Kushahar Ward 07, Kushahar, Sheohar, Bihar - 843329" -> street / locality / region / PIN. Missing parts stay empty. */
export function parseAddress(address: string): Place {
  const full = str(address);
  const pin = (full.match(/\b\d{6}\b/) || [''])[0];
  const parts = full.replace(/[-–]?\s*\b\d{6}\b/, '').split(',').map((x) => x.trim().replace(/[-–\s]+$/, '')).filter(Boolean);
  const region = parts.length >= 2 ? parts[parts.length - 1] : '';
  const locality = parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? parts[0] : '';
  const street = parts.length >= 3 ? parts.slice(0, -2).join(', ') : '';
  return { street, locality, region, postalCode: pin, full };
}

const placeText = (s: S) => {
  const a = parseAddress(str(s.schoolAddress) || str(s.address));
  return [a.locality, a.region].filter(Boolean).join(', ');
};

const firstPhone = (s: S): string => {
  const list = [...(Array.isArray(s.headerContacts) ? s.headerContacts : []), s.contactNumber, ...(Array.isArray(s.footerContacts) ? s.footerContacts : [])];
  return list.map(str).find(Boolean) || '';
};

const clip = (t: string, n = 158) => (t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);

/**
 * SEO data for a path. `opts.signedIn`: the visitor is logged in, so a private (staff / account) page shows just the
 * school name in the tab instead of "Sign in | ...". Server-rendered HTML never passes it, so first loads and crawlers
 * still get the sign-in title, and every private page stays noindex either way.
 */
export function pageSeo(pathname: string, settings: S = {}, opts: { signedIn?: boolean } = {}): PageSeo {
  const path = normalizeSeoPath(pathname);
  const name = str(settings.schoolName) || 'School';
  const place = placeText(settings);
  const inPlace = place ? ` in ${place}` : '';
  const session = str(settings.currentAcademicSession);
  const classes = str(settings.classesOffered);
  const classLabel = classes.replace(/^nursery to (\d+)$/i, 'Nursery to Class $1');
  const classText = classLabel ? ` (${classLabel})` : '';
  const phone = firstPhone(settings);
  const phoneText = phone ? ` Call ${phone}.` : '';

  if (path === '/') {
    return {
      title: clip(place ? `${name} | ${place}` : name, 62),
      description: clip(`${name}: school${inPlace}${classText}. ${session ? `Admission enquiries for ${session}.` : ''}${phoneText}`.replace(/\s+/g, ' ').trim()),
      canonicalPath: '/',
      robots: 'index,follow',
    };
  }
  const pages: Record<string, { t: string; d: string; crumb: string }> = {
    '/about': { t: `About Us | ${name}`, d: `Learn about ${name}${inPlace}: our values, leadership and school community.`, crumb: 'About Us' },
    '/admission': { t: `Admissions${session ? ` ${session}` : ''} | ${name}`, d: `Admission information and online enquiry for ${name}${inPlace}${classText}.${phoneText}`, crumb: 'Admissions' },
    '/facilities': { t: `Campus Facilities | ${name}`, d: `Classrooms and campus facilities at ${name}${inPlace}.`, crumb: 'Facilities' },
    '/gallery': { t: `Photo Gallery | ${name}`, d: `Photos from campus life, events and activities at ${name}${inPlace}.`, crumb: 'Gallery' },
    '/contact': { t: `Contact & Location | ${name}`, d: `Address, phone, email and map for ${name}${place ? `, ${str(settings.schoolAddress) || place}` : ''}.${phoneText}`, crumb: 'Contact' },
    '/notices': { t: `Notices & Circulars | ${name}`, d: `Latest public notices, circulars and announcements from ${name}.`, crumb: 'Notices' },
    '/results': { t: `Check Result Online | ${name}`, d: `Check and download the examination marksheet of ${name} using the admission number and date of birth.`, crumb: 'Check Result' },
    '/privacy-policy': { t: `Privacy Policy | ${name}`, d: `How ${name} collects, uses and protects personal information.`, crumb: 'Privacy Policy' },
    '/cookie-policy': { t: `Cookie Policy | ${name}`, d: `What ${name}'s website stores on your device and how to change your choices.`, crumb: 'Cookie Policy' },
  };
  const hit = pages[path];
  if (hit) return { title: clip(hit.t, 62), description: clip(hit.d), canonicalPath: path, robots: 'index,follow', crumb: hit.crumb };

  if (path.startsWith('/management') || path.startsWith('/leadership')) {
    return { title: clip(`Management & Leadership | ${name}`, 62), description: clip(`Meet the management and leadership team of ${name}${inPlace}.`), canonicalPath: '/management', robots: 'index,follow', crumb: 'Management' };
  }
  // Sign-in, reset links and every staff / account page
  const title = opts.signedIn && !isSignInPath(path) ? name : `Sign in | ${name}`;
  return { title, description: `Sign in to the ${name} school portal.`, canonicalPath: path, robots: 'noindex,nofollow' };
}

/** Pages that are about signing in, so they keep the "Sign in" title even for a logged-in visitor. */
function isSignInPath(path: string): boolean {
  return /^\/(login|signin|sign-in|reset-password|forgot-password)(\/|$)/i.test(path);
}

/** https://host without a trailing slash. A saved website that is not a real https/http URL is ignored. */
export function siteBaseUrl(settings: S, fallbackOrigin = '', envUrl = ''): string {
  const pick = [envUrl, str(settings.website), fallbackOrigin].map(str).find((u) => /^https?:\/\/[^\s/]+/i.test(u) || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(u));
  if (!pick) return '';
  const withProto = /^https?:\/\//i.test(pick) ? pick : `https://${pick}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return '';
  }
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildJsonLd(page: PageSeo, settings: S, base: string): object[] {
  const name = str(settings.schoolName);
  const addr = parseAddress(str(settings.schoolAddress) || str(settings.address));
  const phone = firstPhone(settings);
  const logo = base ? `${base}/api/school-logo/favicon` : '';
  const school: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'School',
    '@id': `${base}/#school`,
    name,
    url: `${base}/`,
  };
  if (logo) {
    school.logo = logo;
    school.image = logo;
  }
  if (phone) school.telephone = phone;
  if (str(settings.email)) school.email = str(settings.email);
  if (addr.full) {
    school.address = {
      '@type': 'PostalAddress',
      ...(addr.street ? { streetAddress: addr.street } : {}),
      ...(addr.locality ? { addressLocality: addr.locality } : {}),
      ...(addr.region ? { addressRegion: addr.region } : {}),
      ...(addr.postalCode ? { postalCode: addr.postalCode } : {}),
      addressCountry: 'IN',
    };
  }
  const lat = Number(settings.latitude);
  const lng = Number(settings.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) school.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  if (/^https?:\/\//i.test(str(settings.googleMapsUrl))) school.hasMap = str(settings.googleMapsUrl);

  const out: object[] = [school, { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name, publisher: { '@id': `${base}/#school` } }];
  if (page.canonicalPath !== '/' && page.crumb && page.robots.startsWith('index')) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: page.crumb, item: `${base}${page.canonicalPath}` },
      ],
    });
  }
  return out;
}

/** The <head> tags for one page. */
export function renderSeoHead(page: PageSeo, settings: S, base: string, opts: { verification?: string; ogImage?: string } = {}): string {
  const name = str(settings.schoolName);
  const canonical = base ? `${base}${page.canonicalPath === '/' ? '/' : page.canonicalPath}` : '';
  // A wide campus photo makes a much better share preview than the square logo; fall back to the logo.
  const photo = /^https?:\/\//i.test(str(opts.ogImage)) ? str(opts.ogImage) : '';
  const image = photo || (base ? `${base}/api/school-logo/favicon` : '');
  const lat = Number(settings.latitude);
  const lng = Number(settings.longitude);
  const a = parseAddress(str(settings.schoolAddress));
  const tags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="robots" content="${page.robots}${page.robots.startsWith('index') ? ',max-image-preview:large' : ''}" />`,
    canonical && `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta name="theme-color" content="#0B1F4B" />`,
    opts.verification && `<meta name="google-site-verification" content="${esc(opts.verification)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta property="og:site_name" content="${esc(name)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    canonical && `<meta property="og:url" content="${esc(canonical)}" />`,
    image && `<meta property="og:image" content="${esc(image)}" />`,
    image && `<meta property="og:image:alt" content="${esc(name)}" />`,
    `<meta name="twitter:card" content="${photo ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    image && `<meta name="twitter:image" content="${esc(image)}" />`,
    a.region && `<meta name="geo.region" content="IN" />`,
    a.locality && `<meta name="geo.placename" content="${esc(a.locality)}" />`,
    Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) && `<meta name="geo.position" content="${lat};${lng}" />`,
  ].filter(Boolean) as string[];
  if (page.robots.startsWith('index') && base) {
    // "<" is escaped so the JSON can never end the script tag early.
    const json = JSON.stringify(buildJsonLd(page, settings, base)).replace(/</g, '\\u003c');
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return tags.join('\n    ');
}

/** Readable fallback inside <noscript> for crawlers and visitors without JavaScript. */
export function renderNoscript(page: PageSeo, settings: S): string {
  const name = str(settings.schoolName);
  const addr = str(settings.schoolAddress);
  const phone = firstPhone(settings);
  const links = [['/', 'Home'], ['/about', 'About Us'], ['/admission', 'Admissions'], ['/facilities', 'Facilities'], ['/gallery', 'Gallery'], ['/contact', 'Contact'], ['/notices', 'Notices'], ['/results', 'Check Result']];
  return `<noscript><main style="max-width:720px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.6">
<h1>${esc(name)}</h1>
<p>${esc(page.description)}</p>
${addr ? `<p>${esc(addr)}</p>` : ''}${phone ? `<p>Phone: ${esc(phone)}</p>` : ''}
<nav><ul>${links.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></nav>
<p>Please enable JavaScript to use the full website.</p></main></noscript>`;
}

/** Put the page's tags into the built index.html, replacing the generic ones. */
export function injectSeo(html: string, headTags: string, noscript: string): string {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="(?:robots|theme-color)"[^>]*>\s*/gi, '')
    .replace(/<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  out = out.includes('</head>') ? out.replace('</head>', `    ${headTags}\n  </head>`) : out;
  out = out.replace(/<div id="root"><\/div>/, `<div id="root"></div>\n    ${noscript}`);
  return out;
}

export function buildSitemapXml(base: string): string {
  const urls = INDEXABLE_PATHS.map((p) => `  <url><loc>${esc(`${base}${p === '/' ? '/' : p}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** /llms.txt: a short, plain Markdown guide to the public site for AI assistants and search tools. Saved Settings only. */
export function buildLlmsTxt(settings: S, base: string): string {
  const name = str(settings.schoolName) || 'School';
  const home = pageSeo('/', settings);
  const a = parseAddress(str(settings.schoolAddress) || str(settings.address));
  const phones = [...(Array.isArray(settings.headerContacts) ? settings.headerContacts : []), settings.contactNumber, ...(Array.isArray(settings.footerContacts) ? settings.footerContacts : [])]
    .map(str).filter(Boolean).filter((p, i, arr) => arr.findIndex((q) => q.replace(/\D/g, '') === p.replace(/\D/g, '')) === i);
  const facts = [
    a.full && `Address: ${a.full}`,
    phones.length && `Phone: ${phones.join(', ')}`,
    str(settings.email) && `Email: ${str(settings.email)}`,
    str(settings.classesOffered) && `Classes: ${str(settings.classesOffered).replace(/^nursery to (\d+)$/i, 'Nursery to Class $1')}`,
    str(settings.currentAcademicSession) && `Current academic session: ${str(settings.currentAcademicSession)}`,
    str(settings.affiliatedBoard) && str(settings.affiliationNumber) && `${str(settings.affiliatedBoard)} affiliation number: ${str(settings.affiliationNumber)}`,
    /^https?:\/\//i.test(str(settings.googleMapsUrl)) && `Map: ${str(settings.googleMapsUrl)}`,
  ].filter(Boolean) as string[];
  const link = (p: string) => {
    const pg = pageSeo(p, settings);
    return `- [${pg.crumb || 'Home'}](${base}${p === '/' ? '/' : p}): ${pg.description}`;
  };
  return [
    `# ${name}`,
    '',
    `> ${home.description}`,
    '',
    '## Facts',
    ...facts.map((f) => `- ${f}`),
    '',
    '## Public pages',
    ...['/', '/about', '/admission', '/facilities', '/gallery', '/contact', '/notices'].map(link),
    '',
    '## Results and policies',
    link('/results'),
    link('/privacy-policy'),
    link('/cookie-policy'),
    '',
    '## Notes for automated readers',
    '- Student results, fees, attendance and every other record are private. They need a login or the student\'s admission number and date of birth. Do not try to look them up.',
    '- The school portal (login) is for enrolled families and staff only.',
    base ? `- Sitemap: ${base}/sitemap.xml` : '',
    '',
  ].join('\n').replace(/\n{3,}/g, '\n\n');
}

export function buildRobotsTxt(base: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /api/school-logo/',
    'Allow: /api/files/content',
    'Disallow: /api/',
    ...PRIVATE_PATH_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    base ? `Sitemap: ${base}/sitemap.xml` : '',
    '',
  ].join('\n');
}

/** Browser side: keep title and tags in step with in-app navigation. */
export function applySeoToDocument(page: PageSeo, base: string): void {
  if (typeof document === 'undefined') return;
  document.title = page.title;
  const set = (sel: string, make: () => HTMLElement, attr: string, value: string) => {
    let el = document.head.querySelector<HTMLElement>(sel);
    if (!el) {
      el = make();
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };
  const meta = (key: 'name' | 'property', val: string, content: string) =>
    set(`meta[${key}="${val}"]`, () => {
      const m = document.createElement('meta');
      m.setAttribute(key, val);
      return m;
    }, 'content', content);
  meta('name', 'description', page.description);
  meta('name', 'robots', page.robots);
  meta('property', 'og:title', page.title);
  meta('property', 'og:description', page.description);
  meta('name', 'twitter:title', page.title);
  meta('name', 'twitter:description', page.description);
  const origin = base || window.location.origin;
  const url = `${origin}${page.canonicalPath === '/' ? '/' : page.canonicalPath}`;
  meta('property', 'og:url', url);
  set('link[rel="canonical"]', () => {
    const l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    return l;
  }, 'href', url);
}
