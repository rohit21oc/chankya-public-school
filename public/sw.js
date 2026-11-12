/* School ERP service worker: shows push notifications when the site is closed or in the background. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    p = { title: 'School update', body: event.data ? event.data.text() : '' };
  }
  const title = String(p.title || 'School update').slice(0, 80);
  const body = String(p.body || '').slice(0, 200);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // The person is looking at the site: let the page show its own small popup instead of a system banner.
      if (windows.some((w) => w.visibilityState === 'visible')) {
        windows.forEach((w) => w.postMessage({ type: 'SCHOOL_PUSH', payload: { title, body, kind: p.type, url: p.url || '/' } }));
        return;
      }
      await self.registration.showNotification(title, {
        body,
        icon: '/api/school-logo/favicon',
        tag: String(p.type || 'school') + ':' + String((p.data && (p.data.threadId || p.data.noticeId || p.data.homeworkId || p.data.enquiryId || p.data.studentId)) || ''),
        renotify: true,
        data: { url: typeof p.url === 'string' && p.url.charAt(0) === '/' ? p.url : '/' },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (w.url.indexOf(self.location.origin) === 0 && 'focus' in w) {
          await w.focus();
          if ('navigate' in w) {
            try { await w.navigate(url); } catch (e) { /* the page keeps its place */ }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
