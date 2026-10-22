// Prazni obrazci za tisk: ležeči A4 PDF brez naslovnice, mesečni listi iz podatkov, Excel.
const path = require("path"), fs = require("fs"), cp = require("child_process");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const hex = s => Buffer.from(s, "latin1").toString("latin1");
const textOf = f => { const r = cp.spawnSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" }); return r.error ? null : r.stdout; };
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext({ acceptDownloads: true })).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  await pg.evaluate(async () => { const s = await D.add("stranke", { naziv: "Obrazci d.o.o." }); await D.add("ciscenje_nacrt", { stranka_id: s.id, podrocje: "Tla", opravilo: "Pranje tal", sredstvo: "Čistilo A", pogostost_dni: 1 }); await D.add("ciscenje_nacrt", { stranka_id: s.id, podrocje: "Pult", opravilo: "Razkuževanje", pogostost_dni: 1 }); await D.add("oprema", { stranka_id: s.id, naziv: "Hladilnik A", tip: "hladilnik", meja_min: 0, meja_max: 4 }); });
  await pg.goto(B + "/#/obrazci"); await pg.waitForSelector("[data-p=temperatura]");
  for (const k of ["temperatura", "hitri_test", "@ciscenje", "@temp", "@prisotnost"]) {
    const [d] = await Promise.all([pg.waitForEvent("download"), pg.click(`[data-p="${k}"]`)]); const f = path.join(OUT, "obr-" + k.replace("@", "") + ".pdf"); await d.saveAs(f);
    const bin = fs.readFileSync(f, "latin1"); const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(bin);
    ok(mb && +mb[1] > +mb[2], k + ": ležeči A4 (" + (mb ? mb[1] + "×" + mb[2] : "?") + ")");
    ok(!/Kazalo/.test(textOf(f) || "") , k + ": brez naslovnice in kazala");
    const t = textOf(f); if (t) { if (k === "@ciscenje") ok(/Pranje tal/.test(t) && /Razkuževanje/.test(t) && /\b31\b/.test(t), "mesečni list čiščenja vsebuje opravila iz načrta in dneve do 31"); if (k === "@temp") ok(/Hladilnik A/.test(t) && /0 do 4/.test(t), "mesečni list temperatur vsebuje napravo in dovoljen razpon"); if (k === "temperatura") ok(/Obrazci d\.o\.o\./.test(t) && /Podpis/.test(t), "obrazec vsebuje podjetje in stolpec za podpis"); }
  }
  const [dx] = await Promise.all([pg.waitForEvent("download"), pg.click('[data-x="bris"]')]); const fx = path.join(OUT, "obr-bris.xlsx"); await dx.saveAs(fx); ok(fs.statSync(fx).size > 1500, "Excel obrazec");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
