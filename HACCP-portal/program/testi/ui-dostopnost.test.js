// Dostopnost: preskočna povezava, landmarki, tipkovnica, fokus v pogovornih oknih, imena gumbov in polj.
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const audit = () => { const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); const out = [];
  document.querySelectorAll("button,a[href],[role=button]").forEach(e => { if (!vis(e) || e.closest("[hidden]")) return; const n = (e.getAttribute("aria-label") || e.textContent || e.title || "").trim(); if (!n) out.push("brez imena: " + e.outerHTML.slice(0, 80)); });
  document.querySelectorAll("input,select,textarea").forEach(e => { if (!vis(e) || e.type === "hidden" || e.closest("[hidden]")) return; const has = (e.labels && e.labels.length) || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.title; if (!has) out.push("polje brez oznake: " + (e.id || e.name || e.outerHTML.slice(0, 60))); });
  return out; };
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext()).newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const ids = await pg.evaluate(async () => { const s = await D.add("stranke", { naziv: "Dostopna d.o.o.", odgovorna_oseba: "Jan" }); const o = await D.add("obrati", { stranka_id: s.id, naziv: "Obrat" }); await D.add("oprema", { stranka_id: s.id, naziv: "Hladilnik", tip: "hladilnik" }); const n = await D.add("nacrti", { stranka_id: s.id, obrat_id: o.id, naziv: "Plan" }); return { sid: s.id, nid: n.id }; });
  await pg.goto(B + "/#/nadzorna"); await pg.waitForSelector(".kpis");
  ok(await pg.locator("a.skip").count() === 1 && await pg.locator("main#main").count() === 1 && await pg.locator("nav[aria-label]").count() === 1, "preskočna povezava, glavni element in oznaka menija");
  ok((await pg.title()).includes("Nadzorna plošča"), "naslov strani sledi pogledu: " + (await pg.title()));
  ok(await pg.evaluate(() => document.querySelector("#menu a.on").getAttribute("aria-current") === "page"), "aria-current v meniju");
  await pg.reload(); await pg.waitForSelector(".kpis"); await pg.keyboard.press("Tab"); ok(await pg.evaluate(() => document.activeElement.classList.contains("skip")), "prvi Tab po nalaganju je preskočna povezava");
  // tipkovnica na seznamu strank
  await pg.goto(B + "/#/stranke"); await pg.waitForSelector("tr.click"); ok(await pg.locator("tr.click[tabindex='0']").count() >= 1, "vrstice seznama so dosegljive s tipko Tab");
  await pg.focus("tr.click >> nth=0"); await pg.keyboard.press("Enter"); await pg.waitForSelector(".tabs"); await pg.waitForTimeout(500); ok(/#\/stranka\//.test(pg.url()), "Enter na vrstici odpre stranko");
  ok(await pg.evaluate(() => document.activeElement.id === "title"), "po navigaciji je fokus na naslovu strani");
  // pogovorno okno
  await pg.click(".tabs >> text=Obrati"); await pg.waitForSelector("#ladd"); await pg.focus("#ladd"); await pg.keyboard.press("Enter"); await pg.waitForSelector("dialog[open]");
  ok(await pg.getAttribute("#dlg", "aria-labelledby") === "dlg-t", "pogovorno okno ima ime");
  await pg.waitForTimeout(150); ok(await pg.evaluate(() => document.getElementById("dlg").contains(document.activeElement)), "fokus je ob odprtju znotraj okna");
  ok(await pg.evaluate(() => document.querySelector("#dlg label.req input").getAttribute("aria-required") === "true"), "obvezna polja imajo aria-required");
  await pg.keyboard.press("Escape"); await pg.waitForFunction(() => !document.getElementById("dlg").open);
  ok(await pg.evaluate(() => document.activeElement && document.activeElement.id === "ladd"), "po zaprtju se fokus vrne na sprožilni gumb");
  // napaka se napove
  await pg.click("#ladd"); await pg.waitForSelector("dialog[open]"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("#ferr:not(:empty)"); ok(await pg.getAttribute("#ferr", "role") === "alert", "sporočilo o napaki ima role=alert"); await pg.keyboard.press("Escape");
  // imena gumbov in polj po pogledih
  for (const [name, url] of [["nadzorna", "/#/nadzorna"], ["koledar", "/#/koledar"], ["stranka-evidence", `/#/stranka/${ids.sid}/evidence`], ["stranka-higiena", `/#/stranka/${ids.sid}/higiena`], ["čarovnik", `/#/carovnik/${ids.nid}`], ["tloris", `/#/stranka/${ids.sid}/tloris`], ["uvoz", "/#/uvoz"], ["obrazci", "/#/obrazci"], ["admin", "/#/admin"], ["QR", `/#/qr/${ids.sid}`]]) {
    await pg.goto(B + url); await pg.waitForTimeout(600); const bad = await pg.evaluate(audit); ok(!bad.length, "imena gumbov in oznake polj: " + name + (bad.length ? " → " + bad.slice(0, 3).join(" | ") : ""));
  }
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
