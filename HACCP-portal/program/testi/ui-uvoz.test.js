// Uvoz iz CSV in Excela (krožno: predloga .xlsx → uvoz) + koš v vmesniku.
const path = require("path"), fs = require("fs");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext({ acceptDownloads: true })).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e))); pg.on("dialog", d => d.accept());
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const sid = await pg.evaluate(async () => (await D.add("stranke", { naziv: "Uvoz d.o.o." })).id);
  await pg.goto(B + "/#/uvoz"); await pg.waitForSelector("#u_c");
  // 1) CSV: podpičje, BOM, narekovaji, decimalna vejica, datum d. m. yyyy
  await pg.selectOption("#u_c", "oprema"); await pg.waitForSelector("#u_t");
  const csv = "﻿Naziv *;Vrsta;Lokacija;Naslednji servis / umerjanje;Dovoljeno od (°C / enota);Dovoljeno do\r\n\"Hladilnik, veliki\";hladilnik;Kuhinja;15. 1. 2027;0;4,5\r\nZamrzovalnik;zamrzovalnik;\"Klet \"\"B\"\"\";2027-02-01;-25;-18\r\n;drugo;brez imena;;;\r\n";
  const f1 = path.join(OUT, "oprema.csv"); fs.writeFileSync(f1, csv);
  await pg.setInputFiles("#u_f", f1); await pg.waitForSelector("#u_go");
  ok(/Vrstic z napako: 1/.test(await pg.textContent("#u_b")), "vrstica brez obveznega polja je zaznana kot napaka");
  ok(/Uvozi 2 vrstic/.test(await pg.textContent("#u_go")), "2 veljavni vrstici");
  await pg.click("#u_go"); await pg.waitForSelector("#u_r .note");
  const eq = await pg.evaluate(async sid => (await D.list("oprema", { stranka_id: sid })).sort((a, b) => a.naziv.localeCompare(b.naziv)), sid);
  ok(eq.length === 2 && eq[0].naziv === "Hladilnik, veliki" && eq[0].meja_max === 4.5 && eq[0].naslednji_servis === "2027-01-15" && eq[0].tip === "hladilnik" && eq[1].lokacija === 'Klet "B"' && eq[1].meja_min === -25, "CSV pravilno uvožen (vejica v narekovajih, decimalna vejica, datum, negativno število)");
  // ponovni uvoz: preskoči obstoječe
  const f1b = path.join(OUT, "oprema2.csv"); fs.writeFileSync(f1b, csv);
  await pg.setInputFiles("#u_f", f1b); await pg.waitForSelector("#u_go:not([disabled])"); await pg.click("#u_go"); await pg.waitForFunction(() => /preskočeno/.test(document.getElementById("u_r").textContent));
  ok(/Uvoženo: <b>0<\/b>, preskočeno \(že obstaja\): 2/.test(await pg.innerHTML("#u_r")) || /preskočeno \(že obstaja\): 2/.test(await pg.textContent("#u_r")), "ponovni uvoz preskoči obstoječe");
  // 2) Excel: predloga → izpolni (primer) → uvoz
  await pg.selectOption("#u_c", "osebje"); await pg.waitForSelector("#u_t");
  const [d] = await Promise.all([pg.waitForEvent("download"), pg.click("#u_t")]); const x1 = path.join(OUT, "predloga-osebje.xlsx"); await d.saveAs(x1);
  await pg.setInputFiles("#u_f", x1); await pg.waitForSelector("#u_go");
  ok(/Ana Novak/.test(await pg.textContent("#u_b")), "predogled prebere primer iz Excelove predloge");
  await pg.click("#u_go"); await pg.waitForSelector("#u_r .note");
  const os = await pg.evaluate(async sid => await D.list("osebje", { stranka_id: sid }), sid);
  ok(os.length === 1 && os[0].ime === "Ana Novak" && os[0].higienski_do === "2027-03-01", "Excel uvožen (datum iz celice)");
  // 3) koš v vmesniku
  await pg.evaluate(async id => { await D.del("osebje", id); }, os[0].id);
  await pg.goto(B + "/#/kos"); await pg.waitForSelector("td:has-text('Ana Novak')"); await pg.click("[data-ob]"); await pg.waitForSelector("td.empty");
  ok((await pg.evaluate(async sid => (await D.list("osebje", { stranka_id: sid })).length, sid)) === 1, "obnova iz koša v vmesniku");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
