// Bump VERSION whenever you change app files so installed copies update.
const VERSION = 'mch-v14';
const OFFLINE = 'mch-offline-v1';   // files the user saved for offline use (never auto-deleted)
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest',
  'assets/cover.jpg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'update-kit.js'];
const IMG = 'mch-images-v1';

// Install: download every app file and report the real progress to the page (drives the update ring).
// The new version then WAITS; it is switched on only when the user taps "Update" (see update-kit.js).
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    let n = 0, dead = false;
    const say = async (pct) => { const l = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' }); if (!dead) l.forEach((w) => w.postMessage({ type: 'upk-progress', v: VERSION, pct })); };
    await say(0);
    try {
      await Promise.all(SHELL.map(async (u) => {
        const r = await fetch(new Request(u, { cache: 'reload' }));
        if (!r.ok) throw new Error('Could not download ' + u);
        await c.put(u, r);
        await say(Math.round(++n / SHELL.length * 100));
      }));
    } catch (err) { dead = true; throw err; }     // stop reporting; the old version stays in use
  })());
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== IMG && k !== OFFLINE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Serve files saved for offline use (supports Range requests so video can seek)
async function offlineFile(req) {
  const c = await caches.open(OFFLINE);
  const hit = await c.match(req.url);
  if (!hit) return new Response('This file is not saved for offline use.', { status: 404 });
  const blob = await hit.blob();
  const type = hit.headers.get('Content-Type') || 'application/octet-stream';
  const name = decodeURIComponent(new URL(req.url).pathname.split('/').pop());
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Disposition': type === 'application/pdf' || type === 'video/mp4' ? 'inline' : `attachment; filename="${name}"` };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return new Response(blob, { status: 200, headers: { ...base, 'Content-Length': String(blob.size) } });
  let s = m[1] ? +m[1] : 0, e = m[2] ? +m[2] : blob.size - 1;
  if (!m[1] && m[2]) { s = Math.max(0, blob.size - +m[2]); e = blob.size - 1; }
  e = Math.min(e, blob.size - 1);
  return new Response(blob.slice(s, e + 1), { status: 206, headers: { ...base, 'Content-Range': `bytes ${s}-${e}/${blob.size}`, 'Content-Length': String(e - s + 1) } });
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.includes('/offline-file/')) { e.respondWith(offlineFile(req)); return; }
  if (req.headers.has('range')) return;
  if (/\.(mp4|pdf|pptx)$/i.test(url.pathname)) return;            // big files: always straight to network

  if (req.mode === 'navigate') {                                   // pages: network first, cached shell offline
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  if (url.origin === location.origin) {                            // app files: stale-while-revalidate
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (req.destination === 'image') {                               // topic/video covers from GitHub: cache as seen
    e.respondWith(caches.open(IMG).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }
      catch { return Response.error(); }
    }));
  }
});
