const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");


let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const ctx = await br.newContext({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = [];
  pg.on("pageerror", e => errs.push("pageerror " + e.message)); pg.on("console", m => { if (m.type() === "error" && !/401|403|404|409|400/.test(m.text())) errs.push("console " + m.text()); });
  pg.on("dialog", d => d.accept());
  await pg.goto(B + "/"); await pg.waitForSelector("#lf");
  ok((await pg.textContent("#login")).includes("Prva nastavitev"), "prikaz prve nastavitve");
  await pg.fill("#le", "admin@test.si"); await pg.fill("#ln", "Admin Test"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button");
  await pg.waitForSelector("#shell:not([hidden])"); ok(true, "prijava po nastavitvi");
  await pg.waitForSelector(".kpis"); await pg.screenshot({ path: OUT + "/1-dash.png" });
  // stranka
  await pg.goto(B + "/#/stranke"); await pg.waitForSelector("#ladd"); await pg.click("#ladd");
  await pg.fill("#f_naziv", "Gostilna Pri Luki"); await pg.selectOption("#f_dejavnost", { index: 1 }); await pg.fill("#f_odgovorna_oseba", "Luka Novak"); await pg.fill("#f_naslov", "Glavna 1, Ljubljana");
  await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("text=Gostilna Pri Luki");
  await pg.click("text=Gostilna Pri Luki"); await pg.waitForSelector(".tabs"); ok(true, "profil stranke");
  // obrat
  await pg.click(".tabs >> text=Obrati"); await pg.waitForSelector("#ladd"); await pg.click("#ladd"); await pg.fill("#f_naziv", "Kuhinja"); await pg.fill("#f_opis_prostorov", "Kuhinja, shramba, točilnica"); await pg.click("#dlg-f .btn:last-child");
  await pg.waitForSelector("td:has-text('Kuhinja')"); ok(true, "obrat dodan");
  // oprema z mejami
  await pg.click(".tabs >> text=Oprema"); await pg.waitForSelector("#ladd"); await pg.click("#ladd"); await pg.fill("#f_naziv", "Hladilnik 1"); await pg.selectOption("#f_tip", "hladilnik"); await pg.fill("#f_meja_min", "0"); await pg.fill("#f_meja_max", "4"); await pg.click("#dlg-f .btn:last-child");
  await pg.waitForSelector("td:has-text('Hladilnik 1')"); ok(true, "oprema dodana");
  // evidenca – temperatura z odstopanjem
  await pg.click(".tabs >> text=Evidence"); await pg.waitForSelector("#enew"); await pg.click("#enew"); await pg.click("button[data-v=temperatura]");
  await pg.selectOption("#f_oprema", "Hladilnik 1"); ok((await pg.inputValue("#f_max")) === "4", "meje se prenesejo iz naprave");
  await pg.fill("#f_vrednost", "9"); ok((await pg.textContent("#ocena")).includes("ODSTOPANJE"), "živo opozorilo odstopanja");
  await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("td:has-text('Hladilnik 1')");
  ok(await pg.locator(".badge.bad:has-text('odstopanje')").count() > 0, "zapis označen kot odstopanje");
  // zapis brez mej
  await pg.click("#enew"); await pg.click("button[data-v=temperatura]"); await pg.fill("#f_vrednost", "5"); ok((await pg.textContent("#ocena")).includes("niso določene"), "brez mej ni ocene"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForTimeout(400);
  // odpri zapis, ustvari CAPA
  await pg.click("tr[data-id] >> nth=1"); await pg.waitForSelector("#f__razlog"); await pg.click("text=Ustvari neskladnost"); await pg.waitForSelector("#f_opis");
  ok((await pg.inputValue("#f_opis")).includes("Odstopanje"), "CAPA predizpolnjena"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForTimeout(500);
  await pg.click(".tabs >> text=Neskladnosti"); await pg.waitForSelector("td:has-text('Odstopanje pri zapisu')"); ok(true, "CAPA v seznamu");
  // izvoz evidenc
  await pg.click(".tabs >> text=Evidence"); await pg.waitForSelector("#epdf");
  let [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#epdf")]); await dl.saveAs(OUT + "/evidence.pdf");
  [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#exl")]); await dl.saveAs(OUT + "/evidence.xlsx");
  [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#edoc")]); await dl.saveAs(OUT + "/evidence.docx");
  await pg.click(".tabs >> text=Neskladnosti"); await pg.waitForSelector("#cdoc"); [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#cdoc")]); await dl.saveAs(OUT + "/capa.docx"); [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#cpdf")]); await dl.saveAs(OUT + "/capa.pdf"); await pg.click(".tabs >> text=Navodila");
  // navodila iz predlog
  await pg.click(".tabs >> text=Navodila"); await pg.waitForSelector("#npred"); await pg.click("#npred"); await pg.waitForSelector(".pp"); ok(await pg.locator(".pp").count() >= 18, "knjižnica predlog");
  await pg.click("#dlg-f .btn:last-child"); await pg.waitForTimeout(700); ok(await pg.locator("#lb tr.click").count() >= 10, "navodila dodana");
  // načrt + čarovnik
  await pg.click(".tabs >> text=HACCP načrti"); await pg.waitForSelector("#ladd"); await pg.click("#ladd"); await pg.fill("#f_naziv", "HACCP kuhinja"); await pg.selectOption("#f_obrat_id", { index: 1 }); await pg.click("#dlg-f .btn:last-child");
  await pg.waitForSelector("td:has-text('HACCP kuhinja')"); await pg.click("td:has-text('HACCP kuhinja')"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector(".steps");
  await pg.click(".steps button >> nth=1"); await pg.selectOption("#wb", "jedi"); await pg.click("#wload"); await pg.waitForSelector(".flow .n");
  ok(await pg.locator(".flow .n").count() >= 5, "predlog korakov naložen + diagram"); await pg.screenshot({ path: OUT + "/2-koraki.png" });
  await pg.click(".steps button >> nth=3"); await pg.waitForSelector("tr[data-h]"); const nh = await pg.locator("tr[data-h]").count(); ok(nh > 3, "nevarnosti naložene: " + nh);
  ok(await pg.locator(".badge:has-text('neocenjeno')").count() === nh, "verjetnost/teža NI vnaprej določena");
  await pg.click("tr[data-h] >> nth=0"); await pg.selectOption("[data-k=verjetnost]", "4"); await pg.selectOption("[data-k=teza]", "4"); ok((await pg.textContent("#rr")).includes("16"), "izračun tveganja 4x4"); await pg.click("#dlg-f .btn:last-child");
  await pg.click(".steps button >> nth=4"); await pg.waitForSelector("tr[data-h]"); ok(await pg.locator("tr[data-h]").count() === 1, "samo pomembne nevarnosti v koraku 5");
  ok(await pg.locator(".badge:has-text('ni izbrano')").count() === 1, "vrsta ukrepa ni samodejno CCP");
  await pg.click("[data-o]"); await pg.waitForSelector("[data-k=vrsta]"); await pg.click("summary:has-text('Odločitveno drevo')"); await pg.selectOption("[data-q='0']", "d"); await pg.selectOption("[data-q='1']", "d"); ok((await pg.textContent("#dtres")).includes("Predlog"), "odločitveno drevo daje predlog");
  await pg.selectOption("[data-k=vrsta]", "CCP"); await pg.fill("[data-k=kaj]", "Temperatura v jedru"); await pg.selectOption("#regsel", { index: 3 }); ok((await pg.inputValue("[data-k=mejna]")).length > 3, "predlog meje iz baze");
  await pg.click("#dlg-f .btn:last-child"); await pg.waitForTimeout(300); ok(await pg.locator(".badge:has-text('potrebna strokovna potrditev')").count() === 1, "CCP označen: potrebna strokovna potrditev");
  await pg.click(".steps button >> nth=5"); ok((await pg.textContent("#wbody")).includes("Pred potrditvijo"), "opozorila v pregledu");
  await pg.click("#wsave"); await pg.waitForSelector(".toast.show:has-text('Shranjeno (')"); {const tt=await pg.textContent("#toast"); ok(tt.includes("Shranjeno"), "shranjeno: "+tt);}
  await pg.click(".steps button >> nth=6"); await pg.waitForSelector("#xpdf");
  await pg.uncheck("tr[data-i='2'] [data-k=on]"); await pg.click("#padd"); await pg.fill("tr[data-i='12'] input[data-k=naslov]", "Moje poglavje"); await pg.fill("tr[data-i='12'] textarea", "Lastno besedilo poglavja.");
  [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#xpdf")]); await dl.saveAs(OUT + "/haccp.pdf");
  [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#xdoc")]); await dl.saveAs(OUT + "/haccp.docx");
  [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#xxl")]); await dl.saveAs(OUT + "/haccp.xlsx");
  // koledar, storitve, admin, nadzorna
  await pg.goto(B + "/#/koledar"); await pg.waitForSelector(".cal"); ok(true, "koledar"); await pg.screenshot({ path: OUT + "/3-koledar.png" });
  await pg.goto(B + "/#/stranke"); await pg.click("text=Gostilna Pri Luki"); await pg.click(".tabs >> text=Storitve"); await pg.waitForSelector("#ladd"); await pg.click("#ladd"); await pg.fill("#f_minute", "90"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("td:has-text('90')"); ok(true, "storitev vnesena");
  await pg.goto(B + "/#/storitve"); await pg.waitForSelector("table.t"); ok((await pg.textContent("#view")).includes("1.5 h"), "povzetek storitev");
  await pg.goto(B + "/#/admin"); await pg.waitForSelector("text=Veriga zgoščenk veljavna"); ok(true, "revizijska sled veljavna");
  await pg.goto(B + "/#/nadzorna"); await pg.waitForSelector(".kpis"); ok((await pg.textContent("#view")).includes("odprtih CAPA"), "nadzorna plošča"); await pg.screenshot({ path: OUT + "/4-dash.png" });
  // uporabnik: odgovorna oseba
  await pg.goto(B + "/#/stranke"); await pg.click("text=Gostilna Pri Luki"); await pg.click(".tabs >> text=Uporabniki"); await pg.waitForSelector("#un"); await pg.click("#un");
  await pg.fill("#u_i", "Mojca"); await pg.fill("#u_e", "mojca@test.si"); await pg.selectOption("#u_v", "odgovorna"); await pg.fill("#u_p", "dolgogeslo123"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("td:has-text('mojca@test.si')"); ok(true, "uporabnik ustvarjen");
  // mobilni pogled
  await pg.setViewportSize({ width: 390, height: 800 }); await pg.goto(B + "/#/nadzorna"); await pg.waitForSelector(".kpis");
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), "mobilno: brez vodoravnega drsenja"); await pg.click("#burger"); await pg.screenshot({ path: OUT + "/5-mobile.png" });
  // odjava
  await pg.setViewportSize({ width: 1300, height: 850 }); await pg.goto(B + "/"); await pg.click("#logout"); await pg.waitForSelector("#lf"); ok(true, "odjava");
  // prijava kot odgovorna oseba: vidi samo svoje, brez notranjih opomb
  await pg.fill("#le", "mojca@test.si"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  ok(await pg.locator("#menu a:has-text('Administracija')").count() === 0, "odgovorna ne vidi administracije");
  ok(await pg.locator("#menu a:has-text('Stranke')").count() === 0, "odgovorna ne vidi seznama strank");
  console.log("Napake v konzoli:", errs.length ? errs : "ni");
  if (errs.length) fails++;
  await br.close(); console.log(fails ? "NEUSPEH " + fails : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
