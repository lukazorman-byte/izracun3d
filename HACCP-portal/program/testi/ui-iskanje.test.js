// Globalno iskanje: brez šumnikov, več izrazov, zakonodaja, povezave, ločenost strank.
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext()).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  await pg.evaluate(async () => { const s = await D.add("stranke", { naziv: "Gostilna Šmarje", odgovorna_oseba: "Marko Čeh" }); await D.add("oprema", { stranka_id: s.id, naziv: "Hladilnik za meso", tip: "hladilnik" }); await D.add("ciscenje_nacrt", { stranka_id: s.id, opravilo: "Čiščenje pulta", podrocje: "Točilnica" }); await D.add("evidence", { stranka_id: s.id, vrsta: "temperatura", oprema: "Hladilnik za meso", vrednost: 3, min: 0, max: 4 }); await D.add("stranke", { naziv: "Druga pekarna" }); });
  const iskanje = async q => { await pg.fill("#gs", q); await pg.press("#gs", "Enter"); await pg.waitForFunction(() => /Zadetkov|Vnesite|Ni zadetkov/.test(document.getElementById("view").textContent)); await pg.waitForTimeout(300); return (await pg.textContent("#view")).replace(/\s+/g, " "); };
  let t = await iskanje("hladilnik"); ok(/Oprema/.test(t) && /Zapis/.test(t) && /Hladilnik za meso/.test(t), "najde opremo in zapis");
  t = await iskanje("cisc"); ok(/Čiščenje pulta/.test(t), "iskanje brez šumnikov (cisc → Čiščenje)");
  t = await iskanje("smarje ceh"); ok(/Gostilna Šmarje/.test(t), "več izrazov, brez šumnikov (smarje ceh)");
  t = await iskanje("852/2004"); ok(/Zakonodaja/.test(t) && /852\/2004/.test(t), "najde predpis v bazi zakonodaje");
  t = await iskanje("zzzneobstaja"); ok(/Ni zadetkov/.test(t), "brez zadetkov");
  await iskanje("hladilnik"); await pg.click("td:has-text('Hladilnik za meso') >> nth=0"); await pg.waitForSelector(".tabs"); ok(/#\/stranka\/.+\/(oprema|evidence)/.test(pg.url()), "klik na zadetek odpre zavihek stranke");
  await pg.goto(B + "/#/nadzorna"); await pg.waitForSelector(".kpis"); await pg.keyboard.press("/"); ok(await pg.evaluate(() => document.activeElement.id === "gs"), "tipka / premakne fokus v iskalnik");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
