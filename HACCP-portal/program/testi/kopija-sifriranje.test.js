// Šifrirane kopije: prenos, obnova z geslom, napačno geslo, šifrirane kopije na drugem mestu.
const fs = require("fs"), path = require("path"), os = require("os");
const B = process.env.BASE, TMP = process.env.TMP || os.tmpdir(); let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
function client() { let ck = ""; return async (m, p, b, raw, hdr) => { const r = await fetch(B + p, { method: m, headers: Object.assign({ "Content-Type": raw ? "text/plain" : "application/json", Cookie: ck, Origin: B }, hdr || {}), body: raw ? b : b ? JSON.stringify(b) : undefined }); const sc = r.headers.get("set-cookie"); if (sc) ck = sc.split(";")[0]; const ct = r.headers.get("content-type") || ""; let j = null, buf = null; if (/json/.test(ct)) j = await r.json(); else buf = Buffer.from(await r.arrayBuffer()); return { s: r.status, j, buf }; }; }
(async () => {
  const A = client(); await A("POST", "/api/auth/nastavi", { email: "a@t.si", geslo: "dolgogeslo123", ime: "A" });
  const s = (await A("POST", "/api/d/stranke", { naziv: "Skrivna stranka XYZ" })).j;
  ok((await A("POST", "/api/kopija/sifrirana", { geslo: "kratko" })).s === 400, "prekratko geslo zavrnjeno");
  const r = await A("POST", "/api/kopija/sifrirana", { geslo: "mojegeslo123" }); ok(r.s === 200 && r.buf.subarray(0, 5).toString() === "HFBK1", "šifrirana kopija ima oznako HFBK1");
  ok(!r.buf.toString("latin1").includes("Skrivna stranka") && !r.buf.toString("latin1").includes("uporabniki"), "v šifrirani kopiji ni berljivih podatkov");
  await A("DELETE", "/api/d/stranke/" + s.id); ok((await A("GET", "/api/d/stranke")).j.length === 0, "stranka je izbrisana (pred obnovo)");
  const b64 = r.buf.toString("base64");
  ok((await A("POST", "/api/obnovi", b64, true)).s === 400, "obnova brez gesla zavrnjena");
  let x = await A("POST", "/api/obnovi", b64, true, { "X-Kopija-Geslo": "napacno-geslo" }); ok(x.s === 400 && /Napačno geslo/.test(x.j.napaka), "napačno geslo zavrnjeno");
  ok((await A("GET", "/api/d/stranke")).j.length === 0, "po napačnem geslu se podatki ne spremenijo");
  x = await A("POST", "/api/obnovi", b64, true, { "X-Kopija-Geslo": "mojegeslo123" }); ok(x.s === 200, "obnova s pravilnim geslom");
  ok((await A("GET", "/api/d/stranke")).j.some(z => z.naziv === "Skrivna stranka XYZ"), "stranka je spet na voljo");
  // zunanja kopija šifrirana
  const dir = path.join(TMP, "zunanja-kopija"); fs.mkdirSync(dir, { recursive: true });
  let k = await A("PUT", "/api/kopija/nastavitve", { mapa: dir, geslo: "zunanjegeslo1" }); ok(k.s === 200, "nastavitev zunanje mape z geslom");
  const files = fs.readdirSync(dir); ok(files.some(f => /\.hfbk$/.test(f)) && !files.some(f => /\.zip$/.test(f)), "zunanja kopija je šifrirana (.hfbk)");
  const g = (await A("GET", "/api/kopija/nastavitve")).j; ok(g.sifrirano === true && !JSON.stringify(g).includes("zunanjegeslo1"), "geslo se ne vrne odjemalcu");
  const ext = fs.readFileSync(path.join(dir, files.find(f => /\.hfbk$/.test(f)))); x = await A("POST", "/api/obnovi", ext.toString("base64"), true, { "X-Kopija-Geslo": "zunanjegeslo1" }); ok(x.s === 200, "zunanja kopija se obnovi z njenim geslom");
  ok((await A("PUT", "/api/kopija/nastavitve", { mapa: dir, geslo: "kratko" })).s === 400, "prekratko geslo za zunanjo kopijo zavrnjeno");
  ok((await A("GET", "/api/revizijska-sled?n=30")).j.preveritev.ok, "veriga zgoščenk veljavna");
  console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})();
