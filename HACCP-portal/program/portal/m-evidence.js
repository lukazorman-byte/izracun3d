// Digitalne evidence, urnik pogostosti, neskladnosti / CAPA, navodila in HACCP načrti (seznami).
const EV = {
  prevzem: { ime: "Prevzem blaga", f: [
    { k: "dobavitelj", l: "Dobavitelj", t: "sel", o: c => Object.values(c.dobavitelji || {}) }, T("izdelek", "Izdelek / surovina", { req: 1 }), T("sarza", "Šarža / rok uporabe"),
    { k: "vrednost", l: "Temperatura ob prevzemu (°C)", t: "num" }, { k: "max", l: "Največja dovoljena (°C)", t: "num", h: "Določi odgovorna oseba / HACCP načrt." },
    { k: "embalaza_ok", l: "Embalaža nepoškodovana, čista", t: "bool" }, { k: "dokumenti_ok", l: "Dokumentacija (dobavnica, sledljivost) v redu", t: "bool" }], ok: o => (o.max === "" || o.max === undefined || o.vrednost === "" || o.vrednost <= o.max) && o.embalaza_ok && o.dokumenti_ok, jedro: "vrednost" },
  temperatura: { ime: "Temperatura hladilnika / zamrzovalnika", f: [
    { k: "oprema", l: "Naprava", t: "sel", o: c => Object.values(c.oprema || {}) }, { k: "vrednost", l: "Izmerjena temperatura (°C)", t: "num", req: 1 },
    { k: "min", l: "Dovoljeno od (°C)", t: "num", h: "Prenese se iz naprave; določi odgovorna oseba." }, { k: "max", l: "Dovoljeno do (°C)", t: "num" }], range: 1, jedro: "vrednost" },
  toplotna: { ime: "Toplotna obdelava", f: [T("izdelek", "Izdelek", { req: 1 }), { k: "vrednost", l: "Temperatura v jedru (°C)", t: "num", req: 1 }, { k: "min", l: "Najmanj (°C)", t: "num", h: "Mejna vrednost po HACCP načrtu." }, { k: "cas_min", l: "Čas vzdrževanja (min)", t: "num" }], range: 1, jedro: "vrednost" },
  hlajenje: { ime: "Hlajenje", f: [T("izdelek", "Izdelek", { req: 1 }), { k: "zacetna", l: "Začetna temperatura (°C)", t: "num" }, { k: "vrednost", l: "Končna temperatura (°C)", t: "num", req: 1 }, { k: "trajanje", l: "Trajanje hlajenja (min)", t: "num" }, { k: "max", l: "Največ končna (°C)", t: "num" }, { k: "max_trajanje", l: "Največ trajanje (min)", t: "num" }], ok: o => (o.max === "" || o.max === undefined || o.vrednost <= o.max) && (o.max_trajanje === "" || o.max_trajanje === undefined || o.trajanje === "" || o.trajanje <= o.max_trajanje), jedro: "vrednost" },
  ciscenje: { ime: "Čiščenje in razkuževanje", f: [T("obmocje", "Območje / površina / naprava", { req: 1 }), T("sredstvo", "Sredstvo"), { k: "izvedeno", l: "Izvedeno po navodilu", t: "bool" }, { k: "kontrola_ok", l: "Vizualna kontrola – čisto", t: "bool" }], ok: o => o.izvedeno && o.kontrola_ok },
  higiena: { ime: "Notranji higienski pregled", f: [{ k: "osebna", l: "Osebna higiena in oblačila v redu", t: "bool" }, { k: "povrsine", l: "Površine in oprema čiste", t: "bool" }, { k: "skladisce", l: "Skladišče urejeno, ločeni alergeni in surovo/gotovo", t: "bool" }, { k: "skodljivci", l: "Brez znakov škodljivcev", t: "bool" }, { k: "odpadki", l: "Odpadki pravilno shranjeni", t: "bool" }, { k: "roke", l: "Umivalniki opremljeni (milo, papir)", t: "bool" }], ok: o => ["osebna", "povrsine", "skladisce", "skodljivci", "odpadki", "roke"].every(k => o[k]) },
  oprema: { ime: "Kontrola opreme / instrumenta", f: [{ k: "oprema", l: "Oprema / instrument", t: "sel", o: c => Object.values(c.oprema || {}) }, { k: "delovanje_ok", l: "Deluje pravilno", t: "bool" }, { k: "umerjeno_ok", l: "Umerjanje / servis veljaven", t: "bool" }], ok: o => o.delovanje_ok && o.umerjeno_ok },
  sledljivost: { ime: "Sledljivost / vaja odpoklica", f: [T("izdelek", "Izdelek / šarža", { req: 1 }), { k: "tip", l: "Vrsta", t: "sel", o: ["Vaja odpoklica", "Dejanski odpoklic / umik", "Preverjanje sledljivosti"] }, { k: "cas_min", l: "Čas do popolne sledljivosti (min)", t: "num" }, T("odjemalci", "Odjemalci / količine", { t: "area" }), { k: "uspesno", l: "Uspešno", t: "bool" }], ok: o => o.uspesno },
  bris: { ime: "Mikrobiološki bris / analiza", f: [
    T("mesto", "Mesto vzorčenja (površina, naprava, roke, zrak)", { req: 1, wide: 1 }), { k: "tip_vzorca", l: "Vrsta vzorca", t: "sel", o: ["bris površine", "odtis (kontaktna plošča)", "bris rok", "zrak", "voda", "drugo"] }, T("laboratorij", "Laboratorij"), T("st_porocila", "Št. poročila"), T("datum_vzorcenja", "Datum vzorčenja", { t: "date" }),
    { k: "sms", l: "Skupno št. mikroorganizmov (cfu)", t: "num" }, { k: "sms_meja", l: "Mejna vrednost – SŠM", t: "num", h: "Meja iz HACCP načrta, laboratorija ali standarda; program je ne predpisuje." },
    { k: "entero", l: "Enterobacteriaceae (cfu)", t: "num" }, { k: "entero_meja", l: "Mejna vrednost – Enterobacteriaceae", t: "num" },
    { k: "listeria", l: "Listeria spp. / L. monocytogenes", t: "sel", o: ["ni zaznano", "zaznano"] }, { k: "salmonella", l: "Salmonella", t: "sel", o: ["ni zaznano", "zaznano"] }, T("drugo_param", "Drugi parametri in rezultati", { t: "area" })], custom: "bris" },
  hitri_test: { ime: "Hitri test čiščenja (ATP, beljakovine, alergen, razkužilo)", f: [
    { k: "tip_testa", l: "Vrsta testa", t: "sel", req: 1, o: ["ATP (bioluminiscenca)", "Beljakovine / ostanki umazanije", "Alergen (hitri test)", "Koncentracija razkužila", "pH / drugo"] }, T("mesto", "Mesto testiranja", { req: 1, wide: 1 }),
    { k: "vrednost", l: "Številčni rezultat (npr. RLU)", t: "num" }, T("enota", "Enota"), { k: "min", l: "Najmanj", t: "num", h: "Pri razkužilu spodnja meja." }, { k: "max", l: "Največ (prag)", t: "num", h: "Za ATP prag za uspešno čiščenje po navodilu naprave/HACCP načrta." },
    { k: "kvalitativno", l: "Kvalitativni rezultat (beljakovine, alergen)", t: "sel", o: ["negativen", "pozitiven"] }, { k: "po_ciscenju", l: "Test po ponovnem čiščenju (ponovitev)", t: "bool" }, T("serija_testa", "Serija / rok trakov ali brisov")], custom: "hitri" },
  ddd_obisk: { ime: "DDD: obisk izvajalca", f: [T("izvajalec", "Izvajalec DDD", { req: 1 }), { k: "poseg", l: "Vrsta posega", t: "sel", o: ["kontrola in pregled vab", "deratizacija", "dezinsekcija", "dezinfekcija", "drugo"] }, T("ugotovitve", "Ugotovitve", { t: "area" }), T("priporocila", "Priporočila izvajalca", { t: "area" }), { k: "brez_znakov", l: "Znakov škodljivcev ni", t: "bool" }], ok: o => !!o.brez_znakov },
  skodljivci: { ime: "DDD: opažanje škodljivcev", f: [{ k: "skodljivec", l: "Škodljivec", t: "sel", req: 1, o: ["miši / podgane", "žuželke (muhe, mušice)", "ščurki", "moljci / hrošči", "ptiči", "drugo"] }, T("lokacija", "Kje", { wide: 1 }), { k: "stevilo", l: "Število / obseg", t: "num" }, T("ukrep", "Ukrep", { t: "area" })], custom: "skodljivci" },
  zdravje: { ime: "Zdravstvena izjava zaposlenega", f: [{ k: "oseba", l: "Zaposleni", t: "sel", req: 1, o: c => (c.osebje || []) }, { k: "simptomi", l: "Ima simptome (driska, bruhanje, vročina, gnojne rane, kožne okužbe)", t: "bool" }, T("ukrep", "Ukrep / odločitev odgovorne osebe", { t: "area" })], ok: o => !o.simptomi },
  drugo: { ime: "Drugo (dejavnosti, prilagojeno)", f: [T("naslov", "Naslov kontrole", { req: 1 }), { k: "vrednost", l: "Vrednost", t: "num" }, T("enota", "Enota"), { k: "min", l: "Najmanj", t: "num" }, { k: "max", l: "Največ", t: "num" }], range: 1, jedro: "vrednost" }
};
const num = x => x === "" || x === undefined || x === null ? null : Number(x);
// ocena skladnosti: true / false / null (mejne vrednosti niso določene → ocena ni mogoča)
function ocena(vrsta, o) {
  const d = EV[vrsta]; if (!d) return null;
  if (d.custom === "bris") {
    const r = []; if (num(o.sms) !== null && num(o.sms_meja) !== null) r.push(num(o.sms) <= num(o.sms_meja)); if (num(o.entero) !== null && num(o.entero_meja) !== null) r.push(num(o.entero) <= num(o.entero_meja));
    if (o.listeria) r.push(o.listeria !== "zaznano"); if (o.salmonella) r.push(o.salmonella !== "zaznano"); return r.length ? r.every(Boolean) : null;
  }
  if (d.custom === "hitri") {
    if (o.kvalitativno) return o.kvalitativno !== "pozitiven";
    const v = num(o.vrednost), lo = num(o.min), hi = num(o.max); if (v === null || (lo === null && hi === null)) return null; return (lo === null || v >= lo) && (hi === null || v <= hi);
  }
  if (d.custom === "skodljivci") return (num(o.stevilo) || 0) > 0 ? false : null;
  if (d.range) {
    const v = num(o.vrednost), lo = num(o.min), hi = num(o.max);
    if (v === null || (lo === null && hi === null)) return null;
    return (lo === null || v >= lo) && (hi === null || v <= hi);
  }
  if (d.ok) {
    if (vrsta === "prevzem" && num(o.max) === null && num(o.vrednost) !== null) { return o.embalaza_ok && o.dokumenti_ok ? null : false; }
    return !!d.ok(o);
  }
  return null;
}
const skladnoBadge = r => r.skladno === true ? '<span class="badge ok">skladno</span>' : r.skladno === false ? '<span class="badge bad">odstopanje</span>' : '<span class="badge">brez ocene</span>';
const evSummary = r => { if (r.vrsta === "bris") return esc((r.mesto || "") + (r.listeria === "zaznano" ? " – Listeria ZAZNANA" : "") + (r.salmonella === "zaznano" ? " – Salmonella ZAZNANA" : "") + (r.sms !== undefined && r.sms !== "" ? " – SŠM " + r.sms : "")); if (r.vrsta === "hitri_test") return esc((r.tip_testa || "") + ": " + (r.mesto || "") + " – " + (r.kvalitativno || (r.vrednost !== undefined && r.vrednost !== "" ? r.vrednost + (r.enota ? " " + r.enota : "") : "")) + (r.po_ciscenju ? " (ponovitev)" : "")); if (r.vrsta === "ddd_obisk") return esc((r.izvajalec || "") + " – " + (r.poseg || "")); if (r.vrsta === "skodljivci") return esc((r.skodljivec || "") + " – " + (r.lokacija || "")); if (r.vrsta === "zdravje") return esc((r.oseba || "") + (r.simptomi ? " – SIMPTOMI" : " – brez simptomov")); const d = EV[r.vrsta]; if (!d) return ""; const j = d.jedro && r[d.jedro] !== undefined && r[d.jedro] !== "" ? ` ${r[d.jedro]}${r.enota ? " " + r.enota : " °C"}` : ""; return esc(r.izdelek || r.oprema || r.obmocje || r.naslov || "") + j; };

SPEC.evidence = { ime: "zapis", rec: true, rev: true };
SPEC.urnik = {
  ime: "pogostost vnosa", fields: ctx => [{ k: "vrsta", l: "Vrsta evidence", t: "sel", req: 1, o: Object.entries(EV).map(([k, v]) => [k, v.ime]) }, obratField(ctx), { k: "naprava", l: "Naprava / izdelek (če velja)", t: "sel", o: c => Object.values(c.oprema || {}) }, { k: "frekvenca_ur", l: "Najdlje med vnosi (ur)", t: "num", req: 1, h: "Npr. 24 = vsak dan, 168 = tedensko. Določi odgovorna oseba po HACCP načrtu." }],
  cols: () => [{ l: "Vrsta", f: r => esc((EV[r.vrsta] || {}).ime || r.vrsta) }, { l: "Naprava", k: "naprava" }, { l: "Najdlje med vnosi", f: r => r.frekvenca_ur + " h" }]
};
SPEC.capa = {
  ime: "neskladnost / CAPA", rev: true, foto: true, sort: (a, b) => (b.cas || b.ustvarjeno || "").localeCompare(a.cas || a.ustvarjeno || ""),
  fields: ctx => [
    T("cas", "Datum in čas ugotovitve", { t: "datetime", def: () => new Date().toISOString() }), obratField(ctx), T("proces", "Proces / področje (npr. prevzem, hlajenje)"),
    T("opis", "Opis neskladnosti", { t: "area", req: 1 }), { k: "tveganje", l: "Tveganje za varnost živil", t: "sel", o: ["nizko", "srednje", "visoko"] }, { k: "nujnost", l: "Nujnost", t: "sel", o: ["običajna", "nujna", "takojšnja"] },
    T("takojsnji_ukrep", "Takojšnji ukrep", { t: "area" }), { k: "odlocitev_zivilo", l: "Odločitev o zadevnem živilu", t: "sel", o: ["ni relevantno", "zadržano do odločitve", "ponovna obdelava", "sprostitev po preverjanju", "umik / uničenje"] },
    T("vzrok", "Ugotovljen vzrok", { t: "area" }), T("dolgorocni_ukrep", "Korektivni / preventivni ukrep (dolgoročni)", { t: "area" }), T("odgovoren", "Odgovorna oseba za ukrep"), T("rok", "Rok izvedbe", { t: "date" }),
    T("dokaz", "Dokaz o izvedbi", { t: "area" }), T("ucinkovitost", "Preverjanje učinkovitosti", { t: "area" }), { k: "status", l: "Stanje", t: "sel", o: ["odprto", "v izvajanju", "čaka preverjanje", "zaprto"], def: "odprto" }, T("zaprl", "Zaprl (ime)"), T("datum_zapiranja", "Datum zaprtja", { t: "date" }), T("vir_zapisa", "Povezan zapis (ID)")
  ],
  check: o => o.status === "zaprto" && (!o.dolgorocni_ukrep || !o.ucinkovitost || !o.zaprl || !o.datum_zapiranja) ? "Za zaprtje izpolnite dolgoročni ukrep, preverjanje učinkovitosti, kdo je zaprl in datum zaprtja." : "",
  cols: ctx => [{ l: "Čas", f: r => fdt(r.cas || r.ustvarjeno) }, { l: "Opis", f: r => esc((r.opis || "").slice(0, 90)) }, { l: "Tveganje", f: r => r.tveganje ? `<span class="badge ${r.tveganje === "visoko" ? "bad" : r.tveganje === "srednje" ? "warn" : ""}">${r.tveganje}</span>` : "" }, { l: "Odgovoren", k: "odgovoren" }, { l: "Rok", f: r => r.status === "zaprto" ? "" : dueBadge(r.rok) }, { l: "Stanje", f: r => badge(r.status) }]
};

async function evCtx(ctx) {
  const [op, db, os] = await Promise.all([D.list("oprema", { stranka_id: ctx.stranka_id }), D.list("dobavitelji", { stranka_id: ctx.stranka_id }), D.list("osebje", { stranka_id: ctx.stranka_id }).catch(() => [])]);
  return Object.assign({}, ctx, { oprema: mapOf(op), opremaRows: op, dobavitelji: mapOf(db), osebje: os.map(o => o.ime) });
}
function evForm(rec, ctx, done, vrsta) {
  vrsta = vrsta || rec.vrsta; const def = EV[vrsta], edit = !!rec, locked = edit && rec.status === "potrjeno";
  const fields = def.f.map(f => Object.assign({}, f));
  const canConfirm = canManage();
  const html = `<p class="err" id="ferr"></p><p class="note info">Čas in uporabnik se zabeležita samodejno (${esc(ME.u.ime)}). ${edit ? "Vsaka sprememba se shrani kot nova različica z razlogom; prejšnje vrednosti ostanejo vidne." : ""}</p><div class="fgrid">${obratField(ctx).o.length ? fieldHtml(Object.assign(obratField(ctx), { def: "" }), rec && rec.obrat_id, ctx) : ""}${fields.map(f => fieldHtml(f, rec ? rec[f.k] : "", ctx)).join("")}
   <label class="f wide"><span>Opomba</span><textarea id="f_opomba">${esc(rec ? rec.opomba || "" : "")}</textarea></label>
   <label class="f wide"><span>Fotografija / priloga (neobvezno)</span><input type="file" id="f_slika" accept="image/*" capture="environment"></label>
   ${canConfirm && edit ? `<label class="f"><span>Stanje zapisa</span><select id="f_status"><option ${rec.status === "vneseno" ? "selected" : ""}>vneseno</option><option ${rec.status === "potrjeno" ? "selected" : ""}>potrjeno</option></select></label>` : ""}
   ${edit ? `<label class="f wide ${locked ? "req" : ""}"><span>Razlog popravka${locked ? " (obvezno)" : ""}</span><input id="f__razlog"></label>` : ""}</div>
   <div id="ocena"></div>${edit && rec.revizije.length ? `<h3>Zgodovina sprememb</h3>${revHtml(rec)}` : ""}${edit && rec.slike && rec.slike.length ? `<h3>Priloge</h3>${rec.slike.map(i => `<a href="/api/priloga/${i}" target="_blank" rel="noopener">priloga</a>`).join(", ")}` : ""}`;
  const d = modal((edit ? "Zapis: " : "Nov zapis: ") + def.ime, html, [{ t: "Prekliči", cls: "ghost sec" }, ...(edit ? [{ t: "Ustvari neskladnost", cls: "ghost", fn: () => { const pre = { vir_zapisa: rec.id, opis: `Odstopanje pri zapisu »${def.ime}« (${fdt(rec.cas)}): ${evSummary(rec)}`, proces: def.ime, obrat_id: rec.obrat_id || "" }; setTimeout(() => openFormPre("capa", pre, ctx, done), 50); } }] : []), { t: "Shrani", fn: async () => {
    const o = readFields(fields); o.opomba = $("#f_opomba").value.trim();
    const ob = $("#f_obrat_id"); if (ob) o.obrat_id = ob.value;
    for (const f of fields) if (f.req && (o[f.k] === "" || o[f.k] === undefined)) { $("#ferr").textContent = `Izpolnite polje »${f.l}«.`; return false; }
    o.vrsta = vrsta; o.skladno = ocena(vrsta, o); o.stranka_id = ctx.stranka_id;
    if ((def.range || def.custom) && o.skladno === null) o.opozorilo = "Mejne vrednosti niso določene – ocena skladnosti ni mogoča."; else o.opozorilo = "";
    const fi = $("#f_slika").files[0];
    if (fi) { try { const up = await uploadFile(fi, ctx.stranka_id, "evidenca", o.obrat_id); o.slike = [...((rec && rec.slike) || []), up.id]; } catch (er) { if (er.offline) toast("Fotografije brez povezave ni mogoče naložiti; zapis se shrani brez nje.", true); else throw er; } }
    const st = $("#f_status"); if (st) o.status = st.value;
    const rz = $("#f__razlog"); if (rz && rz.value.trim()) o._razlog = rz.value.trim();
    const saved = edit ? await D.set("evidence", rec.id, Object.assign({ _ver: rec.spremenjeno || rec.ustvarjeno }, o)) : await D.add("evidence", o);
    if (!(saved && String(saved.id).startsWith("q"))) toast(o.skladno === false ? "Shranjeno – ODSTOPANJE. Ustvarite neskladnost." : "Shranjeno", o.skladno === false); done && done();
  } }]);
  // ob izbiri naprave prenesi meje
  const sel = $("#f_oprema");
  if (sel && ctx.opremaRows && !edit) sel.onchange = () => { const op = ctx.opremaRows.find(x => x.naziv === sel.value); if (op) { if ($("#f_min") && op.meja_min !== undefined) $("#f_min").value = op.meja_min; if ($("#f_max") && op.meja_max !== undefined) $("#f_max").value = op.meja_max; } };
  const live = () => { try { const o = readFields(fields); const r = ocena(vrsta, o); $("#ocena").innerHTML = def.range || def.ok || def.custom ? (r === true ? '<span class="badge ok">skladno z mejami</span>' : r === false ? '<span class="badge bad">ODSTOPANJE od mej – po shranitvi ustvarite neskladnost</span>' : '<span class="badge warn">mejne vrednosti niso določene – ocena ni mogoča</span>') : ""; } catch {} };
  d.querySelectorAll("input,select").forEach(e => e.addEventListener("input", live)); live();
}

async function tabEvidence(el, ctx0) {
  const ctx = await evCtx(ctx0);
  const [rows, urnik] = await Promise.all([D.list("evidence", { stranka_id: ctx.stranka_id }), D.list("urnik", { stranka_id: ctx.stranka_id }).catch(() => [])]);
  rows.sort((a, b) => (b.cas || "").localeCompare(a.cas || ""));
  const warns = [];
  for (const u of urnik) {
    const last = rows.filter(r => r.vrsta === u.vrsta && (!u.naprava || r.oprema === u.naprava || r.izdelek === u.naprava) && (!u.obrat_id || r.obrat_id === u.obrat_id))[0];
    const hrs = last ? (Date.now() - new Date(last.cas)) / 36e5 : Infinity;
    if (hrs > u.frekvenca_ur) warns.push(`Manjka vnos »${(EV[u.vrsta] || {}).ime || u.vrsta}«${u.naprava ? " – " + u.naprava : ""}: ${last ? "zadnji pred " + Math.round(hrs) + " h" : "še ni vnosa"} (dovoljeno ${u.frekvenca_ur} h).`);
  }
  const flt = JSON.parse(sessionStorage.getItem("eflt") || "{}");
  const vis = rows.filter(r => (!flt.v || r.vrsta === flt.v) && (!flt.s || r.status === flt.s) && (!flt.k || String(r.skladno) === flt.k) && (!flt.od || (r.cas || "") >= flt.od) && (!flt.do || (r.cas || "").slice(0, 10) <= flt.do));
  el.innerHTML = `${warns.map(w => `<p class="note">${esc(w)}</p>`).join("")}${rows.some(r => r.opozorilo) ? '<p class="note info">Nekateri zapisi nimajo določenih mejnih vrednosti, zato skladnost ni ocenjena. Mejne vrednosti določi odgovorna oseba oz. HACCP načrt.</p>' : ""}
  <div class="row"><select id="ev" style="max-width:220px"><option value="">Vse vrste</option>${Object.entries(EV).map(([k, v]) => `<option value="${k}" ${flt.v === k ? "selected" : ""}>${v.ime}</option>`).join("")}</select>
   <select id="es" style="max-width:150px"><option value="">Vsa stanja</option><option ${flt.s === "vneseno" ? "selected" : ""}>vneseno</option><option ${flt.s === "potrjeno" ? "selected" : ""}>potrjeno</option></select>
   <select id="ek" style="max-width:150px"><option value="">Vse ocene</option><option value="false" ${flt.k === "false" ? "selected" : ""}>odstopanja</option><option value="true" ${flt.k === "true" ? "selected" : ""}>skladno</option></select>
   <input type="date" id="eod" aria-label="Datum od" value="${flt.od || ""}" style="width:auto"><input type="date" id="edo" aria-label="Datum do" value="${flt.do || ""}" style="width:auto"><span class="sp"></span>
   <button class="btn ghost sec" id="exl">Excel</button><button class="btn ghost sec" id="epdf">PDF</button><button class="btn ghost sec" id="edoc">Word</button><button class="btn" id="enew">+ Nov zapis</button></div>
  <div class="tw"><table class="t"><thead><tr><th>Čas</th><th>Vrsta</th><th>Podatek</th><th>Ocena</th><th>Vnesel</th><th>Stanje</th><th>Ver.</th></tr></thead><tbody>${vis.map(r => `<tr class="click" data-id="${r.id}"><td>${fdt(r.cas)}</td><td>${esc((EV[r.vrsta] || {}).ime || r.vrsta)}</td><td>${evSummary(r)}</td><td>${skladnoBadge(r)}</td><td>${esc(r.ustvaril_ime || "")}</td><td>${badge(r.status)}</td><td>${r.verzija || 1}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">Ni zapisov.</td></tr>'}</tbody></table></div>
  <p class="mut">Zapisov ni mogoče brisati. Popravek ustvari novo različico z razlogom; potrjene zapise lahko popravi samo odgovorna oseba ali svetovalec.</p>
  ${canManage() ? '<h2 style="margin-top:20px">Pogostost vnosov (opozorila za manjkajoče zapise)</h2><div id="urn"></div>' : ""}`;
  const sv = () => { sessionStorage.setItem("eflt", JSON.stringify({ v: $("#ev").value, s: $("#es").value, k: $("#ek").value, od: $("#eod").value, do: $("#edo").value })); tabEvidence(el, ctx0); };
  ["ev", "es", "ek", "eod", "edo"].forEach(i => $("#" + i).onchange = sv);
  $("#enew").onclick = () => modal("Vrsta zapisa", `<div class="grid">${Object.entries(EV).map(([k, v]) => `<button class="btn ghost sec" data-v="${k}" style="text-align:left">${v.ime}</button>`).join("")}</div>`, [{ t: "Prekliči", cls: "ghost sec" }]).querySelectorAll("[data-v]").forEach(b => b.onclick = () => { $("#dlg").close(); evForm(null, ctx, () => tabEvidence(el, ctx0), b.dataset.v); });
  el.querySelector("tbody").onclick = e => { const tr = e.target.closest("tr[data-id]"); if (tr) evForm(rows.find(r => r.id === tr.dataset.id), ctx, () => tabEvidence(el, ctx0)); };
  $("#exl").onclick = () => exportEvidence("xlsx", vis, ctx);
  $("#epdf").onclick = () => exportEvidence("pdf", vis, ctx);
  $("#edoc").onclick = () => exportEvidence("docx", vis, ctx);
  if ($("#urn")) await listView($("#urn"), "urnik", ctx);
}
function evRowsForExport(vis) {
  return vis.map(r => [fdt(r.cas), (EV[r.vrsta] || {}).ime || r.vrsta, ((r.izdelek || r.oprema || r.obmocje || r.naslov || "") + (EV[r.vrsta] && EV[r.vrsta].jedro && r[EV[r.vrsta].jedro] !== undefined && r[EV[r.vrsta].jedro] !== "" ? " " + r[EV[r.vrsta].jedro] : "")).trim(), r.skladno === true ? "skladno" : r.skladno === false ? "odstopanje" : "brez ocene", r.ustvaril_ime || "", r.status, "v" + (r.verzija || 1), r.opomba || ""]);
}
async function exportEvidence(fmt, vis, ctx) {
  const fotke = []; for (const r of vis) for (const id of r.slike || []) { const im = await loadImg("/api/priloga/" + id, 1000); if (im) fotke.push({ im, cap: fdt(r.cas) + " – " + ((EV[r.vrsta] || {}).ime || r.vrsta) + (evSummary(r) ? ": " + evSummary(r).replace(/&[a-z#0-9]+;/g, "") : "") + (r.skladno === false ? " (odstopanje)" : "") }); }
  const slike = d => { if (!fotke.length) return; d.h(1, "Fotografije"); fotke.forEach(f => d.img(f.im, 360, 260, f.cap)); };
  const head = ["Čas", "Vrsta", "Podatek", "Ocena", "Vnesel", "Stanje", "Ver.", "Opomba"], rows = evRowsForExport(vis);
  if (fmt === "xlsx") return downloadXlsx("evidence-" + ctx.stranka.naziv + ".xlsx", [{ ime: "Evidence", glava: head, vrste: rows }]);
  if (fmt === "docx") return dlBlob(docxBuild({ naslov: "Evidence – " + ctx.stranka.naziv, podnaslov: "Izpis: " + fdt(new Date().toISOString()) + ", " + ME.u.ime, stranka: ctx.stranka.naziv, stanje: "izpis evidenc" }, d => { d.h(1, "Evidence"); d.table(head, rows, [14, 16, 20, 9, 12, 8, 5, 16]); slike(d); }), "evidence-" + ctx.stranka.naziv + ".docx");
  dlBlob(pdfBuild({ naslov: "Evidence – " + ctx.stranka.naziv, podnaslov: "Izpis: " + fdt(new Date().toISOString()) + ", " + ME.u.ime, stranka: ctx.stranka.naziv }, d => { d.h(1, "Evidence"); d.table(head, rows, [14, 16, 20, 9, 12, 8, 5, 16]); slike(d); }), "evidence-" + ctx.stranka.naziv + ".pdf");
}

// ---------- neskladnosti ----------
async function tabCapa(el, ctx0) {
  const ctx = await evCtx(ctx0);
  const pre = sessionStorage.getItem("capa_pre");
  const again = () => tabCapa(el, ctx0);
  await listView(el, "capa", ctx, {
    create: () => { const p = JSON.parse(sessionStorage.getItem("capa_pre") || "null"); sessionStorage.removeItem("capa_pre"); openFormPre("capa", p, ctx, again); },
    open: r => openForm("capa", r, ctx, again),
    extra: '<button class="btn ghost sec" id="cx">Excel</button><button class="btn ghost sec" id="cdoc">Word</button><button class="btn ghost sec" id="cpdf">PDF</button>',
    bind: (e2, rows) => {
      $("#cx", e2).onclick = () => downloadXlsx("capa-" + ctx.stranka.naziv + ".xlsx", [{ ime: "CAPA", glava: ["Čas", "Opis", "Tveganje", "Takojšnji ukrep", "Vzrok", "Ukrep", "Odgovoren", "Rok", "Stanje", "Zaprl", "Datum zaprtja"], vrste: rows.map(r => [fdt(r.cas), r.opis, r.tveganje, r.takojsnji_ukrep, r.vzrok, r.dolgorocni_ukrep, r.odgovoren, r.rok, r.status, r.zaprl, r.datum_zapiranja]) }]);
      const capaDoc = (d, fot) => { d.h(1, "Neskladnosti in korektivni ukrepi (CAPA)"); rows.slice().sort((a, b) => (a.cas || "").localeCompare(b.cas || "")).forEach((r, i) => { d.h(2, (i + 1) + ". " + (r.opis || "").slice(0, 70) + " – " + (r.status || "")); d.table(["Postavka", "Vsebina"], [["Čas ugotovitve", fdt(r.cas)], ["Obrat / proces", [ctx.obrati[r.obrat_id], r.proces].filter(Boolean).join(" / ")], ["Opis", r.opis], ["Tveganje / nujnost", [r.tveganje, r.nujnost].filter(Boolean).join(" / ")], ["Takojšnji ukrep", r.takojsnji_ukrep], ["Odločitev o živilu", r.odlocitev_zivilo], ["Vzrok", r.vzrok], ["Dolgoročni ukrep", r.dolgorocni_ukrep], ["Odgovoren", r.odgovoren], ["Rok", r.rok ? fdate(r.rok) : ""], ["Dokaz o izvedbi", r.dokaz], ["Preverjanje učinkovitosti", r.ucinkovitost], ["Zaprl / datum", [r.zaprl, r.datum_zapiranja ? fdate(r.datum_zapiranja) : ""].filter(Boolean).join(", ")], ["Stanje", r.status], ["Različica zapisa", r.verzija]].filter(x => x[1]), [28, 72]); (r.slike || []).forEach((id, k) => { if (fot && fot[id]) d.img(fot[id], 360, 260, "Fotografija " + (k + 1) + " – " + (r.opis || "").slice(0, 50)); }); }); };
      const cm = { naslov: "CAPA – " + ctx.stranka.naziv, stranka: ctx.stranka.naziv, stanje: "izpis neskladnosti" };
      const capaFoto = async () => { const o = {}; for (const r of rows) for (const id of r.slike || []) o[id] = await loadImg("/api/priloga/" + id, 1000); return o; };
      $("#cdoc", e2).onclick = async () => { const f = await capaFoto(); dlBlob(docxBuild(cm, d => capaDoc(d, f)), "capa-" + ctx.stranka.naziv + ".docx"); };
      $("#cpdf", e2).onclick = async () => { const f = await capaFoto(); dlBlob(pdfBuild(cm, d => capaDoc(d, f)), "capa-" + ctx.stranka.naziv + ".pdf"); };
    }
  });
  if (pre) { sessionStorage.removeItem("capa_pre"); }
}
function openFormPre(coll, pre, ctx, done) {
  openForm(coll, null, ctx, done);
  if (pre) for (const [k, v] of Object.entries(pre)) { const e = $("#f_" + k); if (e && v) e.value = v; }
}

// ---------- pregled zapisov (vse stranke, status »vneseno«) ----------
async function pagePregledZapisov(v) {
  const d = await loadAll(), sm = mapOf(d.stranke);
  const rows = d.evidence.filter(r => r.status === "vneseno").sort((a, b) => (b.cas || "").localeCompare(a.cas || ""));
  v.innerHTML = `<p class="note info">Zapisi, ki čakajo na pregled in potrditev. Potrjenih zapisov zaposleni ne morejo več spreminjati.</p><div class="row"><span class="sp"></span><button class="btn" id="pa" ${rows.length ? "" : "disabled"}>Potrdi označene</button></div><div class="tw"><table class="t"><tr><th><input type="checkbox" id="pall"></th><th>Čas</th>${isStaff() ? "<th>Stranka</th>" : ""}<th>Vrsta</th><th>Podatek</th><th>Ocena</th><th>Vnesel</th></tr>${rows.map(r => `<tr><td><input type="checkbox" class="pc" value="${r.id}"></td><td>${fdt(r.cas)}</td>${isStaff() ? `<td>${esc(sm[r.stranka_id] || "")}</td>` : ""}<td>${esc((EV[r.vrsta] || {}).ime || r.vrsta)}</td><td>${evSummary(r)}</td><td>${skladnoBadge(r)}</td><td>${esc(r.ustvaril_ime || "")}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">Ni zapisov za pregled.</td></tr>'}</table></div>`;
  $("#pall").onchange = e => $$(".pc", v).forEach(c => c.checked = e.target.checked);
  $("#pa").onclick = async () => { const ids = $$(".pc:checked", v).map(c => c.value); if (!ids.length) return toast("Označite zapise.", true); try { for (const id of ids) await D.set("evidence", id, { status: "potrjeno" }); toast("Potrjeno: " + ids.length); pagePregledZapisov(v); } catch (e) { fail(e); } };
}
navItem("pregled-zapisov", "Pregled zapisov", "#/pregled-zapisov", ["admin", "svetovalec", "odgovorna"]);
route(/^\/pregled-zapisov$/, pagePregledZapisov, "Zapisi za pregled", "pregled-zapisov");
SPEC.oprema.fields = (old => ctx => [...old(ctx), { k: "meja_min", l: "Dovoljeno od (°C / enota)", t: "num", h: "Mejo določi odgovorna oseba; uporabi se kot privzeto pri zapisih." }, { k: "meja_max", l: "Dovoljeno do", t: "num" }])(SPEC.oprema.fields);

// ---------- navodila (knjižnica predlog) ----------
async function tabNavodila(el, ctx) {
  const db = await baza(); SPEC.navodila.cols = c => [{ l: "Naslov", k: "naslov" }, { l: "Vrsta", k: "vrsta" }, { l: "Različica", k: "verzija_oznaka" }, { l: "Stanje", f: r => badge(r.status) }, { l: "Pregled", f: r => dueBadge(r.naslednji_pregled) }, { l: "Pravna podlaga", f: r => { const w = navodiloOpozorila(r, db); return w.length ? `<span class="badge warn" title="${esc(w.join("; "))}">preveri (${w.length})</span>` : r.predloga ? '<span class="badge ok">skladno z bazo</span>' : ""; } }];
  await listView(el, "navodila", ctx, { bind: e2 => { const b = $("#npred", e2); if (b) b.onclick = () => navodilaIzPredlog(ctx, () => tabNavodila(el, ctx)); }, extra: '<button class="btn ghost sec" id="npred">Iz knjižnice predlog …</button>' });
}
async function navodilaIzPredlog(ctx, done) {
  const db = await baza(), pr = db.navodila_predloge || [];
  if (!pr.length) return toast("Knjižnica predlog je prazna.", true);
  const s = ctx.stranka, dej = (s.dejavnost || "");
  const rel = p => !p.dejavnosti || p.dejavnosti.includes("*") || p.dejavnosti.some(x => dej.includes(x));
  modal("Knjižnica predlog navodil", `<p class="note info">Predloge so splošno izhodišče. Prilagodite jih dejanskemu obratu; mejne vrednosti, pogostosti in odgovornosti potrdi odgovorna oseba oz. strokovnjak. Označene so predloge, ki so smiselne za dejavnost »${esc(dej || "ni določena")}«.</p>
   <div class="tw"><table class="t"><tr><th></th><th>Predloga</th><th>Različica</th><th>Posodobljeno</th><th>Za dejavnost</th></tr>${pr.map(p => `<tr><td><input type="checkbox" class="pp" value="${esc(p.id)}" ${rel(p) ? "checked" : ""}></td><td>${esc(p.naslov)}</td><td>${esc(p.verzija)}</td><td>${fdate(p.posodobljeno)}</td><td>${rel(p) ? '<span class="badge ok">smiselno</span>' : '<span class="badge">po presoji</span>'}</td></tr>`).join("")}</table></div>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Dodaj izbrana (kot osnutek)", fn: async () => {
    const ids = $$(".pp:checked").map(c => c.value);
    for (const id of ids) {
      const p = pr.find(x => x.id === id);
      await D.add("navodila", { stranka_id: ctx.stranka_id, naslov: p.naslov, vrsta: p.vrsta, verzija_oznaka: "1.0", status: "osnutek", predloga: p.id, predloga_verzija: p.verzija, vsebina: navodiloBesedilo(p, s, db) });
    }
    toast("Dodano: " + ids.length); done();
  } }]);
}
// pravna podlaga predloge, razrešena iz žive baze zakonodaje (status + datum preverjanja)
function zakoniVrstice(p, db) {
  const zak = db.zakonodaja || [];
  return (p.zakoni || []).map(q => {
    const z = zak.find(x => x.predpis === q.predpis);
    const ime = (z ? z.predpis : q.predpis) + (q.mesto ? ", " + q.mesto : "");
    if (!z) return { ime, ok: false, txt: ime + " – predpisa ni več v bazi zakonodaje; posodobite navodilo" };
    if (z.status === "razveljavljen") return { ime, ok: false, txt: ime + " – RAZVELJAVLJEN; posodobite navodilo" };
    return { ime, ok: true, txt: ime + " (veljaven po bazi, preverjeno " + (z.preverjeno ? fdate(z.preverjeno) : "ni datuma") + ")" };
  }).concat((p.reference || []).map(r => ({ ime: r, ok: true, txt: r })));
}
// opozorila za shranjeno navodilo: zastarela predloga ali neveljaven predpis
function navodiloOpozorila(n, db) {
  const p = (db.navodila_predloge || []).find(x => x.id === n.predloga); if (!p) return [];
  const w = []; if (p.verzija !== n.predloga_verzija) w.push("nova različica predloge (" + p.verzija + ")");
  for (const v of zakoniVrstice(p, db)) if (!v.ok) w.push(v.txt);
  return w;
}
function navodiloBesedilo(p, s, db) {
  const L = [`${p.naslov}`, `Podjetje: ${s.naziv}`, `Različica predloge: ${p.verzija} (${fdate(p.posodobljeno)})`, "", "1. NAMEN", p.namen, "", "2. OBSEG", p.obseg, "", "3. ODGOVORNOSTI", p.odgovornosti, "", "4. POSTOPEK", ...p.postopek.map((x, i) => `${i + 1}. ${x}`), "", "5. POGOSTOST", p.pogostost, "", "6. UKREPI OB ODSTOPANJU", p.ukrepi, "", "7. EVIDENCE", p.evidence, ""];
  const zv = zakoniVrstice(p, db || {}); if (zv.length) L.push("8. PRAVNA IN STROKOVNA PODLAGA (stanje ob nastanku)", ...zv.map(x => "- " + x.txt), "");
  L.push("OPOMBA: Predlogo prilagodite dejanskemu stanju v obratu. Mejne vrednosti, pogostosti in odgovorne osebe potrdi odgovorna oseba oziroma HACCP-strokovnjak.");
  return L.join("\n");
}

// ---------- HACCP načrti ----------
async function tabNacrti(el, ctx) {
  await listView(el, "nacrti", ctx, {
    create: reload => { openForm("nacrti", null, ctx, reload); },
    open: (r, reload) => modal(r.naziv, `<div class="row">${badge(r.status)} <span class="mut">različica ${esc(r.verzija_oznaka || "")}, verzija zapisa ${r.verzija}</span></div><p>Odpri čarovnik za izpolnjevanje analize nevarnosti, diagrama poteka in kontrolnih točk, ali uredi osnovne podatke načrta.</p>`, [{ t: "Zapri", cls: "ghost sec" }, { t: "Osnovni podatki", cls: "ghost", fn: () => { setTimeout(() => openForm("nacrti", r, ctx, reload), 50); } }, { t: "Čarovnik", fn: () => { location.hash = "#/carovnik/" + r.id; } }]),
    extra: ""
  });
}
