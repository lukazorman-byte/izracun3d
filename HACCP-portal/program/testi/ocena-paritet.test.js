// Pravila ocene skladnosti v brskalniku in na strežniku morajo dajati enak rezultat.
const path = require("path"), fs = require("fs");
const B = process.env.BASE;
const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const P = (vrsta, o) => Object.assign({ vrsta }, o);
const CASES = [
  P("temperatura", { vrednost: 3, min: 0, max: 4 }), P("temperatura", { vrednost: 9, min: 0, max: 4 }), P("temperatura", { vrednost: -2, min: 0, max: 4 }), P("temperatura", { vrednost: 3 }), P("temperatura", { vrednost: 3, max: 4 }), P("temperatura", { vrednost: "", min: 0 }),
  P("toplotna", { vrednost: 75, min: 72 }), P("toplotna", { vrednost: 60, min: 72 }), P("drugo", { vrednost: 5, min: 1, max: 9 }), P("drugo", { vrednost: 50, max: 9 }),
  P("prevzem", { vrednost: 3, max: 7, embalaza_ok: true, dokumenti_ok: true }), P("prevzem", { vrednost: 9, max: 7, embalaza_ok: true, dokumenti_ok: true }), P("prevzem", { vrednost: 3, embalaza_ok: true, dokumenti_ok: true }), P("prevzem", { vrednost: 3, embalaza_ok: false, dokumenti_ok: true }), P("prevzem", { embalaza_ok: true, dokumenti_ok: true }),
  P("hlajenje", { vrednost: 4, max: 5, trajanje: 90, max_trajanje: 120 }), P("hlajenje", { vrednost: 8, max: 5 }), P("hlajenje", { vrednost: 4, trajanje: 200, max_trajanje: 120 }), P("hlajenje", { vrednost: 4 }),
  P("ciscenje", { izvedeno: true, kontrola_ok: true }), P("ciscenje", { izvedeno: true, kontrola_ok: false }), P("ciscenje", {}),
  P("higiena", { osebna: true, povrsine: true, skladisce: true, skodljivci: true, odpadki: true, roke: true }), P("higiena", { osebna: true, povrsine: false, skladisce: true, skodljivci: true, odpadki: true, roke: true }),
  P("oprema", { delovanje_ok: true, umerjeno_ok: true }), P("oprema", { delovanje_ok: true }), P("sledljivost", { uspesno: true }), P("sledljivost", { uspesno: false }),
  P("ddd_obisk", { brez_znakov: true }), P("ddd_obisk", { brez_znakov: false }), P("zdravje", { simptomi: false }), P("zdravje", { simptomi: true }),
  P("skodljivci", { stevilo: 3 }), P("skodljivci", { stevilo: 0 }), P("skodljivci", {}),
  P("bris", { sms: 5, sms_meja: 10 }), P("bris", { sms: 50, sms_meja: 10 }), P("bris", { sms: 5 }), P("bris", { listeria: "zaznano" }), P("bris", { listeria: "ni zaznano", salmonella: "ni zaznano" }), P("bris", { entero: 2, entero_meja: 1, listeria: "ni zaznano" }), P("bris", {}),
  P("hitri_test", { vrednost: 50, max: 100 }), P("hitri_test", { vrednost: 250, max: 100 }), P("hitri_test", { vrednost: 50 }), P("hitri_test", { kvalitativno: "negativen" }), P("hitri_test", { kvalitativno: "pozitiven", vrednost: 1, max: 100 }), P("hitri_test", { vrednost: 3, min: 5, max: 10 })
];
(async () => {
  const br = await chromium.launch(); const pg = await (await br.newContext()).newPage();
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  const res = await pg.evaluate(async cases => {
    const s = await D.add("stranke", { naziv: "Paritet" }); const out = [];
    for (const c of cases) { const cl = ocena(c.vrsta, c); const r = await D.add("evidence", Object.assign({ stranka_id: s.id }, c, { skladno: !cl })); out.push({ vrsta: c.vrsta, c: JSON.stringify(c), klient: cl === undefined ? null : cl, streznik: r.skladno }); }
    return out;
  }, CASES);
  const bad = res.filter(r => r.klient !== r.streznik);
  for (const b of bad) console.log("RAZLIKA", b.vrsta, b.c, "odjemalec:", b.klient, "strežnik:", b.streznik);
  ok(!bad.length, "ocena odjemalec = strežnik pri vseh " + res.length + " primerih");
  await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
