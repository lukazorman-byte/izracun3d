// Varnost in robustnost (strežnik): izvor, UTF-8 telo, hkratno urejanje (409), seje po ponovnem zagonu,
// odjava drugih sej ob spremembi gesla, preverjanje vsebine datotek, IP za posrednikom, čista zaustavitev, čiščenje baza/_backup.
const cp = require("child_process"), path = require("path"), fs = require("fs"), os = require("os");
const ROOT = path.join(__dirname, ".."), PORT = 4990, B = "http://127.0.0.1:" + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "hgvar-"));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
let srv;
const start = env => new Promise((res, rej) => { srv = cp.spawn(process.execPath, [path.join(ROOT, "server.js"), "--tiho"], { env: Object.assign({}, process.env, { PORT: String(PORT), HACCP_DATA: DATA, HOST: "127.0.0.1" }, env || {}), stdio: "ignore" });
  const t0 = Date.now(); const poll = () => fetch(B + "/api/health").then(() => res(), () => Date.now() - t0 > 10000 ? rej(new Error("strežnik se ni zagnal")) : setTimeout(poll, 150)); poll(); });
const stop = () => new Promise(res => { const t0 = Date.now(); srv.once("exit", code => res({ code, ms: Date.now() - t0 })); srv.kill("SIGTERM"); });
const req = async (m, p, body, ck, h) => { const r = await fetch(B + p, { method: m, headers: Object.assign({ "Content-Type": "application/json", Origin: B }, ck ? { Cookie: ck } : {}, h || {}), body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get("set-cookie"); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j, ck: sc ? sc.split(";")[0] : null }; };
(async () => {
  await start({ HACCP_PROXY: "1", HACCP_SLED_MAX: "3000" });
  const a = await req("POST", "/api/auth/nastavi", { email: "a@t.si", geslo: "dolgogeslo123", ime: "A" }, null, { "X-Forwarded-For": "203.0.113.7" }); const ck = a.ck; ok(a.s === 200 && ck, "admin ustvarjen");
  // izvor
  ok((await req("POST", "/api/d/stranke", { naziv: "x" }, ck, { Origin: "null" })).s === 403, "Origin: null -> 403 (ne 500)");
  ok((await req("POST", "/api/d/stranke", { naziv: "x" }, ck, { Origin: "https://zlo.example" })).s === 403, "tuj Origin -> 403");
  { const r = await fetch(B + "/api/d/stranke", { method: "POST", headers: { "Content-Type": "application/json", Cookie: ck, "Sec-Fetch-Site": "cross-site" }, body: "{}" }); ok(r.status === 403, "brez Origin in Sec-Fetch-Site: cross-site -> 403"); }
  // UTF-8 v velikem telesu (večbajtni znaki čez meje kosov)
  const dolg = "čšžČŠŽ đćĐĆ ".repeat(30000);
  const st = await req("POST", "/api/d/stranke", { naziv: "Šumniki čšž", opis: dolg }, ck); ok(st.s === 200, "velik zapis s šumniki");
  const nazaj = (await req("GET", "/api/d/stranke", undefined, ck)).j.find(x => x.id === st.j.id); ok(nazaj && nazaj.opis === dolg, "šumniki ostanejo nepoškodovani (" + dolg.length + " znakov)");
  // hkratno urejanje
  const v0 = nazaj.spremenjeno || nazaj.ustvarjeno;
  ok((await req("PUT", "/api/d/stranke/" + st.j.id, { naziv: "Prva sprememba", _ver: v0 }, ck)).s === 200, "prva sprememba z veljavno različico");
  const r409 = await req("PUT", "/api/d/stranke/" + st.j.id, { naziv: "Druga (zastarela)", _ver: v0 }, ck); ok(r409.s === 409 && /medtem spremenil/.test(r409.j.napaka), "zastarela različica -> 409: " + (r409.j && r409.j.napaka || "").slice(0, 50));
  ok((await req("PUT", "/api/d/stranke/" + st.j.id, { naziv: "Brez preverjanja" }, ck)).s === 200, "brez _ver deluje kot prej");
  // vsebina datotek
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
  ok((await req("POST", "/api/priloga", { stranka_id: st.j.id, ime: "a.png", tip: "image/png", podatki: Buffer.from("<script>alert(1)</script>").toString("base64"), zbirka: "stranke" }, ck)).s === 400, "HTML, poslan kot PNG -> 400");
  ok((await req("POST", "/api/priloga", { stranka_id: st.j.id, ime: "a.png", tip: "image/png", podatki: png, zbirka: "stranke" }, ck)).s === 200, "pravi PNG -> 200");
  // IP za posrednikom
  const sled = (await req("GET", "/api/revizijska-sled?n=50", undefined, ck)).j; ok(JSON.stringify(sled).includes("203.0.113.7"), "revizijska sled vsebuje IP iz X-Forwarded-For (HACCP_PROXY=1)");
  // baza/_backup: največ 30 kopij na zbirko
  const tipi = (await req("GET", "/api/baza/tipi", undefined, ck)).j;
  for (let i = 0; i < 33; i++) await req("PUT", "/api/baza/tipi", tipi, ck);
  const bk = fs.readdirSync(path.join(DATA, "baza", "_backup")).filter(f => f.startsWith("tipi-")); ok(bk.length === 30, "baza/_backup obrezan na 30 (" + bk.length + ")");
  // revizijska sled: arhiviranje pri velikosti in veriga čez datoteke
  const pv = (await req("GET", "/api/revizijska-sled?n=500", undefined, ck)).j;
  const arh = fs.readdirSync(path.join(DATA, "podatki")).filter(f => /^_revizijska-sled-.+\.jsonl$/.test(f));
  ok(arh.length >= 2 && pv.preveritev.ok && pv.preveritev.arhivov === arh.length, "sled arhivirana v " + arh.length + " datotek, veriga veljavna (" + JSON.stringify(pv.preveritev) + ")");
  ok(pv.vnosi.length > 20, "branje sledi zajame tudi arhive (" + pv.vnosi.length + " vnosov)");
  // gesla v nastavitvah šifrirana na disku
  ok((await req("PUT", "/api/nastavitve", { streznik: "smtp.test.si", od: "a@t.si", uporabnik: "u", geslo: "SmtpSkrivnost123" }, ck)).s === 200, "SMTP nastavitve shranjene");
  ok((await req("PUT", "/api/kopija/nastavitve", { mapa: "", geslo: "KopijaSkrivnost9" }, ck)).s === 200, "geslo kopij shranjeno");
  const nf = fs.readFileSync(path.join(DATA, "podatki", "_nastavitve.json"), "utf8"); ok(!/SmtpSkrivnost123|KopijaSkrivnost9/.test(nf) && /enc1:/.test(nf), "gesla na disku niso berljiva");
  const ng = (await req("GET", "/api/nastavitve", undefined, ck)).j; ok(ng.geslo === "********" && ng.kopija_geslo === undefined, "API ne vrne gesel");
  const zz = await fetch(B + "/api/kopija", { headers: { Cookie: ck } }).then(r => r.arrayBuffer()).then(b => Buffer.from(b).toString("latin1")); ok(!zz.includes("podatki/_kljuc") && !zz.includes("podatki/_seje.json") && zz.includes("podatki/uporabniki.json"), "kopija ne vsebuje ključa in sej");
  // ponarejen arhiv sledi se zazna
  const af = path.join(DATA, "podatki", arh[0]); const orig = fs.readFileSync(af, "utf8"); fs.writeFileSync(af, orig.replace('"prijava"', '"PONAREJENO"').replace('"ustvari"', '"PONAREJENO"'));
  ok((await req("GET", "/api/revizijska-sled?n=5", undefined, ck)).j.preveritev.ok === false, "sprememba arhiva sledi se zazna"); fs.writeFileSync(af, orig);
  // seje po ponovnem zagonu + čista zaustavitev
  const z = await stop(); ok(z.code === 0 && z.ms < 5000, "SIGTERM: čista zaustavitev v " + z.ms + " ms");
  await start();
  ok((await req("GET", "/api/auth/jaz", undefined, ck)).s === 200, "seja ostane po ponovnem zagonu");
  // sprememba gesla odjavi druge seje
  const b2 = await req("POST", "/api/auth/prijava", { email: "a@t.si", geslo: "dolgogeslo123" }); ok(b2.s === 200, "druga prijava");
  ok((await req("POST", "/api/auth/geslo", { staro: "dolgogeslo123", novo: "novogeslo12345" }, ck)).s === 200, "sprememba gesla");
  ok((await req("GET", "/api/auth/jaz", undefined, b2.ck)).s === 401 && (await req("GET", "/api/auth/jaz", undefined, ck)).s === 200, "druga seja odjavljena, trenutna ostane");
  // omejitev poskusov pri spremembi gesla
  let last; for (let i = 0; i < 6; i++) last = await req("POST", "/api/auth/geslo", { staro: "napacno-geslo", novo: "novogeslo99999" }, ck); ok(last.s === 429, "sprememba gesla: omejitev poskusov (" + last.s + ")");
  ok((await req("POST", "/api/auth/prijava", { email: "ni@t.si", geslo: "x" })).s === 401, "neznan e-naslov -> 401");
  await stop(); fs.rmSync(DATA, { recursive: true, force: true });
  console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(async e => { console.log("IZJEMA", e.message); try { srv.kill(); } catch {} process.exit(2); });
