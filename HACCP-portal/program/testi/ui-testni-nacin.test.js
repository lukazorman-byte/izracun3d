// Testno okolje: testni računi, napis, prijava napake, ponastavitev, dostop iz omrežja, pravice testnih vlog.
const fs = require("fs"), path = require("path");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const errs = [];
  const mk = async () => { const p = await (await br.newContext({ acceptDownloads: true })).newPage(); p.on("pageerror", e => errs.push(String(e.stack || e))); p.on("dialog", d => d.accept()); return p; };
  const h = await (await fetch(B + "/api/health")).json(); ok(h.testno === true && !!h.verzija, "health: testno " + h.verzija);
  const pg = await mk(); await pg.goto(B + "/"); await pg.waitForSelector("#testhint");
  ok((await pg.textContent("#testhint")).includes("Testiram-123") && await pg.locator("[data-t]").count() === 4, "prijava prikaže 4 testne račune in geslo");
  // zaposleni: najmanj pravic, brez ponastavitve in administracije
  await pg.click('[data-t="zaposleni@test.si"]'); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  ok(await pg.locator("#testbar").count() === 1 && /TESTNA RAZLIČICA/.test(await pg.textContent("#testbar")), "napis TESTNA RAZLIČICA");
  ok(await pg.locator("#treset").count() === 0 && await pg.locator('#menu a[data-id="admin"]').count() === 0, "zaposleni: brez ponastavitve in administracije");
  ok(await pg.evaluate(() => api("POST", "/api/testno/ponastavi").then(() => false, () => true)), "zaposleni ne more ponastaviti (strežnik)");
  ok(await pg.evaluate(() => D.list("evidence").then(r => r.length >= 4)), "zaposleni vidi demo evidence");
  await pg.click("#tbug"); await pg.waitForSelector("#pb_k"); await pg.fill("#pb_k", "Odprl sem Danes"); await pg.fill("#pb_z", "Gumb ne dela"); await pg.fill("#pb_i", "Tester Ena");
  const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#dlg-f .btn:last-child")]); const f = path.join(OUT, "pb.txt"); await dl.saveAs(f); const t = fs.readFileSync(f, "utf8");
  ok(/Gumb ne dela/.test(t) && /zaposleni@test\.si \(zaposleni\)/.test(t) && /Različica: .* \(testna\)/.test(t) && /Brskalnik:/.test(t), "datoteka za prijavo napake vsebuje opis in tehnične podatke");
  // admin: ponastavitev
  const a = await mk(); await a.goto(B + "/"); await a.waitForSelector("#testhint"); await a.click('[data-t="admin@test.si"]'); await a.click("#lf button"); await a.waitForSelector("#shell:not([hidden])");
  await a.evaluate(() => D.add("stranke", { naziv: "Moja začasna" }));
  ok((await a.evaluate(() => D.list("stranke"))).length === 2, "dodana začasna stranka");
  await a.goto(B + "/#/admin"); await a.waitForSelector("#omrb:has-text('samo na tem računalniku')"); ok(true, "Administracija: dostop iz omrežja (izklopljeno) pojasnjen");
  const om = await a.evaluate(() => api("GET", "/api/omrezje")); ok(om.omrezje === false && om.testno === true, "API omrežje");
  await a.click("#treset"); await a.click("#dlg-f .btn:last-child"); await a.waitForSelector("#testhint", { timeout: 15000 });
  await a.click('[data-t="admin@test.si"]'); await a.click("#lf button"); await a.waitForSelector("#shell:not([hidden])");
  const st = await a.evaluate(() => D.list("stranke")); ok(st.length === 1 && st[0].naziv === "Testna gostilna d.o.o.", "po ponastavitvi so spet samo začetni podatki");
  ok(await a.evaluate(() => api("GET", "/api/revizijska-sled?n=5").then(r => JSON.stringify(r).includes("testno-ponastavitev"))), "ponastavitev je v revizijski sledi");
  const o = await mk(); await o.goto(B + "/"); await o.waitForSelector("#testhint"); await o.click('[data-t="odgovorna@test.si"]'); await o.click("#lf button"); await o.waitForSelector("#shell:not([hidden])");
  ok(await o.evaluate(() => api("PUT", "/api/vidnost", { modul: "umiki", vloga: "stranka", vidno: false }).then(() => false, () => true)), "odgovorna ne more spreminjati nastavitev (admin)");
  ok(await pg.evaluate(() => api("GET", "/api/uporabniki").then(() => false, () => true)), "zaposleni ne vidi uporabnikov");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
