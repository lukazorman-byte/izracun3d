// Prvi koraki, privzeto preprostejši meni za zaposlene, vzdrževanje (preizkus obnove, stanje), GDPR (izvoz, anonimizacija, rok hrambe, dokumenti), strokovni pregled baze.
const fs = require("fs"), path = require("path");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const errs = [];
  const mk = async () => { const p = await (await br.newContext({ acceptDownloads: true })).newPage(); p.on("pageerror", e => errs.push(String(e.stack || e))); p.on("dialog", d => d.accept()); return p; };
  const pg = await mk();
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  await pg.waitForSelector("text=Prvi koraki"); ok((await pg.textContent("#pk")).includes("0 od 10"), "prvi koraki: 10 korakov, 0 opravljenih");
  ok(await pg.locator("text=Opozorila sistema").count() === 1, "opozorila sistema na nadzorni plošči (preizkus obnove manjka)");
  const sid = await pg.evaluate(async () => {
    const s = await D.add("stranke", { naziv: "GDPR d.o.o." }); await D.add("obrati", { stranka_id: s.id, naziv: "Kuhinja" });
    const o = await D.add("osebje", { stranka_id: s.id, ime: "Ana Brišem", email: "ana@gdpr.si", funkcija: "Kuharica", datum_odhoda: "2015-01-31", zdravniski_do: "2016-01-01" });
    await D.set("osebje", o.id, { opomba: "Ana Brišem ima izkušnje" });
    await D.add("usposabljanja", { stranka_id: s.id, tema: "Higiena", udelezenci: "Ana Brišem, Boris Ostane" });
    await D.add("osebje", { stranka_id: s.id, ime: "Boris Ostane" });
    await api("POST", "/api/uporabniki", { ime: "Zan", email: "zan@t.si", geslo: "dolgogeslo123", vloga: "zaposleni", stranka_id: s.id, stranke: [] });
    return s.id; });
  await pg.reload(); await pg.waitForSelector("text=Prvi koraki"); ok(/[1-9] od 10/.test(await pg.textContent("#pk")), "napredek prvih korakov: " + (await pg.textContent("#pk")).match(/\d+ od 10/)[0]);
  // zaposleni: preprostejši meni in pomoč
  const z = await mk(); await z.goto(B + "/"); await z.fill("#le", "zan@t.si"); await z.fill("#lp", "dolgogeslo123"); await z.click("#lf button"); await z.waitForSelector("#shell:not([hidden])");
  await z.waitForSelector("#p0"); await z.fill("#p0", "dolgogeslo123"); await z.fill("#p1", "novogeslo12345"); await z.click("#dlg-f .btn:last-child"); await z.waitForSelector("#dlg", { state: "hidden" }); // obvezna zamenjava začasnega gesla
  await z.waitForSelector("text=Kako vnesem zapis"); await z.click("[data-skrij=pomoc]"); ok(await z.locator("#pk").count() === 0, "zaposleni: pomoč se skrije");
  await z.goto(B + `/#/stranka/${sid}/podatki`); await z.waitForSelector(".tabs");
  ok(await z.locator('.tabs a[href$="/certifikacija"]').count() === 0 && await z.locator('.tabs a[href$="/evidence"]').count() === 1, "zaposleni privzeto ne vidi Certifikacije, vidi Evidence");
  ok(await z.locator('#menu a[data-id="generator"]').count() === 0, "zaposleni privzeto ne vidi generatorja");
  // vzdrževanje
  await pg.goto(B + "/#/vzdrzevanje"); await pg.waitForSelector("#vz_p"); await pg.click("#vz_p"); await pg.waitForSelector(".badge.ok:has-text('uspešen')");
  ok((await pg.textContent("#view")).includes("vnosov revizijske sledi (veriga veljavna)"), "preizkus obnove: kopija preverjena");
  // GDPR
  await pg.goto(B + "/#/gdpr"); await pg.waitForSelector("[data-an]"); ok((await pg.textContent("#view")).includes("Ana Brišem"), "oseba s preteklim rokom hrambe je na seznamu");
  await pg.fill("#g_i", "Ana Brišem");
  const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#g_x")]); const f = path.join(OUT, "izvoz.json"); await dl.saveAs(f); const izv = JSON.parse(fs.readFileSync(f, "utf8"));
  ok(izv.zapisi.osebje && izv.zapisi.usposabljanja && izv.zapisi.osebje.length === 1, "izvoz vsebuje zaposlenega in usposabljanje");
  for (const [b, n] of [["#g_p", "pogodba"], ["#g_ev", "evidenca"]]) { await pg.fill("#g_n", "Svetovalec d.o.o."); const [d2] = await Promise.all([pg.waitForEvent("download"), pg.click(b)]); const g = path.join(OUT, n + ".docx"); await d2.saveAs(g); const t = fs.readFileSync(g); ok(t.slice(0, 2).toString() === "PK" && t.length > 3000, n + ": Word dokument"); }
  await pg.click("[data-an]"); await pg.fill("#g_c", "IZBRIŠI"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector(".toast.show:has-text('Anonimizirano')");
  const po = await pg.evaluate(async id => ({ os: await D.list("osebje", { stranka_id: id }), us: await D.list("usposabljanja", { stranka_id: id }) }), sid);
  const ana = po.os.find(x => x.ime === "[izbrisana oseba]");
  ok(ana && !ana.email && !ana.zdravniski_do && !JSON.stringify(po).includes("Brišem"), "anonimizacija: ime, e-naslov, datumi in zgodovina sprememb");
  ok(po.us[0].udelezenci === "[izbrisana oseba], Boris Ostane" && po.os.some(x => x.ime === "Boris Ostane"), "druge osebe ostanejo nespremenjene");
  // strokovni pregled
  await pg.goto(B + "/#/strokovni-pregled"); await pg.waitForSelector("[data-i]"); await pg.check('[data-i="0"]'); await pg.check('[data-i="1"]'); await pg.fill("#sp_k", "dr. Strokovnjak"); await pg.click("#sp_o"); await pg.waitForSelector(".badge.ok");
  const zk = await pg.evaluate(() => api("GET", "/api/baza/zakonodaja")); ok(zk[0].pregledal === "dr. Strokovnjak" && zk[1].strokovno_pregledano && !zk[2].strokovno_pregledano, "strokovni pregled zabeležen v bazi");
  const [d3] = await Promise.all([pg.waitForEvent("download"), pg.click("#sp_x")]); await d3.saveAs(path.join(OUT, "sp.xlsx")); ok(fs.statSync(path.join(OUT, "sp.xlsx")).size > 5000, "izvoz za strokovnjaka (Excel)");
  ok(await pg.evaluate(() => api("GET", "/api/revizijska-sled?n=30").then(r => JSON.stringify(r.vnosi).includes("gdpr-anonimizacija") && !JSON.stringify(r.vnosi.filter(e => e.akcija === "gdpr-anonimizacija")).includes("Brišem"))), "anonimizacija v revizijski sledi brez imena");
  ok(await z.evaluate(() => api("POST", "/api/gdpr/izvoz", { ime: "Boris Ostane" }).then(() => false, () => true)), "zaposleni nima dostopa do GDPR orodij");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
