"""Sestavi preprosto različico za telefon (Android, iPhone) in računalnik.

    python build.py

Ustvari:
  dist/                       – spletna aplikacija (PWA) za HTTPS gostovanje (Netlify, GitHub Pages …)
  izracun3d-preprosto.zip     – mapa dist/ kot zip, za Netlify Drop
  Izracun3D-preprosto.html    – vse v eni datoteki
"""

import base64
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC, ASSETS, DIST = HERE / "src", HERE / "assets", HERE / "dist"
ICONS = ("icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png")

PWA_LINKS = """<link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">"""

SW_REGISTER = """<script>
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      window.addEventListener("load", function() {
        navigator.serviceWorker.register("sw.js").catch(function() {});
      });
    }
  </script>"""

SW = """// Service worker: aplikacija deluje tudi brez interneta.
const CACHE = "izracun3d-preprosto-@VERSION@";
const FILES = ["./", "index.html", "manifest.webmanifest", @ICONS@];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // najprej splet (najnovejša različica), brez povezave iz predpomnilnika
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); }
      return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
"""

MANIFEST = {
    "name": "Izračun stroškov 3D-tiska", "short_name": "Izračun 3D", "lang": "sl",
    "id": "./", "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#eef3f1", "theme_color": "#087f69",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}

NETLIFY_HEADERS = """/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Content-Type: application/manifest+json
"""


def main():
    page = (SRC / "index.html").read_text(encoding="utf-8")
    page = page.replace("/*@XLSX@*/", (SRC / "xlsx.js").read_text(encoding="utf-8"))
    assert "/*@" not in page

    pwa = page.replace("<!--@LINKS@-->", PWA_LINKS).replace("<!--@SW@-->", SW_REGISTER)
    version = hashlib.sha256((pwa + SW).encode()).hexdigest()[:10]
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    (DIST / "index.html").write_text(pwa, encoding="utf-8")
    (DIST / "sw.js").write_text(SW.replace("@VERSION@", version)
                                .replace("@ICONS@", ", ".join(f'"{i}"' for i in ICONS)), encoding="utf-8")
    (DIST / "manifest.webmanifest").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")
    (DIST / "_headers").write_text(NETLIFY_HEADERS, encoding="utf-8")
    for name in ICONS:
        shutil.copy(ASSETS / name, DIST / name)

    zpath = HERE / "izracun3d-preprosto.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(DIST.iterdir()):
            z.write(f, f.name)

    icon = base64.b64encode((ASSETS / "favicon-32.png").read_bytes()).decode()
    single = page.replace("<!--@LINKS@-->", f'<link rel="icon" type="image/png" href="data:image/png;base64,{icon}">') \
                 .replace("<!--@SW@-->", "")
    (HERE / "Izracun3D-preprosto.html").write_text(single, encoding="utf-8")
    # Različica za claude.ai Artifact: brez ovoja <html>/<head> (ovoj doda claude.ai)
    head_start = single.index("<title>")
    style_start = single.index("<style>")
    body = single[single.index("<body>") + len("<body>"):single.rindex("</body>")]
    title = single[head_start:single.index("</title>") + len("</title>")]
    style = single[style_start:single.index("</style>") + len("</style>")]
    (HERE / "izracun3d-artifact.html").write_text(title + "\n" + style + "\n" + body, encoding="utf-8")

    print(f"dist/ ({len(pwa) // 1024} KB, različica {version}), {zpath.name} in Izracun3D-preprosto.html so pripravljeni.")


if __name__ == "__main__":
    main()
