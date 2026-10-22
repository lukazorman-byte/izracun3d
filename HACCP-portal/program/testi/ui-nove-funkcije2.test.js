// Potrditve/različice, Danes, sledljivost/odpoklic, alergeni, certifikacija, arhiv, obvestila o manjkajočih vnosih.
const path = require("path"), fs = require("fs");
const B = process.env.BASE, OUT = process.env.OUT || require("os").tmpdir(); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext({ acceptDownloads: true })).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e.stack || e))); pg.on("dialog", d => d.accept());
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const ids = await pg.evaluate(async () => {
    const s = await D.add("stranke", { naziv: "Nove d.o.o." }); const ob = await D.add("obrati", { stranka_id: s.id, naziv: "Kuhinja" });
    const n = await D.add("nacrti", { stranka_id: s.id, naziv: "HACCP Nove" }); await D.add("navodila", { stranka_id: s.id, naslov: "Higiena rok" });
    await D.add("urnik", { stranka_id: s.id, vrsta: "temperatura", frekvenca_ur: 24 });
    await D.add("dobavitelji", { stranka_id: s.id, naziv: "Mesar d.o.o.", kontakt: "041 111 222" });
    await D.add("sarze", { stranka_id: s.id, izdelek: "Govedina", sarza: "LOT-77", dobavitelj: "Mesar d.o.o.", uporabljeno: "gulaž 3.3." });
    await api("POST", "/api/uporabniki", { ime: "Od", email: "od@t.si", geslo: "dolgogeslo123", vloga: "odgovorna", stranka_id: s.id, stranke: [] });
    await D.add("evidence", { stranka_id: s.id, vrsta: "temperatura", cas: "2015-01-05T10:00:00.000Z", oprema: "x", vrednost: 3 });
    return { sid: s.id, nid: n.id };
  });
  // potrditve in različice
  await pg.goto(B + `/#/stranka/${ids.sid}/potrditve`); await pg.waitForSelector("td:has-text('HACCP Nove')");
  await pg.click("tr:has-text('HACCP Nove') [data-p]"); await pg.waitForSelector("#p_o"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("tr:has-text('HACCP Nove') .badge.ok");
  ok(true, "dokument potrjen");
  await pg.evaluate(id => D.set("nacrti", id, { naziv: "HACCP Nove v2", _razlog: "test" }), ids.nid); await pg.reload(); await pg.waitForSelector("td:has-text('HACCP Nove v2')");
  ok(await pg.locator("tr:has-text('HACCP Nove v2') .badge.bad").count() === 1, "sprememba razveljavi potrditev");
  await pg.click("tr:has-text('HACCP Nove v2') [data-v]"); await pg.waitForSelector("[data-vr]"); await pg.click("[data-vr]"); await pg.waitForSelector("td:text-is('HACCP Nove')"); await pg.waitForTimeout(400);
  ok(await pg.locator("tr:has-text('HACCP Nove') .badge.ok").count() === 1, "vrnitev na različico obnovi veljavno potrditev");
  // Danes
  await pg.goto(B + "/#/danes"); await pg.waitForSelector("[data-m]"); ok(true, "Danes: manjkajoč vnos temperature");
  // sledljivost
  await pg.goto(B + `/#/stranka/${ids.sid}/sledljivost`); await pg.waitForSelector("#od_q"); await pg.fill("#od_q", "lot-77"); await pg.click("#od_i"); await pg.waitForSelector("#od_c");
  ok((await pg.textContent("#od_r")).includes("041 111 222"), "odpoklic pokaže kontakt dobavitelja");
  const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click("#od_p")]); await dl.saveAs(path.join(OUT, "odpoklic.pdf")); ok(fs.statSync(path.join(OUT, "odpoklic.pdf")).size > 1000, "PDF poročilo odpoklica");
  await pg.click("#od_c"); await pg.waitForSelector("#dlg-f .btn:last-child"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("#od_r .badge:has-text('umaknjeno')");
  ok((await pg.evaluate(id => D.list("capa", { stranka_id: id }), ids.sid)).length === 1, "CAPA za odpoklic ustvarjena");
  // alergeni
  await pg.goto(B + `/#/stranka/${ids.sid}/alergeni`); await pg.waitForSelector("#a_n"); await pg.click("#a_n"); await pg.fill("#f_naziv", "Palačinke"); await pg.fill("#f_sestavine", "moka, mleko, jajca, sladkor");
  await pg.click("text=Predlagaj alergene iz sestavin"); await pg.waitForTimeout(500);
  ok(await pg.locator("#f_alergeni input:checked").count() === 3, "predlog alergenov (gluten, jajca, mleko)");
  await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("tr:has-text('Palačinke')");
  const [dl2] = await Promise.all([pg.waitForEvent("download"), pg.click("#a_p")]); await dl2.saveAs(path.join(OUT, "jedilnik.pdf")); ok(fs.statSync(path.join(OUT, "jedilnik.pdf")).size > 1000, "jedilnik z alergeni PDF");
  // certifikacija
  await pg.goto(B + `/#/stranka/${ids.sid}/certifikacija`); await pg.waitForSelector("text=% pokritosti"); await pg.selectOption("#c_s", "iso22000"); await pg.waitForSelector("[data-k='vodstvo']"); const p0 = await pg.textContent(".row strong");
  await pg.selectOption("[data-k='vodstvo']", "ustrezno"); await pg.waitForSelector("small:has-text('ročno')"); const p1 = await pg.textContent(".row strong");
  ok(parseInt(p1) > parseInt(p0), "ročna ocena dvigne pokritost (" + p0.trim() + " → " + p1.trim() + ")");
  // API: arhiv, obvestila, vloge
  const r = await pg.evaluate(async () => { const a = await api("POST", "/api/arhiv", { leta: 3, samo_preveri: true }); const b = await api("POST", "/api/arhiv", { leta: 3 }); const L = await api("GET", "/api/arhiv"); const c = await api("POST", "/api/arhiv/" + L[0].ime + "/obnovi"); const o = await api("POST", "/api/obvestila/zdaj"); return { a, b, n: L.length, c, o: JSON.stringify(o.predogled) }; });
  ok(r.a.stevilo === 1 && r.b.stevilo === 1 && r.n === 1 && r.c.stevilo === 1, "arhiv: preveri, arhiviraj, vrni " + JSON.stringify([r.a.stevilo, r.b.stevilo, r.n, r.c.stevilo]));
  ok(/Manjka vnos/.test(r.o) === true || /temperatura/.test(r.o), "obvestilo o manjkajočem vnosu");
  const p2 = await (await br.newContext()).newPage(); await p2.goto(B + "/"); await p2.fill("#le", "od@t.si"); await p2.fill("#lp", "dolgogeslo123"); await p2.click("#lf button"); await p2.waitForSelector("#shell:not([hidden])");
  ok(await p2.evaluate(() => api("POST", "/api/arhiv", { leta: 1 }).then(() => false, () => true)), "odgovorna ne more arhivirati");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
