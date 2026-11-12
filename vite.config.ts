import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { pageSeo, siteBaseUrl, renderSeoHead, renderNoscript, injectSeo, buildSitemapXml, buildRobotsTxt, buildLlmsTxt } from './src/utils/seo';

const ALL_SPA_ROUTES = [
  'dashboard',
  'settings',
  'students',
  'staff',
  'teachers',
  'academics',
  'academic',
  'academic/timetable',
  'timetable',
  'homework',
  'attendance',
  'fees',
  'fees/collection',
  'fees/ledger',
  'fees/config',
  'fees/transactions',
  'fees/defaulters',
  'exams',
  'documents',
  'hostel',
  'transport',
  'communication',
  'reports',
  'audit-logs',
  'public-website-management',
  'profile',
  'results',
  'login',
  'reset-password',
  'website',
  'home',
  'about',
  'about-us',
  'management',
  'leadership',
  'admissions',
  'admission',
  'facilities',
  'gallery',
  'campus',
  'notices',
  'contact',
  'contact-us',
  'enquiry',
  'mandatory-disclosure',
  'portal',
  'privacy-policy',
  'cookie-policy',
];

function staticSpaRouteGeneratorPlugin(): Plugin {
  return {
    name: 'static-spa-route-generator',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexFile = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexFile)) return;

      const indexContent = fs.readFileSync(indexFile, 'utf-8');

      // Search-engine tags for static hosting (no Node server in front). The Node server replaces these with
      // live values from School Settings on every request; this build-time copy uses the saved settings file.
      let seoSettings: any = {};
      try {
        seoSettings = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data', 'schoolSettings.json'), 'utf-8'));
      } catch {
        seoSettings = {};
      }
      const seoBase = siteBaseUrl(seoSettings, '', process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL || '');
      const seoVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
      const htmlFor = (route: string) => {
        const page = pageSeo(`/${route}`, seoSettings);
        return injectSeo(indexContent, renderSeoHead(page, seoSettings, seoBase, { verification: seoVerification }), renderNoscript(page, seoSettings));
      };
      if (seoBase) {
        fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildSitemapXml(seoBase), 'utf-8');
        fs.writeFileSync(path.join(distDir, 'robots.txt'), buildRobotsTxt(seoBase), 'utf-8');
        fs.writeFileSync(path.join(distDir, 'llms.txt'), buildLlmsTxt(seoSettings, seoBase), 'utf-8');
      }
      // The home page itself
      fs.writeFileSync(indexFile, htmlFor(''), 'utf-8');

      // 1. Generate 404.html fallback for static CDN edge
      const fallback404 = path.join(distDir, '404.html');
      fs.writeFileSync(fallback404, indexContent, 'utf-8'); // generic fallback

      // 2. Generate physical static files and directories for every known route
      // This guarantees HTTP 200 on Render Static Sites without depending on dashboard rewrite rules
      for (const route of ALL_SPA_ROUTES) {
        // e.g., dist/dashboard.html
        const directHtmlPath = path.join(distDir, `${route}.html`);
        const parentDir = path.dirname(directHtmlPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        const routeHtml = htmlFor(route);
        fs.writeFileSync(directHtmlPath, routeHtml, 'utf-8');

        // e.g., dist/dashboard/index.html
        const nestedDir = path.join(distDir, route);
        if (!fs.existsSync(nestedDir)) {
          fs.mkdirSync(nestedDir, { recursive: true });
        }
        const nestedIndexPath = path.join(nestedDir, 'index.html');
        fs.writeFileSync(nestedIndexPath, routeHtml, 'utf-8');
      }

      console.log(`[Build] Successfully pre-generated static entry points for ${ALL_SPA_ROUTES.length} routes + 404.html in dist/`);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), staticSpaRouteGeneratorPlugin()],
    build: {
      // Main entry is ~590 kB (~135 kB gzip) after lazy-loading ERP pages; most of the rest is src/services/api.ts.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // React rarely changes, so a separate chunk stays cached in the browser across our deploys.
          manualChunks(id: string) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
