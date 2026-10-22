// Dva uporabnika hkrati: opozorilo ob hkratnem urejanju (409) in osvežitev odprtega zaslona ob vrnitvi na zavihek.
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
(async () => {
  const br = await chromium.launch(); const errs = [];
  const mk = async () => { const p = await (await br.newContext()).newPage(); p.on("pageerror", e => errs.push(String(e))); return p; };
  const a = await mk(); await a.goto(B + "/"); await a.fill("#le", "a@t.si"); await a.fill("#ln", "A"); await a.fill("#lp", "dolgogeslo123"); await a.click("#lf button"); await a.waitForSelector("#shell:not([hidden])");
  const sid = await a.evaluate(async () => { const s = await D.add("stranke", { naziv: "Skupna d.o.o." }); await D.add("dobavitelji", { stranka_id: s.id, naziv: "Dobavitelj X" }); return s.id; });
  const b = await mk(); await b.goto(B + "/"); await b.fill("#le", "a@t.si"); await b.fill("#lp", "dolgogeslo123"); await b.click("#lf button"); await b.waitForSelector("#shell:not([hidden])");
  for (const p of [a, b]) { await p.goto(B + `/#/stranka/${sid}/dobavitelji`); await p.waitForSelector("td:has-text('Dobavitelj X')"); await p.click("td:has-text('Dobavitelj X')"); await p.waitForSelector("#f_naziv"); }
  await a.fill("#f_kontakt", "A je spremenil"); await a.click("#dlg-f .btn:last-child"); await a.waitForSelector(".toast.show:not(.err)");
  await b.fill("#f_kontakt", "B prepisuje"); await b.click("#dlg-f .btn:last-child"); await b.waitForSelector(".toast.show.err");
  ok(/medtem spremenil/.test(await b.textContent("#toast")), "drugi uporabnik dobi opozorilo o hkratnem urejanju");
  const r = await a.evaluate(id => D.list("dobavitelji", { stranka_id: id }), sid); ok(r[0].kontakt === "A je spremenil", "prva sprememba ni prepisana");
  // osvežitev: A dodaja, B vidi po vrnitvi na zavihek
  await b.keyboard.press("Escape"); await b.goto(B + `/#/stranka/${sid}/dobavitelji`); await b.waitForSelector("td:has-text('Dobavitelj X')");
  await a.evaluate(id => D.add("dobavitelji", { stranka_id: id, naziv: "Nov dobavitelj Y" }), sid);
  await b.evaluate(() => { render.cas = 0; document.dispatchEvent(new Event("visibilitychange")); });
  await b.waitForSelector("td:has-text('Nov dobavitelj Y')", { timeout: 8000 }); ok(true, "zaslon se osveži ob vrnitvi na zavihek");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
