// Strežnik: postreže aplikaciji in urejevalniku baze ter ponuja API nad datotekami v mapi baza/.
// Brez odvisnosti, potrebuje samo Node.js 18+.  Zagon: node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");

const VERZIJA = "2.1.0";
// prstni odtis gradnje (koda strežnika in portala): pove, ali na vratih že teče drugačna različica
const GRADNJA = (() => { const fs = require("fs"), path = require("path"), h = require("crypto").createHash("sha256"); try { for (const f of ["server.js", "platform.js"]) h.update(fs.readFileSync(path.join(__dirname, f))); const pd = path.join(__dirname, "portal"); for (const f of fs.readdirSync(pd).sort()) h.update(f).update(fs.readFileSync(path.join(pd, f))); } catch {} return h.digest("hex").slice(0, 12); })();
const TESTNO = process.argv.includes("--testno") || process.env.HACCP_TEST === "1"; // testno okolje: ločeni testni podatki, demo račun, napis TESTNA RAZLIČICA
const OMREZJE = process.argv.includes("--omrezje"); // dostop z drugih računalnikov v istem omrežju (samo skupaj z --testno)
if (OMREZJE && !TESTNO) { console.error("Dostop iz omrežja je dovoljen samo v testnem načinu (--testno), ker povezava ni šifrirana."); process.exit(1); }
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = OMREZJE ? "0.0.0.0" : (process.env.HOST || "127.0.0.1");
const ROOT = __dirname;
const PACKED = !!process.pkg; // zagnano kot samostojni .exe
// V .exe je baza ob izvedljivi datoteki (da jo lahko urejate); ob prvem zagonu se prekopira privzeta.
const DATA = process.env.HACCP_DATA; // neobvezno: ločena mapa s podatki (testi)
const DB = DATA ? path.join(DATA, "baza") : PACKED ? path.join(path.dirname(process.execPath), "baza") : path.join(ROOT, "baza");
// Privzeta baza (v paketu ali ob programu). Manjkajoče zbirke se dodajo ob zagonu, obstoječe (vaše) se nikoli ne prepišejo.
fs.mkdirSync(DB, { recursive: true });
const DEFAULTS = path.join(ROOT, "baza");
if (DEFAULTS !== DB) {
  for (const f of fs.readdirSync(DEFAULTS).filter(f => f.endsWith(".json"))) {
    if (!fs.existsSync(path.join(DB, f))) fs.writeFileSync(path.join(DB, f), fs.readFileSync(path.join(DEFAULTS, f)));
  }
}
const BACKUP = path.join(DB, "_backup");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

// zbirke v bazi: ime datoteke brez .json
const collections = () => fs.readdirSync(DB).filter(f => f.endsWith(".json") && !f.startsWith("_")).map(f => f.slice(0, -5));
const valid = name => /^[a-z0-9_]+$/.test(name) && collections().includes(name);
const read = name => JSON.parse(fs.readFileSync(path.join(DB, name + ".json"), "utf8"));

function write(name, data) {
  const file = path.join(DB, name + ".json");
  fs.mkdirSync(BACKUP, { recursive: true });
  fs.copyFileSync(file, path.join(BACKUP, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
  try { const old = fs.readdirSync(BACKUP).filter(f => f.startsWith(name + "-") && /^\d{4}-/.test(f.slice(name.length + 1))).sort(); for (const f of old.slice(0, Math.max(0, old.length - 30))) fs.unlinkSync(path.join(BACKUP, f)); } catch {}
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1) + "\n");
  fs.renameSync(tmp, file);
}

// Posodobitev baze sestavin: doda nove sestavine in manjkajoče hranilne vrednosti, vaših sprememb ne prepiše.
function mergeSestavine() {
  const defFile = path.join(DEFAULTS, "sestavine.json"), usrFile = path.join(DB, "sestavine.json");
  if (DEFAULTS === DB || !fs.existsSync(defFile) || !fs.existsSync(usrFile)) return;
  let def, usr;
  try { def = JSON.parse(fs.readFileSync(defFile, "utf8")); usr = JSON.parse(fs.readFileSync(usrFile, "utf8")); } catch { return; }
  const REN = { "Tekoči jajčni rumenjak (pasteriziran)": "Jajčni rumenjak, tekoč pasteriziran (v tubi)", "Tekoči jajčni beljak (pasteriziran)": "Jajčni beljak, tekoč pasteriziran (v tubi)", "Jajčni prah": "Celo jajce v prahu", "Moka iz kokosa": "Kokosova moka" };
  let changed = false;
  const has = n => usr.some(x => x.naziv === n);
  for (const x of usr) if (REN[x.naziv] && !has(REN[x.naziv])) { x.naziv = REN[x.naziv]; changed = true; }
  for (const d of def) {
    const u = usr.find(x => x.naziv === d.naziv);
    if (!u) { usr.push(d); changed = true; }
    else if (!u.hranilne && d.hranilne) { u.hranilne = d.hranilne; if (!u.opomba && d.opomba) u.opomba = d.opomba; changed = true; }
  }
  if (changed) write("sestavine", usr);
}
mergeSestavine();

// ---- paketi posodobitev (zakonodaja, sestavine, obrazci …): dodaj / zamenjaj / odstrani ----
const KEYS = { navodila_predloge: "id", zakonodaja: "predpis", sestavine: "naziv", obrazci: "id", zastavice: "id", rezimi: "id", standardi: "id", branze: "id", alergeni: "naziv", prostori: "naziv", tipi: "koda", mikro: "parameter" };
const APPLIED = path.join(DB, "_posodobitve.json");
const appliedList = () => { try { return JSON.parse(fs.readFileSync(APPLIED, "utf8")); } catch { return []; } };
function applyUpdate(u) {
  const sum = {};
  for (const [coll, ops] of Object.entries(u)) {
    if (!KEYS[coll] || !ops || typeof ops !== "object" || Array.isArray(ops)) continue;
    if (!fs.existsSync(path.join(DB, coll + ".json"))) continue;
    const key = KEYS[coll], data = read(coll);
    if (!Array.isArray(data)) continue;
    let dod = 0, zam = 0, odst = 0;
    for (const k of ops.odstrani || []) { const i = data.findIndex(x => x[key] === k); if (i >= 0) { data.splice(i, 1); odst++; } }
    for (const e of ops.dodaj || []) if (e && e[key] !== undefined && !data.some(x => x[key] === e[key])) { data.push(e); dod++; }
    for (const e of ops.zamenjaj || []) { if (!e || e[key] === undefined) continue; const i = data.findIndex(x => x[key] === e[key]); if (i >= 0) { data[i] = e; zam++; } else { data.push(e); dod++; } }
    if (dod || zam || odst) write(coll, data);
    sum[coll] = { dodano: dod, zamenjano: zam, odstranjeno: odst };
  }
  return sum;
}
function applyUpdateObj(u, vir) {
  if (!u || typeof u !== "object" || !u.id) throw new Error("posodobitev nima polja id");
  const ap = appliedList();
  if (ap.some(x => x.id === u.id)) return { ze_uporabljena: true };
  const povzetek = applyUpdate(u);
  ap.push({ id: u.id, datum: u.datum || "", opis: u.opis || "", uporabljeno: new Date().toISOString(), povzetek, vir: vir || "" });
  fs.writeFileSync(APPLIED, JSON.stringify(ap, null, 1));
  return { ok: true, povzetek };
}
(function applyFolders() {
  const dirs = [...new Set([path.join(ROOT, "posodobitve"), path.join(path.dirname(DB), "posodobitve")])];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith(".json")).sort()) {
      try { const r = applyUpdateObj(JSON.parse(fs.readFileSync(path.join(d, f), "utf8")), f); if (r.ok) console.log("Uporabljena posodobitev: " + f); }
      catch (e) { console.error("Posodobitev " + f + " ni uporabljena: " + e.message); }
    }
  }
})();

const SEC = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin", "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, Object.assign({ "Content-Type": type, "Cache-Control": "no-store" }, SEC));
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function body(req, max) {
  return new Promise((ok, fail) => {
    const parts = []; let n = 0;
    req.on("data", c => { n += c.length; if (n > (max || 20e6)) { fail(new Error("prevelik zahtevek")); req.destroy(); return; } parts.push(c); });
    req.on("end", () => ok(Buffer.concat(parts).toString("utf8")));
    req.on("error", fail);
  });
}

function serveStatic(res, dir, rel) {
  const file = path.normalize(path.join(dir, rel === "" || rel.endsWith("/") ? rel + "index.html" : rel));
  if (!file.startsWith(dir + path.sep) && file !== dir) return send(res, 403, { napaka: "prepovedano" });
  fs.readFile(file, (err, data) => err ? send(res, 404, { napaka: "ni najdeno" }) : send(res, 200, data, MIME[path.extname(file)] || "application/octet-stream"));
}

// Program brez konzole (Windows, .exe): sporočila gredo v zagon.log ob programu (omejeno na ~1 MB)
if (PACKED && !process.stdout.isTTY) {
  try {
    const LOG = path.join(DATA || path.dirname(process.execPath), "zagon.log"); try { if (fs.statSync(LOG).size > 1e6) fs.renameSync(LOG, LOG + ".old"); } catch {}
    const w = (...a) => { try { fs.appendFileSync(LOG, new Date().toISOString() + " " + a.map(x => typeof x === "string" ? x : (x && x.stack) || JSON.stringify(x)).join(" ") + "\n"); } catch {} };
    console.log = w; console.error = w; console.warn = w;
    process.on("uncaughtException", e => { w("NAPAKA:", e); process.exit(1); });
  } catch {}
}
const PODATKI_IME = TESTNO ? "podatki-test" : "podatki"; // testni podatki so vedno ločeni od pravih
const PODATKI = DATA ? path.join(DATA, PODATKI_IME) : PACKED ? path.join(path.dirname(process.execPath), PODATKI_IME) : path.join(ROOT, PODATKI_IME);
fs.mkdirSync(PODATKI, { recursive: true });

// ---- ponastavitev gesla (samo na tem računalniku): node server.js --ponastavi-geslo ----
if (process.argv.includes("--ponastavi-geslo")) {
  (async () => {
    const readline = require("readline"), crypto = require("crypto");
    const file = path.join(PODATKI, "uporabniki.json"); let users = [];
    try { users = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
    if (!users.length) { console.log("Ni uporabnikov (aplikacija še ni nastavljena)."); process.exit(0); }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); let mute = false;
    const origW = rl._writeToOutput; rl._writeToOutput = function (t) { if (mute) { if (t.includes("\n") || t.includes("\r")) origW.call(rl, t); } else origW.call(rl, t); };
    const lines = []; let waiter = null;
    rl.on("line", l => { if (waiter) { const w = waiter; waiter = null; w(l); } else lines.push(l); });
    rl.on("close", () => { if (waiter) process.exit(1); });
    const ask = (q, m) => new Promise(ok => { process.stdout.write(q); mute = !!m; const done = l => { mute = false; if (m && process.stdin.isTTY) console.log(""); ok(l.trim()); }; if (lines.length) done(lines.shift()); else waiter = done; });
    console.log("ZAUSTAVITE aplikacijo, preden nadaljujete. Uporabniki:");
    users.forEach(u => console.log(" - " + u.email + " (" + u.vloga + (u.aktiven === false ? ", onemogočen" : "") + ")"));
    const def = (users.find(u => u.vloga === "admin") || users[0]).email;
    const em = (await ask("E-naslov uporabnika [" + def + "]: ")) || def, u = users.find(x => x.email === em.toLowerCase());
    if (!u) { console.log("Uporabnika ni."); process.exit(1); }
    const p1 = await ask("Novo geslo (vsaj 10 znakov): ", true), p2 = await ask("Ponovite geslo: ", true);
    if (p1 !== p2 || p1.length < 10 || p1.length > 200) { console.log("Gesli se ne ujemata ali je geslo prekratko. Nič ni spremenjeno."); process.exit(1); }
    const salt = crypto.randomBytes(16).toString("hex");
    u.geslo = salt + ":" + crypto.scryptSync(p1, salt, 64).toString("hex"); u.aktiven = true; u.mora_zamenjati = false;
    if (u.totp_vklop) { for (const k of ["totp_vklop", "totp_skrivnost", "totp_zadnji", "totp_rezervne", "totp_cakanje"]) delete u[k]; console.log("Dvostopenjska prijava za " + u.email + " je izklopljena (ponovno jo vklopite v aplikaciji)."); }
    fs.writeFileSync(file + ".tmp", JSON.stringify(users, null, 1)); fs.renameSync(file + ".tmp", file);
    // vpis v revizijsko sled (veriga zgoščenk)
    const AUD = path.join(PODATKI, "_revizijska-sled.jsonl"); let last = "0";
    try { const t = fs.readFileSync(AUD, "utf8").trim().split("\n"); if (t[0]) last = JSON.parse(t[t.length - 1]).h; } catch {}
    const e = { cas: new Date().toISOString(), uporabnik: null, ime: null, akcija: "ponastavitev-gesla-cli", zbirka: "uporabniki", id: u.id, opis: u.email, ip: "lokalno" };
    e.h = crypto.createHash("sha256").update(last + JSON.stringify(e)).digest("hex"); fs.appendFileSync(AUD, JSON.stringify(e) + "\n");
    console.log("Geslo za " + u.email + " je spremenjeno. Aplikacijo znova zaženite."); process.exit(0);
  })();
}

let AKTIVNA_VRATA = PORT;
const platform = require("./platform.js")({ DIR: PODATKI, DB, send, body, testno: TESTNO, verzija: VERZIJA, omrezje: () => ({ host: HOST, port: AKTIVNA_VRATA }) });

const DOSTOPI = process.env.HACCP_DOSTOPNI_DNEVNIK === "1";
const server = http.createServer(async (req, res) => {
  if (DOSTOPI) { const t0 = Date.now(); res.on("finish", () => console.log(`${new Date().toISOString()} ${req.method} ${String(req.url).split("?")[0]} ${res.statusCode} ${Date.now() - t0}ms`)); }
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);
    // proti zlorabi iz drugih strani: pisanje samo iz iste domene
    if (req.method !== "GET" && req.method !== "HEAD") {
      const og = req.headers.origin, sfs = req.headers["sec-fetch-site"];
      if (og !== undefined) { let h = null; try { h = new URL(og).host; } catch {} if (!h || h !== req.headers.host) return send(res, 403, { napaka: "tuj izvor" }); }
      else if (sfs && sfs !== "same-origin" && sfs !== "none") return send(res, 403, { napaka: "tuj izvor" });
    }

    if (p === "/api/health") return send(res, 200, { ok: true, app: "higifood", verzija: VERZIJA, gradnja: GRADNJA, testno: TESTNO });
    if (await platform.handle(req, res, p, url)) return;
    if (p === "/api/posodobitve" && req.method === "GET") return send(res, 200, appliedList());
    if (p === "/api/posodobitev" && req.method === "POST") {
      let u; try { u = JSON.parse(await body(req)); } catch { return send(res, 400, { napaka: "neveljaven JSON" }); }
      try { return send(res, 200, applyUpdateObj(u, "uvoz")); } catch (e) { return send(res, 400, { napaka: e.message }); }
    }
    if (p === "/api/baza" && req.method === "GET") return send(res, 200, Object.fromEntries(collections().map(n => [n, read(n)])));

    const m = p.match(/^\/api\/baza\/([a-z0-9_]+)$/);
    if (m) {
      if (!valid(m[1])) return send(res, 404, { napaka: "zbirka ne obstaja" });
      if (req.method === "GET") return send(res, 200, read(m[1]));
      if (req.method === "PUT") {
        let data;
        try { data = JSON.parse(await body(req)); } catch { return send(res, 400, { napaka: "neveljaven JSON" }); }
        if (Array.isArray(read(m[1])) !== Array.isArray(data)) return send(res, 400, { napaka: "napačna oblika podatkov" });
        write(m[1], data);
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { napaka: "metoda ni dovoljena" });
    }
    if (p.startsWith("/api/")) return send(res, 404, { napaka: "ni najdeno" });

    if (p === "/generator") { res.writeHead(302, { Location: "/generator/" }); return res.end(); }
    if (p.startsWith("/generator/")) { // generator je viden samo, če ga administrator ni skril vlogi uporabnika
      const u = platform.userOf(req);
      if (!u) { res.writeHead(302, { Location: "/" }); return res.end(); }
      if (!platform.vidno(u, "generator")) { res.writeHead(302, { Location: "/?nedostop=1" }); return res.end(); }
    }
    if (p.startsWith("/generator/")) return serveStatic(res, path.join(ROOT, "app"), p.slice(11));
    if (p === "/baza") { res.writeHead(302, { Location: "/baza/" }); return res.end(); }
    if (p.startsWith("/baza/")) return serveStatic(res, path.join(ROOT, "baza-admin"), p.slice(6));
    return serveStatic(res, path.join(ROOT, "portal"), p.slice(1));
  } catch (e) {
    send(res, 500, { napaka: String(e.message || e) });
  }
});

function odpriBrskalnik(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  require("child_process").exec(cmd, { windowsHide: true }, () => {}); // brez bliska konzolnega okna
}
function obvestiStaroRazlicico(port) {
  const f = path.join(require("os").tmpdir(), "higifood-stara-razlicica.html");
  fs.writeFileSync(f, `<!doctype html><meta charset="utf-8"><title>HiGiFood – teče starejša različica</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px"><h2>Teče starejša različica programa HiGiFood</h2><p>Nova različica se ni zagnala, ker na tem računalniku še teče prejšnja (skrito, brez okna).</p><ol><li>Odprite <a href="http://127.0.0.1:${port}/#/admin">staro različico → Administracija</a> in kliknite <b>Ustavi program</b> (ali v upravitelju opravil končajte <b>HACCP-sistem.exe</b>).</li><li>Znova zaženite <b>HiGiFood.vbs</b> v mapi nove različice.</li></ol><p>Če ste novo različico razširili v <b>drugo mapo</b>, vanjo prej prekopirajte mapo <b>podatki</b> iz stare mape, sicer novih podatkov ne boste videli. Če imate vklopljen samodejni zagon, ga v novi mapi znova vklopite (samodejni-zagon-vklopi.bat).</p></body>`);
  odpriBrskalnik("file:///" + f.replace(/\\/g, "/"));
}
function listen(port, tries) {
  server.once("error", e => {
    if (e.code === "EADDRINUSE") {
      // že teče ta aplikacija? potem samo odpri brskalnik (dveh primerkov nad istimi podatki ne zaganjamo)
      const rq = http.get({ host: HOST === "0.0.0.0" ? "127.0.0.1" : HOST, port, path: "/api/health", timeout: 1500 }, r => {
        let b = ""; r.on("data", c => b += c); r.on("end", () => {
          let ours = false, h = {}; try { h = JSON.parse(b); ours = h.app === "higifood"; } catch {}
          // teče druga (običajno starejša) različica: ne ustavimo je sami, uporabniku pokažemo, kako jo zamenja
          if (ours && h.gradnja !== GRADNJA) { console.log("Na vratih " + port + " teče druga različica programa; najprej jo ustavite."); if (!process.argv.includes("--tiho")) obvestiStaroRazlicico(port); setTimeout(() => process.exit(0), 1500); return; }
          if (ours) { console.log("Aplikacija že teče na vratih " + port + "."); if (!process.argv.includes("--tiho")) odpriBrskalnik(`http://127.0.0.1:${port}/`); setTimeout(() => process.exit(0), 500); }
          else if (tries > 0) listen(port + 1, tries - 1); else { console.error("Strežnika ni mogoče zagnati: vrata so zasedena."); process.exit(1); }
        });
      });
      rq.on("error", () => { if (tries > 0) listen(port + 1, tries - 1); else process.exit(1); }); rq.on("timeout", () => rq.destroy());
      return;
    }
    console.error("Strežnika ni mogoče zagnati: " + e.message);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    AKTIVNA_VRATA = port;
    const base = `http://${HOST}:${port}`;
    if (TESTNO) console.log("TESTNI NAČIN: podatki v mapi " + PODATKI_IME + " (niso pravi podatki).");
    if (OMREZJE) for (const l of Object.values(require("os").networkInterfaces())) for (const a of l || []) if (a.family === "IPv4" && !a.internal) console.log(`Za druge računalnike v omrežju: http://${a.address}:${port}/`);
    console.log(`Aplikacija:        ${base}/`);
    console.log(`Urejevalnik baze:  ${base}/baza/`);
    console.log(`Baza (JSON):       ${DB}`);
    console.log("Okno pustite odprto. Ustavite s Ctrl+C ali zaprtjem okna.");
    if ((PACKED || process.env.ODPRI) && !process.argv.includes("--tiho")) odpriBrskalnik(`http://127.0.0.1:${port}/`);
  });
}
server.keepAliveTimeout = 65e3; server.headersTimeout = 66e3; // manj prekinjenih ponovno uporabljenih povezav
process.on("unhandledRejection", e => console.error("Neobravnavana napaka:", e && e.stack || e));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { // docker stop: počakaj, da se tekoče zahteve zaključijo
  console.log("Zaustavljam (" + sig + ") …"); if (platform.zapri) platform.zapri();
  server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref();
});
// Neobvezno: samodejno preverjanje posodobitev baze z vašega naslova (HACCP_POSODOBITVE_URL vrne JSON posodobitev ali seznam).
if (process.env.HACCP_POSODOBITVE_URL) {
  const preveri = async () => {
    try {
      const r = await fetch(process.env.HACCP_POSODOBITVE_URL, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "HiGiFood/" + VERZIJA } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      for (const u of Array.isArray(j) ? j : [j]) { const x = applyUpdateObj(u, "url"); if (x.ok) console.log("Uporabljena posodobitev z URL: " + u.id); }
    } catch (e) { console.error("Posodobitev z URL ni uspela: " + e.message); }
  };
  setTimeout(preveri, 30e3).unref(); setInterval(preveri, 24 * 3600e3).unref();
}
if (!process.argv.includes("--ponastavi-geslo")) listen(PORT, 10);
