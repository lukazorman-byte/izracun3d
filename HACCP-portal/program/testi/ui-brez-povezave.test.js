// PWA: delo brez povezave – vnos zapisa v čakalno vrsto in samodejno pošiljanje ob vrnitvi povezave.
const path = require("path"), fs = require("fs");
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext(); const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const ids = await pg.evaluate(async () => { const s = await D.add("stranke", { naziv: "Offline d.o.o." }); await D.add("oprema", { stranka_id: s.id, naziv: "Hladilnik 1", tip: "hladilnik", meja_min: 0, meja_max: 4 }); return { sid: s.id }; });
  await pg.goto(B + "/#/stranka/" + ids.sid + "/evidence"); await pg.waitForSelector("#enew");
  await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
  await pg.waitForFunction(() => navigator.serviceWorker.controller || true); await pg.reload(); await pg.waitForSelector("#enew");
  const keys = await pg.evaluate(async () => (await caches.keys()).join(","));
  ok(/shell-/.test(keys), "service worker je shranil ogrodje aplikacije: " + keys);
  await pg.waitForTimeout(800);
  // brez povezave
  await ctx.setOffline(true);
  await pg.reload(); await pg.waitForSelector("#shell:not([hidden])", { timeout: 15000 }); ok(true, "stran se odpre brez povezave (ogrodje + shranjen uporabnik)");
  await pg.goto(B + "/#/stranka/" + ids.sid + "/evidence"); await pg.waitForSelector("#enew", { timeout: 15000 }); ok(true, "zavihek Evidence se odpre iz predpomnilnika");
  await pg.click("#enew"); await pg.click("button[data-v=temperatura]"); await pg.selectOption("#f_oprema", "Hladilnik 1"); await pg.fill("#f_vrednost", "3");
  await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector(".toast.show:has-text('Brez povezave')");
  const q = await pg.evaluate(() => JSON.parse(localStorage.getItem("haccp_offq") || "[]")); ok(q.length === 1 && q[0].body.cas && q[0].body.vrednost === 3, "zapis je v čakalni vrsti z lastnim časom");
  ok(/čaka na pošiljanje: 1/.test(await pg.textContent("#offbadge")), "značka v glavi kaže 1 čakajoči zapis");
  // povezava nazaj
  await ctx.setOffline(false);
  await pg.evaluate(() => window.dispatchEvent(new Event("online")));
  await pg.waitForFunction(() => JSON.parse(localStorage.getItem("haccp_offq") || "[]").length === 0, null, { timeout: 15000 });
  const ev = await pg.evaluate(async sid => await D.list("evidence", { stranka_id: sid }), ids.sid);
  ok(ev.length === 1 && ev[0].vrednost === 3 && ev[0].skladno === true && Math.abs(new Date(ev[0].cas) - new Date(q[0].body.cas)) < 1000, "zapis je na strežniku z izvirnim časom in strežniško oceno");
  // odjava izprazni predpomnilnik in čakalno vrsto
  await pg.goto(B + "/"); await pg.waitForSelector("#logout"); await pg.click("#logout"); await pg.waitForSelector("#lf");
  ok(await pg.evaluate(() => localStorage.getItem("haccp_me") === null && localStorage.getItem("haccp_offq") === null), "odjava izbriše shranjenega uporabnika in čakalno vrsto");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
