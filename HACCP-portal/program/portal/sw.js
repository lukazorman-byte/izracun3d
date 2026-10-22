// Service worker: shrani ogrodje aplikacije in zadnje prebrane podatke za delo brez povezave.
// Vsebina v predpomnilniku je vezana na prijavljenega uporabnika; stran ga izprazni ob odjavi in prijavi.
const VER = "v20", SHELL = "shell-" + VER, API = "api-" + VER;
const FILES = ["/", "/app.css", "/core.js", "/specs.js", "/m-osnova.js", "/m-stranka.js", "/m-izvoz.js", "/m-wizard.js", "/m-evidence.js", "/m-ostalo.js", "/m-tloris.js", "/m-higiena.js", "/m-inspekcija.js", "/m-qr.js", "/m-uvoz.js", "/m-obrazci.js", "/m-iskanje.js", "/m-nove.js", "/m-vidnost.js", "/m-test.js", "/m-vzdrzevanje.js", "/boot.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.png", "/logo-svetlo.png", "/logo-temno.png"];
self.addEventListener("install", e => { e.waitUntil((async () => { const c = await caches.open(SHELL); for (const f of FILES) { try { const r = await fetch(f, { cache: "reload" }); if (r.ok) await c.put(f, r); } catch {} } await self.skipWaiting(); })()); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== API).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("message", e => { if (e.data === "clear-api") e.waitUntil(caches.delete(API)); });
const cacheable = u => u.pathname === "/api/baza" || /^\/api\/d\/[a-z_]+$/.test(u.pathname) || u.pathname === "/api/auth/jaz";
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.startsWith("/api/")) {
    if (!cacheable(u)) return;
    e.respondWith(fetch(r).catch(() => new Promise(ok => setTimeout(ok, 300)).then(() => fetch(r))).then(res => { if (res.ok) { const c = res.clone(); caches.open(API).then(ca => ca.put(r, c)); } return res; }).catch(() => caches.open(API).then(ca => ca.match(r)).then(m => m || new Response(JSON.stringify({ napaka: "Brez povezave" }), { status: 503, headers: { "Content-Type": "application/json" } }))));
    return;
  }
  if (u.pathname.startsWith("/generator") || u.pathname.startsWith("/baza")) return; // ti strani delujeta samo s povezavo
  e.respondWith(caches.open(SHELL).then(async ca => { const m = await ca.match(u.pathname === "/" || !u.pathname.includes(".") ? "/" : r); const net = fetch(r).then(res => { if (res.ok) ca.put(u.pathname === "/" || !u.pathname.includes(".") ? "/" : r, res.clone()); return res; }).catch(() => null); return m || (await net) || new Response("Brez povezave", { status: 503 }); }));
});
