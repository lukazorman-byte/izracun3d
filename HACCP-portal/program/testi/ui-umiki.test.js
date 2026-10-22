// Umiki in odpoklici: vir RSS (lokalni posnetek), ujemanje s šaržami, obvestilo, vloge.
const http = require("http"), fs = require("fs");
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const RC = [];
const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Odpoklic: goveji gulaž, šarža LOT-77</title><link>https://example.si/1</link><guid>g1</guid><description><![CDATA[<p>Zaradi <b>Listerie</b> se odpoklicuje izdelek.</p>]]></description></item>
<item><title>Umik čokolade</title><link>https://example.si/2</link><guid>g2</guid><description>Nepovezano</description></item></channel></rss>`;
(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "application/rss+xml" }); r.end(FEED); }).listen(4950, "127.0.0.1");
  const br = await chromium.launch(); const pg = await (await br.newContext()).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e.stack || e))); pg.on("dialog", d => d.accept());
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const rs = http.createServer((q, r) => { let b = ""; q.on("data", c => b += c); q.on("end", () => { RC.push({ ua: q.headers["user-agent"], body: JSON.parse(b) }); r.writeHead(200, { "Content-Type": "application/json" }); r.end(JSON.stringify({ notifications: [{ id: 555001, reference: "2024.0777", validationDate: "2024-05-01T08:00:00Z", subject: "Listeria monocytogenes in goveji gulaž from Slovenia", riskDecision: { description: "serious" }, productCategory: { description: "meat" }, originCountries: [{ description: "Slovenia" }] }, { subject: "brez id" }] })); }); }).listen(4951, "127.0.0.1");
  const sid = await pg.evaluate(async () => { const s = await D.add("stranke", { naziv: "Umik d.o.o." }); await D.add("sarze", { stranka_id: s.id, izdelek: "Goveji gulaž", sarza: "LOT-77" }); await api("POST", "/api/uporabniki", { ime: "Od", email: "od@t.si", geslo: "dolgogeslo123", vloga: "odgovorna", stranka_id: s.id, stranke: [] }); await api("PUT", "/api/umiki/viri", { viri: [{ ime: "Test", url: "http://127.0.0.1:4950/feed" }, { ime: "Slab", url: "ftp://x" }] }); return s.id; });
  const r = await pg.evaluate(async id => { const o = await api("POST", "/api/umiki/osvezi"); const o2 = await api("POST", "/api/umiki/osvezi"); const l = await api("GET", "/api/umiki?stranka_id=" + id); const dig = await api("POST", "/api/obvestila/zdaj"); return { o, o2, l, dig: JSON.stringify(dig.predogled) }; }, sid);
  ok(r.o.novih === 2 && r.o2.novih === 0, "osvežitev: 2 novi, brez podvajanja " + JSON.stringify([r.o.novih, r.o2.novih]));
  const m = r.l.obvestila.find(n => /gulaž/.test(n.naslov)); ok(m && m.zadetki.length >= 1, "ujemanje");
  ok(r.l.obvestila.find(n => /čokolade/.test(n.naslov)).zadetki.length === 0, "nepovezano obvestilo brez ujemanja");
  ok(!/<b>/.test(m.opis), "HTML iz opisa odstranjen");
  ok(/Možen umik/.test(r.dig), "obvestilo prejemniku o možnem umiku");
  await pg.goto(B + "/#/umiki"); await pg.waitForSelector("td:has-text('gulaž')"); ok(await pg.locator(".badge.bad").count() >= 1, "stran Umiki prikaže ujemanje");
  await pg.click("#um_n"); await pg.fill("#um_t", "Ročno obvestilo test"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("td:has-text('Ročno obvestilo test')"); ok(true, "ročni vnos");
  await pg.goto(B + "/#/danes"); await pg.waitForSelector("text=Možen umik/odpoklic"); ok(true, "Danes prikaže opozorilo");
  const p2 = await (await br.newContext()).newPage(); await p2.goto(B + "/"); await p2.fill("#le", "od@t.si"); await p2.fill("#lp", "dolgogeslo123"); await p2.click("#lf button"); await p2.waitForSelector("#shell:not([hidden])");
  ok(await p2.evaluate(() => api("POST", "/api/umiki/osvezi").then(() => false, () => true)), "odgovorna ne more osvežiti virov");
  ok(await p2.evaluate(() => api("GET", "/api/umiki").then(r => r.obvestila.length >= 2 && r.viri === undefined, () => false)), "odgovorna vidi obvestila brez virov");
  await pg.goto(B + "/#/umiki"); await pg.waitForSelector("#um_r"); await pg.check("#um_r"); await pg.click("#um_rs"); await pg.waitForSelector(".toast.show");
  const rr = await pg.evaluate(async id => { const o = await api("POST", "/api/umiki/osvezi"); const l = await api("GET", "/api/umiki?stranka_id=" + id); return { o, n: l.obvestila.find(n => n.vir === "RASFF") }; }, sid);
  ok(rr.o.novih >= 1 && rr.n && rr.n.zadetki.length >= 1, "RASFF: uvoz in ujemanje " + (rr.n ? rr.n.povezava : "ni"));
  ok(RC.length >= 1 && RC[0].ua === "MojaPlatforma/1.0" && RC[0].body.parameters.pageNumber === 1 && RC[0].body.notificationClassification[0] === 306 && RC[0].body.originCountry[0] === 5075, "RASFF: zahteva (User-Agent, telo)");
  console.log("napake", errs); if (errs.length) fails++; srv.close(); rs.close(); await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
