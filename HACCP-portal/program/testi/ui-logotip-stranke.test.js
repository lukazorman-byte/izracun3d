// Logotip stranke: nalaganje na profilu stranke, pravice dostopa, prikaz v meniju uporabnikov stranke in na naslovnici PDF/Word.
const fs = require("fs"), path = require("path");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const errs = [];
  const mk = async () => { const p = await (await br.newContext({ acceptDownloads: true })).newPage(); p.on("pageerror", e => errs.push(String(e.stack || e))); p.on("dialog", d => d.accept()); return p; };
  const pg = await mk();
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const [sa, sb] = await pg.evaluate(async () => {
    const a = await D.add("stranke", { naziv: "Logo d.o.o." }), b = await D.add("stranke", { naziv: "Brez d.o.o." });
    for (const [ime, email, vloga, sid] of [["Oda", "oda@t.si", "odgovorna", a.id], ["Zan", "zan@t.si", "zaposleni", a.id], ["Bor", "bor@t.si", "zaposleni", b.id]]) await api("POST", "/api/uporabniki", { ime, email, geslo: "dolgogeslo123", vloga, stranka_id: sid, stranke: [] });
    return [a.id, b.id]; });
  // administrator naloži logotip na profilu stranke
  await pg.goto(B + `/#/stranka/${sa}/podatki`); await pg.waitForSelector("#sl_up");
  ok(await pg.locator("#sl_del").count() === 0, "stranka še nima logotipa");
  await pg.setInputFiles("#sl_f", path.join(__dirname, "fixtures", "logo.png")); await pg.click("#sl_up");
  await pg.waitForSelector("#sl_del"); ok(await pg.locator("#sl_prev:not([hidden])").count() === 1, "logotip naložen in prikazan v predogledu");
  // dokumenti: naslovnica ima logotip stranke samo za to stranko
  const dok = await pg.evaluate(async () => {
    await loadLogo(); const st = n => (n.match(/\/Subtype \/Image/g) || []).length, md = n => (n.match(/word\/media\//g) || []).length;
    const pA = await pdfBuild({ naslov: "T", stranka: "Logo d.o.o." }, d => d.p("x")).text(), pB = await pdfBuild({ naslov: "T", stranka: "Brez d.o.o." }, d => d.p("x")).text();
    const wA = await docxBuild({ naslov: "T", stranka: "Logo d.o.o." }, d => d.p("x")).text(), wB = await docxBuild({ naslov: "T", stranka: "Brez d.o.o." }, d => d.p("x")).text();
    return { pA: st(pA), pB: st(pB), wA: md(wA), wB: md(wB) }; });
  ok(dok.pA === 2 && dok.pB === 1, `PDF: logotip stranke na naslovnici (slik ${dok.pA} proti ${dok.pB})`);
  ok(dok.wA > dok.wB && dok.wB > 0, `Word: logotip stranke na naslovnici (${dok.wA} proti ${dok.wB})`);
  // zaposleni stranke vidi logotip v meniju, ne more ga spremeniti; druga stranka ga ne vidi
  const prijava = async (email) => { const z = await mk(); await z.goto(B + "/"); await z.fill("#le", email); await z.fill("#lp", "dolgogeslo123"); await z.click("#lf button"); await z.waitForSelector("#shell:not([hidden])"); await z.waitForSelector("#p0"); await z.fill("#p0", "dolgogeslo123"); await z.fill("#p1", "novogeslo12345"); await z.click("#dlg-f .btn:last-child"); await z.waitForSelector("#dlg", { state: "hidden" }); return z; };
  const z = await prijava("zan@t.si");
  await z.waitForSelector("#stlogo:not([hidden]) img"); ok(true, "zaposleni stranke vidi logotip podjetja v meniju");
  const zr = await z.evaluate(async ([sa]) => ({ get: (await fetch("/api/stranka-logo/" + sa)).status, post: await api("POST", "/api/stranka-logo/" + sa, { tip: "image/png", podatki: "" }).then(() => 200, e => e.status) }), [sa]);
  ok(zr.get === 200 && zr.post === 403, "zaposleni: logotip lahko vidi, ne more ga spremeniti");
  await z.goto(B + `/#/stranka/${sa}/podatki`); await z.waitForSelector(".tabs"); ok(await z.locator("#sl_up").count() === 0, "zaposleni nima obrazca za logotip");
  const b = await prijava("bor@t.si");
  ok(await b.locator("#stlogo:not([hidden])").count() === 0, "uporabnik stranke brez logotipa nima logotipa v meniju");
  const br2 = await b.evaluate(async ([sa, sb]) => [(await fetch("/api/stranka-logo/" + sa)).status, (await fetch("/api/stranka-logo/" + sb)).status], [sa, sb]);
  ok(br2[0] === 404 && br2[1] === 204, "druga stranka ne dostopa do tujega logotipa (404), lastnega nima (204)");
  // odgovorna oseba lahko logotip odstrani
  const o = await prijava("oda@t.si");
  await o.goto(B + `/#/stranka/${sa}/podatki`); await o.waitForSelector("#sl_del"); await o.click("#sl_del"); await o.click("#dlg-f .btn:last-child");
  await o.waitForSelector("#sl_up"); await o.waitForFunction(() => !document.querySelector("#sl_del"));
  ok(await o.evaluate(async sa => (await fetch("/api/stranka-logo/" + sa)).status, sa) === 204, "odgovorna oseba odstrani logotip");
  ok(await pg.evaluate(() => api("GET", "/api/revizijska-sled?n=20").then(r => ["logotip-stranke-nov", "logotip-stranke-odstranjen"].every(a => r.vnosi.some(e => e.akcija === a)))), "spremembe logotipa v revizijski sledi");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
