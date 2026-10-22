// Način »inšpekcija«: pregled stanja dokumentacije za izbrano stranko in obdobje + izvoz (PDF, Word, Excel).
async function inspData(ctx, od, doo) {
  const d = await loadAll({ stranka_id: ctx.stranka_id });
  const inP = x => { const t = String(x || "").slice(0, 10); return (!od || t >= od) && (!doo || t <= doo); };
  const ev = d.evidence.filter(e => inP(e.cas)), capa = d.capa;
  const exp = (s) => s && daysTo(s) < 0;
  const pot = d.nacrti.filter(n => n.status === "potrjeno"), nav = d.navodila;
  const check = [];
  const add = (p, st, txt) => check.push({ p, st, txt });
  add("Potrjen HACCP načrt", pot.length ? "ok" : "bad", pot.length ? `${pot.length} potrjen(ih) od ${d.nacrti.length}` : `Potrjenega načrta ni (skupaj ${d.nacrti.length})`);
  const nacrtZam = d.nacrti.filter(n => n.status !== "zastarelo" && exp(n.naslednji_pregled)).length; add("Pregled HACCP načrta", nacrtZam ? "warn" : "ok", nacrtZam ? nacrtZam + " načrt(ov) s pretečenim rokom pregleda" : "Roki pregleda niso pretečeni");
  const navPot = nav.filter(n => n.status === "potrjeno").length, navZam = nav.filter(n => n.status !== "zastarelo" && exp(n.naslednji_pregled)).length;
  add("Delovna navodila", nav.length ? (navPot === nav.length && !navZam ? "ok" : "warn") : "bad", `${navPot} potrjenih od ${nav.length}${navZam ? ", " + navZam + " s pretečenim pregledom" : ""}`);
  const osZam = d.osebje.filter(o => exp(o.higienski_do) || exp(o.zdravniski_do)).length; add("Zaposleni: izobraževanje in zdravniški pregled", d.osebje.length ? (osZam ? "bad" : "ok") : "warn", d.osebje.length ? (osZam ? osZam + " zaposlen(ih) s pretečeno veljavnostjo" : "Vse veljavnosti so v redu") : "Zaposleni niso vneseni");
  const opZam = d.oprema.filter(o => exp(o.naslednji_servis)).length; add("Oprema in merilni instrumenti", d.oprema.length ? (opZam ? "warn" : "ok") : "warn", d.oprema.length ? (opZam ? opZam + " naprav s pretečenim servisom/umerjanjem" : "Servisi/umerjanja niso pretečeni") : "Oprema ni vnesena");
  const dobZam = d.dobavitelji.filter(o => exp(o.naslednja_ocena)).length; add("Dobavitelji", d.dobavitelji.length ? (dobZam ? "warn" : "ok") : "warn", d.dobavitelji.length ? (dobZam ? dobZam + " dobaviteljev s pretečeno oceno" : "Ocene so v redu") : "Dobavitelji niso vneseni");
  const odst = ev.filter(e => e.skladno === false).length, nepot = ev.filter(e => e.status !== "potrjeno").length, brez = ev.filter(e => e.skladno === null || e.skladno === undefined).length;
  add("Evidence v obdobju", ev.length ? (odst || nepot ? "warn" : "ok") : "bad", `${ev.length} zapisov, ${odst} odstopanj, ${nepot} nepotrjenih, ${brez} brez ocene`);
  const cis = ciscenjeStanje(d.ciscenje_nacrt || [], d.evidence), cisZ = cis.filter(x => x.zamuda).length;
  add("Čiščenje po načrtu", (d.ciscenje_nacrt || []).length ? (cisZ ? "warn" : "ok") : "warn", (d.ciscenje_nacrt || []).length ? `${(d.ciscenje_nacrt || []).length} opravil v načrtu${cisZ ? ", " + cisZ + " v zamudi" : ", brez zamud"}` : "Načrt čiščenja ni vnesen");
  const tst = ev.filter(e => e.vrsta === "bris" || e.vrsta === "hitri_test"), tstN = tst.filter(e => e.skladno === false).length, ddd = ev.filter(e => e.vrsta === "ddd_obisk").length;
  add("Brisi in hitri testi v obdobju", tst.length ? (tstN ? "warn" : "ok") : "warn", `${tst.length} rezultatov, ${tstN} odstopanj`);
  add("DDD obiski v obdobju", ddd ? "ok" : "warn", `${ddd} obiskov izvajalca`);
  const capaOdp = capa.filter(c => c.status !== "zaprto"), capaZam = capaOdp.filter(c => exp(c.rok)).length;
  add("Neskladnosti (CAPA)", capaOdp.length ? (capaZam ? "bad" : "warn") : "ok", `${capaOdp.length} odprtih${capaZam ? ", od tega " + capaZam + " v zamudi" : ""}; zaprtih v obdobju: ${capa.filter(c => c.status === "zaprto" && inP(c.datum_zapiranja)).length}`);
  let tlorisi = []; try { tlorisi = await D.list("tlorisi", { stranka_id: ctx.stranka_id }); } catch {}
  return { d, ev, capa, check, od, doo, odst, tlorisi };
}
function inspDoc(doc, ctx, R) {
  const { d, ev, capa, check, od, doo } = R, s = ctx.stranka, obr = d.obrati;
  doc.h(1, "1. Podatki o podjetju in obratih");
  doc.table(["Podatek", "Vrednost"], [["Naziv", s.naziv], ["Naslov", s.naslov || ""], ["Matična / davčna št.", [s.maticna, s.davcna].filter(Boolean).join(" / ")], ["Odgovorna oseba", s.odgovorna_oseba || ""], ["Dejavnost", s.dejavnost || ""], ["Obrati", obr.map(o => o.naziv + (o.naslov ? " (" + o.naslov + ")" : "")).join("; ")], ["Obdobje izpisa", (od ? fdate(od) : "začetek") + " – " + (doo ? fdate(doo) : "danes")]].filter(r => r[1]), [30, 70]);
  doc.h(1, "2. Stanje dokumentacije (po podatkih v sistemu)");
  doc.table(["Področje", "Ocena", "Podrobnosti"], check.map(c => [c.p, c.st === "ok" ? "v redu" : c.st === "warn" ? "preveri" : "manjka / zamuda", c.txt]), [34, 16, 50]);
  doc.p("Izpis prikazuje stanje, kot je vneseno v sistemu. Ne pomeni ocene skladnosti z zakonodajo.", { size: 8.5, col: "m" });
  doc.h(1, "3. HACCP načrti");
  doc.table(["Načrt", "Različica", "Stanje", "Strokovno potrdil", "Datum potrditve", "Naslednji pregled"], d.nacrti.map(n => [n.naziv, n.verzija_oznaka, n.status, (n.vsebina && n.vsebina.pregled && n.vsebina.pregled.potrdil) || n.potrdil || "", (n.vsebina && n.vsebina.pregled && n.vsebina.pregled.datum) ? fdate(n.vsebina.pregled.datum) : n.datum_potrditve ? fdate(n.datum_potrditve) : "", n.naslednji_pregled ? fdate(n.naslednji_pregled) : ""]), [26, 10, 14, 20, 15, 15]);
  doc.h(1, "4. Delovna navodila in predpogojni programi");
  doc.table(["Navodilo", "Vrsta", "Različica", "Stanje", "Naslednji pregled"], d.navodila.map(n => [n.naslov, n.vrsta, n.verzija_oznaka, n.status, n.naslednji_pregled ? fdate(n.naslednji_pregled) : ""]), [40, 20, 10, 14, 16]);
  doc.h(1, "5. Zaposleni in usposabljanja");
  doc.table(["Zaposleni", "Vloga", "Izobraževanje do", "Zdravniški pregled do"], d.osebje.map(o => [o.ime, o.funkcija, o.higienski_do ? fdate(o.higienski_do) : "", o.zdravniski_do ? fdate(o.zdravniski_do) : ""]), [30, 25, 22, 23]);
  doc.table(["Usposabljanje", "Datum", "Veljavno do", "Izvajalec"], d.usposabljanja.map(u => [u.tema, u.datum ? fdate(u.datum) : "", u.veljavno_do ? fdate(u.veljavno_do) : "", u.izvajalec]), [40, 18, 18, 24]);
  doc.h(1, "6. Oprema in merilni instrumenti");
  doc.table(["Naprava", "Vrsta", "Dovoljeni razpon", "Naslednji servis / umerjanje"], d.oprema.map(o => [o.naziv, o.tip, (o.meja_min !== undefined && o.meja_min !== "") || (o.meja_max !== undefined && o.meja_max !== "") ? (o.meja_min ?? "") + " do " + (o.meja_max ?? "") : "ni določen", o.naslednji_servis ? fdate(o.naslednji_servis) : ""]), [30, 20, 22, 28]);
  doc.h(1, "7. Dobavitelji");
  doc.table(["Dobavitelj", "Kategorija", "Ocena", "Naslednja ocena"], d.dobavitelji.map(o => [o.naziv, o.kategorija, o.ocena, o.naslednja_ocena ? fdate(o.naslednja_ocena) : ""]), [34, 22, 22, 22]);
  doc.h(1, "8. Evidence v obdobju");
  const byV = {}; for (const e of ev) { const k = (EV[e.vrsta] || {}).ime || e.vrsta; const r = byV[k] = byV[k] || { n: 0, o: 0, p: 0 }; r.n++; if (e.skladno === false) r.o++; if (e.status === "potrjeno") r.p++; }
  doc.table(["Vrsta evidence", "Zapisov", "Odstopanj", "Potrjenih"], Object.entries(byV).map(([k, r]) => [k, r.n, r.o, r.p]), [46, 18, 18, 18]);
  const od2 = ev.filter(e => e.skladno === false).sort((a, b) => (a.cas || "").localeCompare(b.cas || ""));
  if (od2.length) { doc.h(2, "Zabeležena odstopanja"); doc.table(["Čas", "Vrsta", "Podatek", "Vnesel", "Stanje", "Ver."], od2.map(e => [fdt(e.cas), (EV[e.vrsta] || {}).ime || e.vrsta, evSummary(e).replace(/&[a-z#0-9]+;/g, ""), e.ustvaril_ime || "", e.status, e.verzija || 1]), [18, 22, 26, 16, 12, 6]); }
  doc.h(1, "9. Neskladnosti in korektivni ukrepi (CAPA)");
  doc.table(["Čas", "Opis", "Tveganje", "Odgovoren", "Rok", "Stanje", "Zaprto"], capa.sort((a, b) => (a.cas || "").localeCompare(b.cas || "")).map(c => [fdt(c.cas), c.opis, c.tveganje, c.odgovoren, c.rok ? fdate(c.rok) : "", c.status, c.datum_zapiranja ? fdate(c.datum_zapiranja) : ""]), [14, 30, 9, 14, 11, 11, 11]);
  if (R.tl && R.tl.length) { doc.h(1, "10. Tloris obrata"); R.tl.forEach((im, k) => doc.img(im, 480, 340, R.tlNames[k])); }
}

async function tabInspekcija(el, ctx) {
  const dnes = today(), od0 = addDays(dnes, -90);
  el.innerHTML = `<p class="note info">Pregled stanja dokumentacije za inšpektorja ali presojevalca: ena stran s kontrolnim seznamom in izpis vseh dokazil za izbrano obdobje. Prikazuje samo podatke, ki so vneseni v sistem.</p>
  <div class="row"><label class="mut">Evidence od <input type="date" id="i_od" value="${od0}" style="width:auto"></label><label class="mut">do <input type="date" id="i_do" value="${dnes}" style="width:auto"></label><span class="sp"></span><button class="btn" id="i_pdf">PDF</button><button class="btn ghost" id="i_doc">Word</button><button class="btn ghost sec" id="i_xl">Excel</button></div><div id="i_body"><p class="mut">Nalaganje …</p></div>`;
  let R;
  const load = async () => {
    R = await inspData(ctx, $("#i_od").value, $("#i_do").value);
    $("#i_body").innerHTML = `<div class="tw"><table class="t"><tr><th>Področje</th><th>Ocena</th><th>Podrobnosti</th></tr>${R.check.map(c => `<tr><td><b>${esc(c.p)}</b></td><td><span class="badge ${c.st === "ok" ? "ok" : c.st === "warn" ? "warn" : "bad"}">${c.st === "ok" ? "v redu" : c.st === "warn" ? "preveri" : "manjka / zamuda"}</span></td><td>${esc(c.txt)}</td></tr>`).join("")}</table></div>`;
  };
  await load(); $("#i_od").onchange = $("#i_do").onchange = load;
  const meta = () => ({ naslov: "Pregled za inšpekcijo: " + ctx.stranka.naziv, podnaslov: "Obdobje evidenc: " + fdate($("#i_od").value) + " – " + fdate($("#i_do").value), stranka: ctx.stranka.naziv, avtor: ME.u.ime, stanje: "izpis iz sistema na dan " + fdate(today()) });
  const withTl = async () => { if (!R.tl) { R.tl = []; R.tlNames = []; for (const t of R.tlorisi) { const im = await tlorisToImg(t); if (im) { R.tl.push(im); R.tlNames.push("Tloris: " + t.naziv); } } } };
  $("#i_pdf").onclick = async () => { await withTl(); dlBlob(pdfBuild(meta(), d => inspDoc(d, ctx, R)), "inspekcija-" + ctx.stranka.naziv + ".pdf"); };
  $("#i_doc").onclick = async () => { await withTl(); dlBlob(docxBuild(meta(), d => inspDoc(d, ctx, R)), "inspekcija-" + ctx.stranka.naziv + ".docx"); };
  $("#i_xl").onclick = () => { const { d } = R; downloadXlsx("inspekcija-" + ctx.stranka.naziv + ".xlsx", [
    { ime: "Kontrolni seznam", glava: ["Področje", "Ocena", "Podrobnosti"], vrste: R.check.map(c => [c.p, c.st === "ok" ? "v redu" : c.st === "warn" ? "preveri" : "manjka / zamuda", c.txt]) },
    { ime: "Evidence", glava: ["Čas", "Vrsta", "Podatek", "Ocena", "Vnesel", "Stanje", "Ver."], vrste: evRowsForExport(R.ev).map(r => r.slice(0, 7)) },
    { ime: "CAPA", glava: ["Čas", "Opis", "Tveganje", "Odgovoren", "Rok", "Stanje", "Zaprto"], vrste: R.capa.map(c => [fdt(c.cas), c.opis, c.tveganje, c.odgovoren, c.rok, c.status, c.datum_zapiranja]) },
    { ime: "Načrti in navodila", glava: ["Vrsta", "Naziv", "Različica", "Stanje", "Naslednji pregled"], vrste: [...d.nacrti.map(n => ["HACCP načrt", n.naziv, n.verzija_oznaka, n.status, n.naslednji_pregled]), ...d.navodila.map(n => ["Navodilo", n.naslov, n.verzija_oznaka, n.status, n.naslednji_pregled])] }]); };
}