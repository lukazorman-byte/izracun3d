// Platforma HiGiFood: prijava, vloge, ločevanje strank, revizijska sled, evidence z revizijami, varnostne kopije.
// Brez odvisnosti. Vse preverjanje dostopa poteka na strežniku.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = function (o) {
  const { DIR, DB, send, body } = o;
  const TESTNO = !!o.testno, TEST_GESLO = "Testiram-123";
  const PRIL = path.join(DIR, "priloge"), SLOGO = path.join(DIR, "logotipi-strank");
  const BKP = path.join(DIR, "_kopije");
  fs.mkdirSync(PRIL, { recursive: true });
  fs.mkdirSync(BKP, { recursive: true });

  // ---------- shramba ----------
  const cache = {};
  const fileOf = n => path.join(DIR, n + ".json");
  function load(n) {
    if (!cache[n]) { try { cache[n] = JSON.parse(fs.readFileSync(fileOf(n), "utf8")); } catch { cache[n] = []; } }
    return cache[n];
  }
  function save(n) {
    const tmp = fileOf(n) + ".tmp", fd = fs.openSync(tmp, "w");
    try { fs.writeSync(fd, Array.isArray(cache[n]) && cache[n].length > 2000 ? JSON.stringify(cache[n]) : JSON.stringify(cache[n], null, 1)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } // velike zbirke brez zamikov (hitreje)
    fs.renameSync(tmp, fileOf(n));
    spremembeOdKopije = true;
  }
  let spremembeOdKopije = true; // dnevna kopija se osveži, če so se podatki od nje spremenili
  const uid = () => crypto.randomBytes(9).toString("base64url");
  function vsebinaUstreza(buf, tip) { // preverjanje prvih bajtov (ne zaupamo samo tipu, ki ga pošlje brskalnik)
    const h = buf.subarray(0, 12), a = h.toString("latin1");
    if (tip === "image/png") return a.startsWith("\x89PNG");
    if (tip === "image/jpeg") return h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
    if (tip === "image/webp") return a.startsWith("RIFF") && a.slice(8, 12) === "WEBP";
    if (tip === "image/gif") return a.startsWith("GIF8");
    if (tip === "application/pdf") return a.startsWith("%PDF");
    if (tip === "text/plain") return !buf.subarray(0, 4096).includes(0);
    return false;
  }
  const now = () => new Date().toISOString();
  const NAPAKE = []; // zadnje napake strežnika (Administracija, Stanje sistema)
  { const ce = console.error.bind(console); console.error = (...a) => { NAPAKE.push({ cas: now(), sporocilo: a.map(x => typeof x === "string" ? x : (x && x.message) || String(x)).join(" ").slice(0, 300) }); if (NAPAKE.length > 20) NAPAKE.shift(); ce(...a); }; }

  // ---------- revizijska sled (veriga zgoščenk) ----------
  // Tekoča datoteka _revizijska-sled.jsonl se pri ~5 MB arhivira v _revizijska-sled-<čas>.jsonl; veriga se nadaljuje čez datoteke.
  const AUDIT = path.join(DIR, "_revizijska-sled.jsonl"), SLED_MAX = +process.env.HACCP_SLED_MAX || 5e6;
  const sledArhivi = () => { try { return fs.readdirSync(DIR).filter(f => /^_revizijska-sled-.+\.jsonl$/.test(f)).sort(); } catch { return []; } };
  const vrstice = f => { try { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean); } catch { return []; } };
  let lastHash = "0";
  const auditLast = () => {
    lastHash = "0";
    for (const f of [...sledArhivi().map(a => path.join(DIR, a)), AUDIT]) { const t = vrstice(f); if (t.length) try { lastHash = JSON.parse(t[t.length - 1]).h; } catch {} }
    preverjeniArhivi.clear();
  };
  const preverjeniArhivi = new Map(); // arhiv -> {mtime, prev, h, n}: arhivi se ne spreminjajo, zato se preverijo enkrat
  auditLast();
  function audit(user, akcija, zbirka, id, opis, ip) {
    const e = { cas: now(), uporabnik: user ? user.id : null, ime: user ? user.ime : null, akcija, zbirka: zbirka || "", id: id || "", opis: opis || "", ip: ip || "" };
    e.h = crypto.createHash("sha256").update(lastHash + JSON.stringify(e)).digest("hex");
    lastHash = e.h;
    fs.appendFileSync(AUDIT, JSON.stringify(e) + "\n");
    try { if (fs.statSync(AUDIT).size > SLED_MAX) fs.renameSync(AUDIT, path.join(DIR, "_revizijska-sled-" + now().replace(/[:.]/g, "-") + ".jsonl")); } catch {}
  }
  function auditRead(limit) {
    const out = []; const files = [AUDIT, ...sledArhivi().reverse().map(a => path.join(DIR, a))];
    for (const f of files) { const t = vrstice(f); for (let k = t.length - 1; k >= 0 && out.length < limit; k--) try { out.push(JSON.parse(t[k])); } catch {} if (out.length >= limit) break; }
    return out;
  }
  function auditVerify() {
    let prev = "0", n = 0, arhivov = 0;
    const preveri = (lines, start) => { let pv = start, c = 0; for (const l of lines) { const e = JSON.parse(l), h = e.h; delete e.h; if (crypto.createHash("sha256").update(pv + JSON.stringify(e)).digest("hex") !== h) return { napaka: c + 1 }; pv = h; c++; } return { h: pv, n: c }; };
    try {
      for (const a of sledArhivi()) {
        const f = path.join(DIR, a), mt = fs.statSync(f).mtimeMs, c = preverjeniArhivi.get(a);
        let r = c && c.mtime === mt && c.prev === prev ? c : null;
        if (!r) { const x = preveri(vrstice(f), prev); if (x.napaka) return { ok: false, vrstica: n + x.napaka, datoteka: a }; r = { mtime: mt, prev, h: x.h, n: x.n }; preverjeniArhivi.set(a, r); }
        prev = r.h; n += r.n; arhivov++;
      }
      const x = preveri(vrstice(AUDIT), prev); if (x.napaka) return { ok: false, vrstica: n + x.napaka };
      n += x.n;
    } catch { return { ok: false }; }
    return { ok: true, vnosov: n, arhivov };
  }

  // ---------- gesla in seje ----------
  const hashPw = (pw, salt) => { salt = salt || crypto.randomBytes(16).toString("hex"); return salt + ":" + crypto.scryptSync(pw, salt, 64).toString("hex"); };
  const checkPw = (pw, st) => {
    const [salt, h] = String(st || "").split(":");
    if (!salt || !h) return false;
    const a = Buffer.from(h, "hex"), b = crypto.scryptSync(pw, salt, 64);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  // seje: zgoščen žeton -> {uid, do}; shranjene v _seje.json (samo zgoščenke), da ponovni zagon ne odjavi vseh
  const SEJF = path.join(DIR, "_seje.json");
  const LAZNO_GESLO = hashPw(crypto.randomBytes(16).toString("hex")); // za enak odzivni čas pri neznanem e-naslovu
  let sejeT = null;
  const sejeShrani = () => { try { const t = SEJF + ".tmp"; fs.writeFileSync(t, JSON.stringify([...SESS].filter(([, s]) => s.do > Date.now()))); fs.renameSync(t, SEJF); } catch {} };
  const sejeDirty = () => { if (!sejeT) sejeT = setTimeout(() => { sejeT = null; sejeShrani(); }, 1000); };
  class Seje extends Map { set(k, v) { super.set(k, v); sejeDirty(); return this; } delete(k) { const r = super.delete(k); if (r) sejeDirty(); return r; } clear() { super.clear(); sejeDirty(); } }
  const SESS = new Seje();
  try { for (const [k, s] of JSON.parse(fs.readFileSync(SEJF, "utf8"))) if (s && s.do > Date.now()) Map.prototype.set.call(SESS, k, s); } catch {}
  setInterval(() => { if (SESS.size) sejeShrani(); }, 10 * 60e3).unref();
  const TTL = 12 * 3600e3;
  const sh = t => crypto.createHash("sha256").update(t).digest("hex");
  function cookies(req) {
    const r = {};
    for (const p of String(req.headers.cookie || "").split(";")) { const i = p.indexOf("="); if (i > 0) r[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
    return r;
  }
  function userOf(req) {
    const t = cookies(req).hs;
    if (!t) return null;
    const s = SESS.get(sh(t));
    if (!s || s.do < Date.now()) { SESS.delete(sh(t)); return null; }
    const u = load("uporabniki").find(x => x.id === s.uid && x.aktiven !== false);
    if (!u) return null;
    s.do = Date.now() + TTL;
    return u;
  }
  // ---------- dvostopenjska prijava (TOTP, RFC 6238: 30 s, 6 števk, SHA-1; združljivo z Google/Microsoft Authenticator) ----------
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const b32enc = buf => { let bits = 0, val = 0, out = ""; for (const x of buf) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; };
  const b32dec = s => { let bits = 0, val = 0; const out = []; for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, "")) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
  const totpKoda = (key, ctr) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(ctr)); const h = crypto.createHmac("sha1", key).update(b).digest(), o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0"); };
  function totpPreveri(key, koda, zadnji) { // vrne števec ob uspehu (okno ±1 interval), sicer null; ista koda se ne sme uporabiti dvakrat
    const k = String(koda || "").replace(/\s/g, ""); if (!/^\d{6}$/.test(k)) return null;
    const c = Math.floor(Date.now() / 30000);
    for (const d of [0, -1, 1]) { const x = c + d; if (x > (zadnji || 0) && crypto.timingSafeEqual(Buffer.from(totpKoda(key, x)), Buffer.from(k))) return x; }
    return null;
  }
  function drugiKorak(u, koda) { // preveri TOTP ali rezervno kodo; ob uspehu posodobi uporabnika
    const ctr = totpPreveri(b32dec(u.totp_skrivnost), koda, u.totp_zadnji);
    if (ctr) { u.totp_zadnji = ctr; return true; }
    const hv = sh(String(koda || "").trim().toUpperCase()), i = (u.totp_rezervne || []).indexOf(hv);
    if (i >= 0) { u.totp_rezervne.splice(i, 1); return true; }
    return false;
  }
  const pub = u => ({ totp: !!u.totp_vklop, id: u.id, email: u.email, ime: u.ime, vloga: u.vloga, stranka_id: u.stranka_id || null, stranke: u.stranke || [], aktiven: u.aktiven !== false, zadnja_prijava: u.zadnja_prijava || null, mora_zamenjati: !!u.mora_zamenjati });
  const fails = new Map();
  function limited(key) { const f = fails.get(key); return f && f.n >= 5 && f.t > Date.now(); }
  function fail(key) { const f = fails.get(key) || { n: 0 }; f.n++; f.t = Date.now() + 60e3; fails.set(key, f); }

  const VLOGE = ["admin", "svetovalec", "odgovorna", "zaposleni"];
  const pwOk = pw => typeof pw === "string" && pw.length >= 10 && pw.length < 200;

  // ---------- zbirke podatkov in pravice ----------
  // rd/wr/cr/del: črke vlog (A admin, S svetovalec, O odgovorna oseba, Z zaposleni)
  const COLL = {
    stranke: { rd: "ASOZ", cr: "AS", wr: "ASO", del: "A", req: ["naziv"] },
    obrati: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "AS", req: ["naziv"] },
    osebje: { rd: "ASO", cr: "ASO", wr: "ASO", del: "ASO", req: ["ime"] },
    dobavitelji: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["naziv"] },
    oprema: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["naziv"] },
    usposabljanja: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["tema"] },
    nacrti: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "AS", req: ["naziv"], rev: true },
    navodila: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "AS", req: ["naslov"], rev: true },
    evidence: { rd: "ASOZ", cr: "ASOZ", wr: "ASOZ", del: "", req: ["vrsta"], rev: true, rec: true },
    capa: { rd: "ASOZ", cr: "ASOZ", wr: "ASO", del: "", req: ["opis"], rev: true },
    ciscenje_nacrt: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["opravilo"] },
    vabe: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["oznaka"] },
    kemikalije: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["naziv"] },
    tlorisi: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["naziv"], rev: true },
    urnik: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["vrsta"] },
    dogodki: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["naslov", "datum"] },
    storitve: { rd: "ASO", cr: "AS", wr: "AS", del: "A", req: ["datum"] },
    priloge: { rd: "ASOZ", cr: "ASOZ", wr: "ASO", del: "AS", req: ["ime"] },
    sarze: { rd: "ASOZ", cr: "ASOZ", wr: "ASOZ", del: "ASO", req: ["izdelek"], rev: true },
    jedi: { rd: "ASOZ", cr: "ASO", wr: "ASO", del: "ASO", req: ["naziv"] },
    certifikacija: { rd: "ASO", cr: "ASO", wr: "ASO", del: "ASO", req: ["standard", "tocka"] }
  };
  const CASCADE = ["obrati", "osebje", "dobavitelji", "oprema", "usposabljanja", "nacrti", "navodila", "dogodki", "storitve", "urnik", "priloge", "ciscenje_nacrt", "vabe", "kemikalije", "tlorisi", "sarze", "jedi", "certifikacija", "potrditve"];
  const KOS_DNI = 30;
  function kosPocisti() {
    const meja = Date.now() - KOS_DNI * 864e5, kos = load("_kos"), ostane = [];
    for (const it of kos) { if (new Date(it.cas).getTime() >= meja) { ostane.push(it); continue; } for (const pr of (it.zbirka === "priloge" ? [it.zapis] : (it.otroci && it.otroci.priloge) || [])) try { fs.unlinkSync(path.join(PRIL, pr.id)); } catch {} }
    if (ostane.length !== kos.length) { cache["_kos"] = ostane; save("_kos"); }
  }
  const RESERVED = ["id", "ustvarjeno", "ustvaril", "spremenjeno", "spremenil", "revizije", "_t"];
  const letter = u => ({ admin: "A", svetovalec: "S", odgovorna: "O", zaposleni: "Z" }[u.vloga]);
  const can = (u, perm) => perm && perm.includes(letter(u));
  function tenantOk(u, sid) {
    if (u.vloga === "admin") return true;
    if (!sid) return false;
    if (u.vloga === "svetovalec") return (u.stranke || []).includes(sid);
    return u.stranka_id === sid;
  }
  const sidOf = (c, r) => c === "stranke" ? r.id : r.stranka_id;
  function visible(u, c, r) { return tenantOk(u, sidOf(c, r)); }

  const INTERNAL = { stranke: ["notranje"], storitve: ["cena"] };
  function outv(u, c, r) {
    if (u.vloga === "admin" || u.vloga === "svetovalec" || !INTERNAL[c]) return r;
    const x = Object.assign({}, r);
    for (const k of INTERNAL[c]) delete x[k];
    return x;
  }
  function clean(obj) {
    const r = {};
    for (const [k, v] of Object.entries(obj || {})) if (!RESERVED.includes(k) && !k.startsWith("__")) r[k] = v;
    return r;
  }
  const bad = (res, code, m) => send(res, code, { napaka: m });

  async function jbody(req, res, max) {
    let s;
    try { s = await body(req); } catch { bad(res, 413, "prevelik zahtevek"); return null; }
    try { return JSON.parse(s); } catch { bad(res, 400, "neveljaven JSON"); return null; }
  }

  // ---------- varnostne kopije (zip brez stiskanja) ----------
  const CT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipMake(files) { // [{name, data:Buffer}]
    const loc = [], cen = []; let off = 0;
    for (const f of files) {
      const nm = Buffer.from(f.name), c = crc(f.data), h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt32LE(c, 14); h.writeUInt32LE(f.data.length, 18); h.writeUInt32LE(f.data.length, 22); h.writeUInt16LE(nm.length, 26);
      const e = Buffer.alloc(46);
      e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt16LE(0x0800, 8); e.writeUInt32LE(c, 16); e.writeUInt32LE(f.data.length, 20); e.writeUInt32LE(f.data.length, 24); e.writeUInt16LE(nm.length, 28); e.writeUInt32LE(off, 42);
      loc.push(h, nm, f.data); cen.push(e, nm);
      off += 30 + nm.length + f.data.length;
    }
    const cb = Buffer.concat(cen), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cb.length, 12); end.writeUInt32LE(off, 16);
    return Buffer.concat([...loc, cb, end]);
  }
  function zipRead(buf) {
    let e = buf.length - 22;
    while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
    if (e < 0) throw new Error("ni zip datoteka");
    const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = [];
    for (let i = 0; i < n; i++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("pokvarjen zip");
      const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
      const name = buf.slice(p + 46, p + 46 + nl).toString();
      if (method !== 0) throw new Error("nepodprta oblika zip (uporabite kopijo iz programa)");
      const ln = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), st = lo + 30 + ln + lx;
      out.push({ name, data: buf.slice(st, st + size) });
      p += 46 + nl + xl + cl;
    }
    return out;
  }
  function walk(d, pre) {
    const r = [];
    if (!fs.existsSync(d)) return r;
    for (const f of fs.readdirSync(d)) {
      if (f.startsWith("_kopije") || f.startsWith("_backup") || f.endsWith(".tmp")) continue;
      const fp = path.join(d, f), st = fs.statSync(fp);
      if (st.isDirectory()) r.push(...walk(fp, pre + f + "/"));
      else r.push({ name: pre + f, data: fs.readFileSync(fp) });
    }
    return r;
  }
  function makeBackup() {
    const files = [...walk(DB, "baza/").filter(f => !f.name.startsWith("baza/_")), ...walk(DIR, "podatki/").filter(f => !/^podatki\/(_kljuc|_seje\.json)$/.test(f.name))];
    return zipMake(files);
  }
  // mapa za kopije: ustvari se samo zadnja raven (nadrejena mapa mora obstajati)
  const mkdirPlitvo = d => { if (!fs.existsSync(d)) { if (!fs.existsSync(path.dirname(d))) throw new Error("nadrejena mapa ne obstaja: " + path.dirname(d)); fs.mkdirSync(d); } };
  // ---------- šifriranje kopij: HFBK1 | sol(16) | iv(12) | oznaka(16) | šifrat (AES-256-GCM, ključ iz gesla prek scrypt) ----------
  const MAGIC = Buffer.from("HFBK1");
  const kljuc = (geslo, sol) => crypto.scryptSync(String(geslo), sol, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  function sifriraj(buf, geslo) { const sol = crypto.randomBytes(16), iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", kljuc(geslo, sol), iv), ct = Buffer.concat([c.update(buf), c.final()]); return Buffer.concat([MAGIC, sol, iv, c.getAuthTag(), ct]); }
  function desifriraj(buf, geslo) { const sol = buf.subarray(5, 21), iv = buf.subarray(21, 33), tag = buf.subarray(33, 49), d = crypto.createDecipheriv("aes-256-gcm", kljuc(geslo, sol), iv); d.setAuthTag(tag); try { return Buffer.concat([d.update(buf.subarray(49)), d.final()]); } catch { throw new Error("Napačno geslo ali poškodovana datoteka."); } }
  const jeSifrirana = buf => buf.length > 49 && buf.subarray(0, 5).equals(MAGIC);
  const KSTAT = path.join(DIR, "_kopija-stanje.json");
  const kstat = () => { try { return JSON.parse(fs.readFileSync(KSTAT, "utf8")); } catch { return {}; } };
  const imeVen = name => (nast().kopija_geslo ? name.replace(/\.zip$/, ".hfbk") : name);
  function kopijaVenzaj(zip, name) {
    const dir = (nast().kopija_mapa || "").trim(); if (!dir) return;
    try {
      const g = nast().kopija_geslo; name = imeVen(name); mkdirPlitvo(dir); fs.writeFileSync(path.join(dir, name), g ? sifriraj(zip, g) : zip);
      const all = fs.readdirSync(dir).filter(x => /^kopija-.*\.(zip|hfbk)$/.test(x)).sort();
      for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(dir, old));
      fs.writeFileSync(KSTAT, JSON.stringify({ cas: now(), ok: true, mapa: dir, datoteka: name }));
    } catch (e) { fs.writeFileSync(KSTAT, JSON.stringify({ cas: now(), ok: false, mapa: dir, napaka: e.message })); }
  }
  function autoBackup(force) {
    try {
      const name = "kopija-" + now().slice(0, 10) + ".zip", f = path.join(BKP, name), ext = (nast().kopija_mapa || "").trim();
      const extMissing = ext && !fs.existsSync(path.join(ext, imeVen(name)));
      if (!fs.existsSync(f) || force || extMissing || spremembeOdKopije) {
        spremembeOdKopije = false;
        const zip = makeBackup();
        fs.writeFileSync(f, zip);
        const all = fs.readdirSync(BKP).filter(x => /^kopija-.*\.zip$/.test(x)).sort();
        for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(BKP, old));
        kopijaVenzaj(zip, name);
      }
    } catch (e) { console.error("Samodejna kopija ni uspela: " + e.message); }
  }


  // ---------- obvestila po e-pošti (SMTP je neobvezen; nastavitve in geslo ostanejo na strežniku) ----------
  const net = require("net"), tls = require("tls");
  const NAST = path.join(DIR, "_nastavitve.json");
  // Gesla v nastavitvah (SMTP, šifriranje kopij) so na disku šifrirana (AES-256-GCM). Ključ: okoljska spremenljivka HACCP_KLJUC
  // ali datoteka _kljuc (ustvari se sama; ni del varnostnih kopij). Brez ključa gesel iz nastavitev ni mogoče prebrati.
  const GK = (() => {
    if (process.env.HACCP_KLJUC) return crypto.createHash("sha256").update(process.env.HACCP_KLJUC).digest();
    const f = path.join(DIR, "_kljuc");
    try { const k = Buffer.from(fs.readFileSync(f, "utf8").trim(), "hex"); if (k.length === 32) return k; } catch {}
    const k = crypto.randomBytes(32); fs.writeFileSync(f, k.toString("hex"), { mode: 0o600 }); return k;
  })();
  const zakleni = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", GK, iv), ct = Buffer.concat([c.update(String(t), "utf8"), c.final()]); return "enc1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"); };
  const odkleni = t => { if (typeof t !== "string" || !t.startsWith("enc1:")) return t; try { const b = Buffer.from(t.slice(5), "base64"), d = crypto.createDecipheriv("aes-256-gcm", GK, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"); } catch { console.error("Gesla v nastavitvah ni mogoče odkleniti (drug ključ?). Vnesite ga znova v Administraciji."); return ""; } };
  const SKRIVNO = ["geslo", "kopija_geslo"];
  const nastSurovo = () => { try { return JSON.parse(fs.readFileSync(NAST, "utf8")); } catch { return {}; } };
  const nast = () => { const c = nastSurovo(); for (const k of SKRIVNO) if (c[k]) c[k] = odkleni(c[k]); return c; };
  const nastShrani = c => { const o = Object.assign({}, c); for (const k of SKRIVNO) if (o[k]) o[k] = zakleni(o[k]); const t = NAST + ".tmp"; fs.writeFileSync(t, JSON.stringify(o, null, 1), { mode: 0o600 }); fs.renameSync(t, NAST); };
  { const s0 = nastSurovo(); if (SKRIVNO.some(k => s0[k] && !String(s0[k]).startsWith("enc1:"))) nastShrani(nast()); } // obstoječa nešifrirana gesla se šifrirajo
  async function smtpSend(c, to, subject, text) {
    const b64 = s => Buffer.from(s).toString("base64");
    let sock = await new Promise((ok, no) => {
      const opt = { host: c.streznik, port: +c.vrata || (c.varnost === "ssl" ? 465 : 587) };
      const s = c.varnost === "ssl" ? tls.connect(opt, () => ok(s)) : net.connect(opt, () => ok(s));
      s.once("error", no); s.setTimeout(20000, () => no(new Error("SMTP: časovna omejitev")));
    });
    let buf = "", waiter = null, err = null;
    const attach = s => { s.on("data", d => { buf += d.toString(); pump(); }); s.on("error", e => { err = e; if (waiter) waiter.no(e); }); s.on("close", () => { if (waiter) waiter.no(new Error("SMTP: povezava prekinjena")); }); };
    const pump = () => {
      if (!waiter) return;
      const lines = buf.split("\r\n"); // zadnji element je nepopoln
      for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i])) { const code = lines[i].slice(0, 3), text = lines.slice(0, i + 1).join(" | "); buf = lines.slice(i + 1).join("\r\n"); const w = waiter; waiter = null; return w.ok({ code, text }); }
    };
    const read = () => err ? Promise.reject(err) : new Promise((ok, no) => { waiter = { ok, no }; pump(); });
    const cmd = async (s, expect) => { if (s !== null) sock.write(s + "\r\n"); const r = await read(); if (!r.code.startsWith(expect)) throw new Error("SMTP: " + r.text); return r; };
    attach(sock);
    try {
      await cmd(null, "220");
      let r = await cmd("EHLO higifood.local", "250");
      if (c.varnost === "starttls") {
        await cmd("STARTTLS", "220");
        sock.removeAllListeners("data"); sock.removeAllListeners("close"); sock.removeAllListeners("error");
        buf = "";
        sock = await new Promise((ok, no) => { const t = tls.connect({ socket: sock, servername: c.streznik }, () => ok(t)); t.once("error", no); });
        attach(sock);
        await cmd("EHLO higifood.local", "250");
      }
      if (c.uporabnik) { await cmd("AUTH LOGIN", "334"); await cmd(b64(c.uporabnik), "334"); await cmd(b64(c.geslo || ""), "235"); }
      const addr = c.od.replace(/^.*<|>.*$/g, "");
      await cmd("MAIL FROM:<" + addr + ">", "250");
      await cmd("RCPT TO:<" + to + ">", "25");
      await cmd("DATA", "354");
      const msg = ["From: " + c.od, "To: " + to, "Subject: =?UTF-8?B?" + b64(subject) + "?=", "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(text).replace(/(.{76})/g, "$1\r\n")].join("\r\n");
      await cmd(msg + "\r\n.", "250");
      try { sock.write("QUIT\r\n"); } catch {}
    } finally { try { sock.destroy(); } catch {} }
  }
  const dTo = s => s ? Math.ceil((new Date(String(s).slice(0, 10) + "T00:00:00") - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")) / 864e5) : null;
  function dueItems() {
    const L = [], sm = Object.fromEntries(load("stranke").map(s => [s.id, s.naziv]));
    const add = (d, tip, naslov, sid, pre) => { if (d) L.push({ datum: String(d).slice(0, 10), tip, naslov, sid, pre: pre === undefined ? 7 : pre, stranka: sm[sid] || "" }); };
    for (const s of load("stranke")) add(s.naslednji_pregled, "Pregled", "Pregled stranke: " + s.naziv, s.id);
    for (const n of load("nacrti")) if (n.status !== "zastarelo") add(n.naslednji_pregled, "Pregled", "Pregled HACCP načrta: " + n.naziv, n.stranka_id);
    for (const n of load("navodila")) if (n.status !== "zastarelo") add(n.naslednji_pregled, "Pregled", "Pregled navodila: " + n.naslov, n.stranka_id);
    for (const o of load("osebje")) { add(o.higienski_do, "Izobraževanje", "Poteče izobraževanje: " + o.ime, o.stranka_id); add(o.zdravniski_do, "Zdravniški pregled", "Poteče zdravniški pregled: " + o.ime, o.stranka_id); }
    for (const u of load("usposabljanja")) add(u.veljavno_do, "Usposabljanje", "Poteče usposabljanje: " + u.tema, u.stranka_id);
    for (const o of load("oprema")) add(o.naslednji_servis, "Oprema", "Servis/umerjanje: " + o.naziv, o.stranka_id);
    for (const o of load("dobavitelji")) add(o.naslednja_ocena, "Dobavitelj", "Ocena dobavitelja: " + o.naziv, o.stranka_id);
    for (const c of load("capa")) if (c.status !== "zaprto") add(c.rok, "CAPA", "Rok ukrepa CAPA: " + String(c.opis || "").slice(0, 70), c.stranka_id, 3);
    { const ev = load("evidence"); for (const n of load("ciscenje_nacrt")) { if (n.aktivno === false || !(+n.pogostost_dni > 0)) continue; const last = ev.filter(e => e.vrsta === "ciscenje" && e.nacrt_id === n.id && e.izvedeno).map(e => String(e.cas).slice(0, 10)).sort().pop(); let next; if (last) { const d = new Date(last + "T00:00:00"); d.setDate(d.getDate() + (+n.pogostost_dni)); next = d.toISOString().slice(0, 10); } else next = n.zacetek || String(n.ustvarjeno || "").slice(0, 10); add(next, "Čiščenje", "Čiščenje: " + (n.podrocje ? n.podrocje + " – " : "") + n.opravilo, n.stranka_id, 0); } }
    for (const k of load("kemikalije")) add(k.rok_uporabe, "Čistilo", "Poteče rok uporabe čistila: " + k.naziv, k.stranka_id, 14);
    for (const e of load("dogodki")) if (e.status !== "opravljeno") add(e.datum, e.vrsta || "Dogodek", e.naslov, e.stranka_id, e.opomnik_dni === undefined || e.opomnik_dni === "" ? 3 : +e.opomnik_dni);
    { const ev = load("evidence"), today = new Date().toISOString().slice(0, 10); for (const u of load("urnik")) { if (!(+u.frekvenca_ur > 0)) continue; const last = ev.filter(e => e.vrsta === u.vrsta && e.stranka_id === u.stranka_id && (!u.naprava || e.oprema === u.naprava || e.izdelek === u.naprava) && (!u.obrat_id || e.obrat_id === u.obrat_id)).map(e => e.cas).sort().pop(); const hrs = last ? (Date.now() - new Date(last)) / 36e5 : Infinity; if (hrs > +u.frekvenca_ur) add(today, "Manjka vnos", "Manjka vnos »" + u.vrsta + "«" + (u.naprava ? " – " + u.naprava : "") + (last ? " (zadnji pred " + Math.round(hrs) + " h, dovoljeno " + u.frekvenca_ur + " h)" : " (še ni vnosa)"), u.stranka_id, 0); } }
    { const meja = new Date(Date.now() - 7 * 864e5).toISOString(); for (const st of load("stranke")) for (const n of umikiZa(st.id)) if (n.zadetki.length && n.cas_prejema > meja) add(now().slice(0, 10), "Umik / odpoklic", "Možen umik/odpoklic: " + n.naslov + " (" + n.zadetki.slice(0, 3).join(", ") + ")", st.id, 0); }
    return L;
  }
  function digests() { // prejemniki → seznam postavk (poteklo ali v opomniku)
    const per = {}, users = load("uporabniki").filter(u => u.aktiven !== false);
    for (const it of dueItems()) {
      const n = dTo(it.datum); if (n === null || n > it.pre) continue;
      const rec = new Set();
      for (const u of users) if ((u.vloga === "odgovorna" && u.stranka_id === it.sid) || (u.vloga === "svetovalec" && (u.stranke || []).includes(it.sid))) rec.add(u.email);
      for (const e of rec) (per[e] = per[e] || []).push(Object.assign({ n }, it));
    }
    try { const op = stanjeSistema().opozorila; if (op.length) for (const u of users.filter(x => x.vloga === "admin")) for (const t of op) (per[u.email] = per[u.email] || []).push({ n: 0, datum: now().slice(0, 10), naslov: "Sistem: " + t }); } catch {}
    return per;
  }
  // ---------- obvestila o umikih in odpoklicih živil (viri RSS/Atom, ki jih določi administrator, in ročni vnos) ----------
  const UF = path.join(DIR, "_umiki.json"), UN = path.join(DIR, "_umiki-viri.json");
  const rjson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const nrm = x => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const strip = x => String(x || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
  function parseFeed(xml) {
    const out = [];
    for (const m of String(xml).matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
      const b = m[0], tag = n => { const r = new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">", "i").exec(b); return r ? strip(r[1]) : ""; };
      let link = tag("link"); if (!link) { const h = /<link[^>]*href=["']([^"']+)["']/i.exec(b); link = h ? h[1] : ""; }
      const naslov = tag("title"); if (!naslov) continue;
      out.push({ naslov, povezava: /^https?:\/\//i.test(link) ? link : "", opis: (tag("description") || tag("summary") || tag("content")).slice(0, 1500), objavljeno: tag("pubDate") || tag("published") || tag("updated") || tag("dc:date"), guid: tag("guid") || tag("id") || link || naslov });
    }
    return out;
  }
  let umikiStanje = { cas: "", napaka: "" };
  // RASFF Window (EU): neuradni, nedokumentiran backend endpoint; privzeto izklopljen. Dnevni uvoz, 15 s timeout, 3 poskusi.
  const UR = path.join(DIR, "_umiki-rasff.json");
  const RASFF_URL = () => process.env.HACCP_RASFF_URL || "https://webgate.ec.europa.eu/rasff-window/backend/public/notification/search/consolidated/en/";
  const rasffNast = () => Object.assign({ vklopljeno: false, klasifikacija: [306], izvor: [5075], zadnje: "" }, rjson(UR, {}));
  const rtxt = v => v == null ? "" : typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : Array.isArray(v) ? v.map(rtxt).filter(Boolean).join(", ") : typeof v === "object" ? rtxt(v.description || v.name || v.label || v.title || v.value || v.code) : "";
  const rget = (o, keys) => { const lo = {}; for (const k of Object.keys(o)) lo[k.toLowerCase()] = o[k]; for (const k of keys) { const v = lo[k.toLowerCase()]; if (v !== undefined && v !== null && v !== "") return v; } return null; };
  function rasffItems(j) {
    if (Array.isArray(j)) return j.filter(x => x && typeof x === "object");
    const q = [j]; for (let d = 0; d < 3 && q.length; d++) { const nx = []; for (const n of q) { if (!n || typeof n !== "object") continue; for (const k of ["notifications", "notificationList", "content", "items", "results", "data", "rows"]) if (Array.isArray(n[k])) return n[k].filter(x => x && typeof x === "object"); for (const v of Object.values(n)) { if (Array.isArray(v) && v.length && v.every(x => x && typeof x === "object")) return v; if (v && typeof v === "object") nx.push(v); } } q.length = 0; q.push(...nx); }
    return [];
  }
  async function rasffKlic(c) {
    let zadnja = null;
    for (let i = 1; i <= 3; i++) {
      try {
        const r = await fetch(RASFF_URL(), { method: "POST", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "MojaPlatforma/1.0" }, body: JSON.stringify({ parameters: { pageNumber: 1, itemsPerPage: 50 }, notificationClassification: c.klasifikacija, originCountry: c.izvor }) });
        if (!r.ok) { const e = new Error("HTTP " + r.status); e.trajno = r.status < 500 && r.status !== 429 && r.status !== 408; throw e; }
        return await r.json();
      } catch (e) { zadnja = e; if (e.trajno || i === 3) break; await new Promise(res => setTimeout(res, 1000 * 2 ** (i - 1))); }
    }
    throw zadnja;
  }
  async function osveziRasff(force) {
    const c = rasffNast(); if (!c.vklopljeno) return { novih: 0, napaka: "" };
    if (!force && c.zadnje && Date.now() - new Date(c.zadnje).getTime() < 20 * 36e5) return { novih: 0, napaka: "" };
    const vsi = rjson(UF, []), have = new Set(vsi.map(x => x.kljuc)); let novih = 0;
    const j = await rasffKlic(c);
    for (const it of rasffItems(j)) {
      const ref = rtxt(rget(it, ["reference", "notificationReference", "ecReference", "number"])) || rtxt(rget(it, ["notificationId", "id"])); if (!ref) continue;
      const kljuc = "rasff|" + ref; if (have.has(kljuc)) continue; have.add(kljuc);
      const id = rtxt(rget(it, ["notificationId", "id"])), subj = rtxt(rget(it, ["subject", "title", "description"])) || ("RASFF " + ref);
      const dt = rget(it, ["validationDate", "validatedOn", "ecValidationDate", "validatedAt", "notificationDate", "date"]), d = dt ? new Date(dt) : null;
      vsi.push({ id: uid(), kljuc, vir: "RASFF", cas_prejema: now(), naslov: subj.slice(0, 300) + " (RASFF " + ref + ")", povezava: /^\d+$/.test(id) ? "https://webgate.ec.europa.eu/rasff-window/screen/notification/" + id : "", opis: [rtxt(rget(it, ["productCategory", "category", "productType"])), rtxt(rget(it, ["riskDecision", "risk", "riskLevel"])) && "tveganje: " + rtxt(rget(it, ["riskDecision", "risk", "riskLevel"])), rtxt(rget(it, ["originCountries", "originCountry", "origin"])) && "izvor: " + rtxt(rget(it, ["originCountries", "originCountry", "origin"]))].filter(Boolean).join("; "), objavljeno: d && !isNaN(d) ? d.toISOString().slice(0, 10) : "" });
      novih++;
    }
    vsi.sort((a, b) => b.cas_prejema.localeCompare(a.cas_prejema)); fs.writeFileSync(UF, JSON.stringify(vsi.slice(0, 500), null, 1));
    c.zadnje = now(); fs.writeFileSync(UR, JSON.stringify(c, null, 1)); return { novih, napaka: "" };
  }
  async function osveziUmike(force) {
    const viri = rjson(UN, []), vsi = rjson(UF, []), have = new Set(vsi.map(x => x.kljuc)); let novih = 0; const napake = [];
    for (const v of viri) {
      if (!/^https?:\/\//i.test(v.url || "")) continue;
      try {
        const r = await fetch(v.url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "HiGiFood-HACCP" } }); if (!r.ok) throw new Error("HTTP " + r.status);
        for (const it of parseFeed(await r.text()).slice(0, 100)) { const kljuc = v.url + "|" + it.guid; if (have.has(kljuc)) continue; have.add(kljuc); vsi.push({ id: uid(), kljuc, vir: v.ime || v.url, cas_prejema: now(), naslov: it.naslov, povezava: it.povezava, opis: it.opis, objavljeno: it.objavljeno }); novih++; }
      } catch (e) { napake.push((v.ime || v.url) + ": " + e.message); }
    }
    vsi.sort((a, b) => b.cas_prejema.localeCompare(a.cas_prejema)); fs.writeFileSync(UF, JSON.stringify(vsi.slice(0, 500), null, 1));
    try { novih += (await osveziRasff(force)).novih; } catch (e) { napake.push("RASFF: " + e.message); }
    umikiStanje = { cas: now(), napaka: napake.join("; ") }; return { novih, napake };
  }
  function umikiZa(sid) { // obvestila, ki omenjajo izdelke, šarže ali dobavitelje te stranke
    const tok = new Map(), add = (t, o) => { const k = nrm(t).trim(); if (k.length >= 4 && !tok.has(k)) tok.set(k, o); };
    for (const x of load("sarze").filter(x => x.stranka_id === sid)) { add(x.ean, "EAN " + x.ean); add(x.sarza, "šarža " + x.sarza); add(x.izdelek, "izdelek " + x.izdelek); }
    for (const x of load("dobavitelji").filter(x => x.stranka_id === sid)) add(x.naziv, "dobavitelj " + x.naziv);
    for (const x of load("jedi").filter(x => x.stranka_id === sid)) for (const p of String(x.sestavine || "").split(/[,;\n]/)) add(p, "sestavina " + p.trim());
    return rjson(UF, []).map(n => { const t = nrm(n.naslov + " " + n.opis), z = []; for (const [k, o] of tok) if (t.includes(k) && !z.includes(o)) z.push(o); return Object.assign({}, n, { kljuc: undefined, zadetki: z }); });
  }
  setTimeout(() => osveziUmike().catch(() => {}), 90e3).unref();
  setInterval(() => osveziUmike().catch(() => {}), 6 * 3600e3).unref();
  // ---------- nastavitve vidnosti (admin določi, kaj vidita "Stranka" = zaposleni stranke in odgovorna oseba; privzeto + po stranki) ----------
  const VF = path.join(DIR, "_vidnost.json");
  const MODULI = [
    ["danes", "Danes (opravila)", "Meni platforme"], ["umiki", "Umiki in odpoklici", "Meni platforme"], ["koledar", "Koledar in roki", "Meni platforme"], ["pregled-zapisov", "Pregled zapisov", "Meni platforme"], ["obrazci", "Obrazci za tisk", "Meni platforme"], ["uvoz", "Uvoz podatkov", "Meni platforme"], ["kos", "Koš (izbrisano)", "Meni platforme"], ["generator", "Generator dokumentacije", "Generator"],
    ["tab:obrati", "Obrati", "Zavihki v profilu stranke"], ["tab:tloris", "Tloris", "Zavihki v profilu stranke"], ["tab:osebje", "Zaposleni in usposabljanja", "Zavihki v profilu stranke"], ["tab:dobavitelji", "Dobavitelji", "Zavihki v profilu stranke"], ["tab:oprema", "Oprema in instrumenti", "Zavihki v profilu stranke"], ["tab:nacrti", "HACCP načrti", "Zavihki v profilu stranke"], ["tab:navodila", "Navodila in obrazci", "Zavihki v profilu stranke"], ["tab:evidence", "Evidence", "Zavihki v profilu stranke"], ["tab:higiena", "Higiena", "Zavihki v profilu stranke"], ["tab:capa", "Neskladnosti / CAPA", "Zavihki v profilu stranke"], ["tab:inspekcija", "Inšpekcija", "Zavihki v profilu stranke"], ["tab:koledar", "Koledar (zavihek)", "Zavihki v profilu stranke"], ["tab:priloge", "Priloge", "Zavihki v profilu stranke"], ["tab:potrditve", "Potrditve in različice", "Zavihki v profilu stranke"], ["tab:sledljivost", "Sledljivost", "Zavihki v profilu stranke"], ["tab:alergeni", "Alergeni in jedilnik", "Zavihki v profilu stranke"], ["tab:certifikacija", "Certifikacija", "Zavihki v profilu stranke"], ["tab:storitve", "Storitve", "Zavihki v profilu stranke"], ["tab:uporabniki", "Uporabniki", "Zavihki v profilu stranke"]
  ].map(m => ({ id: m[0], label: m[1], skupina: m[2] }));
  const MODUL_IDS = new Set(MODULI.map(m => m.id));
  // zbirka podatkov je dostopna, če je viden vsaj en modul, ki jo uporablja
  const ZBIRKA_MODULI = {
    evidence: ["tab:evidence", "tab:higiena", "danes", "pregled-zapisov", "tab:inspekcija", "obrazci"], osebje: ["tab:osebje", "tab:evidence", "tab:higiena", "tab:inspekcija", "obrazci"], usposabljanja: ["tab:osebje", "tab:inspekcija", "obrazci"],
    dobavitelji: ["tab:dobavitelji", "tab:sledljivost", "tab:evidence", "tab:inspekcija"], oprema: ["tab:oprema", "tab:evidence", "tab:higiena", "obrazci", "tab:inspekcija", "tab:nacrti"],
    nacrti: ["tab:nacrti", "tab:inspekcija", "tab:potrditve", "tab:navodila"], navodila: ["tab:navodila", "tab:potrditve", "tab:inspekcija", "tab:nacrti"], capa: ["tab:capa", "tab:sledljivost", "danes", "tab:inspekcija"],
    ciscenje_nacrt: ["tab:higiena", "danes", "obrazci", "tab:inspekcija"], vabe: ["tab:higiena", "tab:inspekcija"], kemikalije: ["tab:higiena", "tab:inspekcija"], tlorisi: ["tab:tloris", "tab:inspekcija", "tab:nacrti"],
    sarze: ["tab:sledljivost"], jedi: ["tab:alergeni"], certifikacija: ["tab:certifikacija"], dogodki: ["tab:koledar", "koledar"], storitve: ["tab:storitve"], urnik: ["tab:evidence", "danes"],
    priloge: ["tab:priloge", "tab:capa", "tab:evidence", "tab:inspekcija", "tab:navodila"]
  };
  const vidnost = () => Object.assign({ privzeto: {}, stranke: {} }, rjson(VF, {}));
  const VLOGA_KLJUC = { zaposleni: "stranka", odgovorna: "odgovorna" };
  const SISTEMSKO_SKRITO = { "tab:certifikacija": ["stranka"], "tab:potrditve": ["stranka"], "generator": ["stranka"], "tab:inspekcija": ["stranka"] }; // privzeto za zaposlene (preprostejši meni)
  function vidno(u, modul, cfg) { // admin in svetovalec vidita vse
    const k = VLOGA_KLJUC[u.vloga]; if (!k) return true;
    cfg = cfg || vidnost();
    const po = cfg.stranke[u.stranka_id] && cfg.stranke[u.stranka_id][modul], pr = cfg.privzeto[modul];
    if (po && typeof po[k] === "boolean") return po[k];
    if (pr && typeof pr[k] === "boolean") return pr[k];
    return !(SISTEMSKO_SKRITO[modul] || []).includes(k);
  }
  function vidnoZaVlogo(vloga, sid, modul, cfg) { return vidno({ vloga, stranka_id: sid }, modul, cfg); }
  function modulZaPot(p) {
    const md = p.match(/^\/api\/d\/([a-z_]+)/); if (md) return ZBIRKA_MODULI[md[1]] || null;
    if (p === "/api/umiki" || p.startsWith("/api/umiki/")) return ["umiki"];
    if (p === "/api/potrdi" || p === "/api/potrditve") return ["tab:potrditve"];
    if (p === "/api/kos" || p.startsWith("/api/kos/")) return ["kos"];
    return null;
  }
  const SENT = path.join(DIR, "_obvestila.json");
  async function posljiObvestila(force) {
    const c = nast(), per = digests(), out = { prejemniki: Object.keys(per).length, poslano: 0, napake: [], predogled: [] };
    let sent = {}; try { sent = JSON.parse(fs.readFileSync(SENT, "utf8")); } catch {}
    const day = new Date().toISOString().slice(0, 10);
    for (const [to, items] of Object.entries(per)) {
      items.sort((a, b) => a.n - b.n);
      const text = "Pozdravljeni,\n\nopomnik HiGiFood HACCP:\n\n" + items.map(i => `- ${i.n < 0 ? "ZAMUDA " + -i.n + " d" : i.n === 0 ? "DANES" : "čez " + i.n + " d"} (${i.datum}): ${i.naslov}${i.stranka ? " [" + i.stranka + "]" : ""}`).join("\n") + "\n\nPrijava: " + (c.naslov_aplikacije || "") + "\n";
      out.predogled.push({ komu: to, postavk: items.length, tekst: items.map(i => i.naslov) });
      if (TESTNO || !c.streznik || !c.od || c.vklopljeno === false) continue;
      const key = to + "|" + day;
      if (sent[key] && !force) continue;
      try { await smtpSend(c, to, "HiGiFood HACCP: opomnik (" + items.length + ")", text); sent[key] = 1; out.poslano++; } catch (e) { out.napake.push(to + ": " + e.message); }
    }
    for (const k of Object.keys(sent)) if (k.split("|")[1] < new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)) delete sent[k];
    fs.writeFileSync(SENT, JSON.stringify(sent));
    return out;
  }
  setTimeout(() => posljiObvestila().catch(() => {}), 60e3).unref();
  setInterval(() => posljiObvestila().catch(() => {}), 3600e3).unref();



  // ---------- strežniška ocena skladnosti evidenc (pravila enaka kot v odjemalcu; odjemalčeva vrednost se prepiše) ----------
  const Nn = x => x === "" || x === undefined || x === null || isNaN(Number(x)) ? null : Number(x);
  function ocenaEvidence(o) {
    const range = () => { const v = Nn(o.vrednost), lo = Nn(o.min), hi = Nn(o.max); if (v === null || (lo === null && hi === null)) return null; return (lo === null || v >= lo) && (hi === null || v <= hi); };
    switch (o.vrsta) {
      case "temperatura": case "toplotna": case "drugo": return range();
      case "prevzem": { if (Nn(o.max) === null && Nn(o.vrednost) !== null) return o.embalaza_ok && o.dokumenti_ok ? null : false; return !!((o.max === "" || o.max === undefined || o.vrednost === "" || o.vrednost <= o.max) && o.embalaza_ok && o.dokumenti_ok); }
      case "hlajenje": return !!((o.max === "" || o.max === undefined || o.vrednost <= o.max) && (o.max_trajanje === "" || o.max_trajanje === undefined || o.trajanje === "" || o.trajanje <= o.max_trajanje));
      case "ciscenje": return !!(o.izvedeno && o.kontrola_ok);
      case "higiena": return ["osebna", "povrsine", "skladisce", "skodljivci", "odpadki", "roke"].every(k => o[k]);
      case "oprema": return !!(o.delovanje_ok && o.umerjeno_ok);
      case "sledljivost": return !!o.uspesno;
      case "ddd_obisk": return !!o.brez_znakov;
      case "zdravje": return !o.simptomi;
      case "skodljivci": return (Nn(o.stevilo) || 0) > 0 ? false : null;
      case "bris": { const r = []; if (Nn(o.sms) !== null && Nn(o.sms_meja) !== null) r.push(Nn(o.sms) <= Nn(o.sms_meja)); if (Nn(o.entero) !== null && Nn(o.entero_meja) !== null) r.push(Nn(o.entero) <= Nn(o.entero_meja)); if (o.listeria) r.push(o.listeria !== "zaznano"); if (o.salmonella) r.push(o.salmonella !== "zaznano"); return r.length ? r.every(Boolean) : null; }
      case "hitri_test": { if (o.kvalitativno) return o.kvalitativno !== "pozitiven"; return range(); }
      default: return null;
    }
  }

  // ---------- usmerjanje ----------
  async function handle(req, res, p, url) {
    if (!p.startsWith("/api/") || p === "/api/health") return false;
    const xff = req.headers["x-forwarded-for"];
    const ip = process.env.HACCP_PROXY === "1" && xff ? String(xff).split(",").pop().trim() : (req.socket.remoteAddress || "");
    const users = load("uporabniki");

    // --- stanje / prva nastavitev ---
    if (p === "/api/auth/stanje" && req.method === "GET") { send(res, 200, { nastavljeno: users.length > 0, testno: TESTNO, verzija: o.verzija, racuni: TESTNO ? TEST_RACUNI.map(r => ({ email: r[0], vloga: r[1], opis: r[2] })).concat([]) : undefined, geslo: TESTNO ? TEST_GESLO : undefined }); return true; }
    if (p === "/api/auth/nastavi" && req.method === "POST") {
      if (users.length) { bad(res, 403, "že nastavljeno"); return true; }
      const b = await jbody(req, res); if (!b) return true;
      if (!/^\S+@\S+\.\S+$/.test(b.email || "") || !pwOk(b.geslo)) { bad(res, 400, "Vnesite veljaven e-naslov in geslo z vsaj 10 znaki."); return true; }
      const u = { id: uid(), email: b.email.trim().toLowerCase(), ime: String(b.ime || "Administrator").slice(0, 80), vloga: "admin", geslo: hashPw(b.geslo), aktiven: true, ustvarjeno: now() };
      users.push(u); save("uporabniki");
      audit(u, "nastavitev", "uporabniki", u.id, "prvi administrator", ip);
      return startSession(res, u), send(res, 200, pub(u)), true;
    }
    if (p === "/api/auth/prijava" && req.method === "POST") {
      const b = await jbody(req, res); if (!b) return true;
      const em = String(b.email || "").trim().toLowerCase(), key = ip + "|" + em;
      if (limited(key)) { bad(res, 429, "Preveč poskusov. Poskusite čez minuto."); return true; }
      const u = users.find(x => x.email === em && x.aktiven !== false);
      const gesloOk = checkPw(String(b.geslo || ""), u ? u.geslo : LAZNO_GESLO); // tudi za neznan naslov izračunamo zgoščenko (enak odzivni čas)
      if (!u || !gesloOk) { fail(key); audit(null, "prijava-neuspela", "uporabniki", "", em, ip); bad(res, 401, "Napačen e-naslov ali geslo."); return true; }
      if (u.totp_vklop) {
        if (!b.koda) { send(res, 401, { napaka: "Vnesite kodo iz aplikacije za preverjanje (ali rezervno kodo).", potrebna_koda: true }); return true; }
        if (!drugiKorak(u, b.koda)) { fail(key); audit(null, "prijava-napacna-koda", "uporabniki", u.id, em, ip); send(res, 401, { napaka: "Koda ni pravilna ali je že bila uporabljena.", potrebna_koda: true }); return true; }
      }
      fails.delete(key);
      u.zadnja_prijava = now(); save("uporabniki");
      audit(u, "prijava", "uporabniki", u.id, "", ip);
      startSession(res, u); send(res, 200, pub(u)); return true;
    }
    function startSession(res, u) {
      const secure = req.headers["x-forwarded-proto"] === "https";
      const t = crypto.randomBytes(32).toString("base64url");
      SESS.set(sh(t), { uid: u.id, do: Date.now() + TTL });
      res.setHeader("Set-Cookie", `hs=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL / 1000}${secure ? "; Secure" : ""}`);
    }

    const me = userOf(req);
    if (p === "/api/auth/odjava" && req.method === "POST") {
      const t = cookies(req).hs; if (t) SESS.delete(sh(t));
      res.setHeader("Set-Cookie", "hs=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
      if (me) audit(me, "odjava", "uporabniki", me.id, "", ip);
      send(res, 200, { ok: true }); return true;
    }
    if (p === "/api/auth/jaz" && req.method === "GET") { if (!me) bad(res, 401, "ni prijave"); else send(res, 200, pub(me)); return true; }

    // vse spodaj zahteva prijavo
    const PUBLIC_BAZA = false;
    if (!me && !PUBLIC_BAZA) { bad(res, 401, "ni prijave"); return true; }

    { const mods = modulZaPot(p); if (mods && !mods.some(m => vidno(me, m))) { bad(res, 403, "Nimate dostopa do tega razdelka."); return true; } }
    for (const pot of [rRacun, rVzdrzevanje, rUporabniki, rBazaDokumenti, rStoritve, rKopije, rPriloge, rZbirke]) { const r = await pot(req, res, p, url, me, ip, users); if (r !== undefined) return r; }
    bad(res, 404, "ni najdeno"); return true;
  }
  // Poti: nastavitve vidnosti, dvostopenjska prijava, sprememba gesla. Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  // ---------- vzdrževanje: GDPR (izvoz, anonimizacija, roki hrambe), preizkus obnove, stanje sistema ----------
  const GDPRF = path.join(DIR, "_gdpr.json"), PREIZF = path.join(DIR, "_preizkus-obnove.json");
  const gdprNast = () => Object.assign({ hramba_osebje_let: 2 }, rjson(GDPRF, {}));
  const ANON = "[izbrisana oseba]";
  const nrmI = x => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  function vsebuje(v, iskani) { // ali kateri koli niz v zapisu (tudi gnezdeno) vsebuje ime ali e-naslov
    if (typeof v === "string") { const t = nrmI(v); return iskani.some(q => q && t.includes(q)); }
    if (Array.isArray(v)) return v.some(x => vsebuje(x, iskani));
    if (v && typeof v === "object") return Object.values(v).some(x => vsebuje(x, iskani));
    return false;
  }
  function zamenjaj(v, vzorci) { // zamenja ime/e-naslov v vseh nizih (tudi v zgodovini sprememb); vrne [nova vrednost, število zamenjav]
    let n = 0;
    const f = x => { if (typeof x === "string") { let y = x; for (const re of vzorci) y = y.replace(re, () => { n++; return ANON; }); return y; } if (Array.isArray(x)) return x.map(f); if (x && typeof x === "object") { const o = {}; for (const [k, w] of Object.entries(x)) o[k] = f(w); return o; } return x; };
    const r = f(v); return [r, n];
  }
  const esc_re = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function preizkusObnove() {
    const kandidati = fs.readdirSync(BKP).filter(f => /\.(zip|hfbk)$/.test(f)).map(f => ({ f, t: fs.statSync(path.join(BKP, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    const r = { cas: now(), ok: false, datoteka: kandidati[0] ? kandidati[0].f : null, podrobnosti: [] };
    try {
      if (!kandidati.length) throw new Error("ni nobene varnostne kopije");
      let raw = fs.readFileSync(path.join(BKP, r.datoteka));
      if (jeSifrirana(raw)) { const g = nast().kopija_geslo; if (!g) throw new Error("kopija je šifrirana, geslo ni nastavljeno"); raw = desifriraj(raw, g); }
      const files = zipRead(raw), ime = n => files.find(x => x.name === n);
      const us = ime("podatki/uporabniki.json"); if (!us) throw new Error("kopija ne vsebuje uporabnikov");
      const usr = JSON.parse(us.data.toString("utf8")); if (!Array.isArray(usr) || !usr.length) throw new Error("seznam uporabnikov je prazen");
      let jsonov = 0; for (const x of files) if (x.name.endsWith(".json")) { JSON.parse(x.data.toString("utf8")); jsonov++; }
      const sled = files.filter(x => /^podatki\/_revizijska-sled(-.+)?\.jsonl$/.test(x.name)).sort((a, b) => (a.name === "podatki/_revizijska-sled.jsonl") - (b.name === "podatki/_revizijska-sled.jsonl") || a.name.localeCompare(b.name));
      let prev = "0", vnosov = 0;
      for (const x of sled) for (const l of x.data.toString("utf8").split("\n").filter(Boolean)) { const e = JSON.parse(l), h = e.h; delete e.h; if (crypto.createHash("sha256").update(prev + JSON.stringify(e)).digest("hex") !== h) throw new Error("revizijska sled v kopiji ni veljavna (vnos " + (vnosov + 1) + ")"); prev = h; vnosov++; }
      const st = c => { const x = ime("podatki/" + c + ".json"); return x ? JSON.parse(x.data.toString("utf8")).length : 0; };
      r.podrobnosti = [files.length + " datotek", jsonov + " zbirk JSON brez napak", usr.length + " uporabnikov", st("stranke") + " strank", st("evidence") + " evidenc", vnosov + " vnosov revizijske sledi (veriga veljavna)"];
      r.ok = true;
    } catch (e) { r.napaka = e.message; console.error("Preizkus obnove ni uspel: " + e.message); }
    fs.writeFileSync(PREIZF, JSON.stringify(r, null, 1)); return r;
  }
  function stanjeSistema() {
    let disk = null; try { const s = fs.statfsSync(DIR); disk = { prosto: s.bavail * s.bsize, skupaj: s.blocks * s.bsize }; } catch {}
    let velikost = 0; for (const f of walk(DIR, "")) velikost += f.data ? f.data.length : 0;
    const ks = kstat(), pr = rjson(PREIZF, null), zadnja = fs.readdirSync(BKP).filter(f => /^kopija-.*\.zip$/.test(f)).sort().pop();
    const opozorila = [];
    if (disk && disk.prosto < 1e9) opozorila.push("Na disku je manj kot 1 GB prostora.");
    if (!zadnja || Date.now() - fs.statSync(path.join(BKP, zadnja)).mtimeMs > 2 * 864e5) opozorila.push("Zadnja samodejna kopija je starejša od 2 dni.");
    if (ks && ks.ok === false) opozorila.push("Kopija v zunanjo mapo ni uspela: " + (ks.napaka || ""));
    if (!pr) opozorila.push("Obnova iz kopije še ni bila preizkušena.");
    else if (!pr.ok) opozorila.push("Zadnji preizkus obnove ni uspel: " + pr.napaka);
    else if (Date.now() - new Date(pr.cas).getTime() > 35 * 864e5) opozorila.push("Preizkus obnove je starejši od 35 dni.");
    const zbirke = {}; for (const c of Object.keys(COLL)) zbirke[c] = load(c).length;
    return { verzija: o.verzija, testno: TESTNO, deluje_od: new Date(Date.now() - process.uptime() * 1000).toISOString(), node: process.version, disk, velikost_podatkov: velikost, zadnja_kopija: zadnja || null, kopija_zunaj: ks, preizkus_obnove: pr, zbirke, napake: NAPAKE.slice().reverse(), opozorila, smtp: !!nast().streznik };
  }
  async function rVzdrzevanje(req, res, p, url, me, ip, users) {
    if (!p.startsWith("/api/gdpr") && !p.startsWith("/api/sistem") && p !== "/api/kopija/preizkus") return;
    if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
    if (p === "/api/sistem" && req.method === "GET") { send(res, 200, stanjeSistema()); return true; }
    if (p === "/api/kopija/preizkus") {
      if (req.method === "GET") { send(res, 200, rjson(PREIZF, null)); return true; }
      if (req.method === "POST") { autoBackup(); const r = preizkusObnove(); audit(me, "preizkus-obnove", "", "", r.ok ? "uspešno" : "neuspešno: " + r.napaka, ip); send(res, 200, r); return true; }
    }
    if (p === "/api/gdpr/nastavitve") {
      if (req.method === "GET") { send(res, 200, gdprNast()); return true; }
      if (req.method === "PUT") { const b = await jbody(req, res); if (!b) return true; const n = { hramba_osebje_let: Math.max(0, Math.min(50, +b.hramba_osebje_let || 0)) }; fs.writeFileSync(GDPRF, JSON.stringify(n)); audit(me, "gdpr-nastavitve", "", "", JSON.stringify(n), ip); send(res, 200, n); return true; }
    }
    if (p === "/api/gdpr/potekli" && req.method === "GET") { // nekdanji zaposleni, katerih rok hrambe je potekel
      const let_ = gdprNast().hramba_osebje_let, meja = new Date(Date.now() - let_ * 365.25 * 864e5).toISOString().slice(0, 10);
      const sm = Object.fromEntries(load("stranke").map(s => [s.id, s.naziv]));
      send(res, 200, { hramba_osebje_let: let_, meja, osebe: load("osebje").filter(x => x.datum_odhoda && x.datum_odhoda <= meja && x.ime !== ANON).map(x => ({ id: x.id, ime: x.ime, email: x.email || "", stranka: sm[x.stranka_id] || "", datum_odhoda: x.datum_odhoda })) }); return true;
    }
    const b = req.method === "POST" ? await jbody(req, res) : null; if (req.method === "POST" && !b) return true;
    const ime = String((b && b.ime) || "").trim(), email = String((b && b.email) || "").trim().toLowerCase();
    if ((p === "/api/gdpr/izvoz" || p === "/api/gdpr/anonimiziraj") && req.method === "POST") {
      if (ime.length < 3 && email.length < 5) { bad(res, 400, "Vnesite ime in priimek ali e-naslov osebe."); return true; }
      const iskani = [nrmI(ime), nrmI(email)].filter(x => x.length >= 3);
      if (p === "/api/gdpr/izvoz") {
        const zadetki = {}; for (const c of Object.keys(COLL)) { const z = load(c).filter(r => vsebuje(r, iskani)); if (z.length) zadetki[c] = z; }
        const u = users.filter(x => (email && x.email === email) || (ime && nrmI(x.ime) === nrmI(ime))).map(pub);
        const sled = auditRead(100000).filter(e => vsebuje([e.ime, e.opis], iskani));
        audit(me, "gdpr-izvoz", "", "", "zadetkov " + Object.values(zadetki).reduce((a, x) => a + x.length, 0), ip);
        send(res, 200, { izvozeno: now(), oseba: { ime, email }, uporabniski_racuni: u, zapisi: zadetki, revizijska_sled: sled }); return true;
      }
      if (b.potrdi !== true) { bad(res, 400, "Potrditev manjka."); return true; }
      const vzorci = [ime, email].filter(x => x.length >= 3).map(x => new RegExp(esc_re(x), "gi"));
      let zamenjav = 0, zapisov = 0;
      for (const c of Object.keys(COLL)) {
        const arr = load(c); let sprememba = false;
        for (let i = 0; i < arr.length; i++) {
          if (!vsebuje(arr[i], iskani)) continue;
          const [nv, n] = zamenjaj(arr[i], vzorci); if (!n) continue;
          if (c === "osebje" && nv.ime === ANON) { for (const k of ["email", "telefon", "opomba", "zdravniski_do", "higienski_do"]) delete nv[k]; }
          arr[i] = nv; zamenjav += n; zapisov++; sprememba = true;
        }
        if (sprememba) save(c);
      }
      let racunov = 0;
      for (const u of users) if ((email && u.email === email) || (ime && nrmI(u.ime) === nrmI(ime))) {
        if (u.id === me.id) continue;
        u.ime = ANON; u.email = "izbrisan-" + u.id + "@anonimizirano.invalid"; u.aktiven = false; for (const k of ["totp_vklop", "totp_skrivnost", "totp_rezervne", "totp_zadnji"]) delete u[k];
        for (const [k, s] of SESS) if (s.uid === u.id) SESS.delete(k); racunov++;
      }
      if (racunov) save("uporabniki");
      audit(me, "gdpr-anonimizacija", "", "", "zapisov " + zapisov + ", zamenjav " + zamenjav + ", računov " + racunov + " (oseba: " + sh(nrmI(ime) + "|" + email).slice(0, 12) + ")", ip);
      send(res, 200, { zapisov, zamenjav, racunov }); return true;
    }
    bad(res, 404, "ni najdeno"); return true;
  }

  async function rRacun(req, res, p, url, me, ip, users) {
    if (p === "/api/vidnost") {
      const cfg = vidnost();
      if (req.method === "GET") {
        const q = new URL(req.url, "http://x").searchParams, kot = q.get("kot");
        let vloga = me.vloga, sid = me.stranka_id;
        if (kot) { if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; } vloga = kot === "stranka" ? "zaposleni" : "odgovorna"; sid = q.get("stranka_id") || null; }
        const moje = {}; for (const m of MODULI) moje[m.id] = vidnoZaVlogo(vloga, sid, m.id, cfg);
        send(res, 200, me.vloga === "admin" && !kot ? { moje, moduli: MODULI, privzeto: cfg.privzeto, stranke: cfg.stranke, sistemsko: SISTEMSKO_SKRITO } : { moje }); return true;
      }
      if (req.method === "PUT") {
        if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
        const b = await jbody(req, res); if (!b) return true;
        const sid = b.stranka_id || null; if (sid && !load("stranke").some(x => x.id === sid)) { bad(res, 400, "Stranka ne obstaja."); return true; }
        if (b.ponastavi) { if (!sid) { bad(res, 400, "Ponastavitev velja za posamezno stranko."); return true; } delete cfg.stranke[sid]; }
        else {
          if (!MODUL_IDS.has(b.modul) || !["stranka", "odgovorna"].includes(b.vloga) || typeof b.vidno !== "boolean") { bad(res, 400, "Neveljavna nastavitev."); return true; }
          const tgt = sid ? (cfg.stranke[sid] = cfg.stranke[sid] || {}) : cfg.privzeto; tgt[b.modul] = Object.assign({}, tgt[b.modul], { [b.vloga]: b.vidno });
        }
        fs.writeFileSync(VF, JSON.stringify(cfg, null, 1)); audit(me, "nastavitve-vidnosti", "", sid || "", b.ponastavi ? "ponastavitev" : b.modul + " " + b.vloga + "=" + b.vidno, ip); send(res, 200, { ok: true }); return true;
      }
    }
    if (p === "/api/auth/2fa/zacni" && req.method === "POST") {
      const sk = crypto.randomBytes(20); me.totp_cakanje = b32enc(sk); // kot zgoščenke gesel: v uporabniki.json (ključ _kljuc ni potreben, kopije delujejo tudi na drugem računalniku) save("uporabniki");
      const s32 = b32enc(sk), lbl = encodeURIComponent("HiGiFood:" + me.email);
      send(res, 200, { skrivnost: s32.replace(/(.{4})/g, "$1 ").trim(), uri: `otpauth://totp/${lbl}?secret=${s32}&issuer=HiGiFood&algorithm=SHA1&digits=6&period=30` }); return true;
    }
    if (p === "/api/auth/2fa/potrdi" && req.method === "POST") {
      const b = await jbody(req, res); if (!b) return true; const gk = "2fa|" + me.id;
      if (limited(gk)) { bad(res, 429, "Preveč poskusov. Poskusite čez minuto."); return true; }
      if (!me.totp_cakanje) { bad(res, 400, "Najprej začnite nastavitev."); return true; }
      const ctr = totpPreveri(b32dec(me.totp_cakanje), b.koda, 0);
      if (!ctr) { fail(gk); bad(res, 400, "Koda ni pravilna. Preverite uro na telefonu in poskusite znova."); return true; }
      const rez = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").toUpperCase());
      me.totp_skrivnost = me.totp_cakanje; delete me.totp_cakanje; me.totp_vklop = true; me.totp_zadnji = ctr; me.totp_rezervne = rez.map(sh); save("uporabniki");
      audit(me, "2fa-vklop", "uporabniki", me.id, "", ip); send(res, 200, { ok: true, rezervne: rez }); return true;
    }
    if (p === "/api/auth/2fa/izklopi" && req.method === "POST") {
      const b = await jbody(req, res); if (!b) return true; const gk = "2fa|" + me.id;
      if (limited(gk)) { bad(res, 429, "Preveč poskusov. Poskusite čez minuto."); return true; }
      if (!me.totp_vklop) { send(res, 200, { ok: true }); return true; }
      if (!checkPw(String(b.geslo || ""), me.geslo) || !drugiKorak(me, b.koda)) { fail(gk); bad(res, 400, "Geslo ali koda ni pravilna."); return true; }
      for (const k of ["totp_vklop", "totp_skrivnost", "totp_zadnji", "totp_rezervne"]) delete me[k]; save("uporabniki");
      audit(me, "2fa-izklop", "uporabniki", me.id, "", ip); send(res, 200, { ok: true }); return true;
    }
    if (p === "/api/auth/geslo" && req.method === "POST") {
      const b = await jbody(req, res); if (!b) return true;
      const gk = "geslo|" + me.id;
      if (limited(gk)) { bad(res, 429, "Preveč poskusov. Poskusite čez minuto."); return true; }
      if (!checkPw(String(b.staro || ""), me.geslo) || !pwOk(b.novo)) { fail(gk); bad(res, 400, "Staro geslo ni pravilno ali novo geslo je prekratko (vsaj 10 znakov)."); return true; }
      fails.delete(gk);
      me.geslo = hashPw(b.novo); me.mora_zamenjati = false; save("uporabniki");
      { const moja = sh(cookies(req).hs || ""); for (const [k, s] of [...SESS]) if (s.uid === me.id && k !== moja) SESS.delete(k); } // odjava drugih naprav
      audit(me, "sprememba-gesla", "uporabniki", me.id, "", ip);
      send(res, 200, { ok: true }); return true;
    }

  }

  // Poti: uporabniki. Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  async function rUporabniki(req, res, p, url, me, ip, users) {
    // --- uporabniki ---
    if (p === "/api/uporabniki") {
      if (req.method === "GET") {
        if (me.vloga === "admin") { send(res, 200, users.map(pub)); return true; }
        if (me.vloga === "svetovalec") { send(res, 200, users.filter(u => u.stranka_id && me.stranke.includes(u.stranka_id)).map(pub)); return true; }
        if (me.vloga === "odgovorna") { send(res, 200, users.filter(u => u.stranka_id === me.stranka_id).map(pub)); return true; }
        bad(res, 403, "prepovedano"); return true;
      }
      if (req.method === "POST") {
        const b = await jbody(req, res); if (!b) return true;
        if (!VLOGE.includes(b.vloga) || !/^\S+@\S+\.\S+$/.test(b.email || "") || !pwOk(b.geslo)) { bad(res, 400, "Neveljavni podatki (vloga, e-naslov, geslo vsaj 10 znakov)."); return true; }
        const em = b.email.trim().toLowerCase();
        if (users.some(x => x.email === em)) { bad(res, 409, "E-naslov že obstaja."); return true; }
        let sid = b.stranka_id || null;
        if (me.vloga === "odgovorna") { if (b.vloga !== "zaposleni") { bad(res, 403, "Dodate lahko samo zaposlene."); return true; } sid = me.stranka_id; }
        else if (me.vloga === "svetovalec") { if (!["odgovorna", "zaposleni"].includes(b.vloga) || !tenantOk(me, sid)) { bad(res, 403, "prepovedano"); return true; } }
        else if (me.vloga !== "admin") { bad(res, 403, "prepovedano"); return true; }
        if (["odgovorna", "zaposleni"].includes(b.vloga) && !sid) { bad(res, 400, "Izberite stranko."); return true; }
        const u = { id: uid(), email: em, ime: String(b.ime || em).slice(0, 80), vloga: b.vloga, stranka_id: sid, stranke: b.vloga === "svetovalec" ? (Array.isArray(b.stranke) ? b.stranke : []) : [], geslo: hashPw(b.geslo), aktiven: true, mora_zamenjati: true, ustvarjeno: now() };
        users.push(u); save("uporabniki");
        audit(me, "uporabnik-nov", "uporabniki", u.id, u.vloga + " " + u.email, ip);
        send(res, 200, pub(u)); return true;
      }
    }
    const mu = p.match(/^\/api\/uporabniki\/([\w-]+)$/);
    if (mu) {
      const u = users.find(x => x.id === mu[1]);
      const mayManage = u && (me.vloga === "admin" || (me.vloga === "odgovorna" && u.stranka_id === me.stranka_id && u.vloga === "zaposleni") || (me.vloga === "svetovalec" && u.stranka_id && me.stranke.includes(u.stranka_id) && u.vloga !== "admin"));
      if (!mayManage) { bad(res, 404, "ni najdeno"); return true; }
      if (req.method === "PUT") {
        const b = await jbody(req, res); if (!b) return true;
        if (b.ime !== undefined) u.ime = String(b.ime).slice(0, 80);
        if (b.aktiven !== undefined) { if (u.id === me.id && !b.aktiven) { bad(res, 400, "Sebe ne morete onemogočiti."); return true; } u.aktiven = !!b.aktiven; if (!u.aktiven) for (const [k, s] of SESS) if (s.uid === u.id) SESS.delete(k); }
        if (b.geslo !== undefined) { if (!pwOk(b.geslo)) { bad(res, 400, "Geslo je prekratko."); return true; } u.geslo = hashPw(b.geslo); u.mora_zamenjati = true; for (const [k, s] of SESS) if (s.uid === u.id) SESS.delete(k); }
        if (me.vloga === "admin") {
          if (b.izklopi_2fa === true) { for (const k of ["totp_vklop", "totp_skrivnost", "totp_zadnji", "totp_rezervne", "totp_cakanje"]) delete u[k]; for (const [k, s] of SESS) if (s.uid === u.id) SESS.delete(k); }
          if (b.stranke !== undefined && u.vloga === "svetovalec") u.stranke = Array.isArray(b.stranke) ? b.stranke : [];
          if (b.vloga !== undefined && VLOGE.includes(b.vloga) && u.id !== me.id) u.vloga = b.vloga;
          if (b.stranka_id !== undefined) u.stranka_id = b.stranka_id || null;
        }
        save("uporabniki"); audit(me, "uporabnik-spremenjen", "uporabniki", u.id, Object.keys(b).filter(k => k !== "geslo").join(","), ip);
        send(res, 200, pub(u)); return true;
      }
      bad(res, 405, "metoda ni dovoljena"); return true;
    }

  }

  // Poti: baza znanja, posodobitve, potrjevanje dokumentov. Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  async function rBazaDokumenti(req, res, p, url, me, ip, users) {
    // --- baza znanja (branje: vsi prijavljeni; pisanje: samo administrator) ---
    if (p === "/api/baza" || p.startsWith("/api/baza/") || p === "/api/posodobitve") {
      if (req.method !== "GET" && me.vloga !== "admin") { bad(res, 403, "Bazo znanja lahko ureja samo administrator."); return true; }
      if (req.method !== "GET") res.on("finish", () => { if (res.statusCode < 300) audit(me, "baza-pisanje", "baza", p.split("/")[3] || "", req.method, ip); });
      return false;
    }
    if (p === "/api/posodobitev") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      res.on("finish", () => audit(me, "baza-posodobitev", "baza", "", "", ip));
      return false;
    }


    // ---------- potrjevanje dokumentov (odgovorna oseba potrdi trenutno različico; sprememba potrditev razveljavi) ----------
    const hashZapisa = r => { const o = {}; for (const k of Object.keys(r).sort()) if (!RESERVED.includes(k) && !k.startsWith("_") && !["verzija", "skladno", "status"].includes(k)) o[k] = r[k]; return sh(JSON.stringify(o)); };
    if (p === "/api/potrdi" && req.method === "POST") {
      if (!can(me, "ASO")) { bad(res, 403, "Dokument lahko potrdi odgovorna oseba ali svetovalec."); return true; }
      const b = await jbody(req, res); if (!b) return true;
      if (!["nacrti", "navodila"].includes(b.zbirka)) { bad(res, 400, "Neveljavna zbirka."); return true; }
      const r = load(b.zbirka).find(x => x.id === b.id);
      if (!r || !visible(me, b.zbirka, r)) { bad(res, 404, "ni najdeno"); return true; }
      const pot = load("potrditve"), z = { id: uid(), stranka_id: r.stranka_id, zbirka: b.zbirka, ref_id: r.id, naslov: r.naslov || r.naziv || "", verzija: r.verzija || 1, hash: hashZapisa(r), potrdil: me.id, potrdil_ime: me.ime, cas: now(), opomba: String(b.opomba || "").slice(0, 500) };
      pot.push(z); save("potrditve"); audit(me, "potrdi", b.zbirka, r.id, z.naslov + " v" + z.verzija, ip); send(res, 200, z); return true;
    }
    if (p === "/api/potrditve" && req.method === "GET") {
      const sid = new URL(req.url, "http://x").searchParams.get("stranka_id") || me.stranka_id;
      if (!tenantOk(me, sid)) { bad(res, 403, "Nimate dostopa do izbrane stranke."); return true; }
      const out = load("potrditve").filter(x => x.stranka_id === sid).map(x => { const r = load(x.zbirka).find(y => y.id === x.ref_id); return Object.assign({}, x, { hash: undefined, veljavna: !!r && hashZapisa(r) === x.hash, obstaja: !!r }); });
      send(res, 200, out); return true;
    }
  }

  // Poti: arhiv, umiki, omrežje, testno okolje, tisk, nastavitve, obvestila, logotip, koš. Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  async function rStoritve(req, res, p, url, me, ip, users) {
    // ---------- arhiv starih evidenc (samo administrator; stisnjeno v podatki/_arhiv, vrnitev mogoča) ----------
    if (p.startsWith("/api/arhiv")) {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      const AD = path.join(DIR, "_arhiv"); fs.mkdirSync(AD, { recursive: true });
      const zl = require("zlib");
      if (p === "/api/arhiv" && req.method === "GET") {
        send(res, 200, fs.readdirSync(AD).filter(f => f.endsWith(".json.gz")).map(f => { const st = fs.statSync(path.join(AD, f)); return { ime: f, velikost: st.size, cas: st.mtime.toISOString() }; }).sort((a, b) => b.cas.localeCompare(a.cas))); return true;
      }
      if (p === "/api/arhiv" && req.method === "POST") {
        const b = await jbody(req, res); if (!b) return true; const leta = Math.max(1, Math.min(30, +b.leta || 0));
        if (!b.leta) { bad(res, 400, "Določite število let."); return true; }
        const meja = new Date(Date.now() - leta * 365.25 * 864e5).toISOString(), ev = load("evidence"), stare = ev.filter(e => String(e.cas || e.ustvarjeno) < meja && (!b.stranka_id || e.stranka_id === b.stranka_id));
        if (b.samo_preveri) { send(res, 200, { stevilo: stare.length, meja: meja.slice(0, 10) }); return true; }
        if (!stare.length) { send(res, 200, { stevilo: 0 }); return true; }
        const ime = "evidence-do-" + meja.slice(0, 10) + "-" + Date.now().toString(36) + ".json.gz";
        fs.writeFileSync(path.join(AD, ime), zl.gzipSync(JSON.stringify({ zbirka: "evidence", meja, zapisi: stare })));
        const ids = new Set(stare.map(e => e.id)); cache["evidence"] = ev.filter(e => !ids.has(e.id)); save("evidence");
        audit(me, "arhiviraj", "evidence", "", stare.length + " zapisov v " + ime, ip); send(res, 200, { stevilo: stare.length, datoteka: ime }); return true;
      }
      const m2 = p.match(/^\/api\/arhiv\/([\w.\-]+\.json\.gz)(\/obnovi)?$/);
      if (m2) {
        const f = path.join(AD, m2[1]); if (!fs.existsSync(f)) { bad(res, 404, "ni najdeno"); return true; }
        if (m2[2] && req.method === "POST") {
          const d = JSON.parse(zl.gunzipSync(fs.readFileSync(f)).toString("utf8")), cur = load("evidence"), have = new Set(cur.map(e => e.id)); let n = 0;
          for (const e of d.zapisi) if (!have.has(e.id)) { cur.push(e); n++; }
          save("evidence"); fs.unlinkSync(f); audit(me, "obnovi-arhiv", "evidence", "", n + " zapisov iz " + m2[1], ip); send(res, 200, { stevilo: n }); return true;
        }
        if (req.method === "GET") { res.writeHead(200, { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${m2[1]}"` }); res.end(fs.readFileSync(f)); return true; }
      }
    }
    if (p === "/api/umiki" || p.startsWith("/api/umiki/")) {
      const staff = me.vloga === "admin" || me.vloga === "svetovalec";
      if (p === "/api/umiki" && req.method === "GET") {
        const sid = new URL(req.url, "http://x").searchParams.get("stranka_id") || me.stranka_id;
        if (sid && !tenantOk(me, sid)) { bad(res, 403, "Nimate dostopa do izbrane stranke."); return true; }
        const l = sid ? umikiZa(sid) : rjson(UF, []).map(n => Object.assign({}, n, { kljuc: undefined, zadetki: [] }));
        send(res, 200, { obvestila: l.slice(0, 200), viri: me.vloga === "admin" ? rjson(UN, []) : undefined, rasff: me.vloga === "admin" ? rasffNast() : undefined, stanje: umikiStanje }); return true;
      }
      if (p === "/api/umiki" && req.method === "POST") {
        if (!staff) { bad(res, 403, "prepovedano"); return true; }
        const b = await jbody(req, res); if (!b) return true; const naslov = String(b.naslov || "").trim(); if (!naslov) { bad(res, 400, "Vnesite naslov obvestila."); return true; }
        const l = rjson(UF, []); l.unshift({ id: uid(), kljuc: "rocno|" + uid(), vir: "ročni vnos", cas_prejema: now(), naslov: naslov.slice(0, 300), povezava: /^https?:\/\//i.test(b.povezava || "") ? b.povezava : "", opis: String(b.opis || "").slice(0, 3000), objavljeno: String(b.objavljeno || "").slice(0, 40) });
        fs.writeFileSync(UF, JSON.stringify(l, null, 1)); audit(me, "umik-vnos", "", "", naslov.slice(0, 80), ip); send(res, 200, { ok: true }); return true;
      }
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      if (p === "/api/umiki/viri" && req.method === "PUT") {
        const b = await jbody(req, res); if (!b) return true;
        const viri = (Array.isArray(b.viri) ? b.viri : []).map(v => ({ ime: String(v.ime || "").slice(0, 80), url: String(v.url || "").trim() })).filter(v => /^https?:\/\//i.test(v.url)).slice(0, 10);
        fs.writeFileSync(UN, JSON.stringify(viri, null, 1)); audit(me, "umik-viri", "", "", String(viri.length), ip); send(res, 200, { ok: true }); return true;
      }
      if (p === "/api/umiki/osvezi" && req.method === "POST") { send(res, 200, await osveziUmike(true)); return true; }
      if (p === "/api/umiki/rasff" && req.method === "PUT") {
        const b = await jbody(req, res); if (!b) return true; const ids = a => (Array.isArray(a) ? a : String(a || "").split(",")).map(x => Number(String(x).trim())).filter(Number.isInteger);
        const o = rasffNast(); o.vklopljeno = b.vklopljeno === true; const k = ids(b.klasifikacija), i2 = ids(b.izvor); if (k.length) o.klasifikacija = k; if (i2.length) o.izvor = i2;
        fs.writeFileSync(UR, JSON.stringify(o, null, 1)); audit(me, "umik-rasff", "", "", o.vklopljeno ? "vklopljen" : "izklopljen", ip); send(res, 200, o); return true;
      }
      const mu = p.match(/^\/api\/umiki\/([\w-]+)$/);
      if (mu && req.method === "DELETE") { fs.writeFileSync(UF, JSON.stringify(rjson(UF, []).filter(x => x.id !== mu[1]), null, 1)); send(res, 200, { ok: true }); return true; }
    }
    if (p === "/api/omrezje" && req.method === "GET") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      const inf = o.omrezje ? o.omrezje() : { host: "127.0.0.1", port: 3000 }, ips = [];
      for (const l of Object.values(require("os").networkInterfaces())) for (const a of l || []) if (a.family === "IPv4" && !a.internal) ips.push(a.address);
      send(res, 200, { host: inf.host, port: inf.port, omrezje: inf.host === "0.0.0.0", testno: TESTNO, naslovi: inf.host === "0.0.0.0" ? ips.map(i => "http://" + i + ":" + inf.port + "/") : [] }); return true;
    }
    if (p === "/api/testno/ponastavi" && req.method === "POST") {
      if (!TESTNO) { bad(res, 404, "ni najdeno"); return true; }
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      for (const f of fs.readdirSync(DIR)) { const fp = path.join(DIR, f); if (f.startsWith("_revizijska") || f === "_kopije") continue; try { if (fs.statSync(fp).isDirectory()) { if (f === "priloge") for (const g of fs.readdirSync(fp)) fs.unlinkSync(path.join(fp, g)); } else fs.unlinkSync(fp); } catch {} }
      for (const k of Object.keys(cache)) delete cache[k];
      SESS.clear(); testniPodatki(); audit(null, "testno-ponastavitev", "", "", me.email, ip); send(res, 200, { ok: true }); return true;
    }
    if (p === "/api/tisk") {
      const TF = path.join(DIR, "_tisk.json");
      const KAT = { haccp: "HACCP načrt (PDF, Word, Excel)", navodila: "Delovna navodila", evidence: "Evidence in higiena (izpisi)", capa: "Korektivni ukrepi (CAPA)", inspekcija: "Inšpekcijska mapa", obrazci: "Prazni obrazci", qr: "QR kode (tisk)", ostalo: "Ostali izpisi (tloris, storitve ...)" };
      const VLOGE = ["svetovalec", "odgovorna", "zaposleni"];
      const priv = { haccp: { svetovalec: true, odgovorna: true, zaposleni: false }, navodila: { svetovalec: true, odgovorna: true, zaposleni: true }, evidence: { svetovalec: true, odgovorna: true, zaposleni: true }, capa: { svetovalec: true, odgovorna: true, zaposleni: false }, inspekcija: { svetovalec: true, odgovorna: true, zaposleni: false }, obrazci: { svetovalec: true, odgovorna: true, zaposleni: true }, qr: { svetovalec: true, odgovorna: true, zaposleni: true }, ostalo: { svetovalec: true, odgovorna: true, zaposleni: false } };
      let sh = {}; try { sh = JSON.parse(fs.readFileSync(TF, "utf8")); } catch {}
      const pravila = {}; for (const k of Object.keys(KAT)) { pravila[k] = {}; for (const v of VLOGE) pravila[k][v] = sh[k] && typeof sh[k][v] === "boolean" ? sh[k][v] : priv[k][v]; }
      if (req.method === "GET") {
        const moje = {}; for (const k of Object.keys(KAT)) moje[k] = me.vloga === "admin" ? true : !!pravila[k][me.vloga];
        send(res, 200, me.vloga === "admin" ? { moje, kategorije: KAT, pravila } : { moje }); return true;
      }
      if (req.method === "PUT") {
        if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
        const b = await jbody(req, res); if (!b) return true; const n = {};
        for (const k of Object.keys(KAT)) { n[k] = {}; for (const v of VLOGE) n[k][v] = b.pravila && b.pravila[k] && typeof b.pravila[k][v] === "boolean" ? b.pravila[k][v] : pravila[k][v]; }
        fs.writeFileSync(TF, JSON.stringify(n, null, 1)); audit(me, "nastavitve-tiska", "", "", "", ip); send(res, 200, { ok: true }); return true;
      }
    }
    if (p === "/api/nastavitve") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      if (req.method === "GET") { const c = nast(); send(res, 200, Object.assign({}, c, { geslo: c.geslo ? "********" : "", kopija_geslo: undefined })); return true; }
      if (req.method === "PUT") {
        const b = await jbody(req, res); if (!b) return true; const old = nast();
        const n = { kopija_mapa: old.kopija_mapa, kopija_geslo: old.kopija_geslo, vklopljeno: b.vklopljeno !== false, streznik: String(b.streznik || "").trim(), vrata: +b.vrata || "", varnost: ["ssl", "starttls", "brez"].includes(b.varnost) ? b.varnost : "starttls", uporabnik: String(b.uporabnik || ""), geslo: b.geslo && b.geslo !== "********" ? String(b.geslo) : old.geslo || "", od: String(b.od || "").trim(), naslov_aplikacije: String(b.naslov_aplikacije || "").trim() };
        nastShrani(n); audit(me, "nastavitve-obvestil", "", "", n.streznik, ip); send(res, 200, { ok: true }); return true;
      }
    }


    if (p === "/api/obvestila/zdaj" && req.method === "POST") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      const r = await posljiObvestila(true); audit(me, "obvestila-poslana", "", "", JSON.stringify({ poslano: r.poslano }), ip); send(res, 200, r); return true;
    }
    if (p === "/api/obvestila/test" && req.method === "POST") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      const b = await jbody(req, res); if (!b) return true; const c = nast();
      if (!c.streznik || !c.od) { bad(res, 400, "SMTP ni nastavljen."); return true; }
      try { await smtpSend(c, String(b.komu || ""), "HiGiFood HACCP: testno sporočilo", "Testno sporočilo. Pošiljanje obvestil deluje."); send(res, 200, { ok: true }); } catch (e) { bad(res, 502, e.message); }
      return true;
    }

    if (p === "/api/logo") {
      const lf = path.join(DIR, "logo.bin"), lm = path.join(DIR, "logo.json");
      if (req.method === "GET") { if (!fs.existsSync(lf)) { bad(res, 404, "ni logotipa"); return true; } const m = JSON.parse(fs.readFileSync(lm, "utf8")); res.writeHead(200, { "Content-Type": m.tip, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); res.end(fs.readFileSync(lf)); return true; }
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      if (req.method === "POST") {
        const b = await jbody(req, res); if (!b) return true; const buf = Buffer.from(String(b.podatki || ""), "base64");
        if (!buf.length || buf.length > 1.5e6 || !/^image\/(png|jpeg|webp)$/.test(b.tip || "") || !vsebinaUstreza(buf, b.tip)) { bad(res, 400, "Logotip: PNG, JPEG ali WebP do 1,5 MB."); return true; }
        fs.writeFileSync(lf, buf); fs.writeFileSync(lm, JSON.stringify({ tip: b.tip })); audit(me, "logotip-nov", "", "", b.tip, ip); send(res, 200, { ok: true }); return true;
      }
      if (req.method === "DELETE") { for (const f of [lf, lm]) try { fs.unlinkSync(f); } catch {} audit(me, "logotip-odstranjen", "", "", "", ip); send(res, 200, { ok: true }); return true; }
    }
    // logotip posamezne stranke: vidijo ga vsi z dostopom do stranke, spremenijo administrator, svetovalec in odgovorna oseba
    const msl = p.match(/^\/api\/stranka-logo\/([\w-]+)$/);
    if (msl) {
      const sid = msl[1];
      if (!tenantOk(me, sid) || !load("stranke").some(s => s.id === sid)) { bad(res, 404, "ni najdeno"); return true; }
      const lf = path.join(SLOGO, sid + ".bin"), lm = path.join(SLOGO, sid + ".json");
      if (req.method === "GET") { if (!fs.existsSync(lf)) { res.writeHead(204, { "Cache-Control": "private, no-store" }); res.end(); return true; } const m = JSON.parse(fs.readFileSync(lm, "utf8")); res.writeHead(200, { "Content-Type": m.tip, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); res.end(fs.readFileSync(lf)); return true; }
      if (!can(me, COLL.stranke.wr)) { bad(res, 403, "prepovedano"); return true; }
      if (req.method === "POST") {
        const b = await jbody(req, res); if (!b) return true; const buf = Buffer.from(String(b.podatki || ""), "base64");
        if (!buf.length || buf.length > 1.5e6 || !/^image\/(png|jpeg|webp)$/.test(b.tip || "") || !vsebinaUstreza(buf, b.tip)) { bad(res, 400, "Logotip: PNG, JPEG ali WebP do 1,5 MB."); return true; }
        fs.mkdirSync(SLOGO, { recursive: true }); fs.writeFileSync(lf, buf); fs.writeFileSync(lm, JSON.stringify({ tip: b.tip })); audit(me, "logotip-stranke-nov", "stranke", sid, b.tip, ip); send(res, 200, { ok: true }); return true;
      }
      if (req.method === "DELETE") { for (const f of [lf, lm]) try { fs.unlinkSync(f); } catch {} audit(me, "logotip-stranke-odstranjen", "stranke", sid, "", ip); send(res, 200, { ok: true }); return true; }
    }

    if (p === "/api/kos" && req.method === "GET") {
      const out = load("_kos").filter(it => COLL[it.zbirka] && can(me, COLL[it.zbirka].del) && tenantOk(me, it.stranka_id)).map(it => ({ id: it.id, zbirka: it.zbirka, ime: it.ime, cas: it.cas, izbrisal: it.izbrisal, stranka_id: it.stranka_id, stranka: (load("stranke").find(s => s.id === it.stranka_id) || (it.zbirka === "stranke" ? it.zapis : {})).naziv || "", otrok: it.otroci ? Object.values(it.otroci).reduce((a, x) => a + x.length, 0) : 0, preostalo_dni: Math.max(0, Math.ceil((new Date(it.cas).getTime() + KOS_DNI * 864e5 - Date.now()) / 864e5)) })).sort((a, b) => b.cas.localeCompare(a.cas));
      send(res, 200, out); return true;
    }
    const mk = p.match(/^\/api\/kos\/([\w-]+)(\/obnovi)?$/);
    if (mk) {
      const kos = load("_kos"), it = kos.find(x => x.id === mk[1]);
      if (!it || !COLL[it.zbirka] || !can(me, COLL[it.zbirka].del) || !tenantOk(me, it.stranka_id)) { bad(res, 404, "ni najdeno"); return true; }
      if (mk[2] && req.method === "POST") {
        if (it.zbirka !== "stranke" && !load("stranke").some(s => s.id === it.stranka_id)) { bad(res, 409, "Najprej obnovite stranko, kateri zapis pripada."); return true; }
        const tgt = load(it.zbirka); if (tgt.some(x => x.id === it.zapis.id)) { bad(res, 409, "Zapis s to oznako že obstaja."); return true; }
        tgt.push(it.zapis); save(it.zbirka);
        for (const [k, arr] of Object.entries(it.otroci || {})) { const cur = load(k); for (const x of arr) if (!cur.some(y => y.id === x.id)) cur.push(x); save(k); }
        cache["_kos"] = kos.filter(x => x !== it); save("_kos"); audit(me, "obnovi", it.zbirka, it.zapis.id, it.ime, ip); send(res, 200, { ok: true }); return true;
      }
      if (!mk[2] && req.method === "DELETE") {
        if (me.vloga !== "admin") { bad(res, 403, "Trajno briše samo administrator."); return true; }
        for (const pr of (it.zbirka === "priloge" ? [it.zapis] : (it.otroci && it.otroci.priloge) || [])) try { fs.unlinkSync(path.join(PRIL, pr.id)); } catch {}
        cache["_kos"] = kos.filter(x => x !== it); save("_kos"); audit(me, "izbris-trajno", it.zbirka, it.zapis.id, it.ime, ip); send(res, 200, { ok: true }); return true;
      }
      bad(res, 405, "metoda ni dovoljena"); return true;
    }
  }

  // Poti: varnostne kopije, obnova, ustavitev. Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  async function rKopije(req, res, p, url, me, ip, users) {
    // --- skrbniške funkcije ---
    if (p === "/api/revizijska-sled" && req.method === "GET") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      send(res, 200, { preveritev: auditVerify(), vnosi: auditRead(Math.min(parseInt(url.searchParams.get("n") || "200", 10) || 200, 2000)) }); return true;
    }

    if (p === "/api/kopija/nastavitve") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      if (req.method === "GET") { send(res, 200, { mapa: nast().kopija_mapa || "", sifrirano: !!nast().kopija_geslo, stanje: kstat() }); return true; }
      if (req.method === "PUT") {
        const b = await jbody(req, res); if (!b) return true; const all = nast(), dir = String(b.mapa || "").trim();
        if (dir) { try { mkdirPlitvo(dir); const t = path.join(dir, ".test-" + uid()); fs.writeFileSync(t, "x"); fs.unlinkSync(t); } catch (e) { bad(res, 400, "V mapo ni mogoče pisati: " + e.message); return true; } }
        if (b.geslo !== undefined && b.geslo !== "********") { if (b.geslo && String(b.geslo).length < 8) { bad(res, 400, "Geslo za šifriranje mora imeti vsaj 8 znakov."); return true; } all.kopija_geslo = String(b.geslo || ""); if (!all.kopija_geslo) delete all.kopija_geslo; }
        all.kopija_mapa = dir; nastShrani(all); audit(me, "kopija-mapa", "", "", dir, ip);
        autoBackup(true); send(res, 200, { ok: true, stanje: kstat() }); return true;
      }
    }
    if (p === "/api/ustavi" && req.method === "POST") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      audit(me, "program-ustavljen", "", "", "", ip); send(res, 200, { ok: true }); setTimeout(() => process.exit(0), 400); return true;
    }
    if (p === "/api/kopija/sifrirana" && req.method === "POST") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      const b = await jbody(req, res); if (!b) return true; if (!b.geslo || String(b.geslo).length < 8) { bad(res, 400, "Geslo mora imeti vsaj 8 znakov."); return true; }
      const z = sifriraj(makeBackup(), b.geslo); audit(me, "kopija-prenos-sifrirana", "", "", z.length + " B", ip);
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="higifood-kopija-${now().slice(0, 10)}.hfbk"`, "Cache-Control": "no-store" }); res.end(z); return true;
    }
    if (p === "/api/kopija/zdaj" && req.method === "POST") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      autoBackup(true); audit(me, "kopija-zdaj", "", "", "", ip); send(res, 200, { ok: true, stanje: kstat() }); return true;
    }
    if (p === "/api/kopija" && req.method === "GET") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      const z = makeBackup(); audit(me, "kopija-prenos", "", "", z.length + " B", ip);
      res.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="higifood-kopija-${now().slice(0, 10)}.zip"`, "Cache-Control": "no-store" });
      res.end(z); return true;
    }
    if (p === "/api/obnovi" && req.method === "POST") {
      if (me.vloga !== "admin") { bad(res, 403, "samo administrator"); return true; }
      let s; try { s = await body(req, 200e6); } catch { bad(res, 413, "prevelika datoteka"); return true; }
      let files; try { let raw = Buffer.from(s, "base64"); if (jeSifrirana(raw)) { const g = req.headers["x-kopija-geslo"]; if (!g) { bad(res, 400, "Kopija je šifrirana: vnesite geslo."); return true; } raw = desifriraj(raw, g); } files = zipRead(raw); } catch (e) { bad(res, 400, e.message); return true; }
      const ok = files.filter(f => /^(baza|podatki)\/[\w\-./]+$/.test(f.name) && !f.name.includes("..") && !/^podatki\/(_kljuc|_seje\.json)$/.test(f.name));
      if (!ok.some(f => f.name.startsWith("podatki/uporabniki.json"))) { bad(res, 400, "Kopija ne vsebuje uporabnikov – ni veljavna."); return true; }
      { const g = nast().kopija_geslo, z = makeBackup(); fs.writeFileSync(path.join(BKP, "pred-obnovo-" + now().replace(/[:.]/g, "-") + (g ? ".hfbk" : ".zip")), g ? sifriraj(z, g) : z); }
      for (const f of ok) {
        const target = f.name.startsWith("baza/") ? path.join(DB, f.name.slice(5)) : path.join(DIR, f.name.slice(8));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, f.data);
      }
      for (const k of Object.keys(cache)) delete cache[k];
      auditLast(); // revizijska sled je bila zamenjana z datoteko iz kopije
      audit(me, "obnova", "", "", ok.length + " datotek", ip);
      send(res, 200, { ok: true, datotek: ok.length }); return true;
    }

  }

  // Poti: priloge. Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  async function rPriloge(req, res, p, url, me, ip, users) {
    // --- priloge (datoteke) ---
    if (p === "/api/priloga" && req.method === "POST") {
      const b = await jbody(req, res); if (!b) return true;
      if (!tenantOk(me, b.stranka_id) || !can(me, COLL.priloge.cr)) { bad(res, 403, "prepovedano"); return true; }
      const buf = Buffer.from(String(b.podatki || ""), "base64");
      if (!buf.length || buf.length > 8e6) { bad(res, 400, "Datoteka je prazna ali večja od 8 MB."); return true; }
      if (!/^(image\/(png|jpeg|webp|gif)|application\/pdf|text\/plain)$/.test(b.tip || "") || !vsebinaUstreza(buf, b.tip)) { bad(res, 400, "Dovoljene so slike, PDF in besedilo (vsebina datoteke se mora ujemati z vrsto)."); return true; }
      const id = uid();
      fs.writeFileSync(path.join(PRIL, id), buf);
      const r = { id, stranka_id: b.stranka_id, obrat_id: b.obrat_id || null, ime: String(b.ime || "priloga").slice(0, 120), tip: b.tip, velikost: buf.length, povezava: b.povezava || null, ustvarjeno: now(), ustvaril: me.id };
      load("priloge").push(r); save("priloge");
      audit(me, "priloga-nova", "priloge", id, r.ime, ip);
      send(res, 200, r); return true;
    }
    const mp = p.match(/^\/api\/priloga\/([\w-]+)$/);
    if (mp && req.method === "GET") {
      const r = load("priloge").find(x => x.id === mp[1]);
      if (!r || !visible(me, "priloge", r)) { bad(res, 404, "ni najdeno"); return true; }
      res.writeHead(200, { "Content-Type": r.tip, "Content-Disposition": `inline; filename="${encodeURIComponent(r.ime)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" });
      res.end(fs.readFileSync(path.join(PRIL, r.id))); return true;
    }

  }

  // Poti: podatkovne zbirke (/api/d/…). Vrne true (obdelano), false (prepusti strežniku) ali undefined (naslednja skupina poti).
  async function rZbirke(req, res, p, url, me, ip, users) {
    // --- podatkovne zbirke (stranke, obrati, evidence, CAPA …) ---
    const md = p.match(/^\/api\/d\/([a-z_]+)(?:\/([\w-]+))?$/);
    if (md) {
      const c = md[1], cfg = COLL[c];
      if (c === "priloge" && req.method !== "GET") { bad(res, 400, "Priloge nalagajte prek /api/priloga."); return true; }
      if (!cfg) { bad(res, 404, "zbirka ne obstaja"); return true; }
      const data = load(c);
      if (!md[2]) {
        if (req.method === "GET") {
          if (!can(me, cfg.rd)) { bad(res, 403, "prepovedano"); return true; }
          let r = data.filter(x => visible(me, c, x)).map(x => outv(me, c, x));
          for (const [k, v] of url.searchParams) if (!k.startsWith("_") && /^[a-z_]+$/.test(k)) r = r.filter(x => String(x[k]) === v);
          send(res, 200, r); return true;
        }
        if (req.method === "POST") {
          if (!can(me, cfg.cr)) { bad(res, 403, "prepovedano"); return true; }
          const b = await jbody(req, res); if (!b) return true;
          const r = clean(b);
          r.id = uid();
          if (c !== "stranke") {
            if (me.vloga === "odgovorna" || me.vloga === "zaposleni") r.stranka_id = me.stranka_id;
            if (!tenantOk(me, r.stranka_id)) { bad(res, 403, "Nimate dostopa do izbrane stranke."); return true; }
            if (!load("stranke").some(s => s.id === r.stranka_id)) { bad(res, 400, "Stranka ne obstaja."); return true; }
            if (r.obrat_id) {
              const ob = load("obrati").find(x => x.id === r.obrat_id);
              if (!ob || ob.stranka_id !== r.stranka_id) { bad(res, 400, "Obrat ne pripada stranki."); return true; }
            }
          }
          for (const k of cfg.req) if (r[k] === undefined || r[k] === "") { bad(res, 400, `Polje »${k}« je obvezno.`); return true; }
          r.ustvarjeno = now(); r.ustvaril = me.id; r.ustvaril_ime = me.ime;
          if (cfg.rev) { r.revizije = []; r.verzija = 1; }
          if (c === "evidence") r.skladno = ocenaEvidence(r);
          if (cfg.rec) { r.cas = r.cas && /^\d{4}-\d\d-\d\d/.test(r.cas) ? r.cas : now(); r.status = r.status === "potrjeno" && !can(me, "ASO") ? "vneseno" : (r.status || "vneseno"); }
          if (c === "stranke" && me.vloga === "svetovalec") { me.stranke = [...(me.stranke || []), r.id]; save("uporabniki"); }
          data.push(r); save(c);
          audit(me, "ustvari", c, r.id, r.naziv || r.vrsta || r.naslov || "", ip);
          send(res, 200, outv(me, c, r)); return true;
        }
        bad(res, 405, "metoda ni dovoljena"); return true;
      }
      const r = data.find(x => x.id === md[2]);
      if (!r || !visible(me, c, r) || !can(me, cfg.rd)) { bad(res, 404, "ni najdeno"); return true; }
      if (req.method === "GET") { send(res, 200, outv(me, c, r)); return true; }
      if (req.method === "PUT") {
        if (!can(me, cfg.wr)) { bad(res, 403, "prepovedano"); return true; }
        const b = await jbody(req, res); if (!b) return true;
        const nw = clean(b), razlog = String(b._razlog || b.razlog_spremembe || "").trim();
        delete nw.razlog_spremembe; delete nw._razlog; delete nw._ver;
        if (b._ver && b._ver !== (r.spremenjeno || r.ustvarjeno)) { const kdo = (load("uporabniki").find(x => x.id === r.spremenil) || {}).ime || "drug uporabnik"; bad(res, 409, `Zapis je medtem spremenil(a) ${kdo} (${String(r.spremenjeno || "").slice(0, 16).replace("T", " ")} UTC). Zaprite obrazec, osvežite stran in vnesite spremembo znova.`); return true; }
        if (cfg.rec) {
          if (r.status === "potrjeno" && !can(me, "ASO")) { bad(res, 403, "Potrjenega zapisa zaposleni ne morejo spreminjati."); return true; }
          if (nw.status === "potrjeno" && !can(me, "ASO")) { bad(res, 403, "Zapis lahko potrdi odgovorna oseba ali svetovalec."); return true; }
          if (r.status === "potrjeno" && !razlog) { bad(res, 400, "Za popravek potrjenega zapisa vnesite razlog."); return true; }
          if (r.status !== "potrjeno" && r.ustvaril !== me.id && !can(me, "ASO")) { bad(res, 403, "Zapis lahko popravi samo avtor ali odgovorna oseba."); return true; }
        }
        if (c === "capa" && r.status === "zaprto" && !razlog) { bad(res, 400, "Zaprt ukrep lahko spremenite samo z razlogom."); return true; }
        if (c !== "stranke") { nw.stranka_id = r.stranka_id; }
        if (c === "stranke" && me.vloga === "odgovorna") { for (const k of ["svetovalec", "paket", "cena", "notranje"]) delete nw[k]; }
        if (nw.obrat_id) {
          const ob = load("obrati").find(x => x.id === nw.obrat_id);
          if (!ob || ob.stranka_id !== r.stranka_id) { bad(res, 400, "Obrat ne pripada stranki."); return true; }
        }
        for (const k of cfg.req) if (nw[k] !== undefined && nw[k] === "") { bad(res, 400, `Polje »${k}« je obvezno.`); return true; }
        if (cfg.rev) {
          const prej = {};
          for (const k of Object.keys(nw)) if (JSON.stringify(r[k]) !== JSON.stringify(nw[k])) prej[k] = r[k];
          if (!Object.keys(prej).length) { send(res, 200, r); return true; }
          r.revizije.push({ n: r.verzija, cas: now(), uporabnik: me.id, ime: me.ime, razlog, prej });
          r.verzija++;
        }
        const keep = { id: r.id, ustvarjeno: r.ustvarjeno, ustvaril: r.ustvaril, ustvaril_ime: r.ustvaril_ime, revizije: r.revizije, verzija: r.verzija, cas: cfg.rec ? r.cas : undefined };
        Object.assign(r, nw);
        for (const [k, v] of Object.entries(keep)) if (v !== undefined) r[k] = v;
        if (c === "evidence") r.skladno = ocenaEvidence(r);
        r.spremenjeno = now(); r.spremenil = me.id;
        save(c); audit(me, "spremeni", c, r.id, razlog, ip);
        send(res, 200, outv(me, c, r)); return true;
      }
      if (req.method === "DELETE") {
        if (!can(me, cfg.del)) { bad(res, 403, cfg.del === "" ? "Zapisov te vrste ni mogoče brisati (revizijska sled)." : "prepovedano"); return true; }
        // mehko brisanje: zapis (in pri stranki vsi podrejeni zapisi) gre v koš za 30 dni
        const kos = load("_kos"), item = { id: uid(), zbirka: c, stranka_id: c === "stranke" ? r.id : r.stranka_id, ime: r.naziv || r.ime || r.naslov || r.oznaka || r.opravilo || r.tema || "", cas: now(), izbrisal: me.ime, zapis: r };
        data.splice(data.indexOf(r), 1);
        if (c === "stranke") { item.otroci = {}; for (const k of CASCADE) { item.otroci[k] = load(k).filter(x => x.stranka_id === r.id); cache[k] = load(k).filter(x => x.stranka_id !== r.id); save(k); } }
        kos.push(item); save("_kos");
        save(c); audit(me, "izbriši", c, r.id, item.ime, ip);
        send(res, 200, { ok: true }); return true;
      }
      bad(res, 405, "metoda ni dovoljena"); return true;
    }
  }


  // ---------- testno okolje: demo podatki in testni računi (samo ob zagonu z --testno) ----------
  const TEST_RACUNI = [["admin@test.si", "admin", "Administrator: vse, tudi nastavitve (samo za vodje testiranja)"], ["svetovalec@test.si", "svetovalec", "HACCP-svetovalec: dela s strankami"], ["odgovorna@test.si", "odgovorna", "Odgovorna oseba stranke"], ["zaposleni@test.si", "zaposleni", "Zaposleni stranke (najmanj pravic)"]];
  function testniPodatki() {
    if (load("uporabniki").length) return;
    const t = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10), c0 = now();
    const ins = (c, r) => { const x = Object.assign({ id: uid(), ustvarjeno: c0, ustvaril: "test", ustvaril_ime: "Testni podatki" }, r); if (COLL[c].rev) { x.revizije = []; x.verzija = 1; } load(c).push(x); return x; };
    const s = ins("stranke", { naziv: "Testna gostilna d.o.o.", dejavnost: "Gostinstvo", odgovorna_oseba: "Mojca Testna", naslov: "Testna ulica 1, Ljubljana", naslednji_pregled: t(25) });
    const sid = s.id, P = r => Object.assign({ stranka_id: sid }, r);
    ins("obrati", P({ naziv: "Kuhinja" }));
    ins("oprema", P({ naziv: "Hladilnik 1", tip: "hladilnik", lokacija: "Kuhinja", naslednji_servis: t(14) })); ins("oprema", P({ naziv: "Zamrzovalnik 1", tip: "zamrzovalnik", lokacija: "Skladišče" }));
    ins("osebje", P({ ime: "Ana Testna", funkcija: "Kuharica", higienski_do: t(60), zdravniski_do: t(-3) })); ins("osebje", P({ ime: "Boris Testni", funkcija: "Natakar", higienski_do: t(200) }));
    ins("usposabljanja", P({ tema: "Osebna higiena", datum: t(-30), udelezenci: "Ana Testna, Boris Testni", izvajalec: "Testni izvajalec", veljavno_do: t(335) }));
    ins("dobavitelji", P({ naziv: "Testna mesarija", kategorija: "meso", kontakt: "041 000 000", ocena: "odobren", naslednja_ocena: t(90) })); ins("dobavitelji", P({ naziv: "Testna zelenjava", kategorija: "zelenjava", ocena: "pogojno odobren" }));
    ins("nacrti", P({ naziv: "HACCP načrt kuhinje (test)", status: "osnutek", naslednji_pregled: t(60) })); ins("navodila", P({ naslov: "Higiena rok (test)", vrsta: "navodilo", status: "veljavno" }));
    [3, 4, 3.5, 8].forEach((v, i) => { const e = ins("evidence", P({ vrsta: "temperatura", oprema: "Hladilnik 1", vrednost: v, min: 0, max: 4, cas: new Date(Date.now() - i * 432e5).toISOString(), status: "vneseno" })); e.skladno = ocenaEvidence(e); });
    ins("capa", P({ opis: "Temperatura hladilnika nad mejo (test)", status: "odprto", tveganje: "srednje", rok: t(3), odgovoren: "Mojca Testna" }));
    ins("ciscenje_nacrt", P({ podrocje: "Kuhinja", opravilo: "Pranje tal", sredstvo: "Čistilo A", pogostost_dni: 1 })); ins("urnik", P({ vrsta: "temperatura", naprava: "Zamrzovalnik 1", frekvenca_ur: 24 }));
    ins("sarze", P({ izdelek: "Goveje meso", sarza: "LOT-TEST-1", dobavitelj: "Testna mesarija", datum_prevzema: t(-2), rok_uporabe: t(5), uporabljeno: "gulaž" }));
    ins("jedi", P({ naziv: "Palačinke", skupina: "sladica", sestavine: "moka, mleko, jajca", alergeni: ["Žita z glutenom", "Jajca", "Mleko"] }));
    for (const c of ["stranke", "obrati", "oprema", "osebje", "usposabljanja", "dobavitelji", "nacrti", "navodila", "evidence", "capa", "ciscenje_nacrt", "urnik", "sarze", "jedi"]) save(c);
    fs.writeFileSync(path.join(DIR, "_umiki.json"), JSON.stringify([{ id: uid(), kljuc: "test|1", vir: "ročni vnos", cas_prejema: c0, naslov: "TEST: odpoklic govejega mesa, šarža LOT-TEST-1", povezava: "", opis: "Testno obvestilo za preizkus ujemanja.", objavljeno: "" }], null, 1));
    const us = TEST_RACUNI.map(r => ({ id: uid(), email: r[0], ime: r[0].split("@")[0].replace(/^./, x => x.toUpperCase()) + " (test)", vloga: r[1], stranka_id: r[1] === "odgovorna" || r[1] === "zaposleni" ? sid : null, stranke: r[1] === "svetovalec" ? [sid] : [], geslo: hashPw(TEST_GESLO), aktiven: true, mora_zamenjati: false, ustvarjeno: c0 }));
    cache["uporabniki"] = us; save("uporabniki");
  }
  if (TESTNO) testniPodatki();
  autoBackup(); kosPocisti();
  setInterval(() => { autoBackup(); kosPocisti(); }, 6 * 3600e3).unref();

  return { handle, userOf, audit, load, save, makeBackup, COLL, vidno, zapri: () => { if (sejeT) clearTimeout(sejeT); sejeShrani(); if (spremembeOdKopije) autoBackup(); } };
};
