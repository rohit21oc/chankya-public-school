# SEO and Google Search Console

## What the website does now
- **Per-page tags**: every public page (`/`, `/about`, `/admission`, `/facilities`, `/gallery`, `/contact`, `/notices`, `/results`, `/privacy-policy`, `/cookie-policy`) has its own title, description, canonical URL, Open Graph and Twitter tags. They are built from School Settings (name, address, phone, session, classes offered), never invented. Logic: `src/utils/seo.ts`.
- **Structured data (JSON-LD)**: `School` + `WebSite` on every public page, `BreadcrumbList` on inner pages. Address, phone, email and map position are included only when saved in Settings.
- **Crawler-safe HTML**: the Node server writes the tags into the first HTML response, so Google and WhatsApp/Facebook previews see them without running JavaScript. A `<noscript>` summary is included. The browser also updates the title and tags when the visitor navigates inside the site.
- **robots.txt** and **sitemap.xml** are served dynamically at `/robots.txt` and `/sitemap.xml`. Login, portal, reset-password and `/api/` are blocked and marked `noindex`.
- **llms.txt** at `/llms.txt`: a short Markdown guide for AI assistants (school facts from Settings, public pages, and a note that student records are private).
- **Share preview (Open Graph)**: WhatsApp, Facebook and X show the first active home-page banner photo (wide, large preview). If there is no banner, the school logo is used. Change the first banner in Public Website Management to change the preview.
- Static hosting (no Node server): `npm run build` also writes the same tags, `robots.txt` and `sitemap.xml` into `dist/`.
- Images below the fold load lazily; all images have alt text.

## One-time setup (do this first)
1. **Set the real domain.** Settings > Website must be the real address, for example `https://yourschool.in` (no path). Canonical links and the sitemap use it. You can override it with the environment variable `PUBLIC_SITE_URL`.
2. Fill in Settings: school address with PIN, phone, email, classes offered, current session, latitude/longitude, Google Maps URL. The better the data, the better the search result.
3. Use HTTPS, and redirect `www` to the one main version (or the other way round). Pick one and keep it.
4. Deploy this version, then open `https://yourschool.in/robots.txt` and `https://yourschool.in/sitemap.xml` in a browser. Both must open and show your domain.

## Add the site to Google Search Console
1. Go to https://search.google.com/search-console and sign in with the school's Google account (use an account that will stay with the school, not a personal one).
2. Click **Add property**.
   - **Domain** (best): enter `yourschool.in`. Verify with a **DNS TXT record** at your domain registrar (MilesWeb, GoDaddy, etc.). It covers http, https, www and non-www.
   - **URL prefix**: enter `https://yourschool.in/`. Verify with any one of:
     - **HTML tag**: copy the `content` value from the meta tag Google shows and set it as environment variable `GOOGLE_SITE_VERIFICATION` on the server, then restart. The tag is added to every page automatically.
     - **HTML file**: download the `googleXXXX.html` file and put it in the `public/` folder, then deploy.
3. Press **Verify**. Keep the verification method in place permanently.
4. Open **Sitemaps**, enter `sitemap.xml`, press **Submit**. Status should become "Success" within a day.
5. Open **URL Inspection**, paste `https://yourschool.in/`, press **Test live URL**, then **Request indexing**. Repeat for `/admission`, `/contact`, `/results`, `/notices`.
6. Later, check **Pages** (which pages are indexed and why others are not), **Performance** (searches and clicks), and **Enhancements** for structured data problems.

Indexing usually starts in a few days; ranking takes weeks. Do not buy "instant ranking" services.

## Google Business Profile (most important for a local school)
Search Console controls the website; the map listing, reviews, photos and the "school near me" panel come from Google Business Profile.
1. Go to https://business.google.com and search for the school; claim the existing listing (it already exists on Google Maps) or create it.
2. Verify ownership (postcard, phone or video, as Google offers).
3. Fill in: exact name, category "School" (add "Boarding school" if shown), address, phone, website (your domain), working days, photos of campus, hostel, events.
4. Make the name, address and phone **identical** to the website footer and Settings.
5. Ask parents to leave honest reviews and reply to them.

## Other search engines and sharing
- Bing: https://www.bing.com/webmasters, "Import from Google Search Console" (one click), then submit the sitemap.
- WhatsApp/Facebook preview: after deploy, test a link in https://developers.facebook.com/tools/debug/ and press "Scrape Again" if the old preview is cached.
- Re-share cache: after changing the banner, press "Scrape Again" in the Facebook debugger; WhatsApp refreshes on its own after a while.
- Rich result check: https://search.google.com/test/rich-results with the home page URL; `School` should be detected.

## Keeping SEO healthy
- Publish notices and events regularly; keep gallery photos with meaningful captions.
- Do not create duplicate pages for the same content. Aliases such as `/admissions` already point to one canonical URL.
- When the domain changes, update Settings > Website (or `PUBLIC_SITE_URL`), submit the new sitemap, and use the Change of Address tool in Search Console.
- Tests: `npx tsx scripts/verify-seo.ts`.
