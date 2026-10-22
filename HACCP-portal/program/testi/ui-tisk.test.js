// Nastavitve tiska po vlogah + kartoteke zaposlenih.
const path = require("path"), fs = require("fs");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext({ acceptDownloads: true })).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const sid = await pg.evaluate(async () => { const s = await D.add("stranke", { naziv: "Tisk d.o.o." }); await D.add("osebje", { stranka_id: s.id, ime: "Ana Novak", funkcija: "Kuharica" }); await D.add("usposabljanja", { stranka_id: s.id, tema: "Higiena rok", datum: "2026-01-10", udelezenci: "Ana Novak, Boris" });
    await api("POST", "/api/uporabniki", { ime: "Zan", email: "zan@t.si", geslo: "dolgogeslo123", vloga: "zaposleni", stranka_id: s.id, stranke: [] }); return s.id; });
  await pg.goto(B + "/#/stranke"); await pg.click("text=Tisk d.o.o."); await pg.click(".tabs >> text=Zaposleni"); await pg.waitForSelector("#kart");
  const [d] = await Promise.all([pg.waitForEvent("download"), pg.click("#kart")]); const f = path.join(OUT, "kart.pdf"); await d.saveAs(f);
  const bin = fs.readFileSync(f, "latin1"); ok(bin.startsWith("%PDF") && bin.length > 1500, "kartoteke PDF ustvarjene");
  await pg.goto(B + "/#/admin"); await pg.waitForSelector("#tiskb input[data-k]");
  ok(await pg.locator('#tiskb input[data-k="haccp"][data-v="zaposleni"]').isChecked() === false, "privzeto zaposleni ne tiska HACCP načrta");
  ok(await pg.locator('#tiskb input[data-k="navodila"][data-v="zaposleni"]').isChecked(), "privzeto zaposleni tiska navodila");
  await pg.uncheck('#tiskb input[data-k="navodila"][data-v="zaposleni"]'); await pg.click("#tisks"); await pg.waitForSelector(".toast.show");
  const login = async () => { const p2 = await (await br.newContext()).newPage(); await p2.goto(B + "/"); await p2.fill("#le", "zan@t.si"); await p2.fill("#lp", "dolgogeslo123"); await p2.click("#lf button"); await p2.waitForSelector("#shell:not([hidden])"); return p2; };
  let p2 = await login();
  ok(await p2.evaluate(() => canPrint("HACCP-x.pdf")) === false, "zaposleni: HACCP blokiran");
  ok(await p2.evaluate(() => canPrint("navodilo-x.pdf")) === false, "zaposleni: navodila blokirana po izklopu");
  ok(await p2.evaluate(() => canPrint("obrazec-x.pdf")) === true, "zaposleni: obrazci dovoljeni");
  const r = await p2.evaluate(() => api("PUT", "/api/tisk", { pravila: {} }).then(() => "ok", e => e.message)); ok(r !== "ok", "zaposleni ne more spreminjati pravil");
  ok(await pg.evaluate(() => canPrint("HACCP-x.pdf")) === true, "admin vedno sme");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
