// Nastavitve vidnosti (privzeto + po stranki), zaščita poti na strežniku, predogled, gumb nazaj v generatorju.
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const errs = [];
  const mk = async () => { const p = await (await br.newContext()).newPage(); p.on("pageerror", e => errs.push(String(e.stack || e))); return p; };
  const login = async (p, em, pw) => { await p.goto(B + "/"); await p.fill("#le", em); await p.fill("#lp", pw); await p.click("#lf button"); await p.waitForSelector("#shell:not([hidden])"); };
  const pg = await mk();
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const ids = await pg.evaluate(async () => {
    const A = await D.add("stranke", { naziv: "Stranka A" }), Bb = await D.add("stranke", { naziv: "Stranka B" });
    const u = (ime, email, vloga, sid) => api("POST", "/api/uporabniki", { ime, email, geslo: "dolgogeslo123", vloga, stranka_id: sid, stranke: [] });
    await u("Zan", "zan@t.si", "zaposleni", A.id); await u("OdA", "oda@t.si", "odgovorna", A.id); await u("OdB", "odb@t.si", "odgovorna", Bb.id);
    await D.add("sarze", { stranka_id: A.id, izdelek: "Moka" });
    return { a: A.id, b: Bb.id };
  });
  // privzeto: skrij Sledljivost, Umike in Generator za Stranko
  await pg.goto(B + "/#/vidnost"); await pg.waitForSelector("input[data-m]");
  for (const m of ["tab:sledljivost", "umiki", "generator"]) { await pg.uncheck(`input[data-m="${m}"][data-k="stranka"]`); await pg.waitForSelector(".toast.show"); await pg.waitForTimeout(150); }
  const z = await mk(); await login(z, "zan@t.si", "dolgogeslo123");
  ok(await z.locator('#menu a[data-id="umiki"]').count() === 0, "Stranka: Umiki skriti v meniju");
  ok(await z.locator('#menu a[data-id="generator"]').count() === 0, "Stranka: Generator skrit v meniju");
  ok(await z.locator('#menu a[data-id="danes"]').count() === 1, "Stranka: ostali elementi ostanejo");
  await z.goto(B + "/#/umiki"); await z.waitForSelector(".toast.show.err"); await z.waitForFunction(() => location.hash === "#/nadzorna");
  ok((await z.textContent("#toast")).includes("Nimate dostopa"), "neposreden URL: preusmeritev in obvestilo");
  await z.goto(B + `/#/stranka/${ids.a}/sledljivost`); await z.waitForFunction(() => /\/podatki$/.test(location.hash));
  ok(await z.locator('.tabs a[href$="/sledljivost"]').count() === 0, "zavihek Sledljivost skrit");
  const api403 = await z.evaluate(async () => [await api("GET", "/api/d/sarze").then(() => 200, e => e.message), await api("GET", "/api/umiki").then(() => 200, e => e.message)]);
  ok(api403.every(x => x !== 200), "strežnik zavrne API klice skritih razdelkov: " + JSON.stringify(api403));
  await z.goto(B + "/generator/"); await z.waitForTimeout(500); ok(/nedostop|\/$/.test(z.url()) && !/generator/.test(z.url()), "strežnik preusmeri iz generatorja: " + z.url());
  const o = await mk(); await login(o, "oda@t.si", "dolgogeslo123");
  ok(await o.locator('#menu a[data-id="umiki"]').count() === 1 && await o.evaluate(id => api("GET", "/api/d/sarze").then(r => r.length, () => -1), ids.a) === 1, "Odgovorna oseba še vidi (neodvisno stikalo)");
  // prepis po stranki: Stranka B skrije Alergeni odgovorni osebi
  await pg.goto(B + "/#/vidnost"); await pg.waitForSelector("#vs"); await pg.selectOption("#vs", ids.b); await pg.waitForSelector("#vr[disabled]");
  await pg.uncheck('input[data-m="tab:alergeni"][data-k="odgovorna"]'); await pg.waitForSelector("small:has-text('prepisano')");
  ok(await pg.locator("#vr:not([disabled])").count() === 1, "gumb Ponastavi aktiven po prepisu");
  const ob = await mk(); await login(ob, "odb@t.si", "dolgogeslo123");
  ok(await ob.evaluate(id => api("GET", "/api/d/jedi").then(() => 200, () => 403), ids.b) === 403, "Stranka B: Alergeni skriti (prepis)");
  ok(await o.evaluate(() => api("GET", "/api/d/jedi").then(() => 200, () => 403)) === 200, "Stranka A: Alergeni ostanejo (privzeto)");
  await pg.click("#vr"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("#vr[disabled]");
  ok(await ob.evaluate(() => api("GET", "/api/d/jedi").then(() => 200, () => 403)) === 200, "po ponastavitvi spet privzeto");
  // pravice
  ok(await z.evaluate(() => api("PUT", "/api/vidnost", { modul: "umiki", vloga: "stranka", vidno: true }).then(() => false, () => true)), "samo administrator spreminja nastavitve");
  // predogled
  await pg.selectOption("#vs", ""); await pg.click("#vp1"); await pg.waitForSelector("#prevbar");
  ok(await pg.locator('#menu a[data-id="umiki"]').count() === 0 && await pg.locator('#menu a[data-id="admin"]').count() === 0, "predogled kot Stranka: meni brez skritih elementov");
  await pg.click("#prevexit"); await pg.waitForSelector("#vs"); ok(await pg.locator("#prevbar").count() === 0 && await pg.locator('#menu a[data-id="admin"]').count() === 1, "izhod iz predogleda");
  // generator: gumb nazaj in opozorilo
  await pg.goto(B + "/generator/"); await pg.waitForSelector("#backbtn:visible"); ok(true, "gumb Nazaj viden v generatorju");
  const dialogs = []; pg.on("dialog", d => { dialogs.push(d.message()); d.dismiss(); });
  await pg.click("#backbtn"); await pg.waitForSelector("#shell:not([hidden])"); ok(dialogs.length === 0 && /\/#\/nadzorna$/.test(pg.url()), "brez sprememb: takojšnja vrnitev brez vprašanja");
  await pg.goto(B + "/generator/"); await pg.waitForSelector("#backbtn:visible"); await pg.fill("#company", "Test d.o.o."); await pg.click("#backbtn"); await pg.waitForTimeout(300);
  ok(dialogs.includes("Imaš neshranjene spremembe. Želiš zapustiti generator?") && /generator/.test(pg.url()), "neshranjene spremembe: potrditev, ostanem (preklic)");
  pg.removeAllListeners("dialog"); pg.on("dialog", d => d.accept()); await pg.click("#backbtn"); await pg.waitForSelector("#shell:not([hidden])");
  ok(/\/#\/nadzorna$/.test(pg.url()), "po potrditvi: nadzorna plošča, prijava ohranjena");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
