const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });


let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
function client() {
  let ck = "";
  return async (method, p, body) => {
    const r = await fetch(B + p, { method, headers: { "Content-Type": "application/json", Cookie: ck, Origin: B }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get("set-cookie"); if (sc) ck = sc.split(";")[0];
    let j; try { j = await r.json(); } catch { j = null; }
    return { s: r.status, j };
  };
}
(async () => {
  const A = client(), S = client(), O1 = client(), Z1 = client(), O2 = client(), N = client();
  ok((await N("GET", "/api/baza")).s === 401, "baza brez prijave = 401");
  ok((await N("GET", "/api/d/stranke")).s === 401, "stranke brez prijave = 401");
  let r = await A("POST", "/api/auth/nastavi", { email: "admin@t.si", geslo: "kratko" }); ok(r.s === 400, "kratko geslo zavrnjeno");
  r = await A("POST", "/api/auth/nastavi", { email: "admin@t.si", geslo: "dolgogeslo123", ime: "Admin" }); ok(r.s === 200 && r.j.vloga === "admin", "prvi admin");
  r = await N("POST", "/api/auth/nastavi", { email: "x@t.si", geslo: "dolgogeslo123" }); ok(r.s === 403, "druga nastavitev zavrnjena");
  r = await A("GET", "/api/baza"); ok(r.s === 200 && r.j.zakonodaja, "admin bere bazo");
  const s1 = (await A("POST", "/api/d/stranke", { naziv: "Pekarna A" })).j, s2 = (await A("POST", "/api/d/stranke", { naziv: "Gostilna B" })).j;
  ok(s1.id && s2.id, "dve stranki");
  const mk = async (c, em, vl, extra) => (await A("POST", "/api/uporabniki", { email: em, geslo: "dolgogeslo123", vloga: vl, ime: em, ...extra })).s;
  ok(await mk(0, "sv@t.si", "svetovalec", { stranke: [s1.id] }) === 200, "svetovalec");
  ok(await mk(0, "o1@t.si", "odgovorna", { stranka_id: s1.id }) === 200, "odgovorna 1");
  ok(await mk(0, "z1@t.si", "zaposleni", { stranka_id: s1.id }) === 200, "zaposleni 1");
  ok(await mk(0, "o2@t.si", "odgovorna", { stranka_id: s2.id }) === 200, "odgovorna 2");
  for (const [c, e] of [[S, "sv@t.si"], [O1, "o1@t.si"], [Z1, "z1@t.si"], [O2, "o2@t.si"]]) ok((await c("POST", "/api/auth/prijava", { email: e, geslo: "dolgogeslo123" })).s === 200, "prijava " + e);
  r = await S("GET", "/api/d/stranke"); ok(r.j.length === 1 && r.j[0].id === s1.id, "svetovalec vidi samo svojo stranko");
  r = await O2("GET", "/api/d/stranke"); ok(r.j.length === 1 && r.j[0].id === s2.id, "odgovorna 2 vidi samo svojo");
  const ob1 = (await O1("POST", "/api/d/obrati", { naziv: "Obrat 1", stranka_id: s2.id })).j; ok(ob1.stranka_id === s1.id, "stranka_id prisiljen na svojo");
  r = await O2("GET", "/api/d/obrati"); ok(r.j.length === 0, "tuje obrate ne vidi");
  r = await O2("GET", "/api/d/obrati/" + ob1.id); ok(r.s === 404, "tuj obrat po ID = 404");
  r = await O2("PUT", "/api/d/obrati/" + ob1.id, { naziv: "hack" }); ok(r.s === 404, "tuj obrat PUT = 404");
  r = await S("POST", "/api/d/obrati", { naziv: "X", stranka_id: s2.id }); ok(r.s === 403, "svetovalec ne piše v tujo stranko");
  r = await Z1("POST", "/api/d/stranke", { naziv: "x" }); ok(r.s === 403, "zaposleni ne ustvari stranke");
  r = await Z1("PUT", "/api/d/stranke/" + s1.id, { naziv: "x" }); ok(r.s === 403, "zaposleni ne ureja stranke");
  r = await Z1("PUT", "/api/baza/zakonodaja", []); ok(r.s === 403, "zaposleni ne piše baze");
  r = await Z1("GET", "/api/uporabniki"); ok(r.s === 403, "zaposleni ne vidi uporabnikov");
  r = await O1("GET", "/api/uporabniki"); ok(r.j.every(u => u.stranka_id === s1.id) && !r.j.some(u => u.geslo), "odgovorna vidi samo svoje uporabnike, brez gesel");
  r = await O1("POST", "/api/uporabniki", { email: "q@t.si", geslo: "dolgogeslo123", vloga: "svetovalec" }); ok(r.s === 403, "odgovorna ne ustvari svetovalca");
  r = await A("GET", "/api/revizijska-sled"); ok(r.j.preveritev.ok && r.j.vnosi.length > 5, "revizijska sled veljavna");
  r = await Z1("GET", "/api/revizijska-sled"); ok(r.s === 403, "zaposleni ne vidi sledi");
  // evidence z revizijami
  const ev = (await Z1("POST", "/api/d/evidence", { vrsta: "temperatura", naprava: "Hladilnik 1", vrednost: 4, status: "potrjeno" })).j;
  ok(ev.status === "vneseno" && ev.cas && ev.ustvaril_ime, "zaposleni ne more sam potrditi; cas/uporabnik samodejno");
  r = await Z1("PUT", "/api/d/evidence/" + ev.id, { vrednost: 5 }); ok(r.s === 200 && r.j.verzija === 2 && r.j.revizije[0].prej.vrednost === 4, "popravek ustvari revizijo");
  r = await O1("PUT", "/api/d/evidence/" + ev.id, { status: "potrjeno" }); ok(r.s === 200 && r.j.status === "potrjeno", "odgovorna potrdi");
  r = await Z1("PUT", "/api/d/evidence/" + ev.id, { vrednost: 9 }); ok(r.s === 403, "potrjenega zaposleni ne spreminja");
  r = await O1("PUT", "/api/d/evidence/" + ev.id, { vrednost: 6 }); ok(r.s === 400, "popravek potrjenega brez razloga zavrnjen");
  r = await O1("PUT", "/api/d/evidence/" + ev.id, { vrednost: 6, _razlog: "napaka pri vnosu" }); ok(r.s === 200 && r.j.verzija === 4 && r.j.revizije.at(-1).razlog === "napaka pri vnosu", "popravek z razlogom");
  r = await A("DELETE", "/api/d/evidence/" + ev.id); ok(r.s === 403, "evidence se ne brišejo niti administrator");
  r = await O2("GET", "/api/d/evidence/" + ev.id); ok(r.s === 404, "tuje evidence nevidne");
  r = await Z1("PUT", "/api/d/evidence/" + ev.id, { stranka_id: s2.id, status: "vneseno" });
  r = await O1("GET", "/api/d/evidence/" + ev.id); ok(r.j.stranka_id === s1.id, "stranka_id se ne da prestaviti");
  // strežnik sam oceni skladnost (odjemalčeva vrednost se ne upošteva)
  const lazi = (await Z1("POST", "/api/d/evidence", { vrsta: "temperatura", vrednost: 9, min: 0, max: 4, skladno: true })).j; ok(lazi.skladno === false, "strežnik prepiše lažno skladno=true (9 °C pri meji 4)");
  r = await Z1("POST", "/api/d/evidence", { vrsta: "temperatura", vrednost: 3, skladno: false }); ok(r.j.skladno === null, "brez mej ocena ni mogoča (null), ne verjame odjemalcu");
  r = await Z1("POST", "/api/d/evidence", { vrsta: "hitri_test", kvalitativno: "pozitiven", skladno: true }); ok(r.j.skladno === false, "pozitiven hitri test = odstopanje");
  r = await Z1("POST", "/api/d/evidence", { vrsta: "bris", listeria: "zaznano", skladno: true }); ok(r.j.skladno === false, "Listeria zaznana = odstopanje");
  r = await Z1("PUT", "/api/d/evidence/" + lazi.id, { vrednost: 2 }); ok(r.j.skladno === true, "po popravku vrednosti se skladnost ponovno izračuna");
  // priloge
  r = await O1("POST", "/api/priloga", { stranka_id: s1.id, ime: "a.txt", tip: "text/plain", podatki: Buffer.from("zdravo").toString("base64") }); ok(r.s === 200, "nalaganje priloge");
  const pr = r.j;
  r = await fetch(B + "/api/priloga/" + pr.id, { headers: { Cookie: "" } }); ok(r.status === 401, "priloga brez prijave");
  r = await O2("GET", "/api/priloga/" + pr.id); ok(r.s === 404, "priloga tuje stranke 404");
  r = await O1("POST", "/api/priloga", { stranka_id: s1.id, ime: "a.exe", tip: "application/x-msdownload", podatki: "QQ==" }); ok(r.s === 400, "nevarna vrsta datoteke zavrnjena");
  // kopija
  r = await fetch(B + "/api/kopija"); ok(r.status === 401, "kopija brez prijave");
  r = await Z1("GET", "/api/kopija"); ok(r.s === 403, "kopija zaposleni");
  // napačno geslo / omejitev
  for (let i = 0; i < 5; i++) await N("POST", "/api/auth/prijava", { email: "o1@t.si", geslo: "napacno" });
  r = await N("POST", "/api/auth/prijava", { email: "o1@t.si", geslo: "dolgogeslo123" }); ok(r.s === 429, "omejitev poskusov prijave");
  // odjava
  await O1("POST", "/api/auth/odjava"); r = await O1("GET", "/api/d/stranke"); ok(r.s === 401, "po odjavi 401");
  console.log(fails ? "NEUSPEH: " + fails : "VSE OK");
  process.exit(fails ? 1 : 0);
})();
