// Potrditve in različice, pregled "Danes", sledljivost in odpoklic, alergeni in jedilnik, pripravljenost na certifikacijo.
// Seznam alergenov iz baze znanja (enak vir kot generator); ta seznam je samo privzeta vrednost, dokler se baza ne naloži.
const ALG = ["Žita z glutenom", "Raki", "Jajca", "Ribe", "Arašidi", "Soja", "Mleko", "Oreščki", "Zelena", "Gorčica", "Sezam", "Žveplov dioksid/sulfiti", "Volčji bob", "Mehkužci"];
async function sinhAlergeni() { try { const db = await baza(); const a = (db.alergeni || []).map(x => x.naziv).filter(Boolean); if (a.length) ALG.splice(0, ALG.length, ...a); } catch {} }
const algKode = a => [].concat(a || []).map(x => ALG.indexOf(x) + 1).filter(Boolean).sort((p, q) => p - q);
const ALG_BESEDE = [[/pšenic|moka|ječmen|rž[a-z]*\b|oves|pira|kruh|testenin|drobtin|gluten|krušn/i, "Žita z glutenom"], [/rak\b|raki|kozic|škamp|jastog|morski rak/i, "Raki"], [/jajc|jajce|jaj\b|majonez/i, "Jajca"], [/\bribe?\b|ribji|tuna|losos|postrv|orada|brancin|sardel|inčun|skuš/i, "Ribe"], [/arašid/i, "Arašidi"], [/soj[aeino]/i, "Soja"], [/mleko|mlečn|smetana|sir\b|sira|maslo|jogurt|skuta|kefir|sirotka|mascarpone|mozzarella|parmezan/i, "Mleko"], [/oreh|orešč|lešnik|mandelj|indijsk|pistaci|makadam|pekan/i, "Oreščki"], [/zelen[ae]\b|zelena\b|zeleno|gomolj zelene/i, "Zelena"], [/gorčic/i, "Gorčica"], [/sezam/i, "Sezam"], [/sulfit|žveplov|vino\b|vina\b|suho sadje/i, "Žveplov dioksid/sulfiti"], [/volčji bob|lupin/i, "Volčji bob"], [/školjk|lignj|hobotnic|polž|mehkuž/i, "Mehkužci"]];

// ---------- potrditve in različice ----------
const fmtV = v => { const s = v === undefined ? "(prazno)" : typeof v === "object" ? JSON.stringify(v) : String(v); return esc(s.length > 160 ? s.slice(0, 160) + " …" : s); };
function verzijeModal(coll, r, done) {
  const rev = r.revizije || [], cur = Object.assign({}, r), touched = {}, rows = [];
  for (const rv of rev.slice().reverse()) {
    const ch = Object.keys(rv.prej || {}).filter(k => !k.startsWith("_")).map(k => [k, rv.prej[k], cur[k]]);
    for (const k of Object.keys(rv.prej || {}).filter(k => !k.startsWith("_"))) { cur[k] = rv.prej[k]; touched[k] = cur[k]; }
    rows.push({ rv, ch, snap: Object.assign({}, touched) });
  }
  const body = rows.length ? `<p class="mut">Trenutna različica: ${r.verzija || 1}. Za vsako spremembo je prikazano, kaj je bilo prej in kaj je zdaj. Z vrnitvijo se vsebina te različice zapiše kot nova različica (zgodovina ostane).</p><div style="max-height:55vh;overflow:auto">${rows.map((x, i) => `<div class="card" style="margin:6px 0"><b>Različica ${x.rv.n}</b> → ${x.rv.n + 1} · ${fdt(x.rv.cas)} · ${esc(x.rv.ime || "")}${x.rv.razlog ? " · " + esc(x.rv.razlog) : ""}<div class="tw"><table class="t"><tr><th>Polje</th><th>Prej</th><th>Potem</th></tr>${x.ch.map(c => `<tr><td>${esc(c[0])}</td><td>${fmtV(c[1])}</td><td>${fmtV(c[2])}</td></tr>`).join("")}</table></div>${canManage() ? `<button class="btn sm ghost sec" data-vr="${i}">Vrni na različico ${x.rv.n}</button>` : ""}</div>`).join("")}</div>` : '<p class="empty">Dokument še nima prejšnjih različic.</p>';
  modal("Različice: " + (r.naslov || r.naziv), body, [{ t: "Zapri", cls: "ghost sec" }]);
  $$("[data-vr]", $("#dlg")).forEach(b => b.onclick = async () => { const x = rows[+b.dataset.vr]; if (!window.confirm("Vrnem dokument na različico " + x.rv.n + "?")) return; try { await D.set(coll, r.id, Object.assign({}, x.snap, { _razlog: "Vrnitev na različico " + x.rv.n })); $("#dlg").close(); toast("Vrnjeno"); done && done(); } catch (e) { fail(e); } });
}
TABEXT.potrditve = async (el, ctx) => {
  const [nac, nav, pot] = await Promise.all([D.list("nacrti", { stranka_id: ctx.stranka_id }), D.list("navodila", { stranka_id: ctx.stranka_id }), api("GET", "/api/potrditve?stranka_id=" + ctx.stranka_id).catch(() => [])]);
  const items = [...nac.map(r => ({ z: "nacrti", r, tip: "HACCP načrt", n: r.naziv })), ...nav.map(r => ({ z: "navodila", r, tip: "Navodilo", n: r.naslov }))];
  const last = id => pot.filter(p => p.ref_id === id).sort((a, b) => b.cas.localeCompare(a.cas))[0];
  const draw = () => {
    el.innerHTML = `<p class="note info">Odgovorna oseba potrdi trenutno različico dokumenta. Zapiše se, kdo je potrdil, kdaj in katero različico. Če se dokument kasneje spremeni, potrditev preneha veljati in jo je treba obnoviti.</p>
    <div class="tw"><table class="t"><thead><tr><th>Dokument</th><th>Vrsta</th><th>Različica</th><th>Potrditev</th><th></th></tr></thead><tbody>${items.map((x, i) => { const p = last(x.r.id); const st = !p ? '<span class="badge warn">ni potrjeno</span>' : p.veljava !== false && p.veljavna ? `<span class="badge ok">potrjeno: ${esc(p.potrdil_ime)}, ${fdate(p.cas)} (v${p.verzija})</span>` : `<span class="badge bad">spremenjeno po potrditvi (v${p.verzija})</span>`; return `<tr><td>${esc(x.n)}</td><td>${x.tip}</td><td>${x.r.verzija || 1}</td><td>${st}</td><td style="white-space:nowrap">${canManage() ? `<button class="btn sm" data-p="${i}">Potrdi</button> ` : ""}<button class="btn sm ghost sec" data-v="${i}">Različice</button></td></tr>`; }).join("") || '<tr><td colspan="5" class="empty">Ni dokumentov.</td></tr>'}</tbody></table></div>`;
    $$("[data-p]", el).forEach(b => b.onclick = () => { const x = items[+b.dataset.p]; modal("Potrditev: " + x.n, `<p>Potrdim trenutno različico (${x.r.verzija || 1})?</p><label class="f"><span>Opomba (neobvezno)</span><input id="p_o"></label>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Potrdi", fn: async () => { await api("POST", "/api/potrdi", { zbirka: x.z, id: x.r.id, opomba: $("#p_o").value }); toast("Potrjeno"); TABEXT.potrditve(el, ctx); } }]); });
    $$("[data-v]", el).forEach(b => b.onclick = () => { const x = items[+b.dataset.v]; verzijeModal(x.z, x.r, () => TABEXT.potrditve(el, ctx)); });
  };
  draw();
};

// ---------- pregled "Danes" ----------
async function pageDanes(v) {
  const st = await D.list("stranke"); if (!st.length) { v.innerHTML = '<p class="empty">Ni strank.</p>'; return; }
  let sid = sessionStorage.getItem("danes_sid"); if (!st.some(s => s.id === sid)) sid = st[0].id;
  v.innerHTML = `${st.length > 1 ? `<div class="row"><label class="f" style="margin:0;min-width:260px"><span>Stranka</span><select id="dn_s">${st.map(s => `<option value="${s.id}" ${s.id === sid ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select></label></div>` : ""}<div id="dn"></div>`;
  const draw = async () => {
    const s = st.find(x => x.id === sid), el = $("#dn"), obrati = await D.list("obrati", { stranka_id: sid }), ctx = await evCtx({ stranka_id: sid, stranka: s, obrati: mapOf(obrati) });
    const [rows, urnik, capa] = await Promise.all([D.list("evidence", { stranka_id: sid }), D.list("urnik", { stranka_id: sid }).catch(() => []), D.list("capa", { stranka_id: sid })]);
    const manjka = [];
    for (const u of urnik) { const l = rows.filter(r => r.vrsta === u.vrsta && (!u.naprava || r.oprema === u.naprava || r.izdelek === u.naprava) && (!u.obrat_id || r.obrat_id === u.obrat_id)).sort((a, b) => (b.cas || "").localeCompare(a.cas || ""))[0], h = l ? (Date.now() - new Date(l.cas)) / 36e5 : Infinity; if (h > +u.frekvenca_ur) manjka.push({ u, h, l }); }
    const um = (await api("GET", "/api/umiki?stranka_id=" + sid).catch(() => ({ obvestila: [] }))).obvestila.filter(n => n.zadetki.length && daysTo(String(n.cas_prejema).slice(0, 10)) >= -14);
    const ukrepi = capa.filter(c => c.status !== "zaprto" && c.rok && daysTo(c.rok) <= 7);
    el.innerHTML = `${um.length ? `<p class="note"><b>Možen umik/odpoklic:</b> ${um.slice(0, 3).map(n => esc(n.naslov)).join("; ")} <a href="#/umiki">Odpri obvestila</a></p>` : ""}<h2>Vnosi, ki jih je treba opraviti</h2>${manjka.length ? `<div class="tw"><table class="t">${manjka.map((m, i) => `<tr><td>${esc((EV[m.u.vrsta] || {}).ime || m.u.vrsta)}${m.u.naprava ? " – " + esc(m.u.naprava) : ""}</td><td class="mut">${m.l ? "zadnji pred " + Math.round(m.h) + " h (dovoljeno " + m.u.frekvenca_ur + " h)" : "še ni vnosa"}</td><td><button class="btn sm" data-m="${i}">Vnesi</button></td></tr>`).join("")}</table></div>` : '<p class="note">Vsi redni vnosi so opravljeni.</p>'}
    <h2 style="margin-top:20px">Čiščenje</h2><div id="dn_c"></div>
    <h2 style="margin-top:20px">Ukrepi z rokom v tem tednu</h2>${ukrepi.length ? `<div class="tw"><table class="t">${ukrepi.map(c => `<tr class="click" data-c="1"><td>${esc((c.opis || "").slice(0, 90))}</td><td>${dueBadge(c.rok)}</td><td>${esc(c.odgovoren || "")}</td></tr>`).join("")}</table></div>` : '<p class="note">Ni nujnih ukrepov.</p>'}
    ${urnik.length ? "" : '<p class="mut">Pogostosti vnosov še niso določene (zavihek Evidence → Pogostost vnosov).</p>'}`;
    $$("[data-m]", el).forEach(b => b.onclick = () => evForm(null, ctx, draw, manjka[+b.dataset.m].u.vrsta));
    $$("[data-c]", el).forEach(r => r.onclick = () => location.hash = "#/stranka/" + sid + "/capa");
    await hDanes($("#dn_c"), ctx);
  };
  if ($("#dn_s")) $("#dn_s").onchange = e => { sid = e.target.value; sessionStorage.setItem("danes_sid", sid); draw(); };
  draw();
}
route(/^\/danes$/, pageDanes, "Danes", "danes");
navItem("danes", "Danes (opravila)", "#/danes"); NAVITEMS.splice(1, 0, NAVITEMS.pop());

// ---------- sledljivost in odpoklic ----------
SPEC.sarze = {
  ime: "šarža", rev: true, sort: (a, b) => (b.datum_prevzema || "").localeCompare(a.datum_prevzema || ""),
  fields: () => [T("izdelek", "Izdelek / surovina", { req: 1 }), T("ean", "EAN (če ga imate)"), T("sarza", "Številka šarže (LOT)"), { k: "dobavitelj", l: "Dobavitelj", t: "sel", o: c => Object.values(c.dobavitelji || {}) }, T("datum_prevzema", "Datum prevzema", { t: "date", def: () => today() }), T("rok_uporabe", "Rok uporabe / minimalna trajnost", { t: "date" }), T("kolicina", "Količina"), T("dokument", "Št. dobavnice / računa"), T("uporabljeno", "Kje uporabljeno (jedi, serije, datumi)", { t: "area" }), { k: "status", l: "Stanje", t: "sel", o: ["na zalogi", "v uporabi", "porabljeno", "umaknjeno"], def: "na zalogi" }, T("opomba", "Opomba", { t: "area" })],
  cols: () => [{ l: "Izdelek", k: "izdelek" }, { l: "Šarža", k: "sarza" }, { l: "Dobavitelj", k: "dobavitelj" }, { l: "Prevzem", f: r => fdate(r.datum_prevzema) }, { l: "Rok", f: r => dueBadge(r.rok_uporabe) }, { l: "Stanje", f: r => badge(r.status) }]
};
TABEXT.sledljivost = async (el, ctx0) => {
  const ctx = await evCtx(ctx0);
  el.innerHTML = `<div class="card"><h2>Odpoklic / umik: iskanje po šarži</h2><p class="mut">Vnesite šaržo, izdelek ali dobavitelja. Prikaže se, kaj je bilo prevzeto in kje je bilo uporabljeno.</p><div class="row"><input id="od_q" placeholder="npr. LOT 2411 ali ime izdelka" aria-label="Iskanje po šarži" style="max-width:340px"><button class="btn" id="od_i">Poišči</button></div><div id="od_r"></div></div><div id="sl"></div>`;
  const reload = () => listView($("#sl"), "sarze", ctx);
  reload();
  const find = async () => {
    const q = $("#od_q").value.trim().toLowerCase(); if (!q) return toast("Vnesite iskalni niz.", true);
    const all = await D.list("sarze", { stranka_id: ctx.stranka_id }), dob = await D.list("dobavitelji", { stranka_id: ctx.stranka_id });
    const m = all.filter(r => [r.izdelek, r.sarza, r.dobavitelj, r.uporabljeno, r.dokument].join(" ").toLowerCase().includes(q));
    if (!$("#od_r")) return;
    $("#od_r").innerHTML = m.length ? `<div class="tw"><table class="t"><tr><th>Izdelek</th><th>Šarža</th><th>Dobavitelj (kontakt)</th><th>Prevzem</th><th>Kje uporabljeno</th><th>Stanje</th></tr>${m.map(r => `<tr><td>${esc(r.izdelek)}</td><td>${esc(r.sarza || "")}</td><td>${esc(r.dobavitelj || "")} ${esc(((dob.find(d => d.naziv === r.dobavitelj) || {}).kontakt) || "")}</td><td>${fdate(r.datum_prevzema)}</td><td>${esc(r.uporabljeno || "")}</td><td>${badge(r.status)}</td></tr>`).join("")}</table></div><div class="row"><button class="btn ghost sec" id="od_p">PDF poročilo</button><button class="btn" id="od_c">Ustvari neskladnost (CAPA) in označi kot umaknjeno</button></div>` : '<p class="note">Ni zadetkov.</p>';
    if (!m.length) return;
    $("#od_p").onclick = () => downloadPdf("evidence-odpoklic-" + ctx.stranka.naziv, { naslov: "Poročilo o sledljivosti: " + q, stranka: ctx.stranka.naziv, podnaslov: "Izpis: " + fdt(new Date().toISOString()), tabela: { glava: ["Izdelek", "Šarža", "Dobavitelj", "Prevzem", "Kje uporabljeno", "Stanje"], vrste: m.map(r => [r.izdelek, r.sarza || "", r.dobavitelj || "", fdate(r.datum_prevzema), r.uporabljeno || "", r.status || ""]), sirine: [20, 13, 18, 12, 27, 10] } });
    $("#od_c").onclick = () => confirmBox("Ustvarim neskladnost in označim " + m.length + " šarž kot umaknjene?", async () => { await D.add("capa", { stranka_id: ctx.stranka_id, cas: new Date().toISOString(), proces: "Odpoklic / umik", opis: "Umik: " + m.map(r => r.izdelek + (r.sarza ? " (" + r.sarza + ")" : "")).join("; "), tveganje: "visoko", nujnost: "takojšnja", odlocitev_zivilo: "umik / uničenje", status: "odprto" }); for (const r of m) await D.set("sarze", r.id, { status: "umaknjeno", _razlog: "Odpoklic" }); toast("Neskladnost ustvarjena"); reload(); find(); });
  };
  $("#od_i").onclick = find; $("#od_q").onkeydown = e => { if (e.key === "Enter") find(); };
};

// ---------- alergeni in jedilnik ----------
SPEC.jedi = {
  ime: "jed", sort: (a, b) => (a.skupina || "").localeCompare(b.skupina || "") || (a.naziv || "").localeCompare(b.naziv || ""),
  fields: () => [T("naziv", "Naziv jedi / izdelka", { req: 1 }), { k: "skupina", l: "Skupina", t: "sel", o: ["predjed", "juha", "glavna jed", "priloga", "solata", "sladica", "pijača", "drugo"] }, T("sestavine", "Sestavine (ločene z vejico)", { t: "area" }), { k: "alergeni", l: "Alergeni (št. po Uredbi 1169/2011)", t: "multi", o: ALG, wide: 1 }, T("sledi", "Možne sledi (navzkrižna kontaminacija)")],
  cols: () => [{ l: "Jed", k: "naziv" }, { l: "Skupina", k: "skupina" }, { l: "Alergeni", f: r => algKode(r.alergeni).join(", ") || '<span class="mut">brez</span>' }],
  onOpen: () => {
    const ta = $("#f_sestavine"); if (!ta) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn sm ghost sec"; b.textContent = "Predlagaj alergene iz sestavin"; ta.parentNode.appendChild(b);
    b.onclick = async () => {
      const txt = ta.value, db = await baza().catch(() => ({})), found = new Set(), from = [];
      for (const part of txt.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)) {
        const rec = (db.sestavine || []).find(s => s.naziv && (s.naziv.toLowerCase() === part.toLowerCase() || part.toLowerCase().includes(s.naziv.toLowerCase())));
        const hit = new Set((rec && rec.alergeni || []).map(a => ALG.indexOf(a)).filter(i => i >= 0));
        for (const [re, ime] of ALG_BESEDE) if (re.test(part) && ALG.includes(ime)) hit.add(ALG.indexOf(ime));
        for (const i of hit) { found.add(i); from.push(part + " → " + ALG[i]); }
      }
      $$("#f_alergeni input").forEach(c => { if (found.has(ALG.indexOf(c.value))) c.checked = true; });
      toast(found.size ? "Predlog (preverite): " + [...found].map(i => ALG[i]).join(", ") : "Ni prepoznanih alergenov – preverite ročno.", !found.size);
    };
  }
};
TABEXT.alergeni = async (el, ctx0) => {
  await sinhAlergeni();
  const ctx = await evCtx(ctx0), jedi = await D.list("jedi", { stranka_id: ctx.stranka_id });
  jedi.sort(SPEC.jedi.sort);
  el.innerHTML = `<p class="note info">Alergeni so predlog iz sestavin in jih mora pregledati odgovorna oseba. Jedilnik z oznakami (številke po Uredbi 1169/2011) lahko natisnete ali izvozite.</p>
  <div class="row"><button class="btn ghost sec" id="a_p">Jedilnik z alergeni (PDF)</button><button class="btn ghost sec" id="a_x">Matrika (Excel)</button></div>
  <div class="tw"><table class="t"><thead><tr><th>Jed</th>${ALG.map((a, i) => `<th title="${esc(a)}" style="text-align:center">${i + 1}</th>`).join("")}</tr></thead><tbody>${jedi.map(j => `<tr class="click" data-j="${j.id}"><td>${esc(j.naziv)}</td>${ALG.map(a => `<td style="text-align:center">${[].concat(j.alergeni || []).includes(a) ? "●" : ""}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="15" class="empty">Ni jedi.</td></tr>`}</tbody></table></div>
  <p class="mut">${ALG.map((a, i) => (i + 1) + " " + a).join(" · ")}</p><div id="aj"></div>`;
  $$("[data-j]", el).forEach(r => r.onclick = () => openForm("jedi", jedi.find(x => x.id === r.dataset.j), ctx, () => TABEXT.alergeni(el, ctx0)));
  const add = document.createElement("div"); add.className = "row"; add.innerHTML = '<button class="btn" id="a_n">+ Dodaj jed</button>'; $("#aj").appendChild(add); $("#a_n").onclick = () => openForm("jedi", null, ctx, () => TABEXT.alergeni(el, ctx0));
  $("#a_p").onclick = () => { if (!jedi.length) return toast("Ni jedi.", true); downloadPdf("obrazec-jedilnik-" + ctx.stranka.naziv, { naslov: "Jedilnik z alergeni", stranka: ctx.stranka.naziv, podnaslov: "Alergeni: " + ALG.map((a, i) => (i + 1) + " " + a).join(", "), tabela: { glava: ["Jed", "Skupina", "Alergeni", "Sledi"], vrste: jedi.map(j => [j.naziv, j.skupina || "", algKode(j.alergeni).join(", ") || "-", j.sledi || ""]), sirine: [38, 16, 22, 24] } }); };
  $("#a_x").onclick = () => downloadXlsx("obrazec-alergeni-" + ctx.stranka.naziv + ".xlsx", [{ ime: "Alergeni", glava: ["Jed", "Skupina", ...ALG.map((a, i) => i + 1 + " " + a)], vrste: jedi.map(j => [j.naziv, j.skupina || "", ...ALG.map(a => [].concat(j.alergeni || []).includes(a) ? "x" : "")]) }]);
};

// ---------- pripravljenost na certifikacijo ----------
SPEC.certifikacija = { ime: "ocena točke", fields: () => [] };
const CERT = [
  // [ključ, besedilo, razdelek v standardi.json, skupina ISO, skupina splošno, samodejno preverjanje]
  ["kontekst", "Obseg sistema in opis dejavnosti (obrati, procesi)", "qms", "4 Kontekst organizacije", "Vodstvo in obseg", d => d.obrati.length > 0],
  ["vodstvo", "Politika varnosti hrane, odgovornosti in pooblastila", "qms", "5 Vodenje", "Vodstvo in obseg", null],
  ["tveganja", "Obvladovanje tveganj in priložnosti", "qms", "6 Planiranje", "Vodstvo in obseg", null],
  ["usposabljanja", "Usposobljenost: higienski minimum in usposabljanja zaposlenih", "prp", "7 Podpora", "Viri in usposobljenost", d => d.osebje.length > 0 && d.usposabljanja.length > 0],
  ["oprema", "Oprema, vzdrževanje in umerjanje merilnih instrumentov", "prp", "7 Podpora", "Viri in usposobljenost", d => d.oprema.length > 0],
  ["dobavitelji", "Odobritev in ocenjevanje dobaviteljev", "prp", "7 Podpora", "Viri in usposobljenost", d => d.dobavitelji.length > 0],
  ["dok", "Dokumentirane informacije: HACCP načrt in navodila", "qms", "7 Podpora", "Dokumentacija", d => d.nacrti.length > 0 && d.navodila.length > 0],
  ["potrjeno", "Potrjena različica HACCP načrta (odgovorna oseba)", "qms", "7 Podpora", "Dokumentacija", d => d.potrjenNacrt],
  ["prp", "Predpogojni programi: čiščenje in razkuževanje, higiena", "prp", "8 Delovanje", "Operativni procesi", d => d.ciscenje_nacrt.length > 0],
  ["haccp", "Analiza nevarnosti, CCP in kritične meje (HACCP načrt)", "haccp", "8 Delovanje", "Operativni procesi", d => d.nacrti.length > 0],
  ["spremljanje", "Spremljanje: evidence meritev v zadnjih 30 dneh", "haccp", "8 Delovanje", "Operativni procesi", d => d.evidence.some(e => daysTo(String(e.cas).slice(0, 10)) >= -30)],
  ["sledljivost", "Sledljivost in postopek umika/odpoklica (šarže)", "prp", "8 Delovanje", "Operativni procesi", d => d.sarze.length > 0],
  ["alergeni", "Obvladovanje alergenov (matrika jedi)", "alerg", "8 Delovanje", "Operativni procesi", d => d.jedi.length > 0],
  ["defence", "Zaščita hrane (food defence): ocena ranljivosti", "defence", "8 Delovanje", "Zaščita hrane in goljufije", null],
  ["fraud", "Preprečevanje goljufij s hrano: ocena ranljivosti", "fraud", "8 Delovanje", "Zaščita hrane in goljufije", null],
  ["presoja", "Notranja presoja", "qms", "9 Vrednotenje uspešnosti", "Preverjanje", d => d.dogodki.some(e => /preso/i.test((e.vrsta || "") + " " + (e.naslov || "")))],
  ["pregled", "Pregled sistema s strani vodstva", "qms", "9 Vrednotenje uspešnosti", "Preverjanje", d => d.dogodki.some(e => /pregled.*vodstv|vodstv.*pregled/i.test((e.vrsta || "") + " " + (e.naslov || "")))],
  ["capa", "Obvladovanje neskladnosti in korektivni ukrepi", "qms", "10 Izboljševanje", "Izboljševanje", d => d.capa.length > 0],
  ["izboljsave", "Stalno izboljševanje (zaprti ukrepi)", "qms", "10 Izboljševanje", "Izboljševanje", d => d.capa.some(c => c.status === "zaprto")]
];
TABEXT.certifikacija = async (el, ctx) => {
  const db = await baza(), sid = ctx.stranka_id, stds = db.standardi || [];
  let std = sessionStorage.getItem("cert_std") || (stds[0] || {}).id;
  const names = ["obrati", "osebje", "usposabljanja", "oprema", "dobavitelji", "nacrti", "navodila", "ciscenje_nacrt", "evidence", "capa", "dogodki", "sarze", "jedi", "certifikacija"];
  const d = {}; await Promise.all(names.map(async c => { d[c] = await D.list(c, { stranka_id: sid }).catch(() => []); }));
  const pot = await api("GET", "/api/potrditve?stranka_id=" + sid).catch(() => []);
  d.potrjenNacrt = d.nacrti.some(n => pot.some(p => p.ref_id === n.id && p.veljavna));
  const draw = () => {
    const S = stds.find(x => x.id === std) || stds[0]; if (!S) { el.innerHTML = '<p class="empty">Standardi niso na voljo.</p>'; return; }
    const items = CERT.filter(c => S.razdelki.includes(c[2])), iso = S.id === "iso22000" || S.id === "fssc";
    const man = k => d.certifikacija.find(r => r.standard === S.id && r.tocka === k);
    const stanje = it => { const m = man(it[0]); if (m && m.status) return { s: m.status, ro: true, m }; if (it[5]) return { s: it[5](d) ? "ustrezno" : "manjka", ro: false }; return { s: "ni ocene", ro: false }; };
    const rows = items.map(it => Object.assign({ it }, stanje(it))), rel = rows.filter(r => r.s !== "ni relevantno"), ok = rel.filter(r => r.s === "ustrezno").length + rel.filter(r => r.s === "delno").length / 2;
    const grp = it => iso ? it[3] : it[4];
    const groups = [...new Set(items.map(grp))];
    el.innerHTML = `<p class="note info">Pripravljenost se izračuna iz podatkov v aplikaciji (neobvezen predpogoj za certifikacijo, ne nadomešča presoje). Kjer ni samodejnega preverjanja ali se z oceno ne strinjate, izberite ročno oceno.</p>
    <div class="row"><label class="f" style="margin:0;min-width:260px"><span>Standard</span><select id="c_s">${stds.map(s => `<option value="${s.id}" ${s.id === S.id ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select></label><span class="sp"></span><strong>${rel.length ? Math.round(ok / rel.length * 100) : 0} % pokritosti</strong><button class="btn ghost sec" id="c_x">Excel</button><button class="btn ghost sec" id="c_p">PDF</button></div>
    <div class="tw"><table class="t"><thead><tr><th>Zahteva</th><th>Stanje</th><th>Ocena</th><th>Opomba</th></tr></thead><tbody>${groups.map(g => `<tr><th colspan="4" style="text-align:left;background:var(--acc2)">${esc(g)}</th></tr>` + rows.filter(r => grp(r.it) === g).map(r => `<tr><td>${esc(r.it[1])}</td><td>${r.s === "ustrezno" ? '<span class="badge ok">ustrezno</span>' : r.s === "delno" ? '<span class="badge warn">delno</span>' : r.s === "manjka" ? '<span class="badge bad">manjka</span>' : `<span class="badge">${esc(r.s)}</span>`}${r.ro ? ' <small class="mut">ročno</small>' : ""}</td><td><select data-k="${r.it[0]}" aria-label="Ocena: ${esc(r.it[1])}" ${canManage() ? "" : "disabled"}><option value="">samodejno</option>${["ustrezno", "delno", "manjka", "ni relevantno"].map(o => `<option ${r.m && r.m.status === o ? "selected" : ""}>${o}</option>`).join("")}</select></td><td><input data-o="${r.it[0]}" value="${esc(r.m ? r.m.opomba || "" : "")}" aria-label="Opomba: ${esc(r.it[1])}" ${canManage() ? "" : "disabled"}></td></tr>`).join("")).join("")}</tbody></table></div>`;
    $("#c_s").onchange = e => { std = e.target.value; sessionStorage.setItem("cert_std", std); draw(); };
    const save = async k => { const sel = $(`[data-k="${k}"]`, el).value, op = $(`[data-o="${k}"]`, el).value, m = man(k); try { if (m) { const r = await D.set("certifikacija", m.id, { standard: S.id, tocka: k, status: sel, opomba: op }); Object.assign(m, r); } else if (sel || op) { const r = await D.add("certifikacija", { stranka_id: sid, standard: S.id, tocka: k, status: sel, opomba: op }); d.certifikacija.push(r); } draw(); } catch (e) { fail(e); } };
    $$("[data-k]", el).forEach(s => s.onchange = () => save(s.dataset.k)); $$("[data-o]", el).forEach(i => i.onchange = () => save(i.dataset.o));
    const tab = () => rows.map(r => [grp(r.it), r.it[1], r.s + (r.ro ? " (ročno)" : ""), r.m ? r.m.opomba || "" : ""]);
    $("#c_x").onclick = () => downloadXlsx("inspekcija-pripravljenost-" + S.id + "-" + ctx.stranka.naziv + ".xlsx", [{ ime: "Pripravljenost", glava: ["Skupina", "Zahteva", "Stanje", "Opomba"], vrste: tab() }]);
    $("#c_p").onclick = () => downloadPdf("inspekcija-pripravljenost-" + S.id + "-" + ctx.stranka.naziv, { naslov: "Pripravljenost: " + S.naziv, stranka: ctx.stranka.naziv, podnaslov: "Pokritost " + (rel.length ? Math.round(ok / rel.length * 100) : 0) + " %, " + fdt(new Date().toISOString()), tabela: { glava: ["Skupina", "Zahteva", "Stanje", "Opomba"], vrste: tab(), sirine: [20, 40, 16, 24] } });
  };
  draw();
};

// ---------- umiki in odpoklici živil (viri RSS/Atom + ročni vnos, samodejno ujemanje s šaržami, izdelki in dobavitelji) ----------
async function pageUmiki(v) {
  const st = await D.list("stranke"); let sid = sessionStorage.getItem("umiki_sid"); if (!st.some(s => s.id === sid)) sid = (st[0] || {}).id;
  const draw = async () => {
    const r = await api("GET", "/api/umiki" + (sid ? "?stranka_id=" + sid : "")), staff = isStaff(), adm = ME.u.vloga === "admin";
    const zad = r.obvestila.filter(n => n.zadetki.length);
    v.innerHTML = `${st.length > 1 ? `<div class="row"><label class="f" style="margin:0;min-width:260px"><span>Stranka (za ujemanje)</span><select id="um_s">${st.map(s => `<option value="${s.id}" ${s.id === sid ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select></label></div>` : ""}
    ${zad.length ? `<p class="note"><b>${zad.length}</b> obvestil se ujema z vašimi izdelki, šaržami ali dobavitelji. Preverite jih in po potrebi označite šarže kot umaknjene.</p>` : '<p class="note info">Za izbrano stranko ni ujemanj z obvestili. Ujemanje temelji na imenih izdelkov, številkah šarž, dobaviteljih in sestavinah jedi, zato ga potrdite z branjem obvestila.</p>'}
    <div class="row">${staff ? '<button class="btn" id="um_n">+ Dodaj obvestilo ročno</button>' : ""}${adm ? '<button class="btn ghost sec" id="um_o">Osveži iz virov</button>' : ""}<span class="mut">${r.stanje && r.stanje.cas ? "Zadnje osveževanje: " + fdt(r.stanje.cas) : ""}${r.stanje && r.stanje.napaka ? " · napaka: " + esc(r.stanje.napaka) : ""}</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Obvestilo</th><th>Vir</th><th>Prejeto</th><th>Ujemanje</th><th></th></tr></thead><tbody>${r.obvestila.map(n => `<tr><td>${n.povezava ? `<a href="${esc(n.povezava)}" target="_blank" rel="noopener">${esc(n.naslov)}</a>` : esc(n.naslov)}${n.opis ? `<br><small class="mut">${esc(n.opis.slice(0, 220))}</small>` : ""}</td><td>${esc(n.vir)}</td><td>${fdt(n.cas_prejema)}</td><td>${n.zadetki.length ? n.zadetki.map(z => `<span class="badge bad">${esc(z)}</span>`).join(" ") : '<span class="mut">ni</span>'}</td><td>${n.zadetki.length && sid ? `<a class="btn sm" href="#/stranka/${sid}/sledljivost">Šarže</a>` : ""}${adm ? ` <button class="btn sm ghost sec" data-d="${n.id}" aria-label="Odstrani obvestilo">✕</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">Ni obvestil. Dodajte vir (RSS/Atom) ali obvestilo ročno.</td></tr>'}</tbody></table></div>
    ${adm ? `<div class="card" style="margin-top:14px"><h2>Viri obvestil (RSS / Atom)</h2><p class="mut">Vpišite naslove virov, ki jih program redno prebira (vsakih 6 ur). Vsaka vrstica: <code>ime | https://naslov-vira</code>. Uradni viri: <a href="https://www.gov.si/teme/umiki-in-odpoklici-zivil/" target="_blank" rel="noopener">gov.si – umiki in odpoklici živil</a>. Če vir ne ponuja RSS, obvestila dodajte ročno.</p><textarea id="um_v" aria-label="Viri obvestil" style="min-height:90px">${esc((r.viri || []).map(x => x.ime + " | " + x.url).join("\\n"))}</textarea><div class="row"><button class="btn" id="um_vs">Shrani vire</button></div>
    <h3 style="margin-top:16px">RASFF (EU sistem hitrega obveščanja)</h3><p class="mut">Neuradni endpoint RASFF Window (ni dokumentiran javni API, lahko se spremeni). Uvoz enkrat na dan, privzeto izklopljen. Šifri filtra sta nastavljivi.</p>
    <div class="row"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="um_r" ${r.rasff && r.rasff.vklopljeno ? "checked" : ""}> Vklopi uvoz iz RASFF</label><label class="f" style="margin:0"><span>Klasifikacija</span><input id="um_rk" value="${esc(((r.rasff || {}).klasifikacija || []).join(","))}" style="width:120px"></label><label class="f" style="margin:0"><span>Država izvora</span><input id="um_ri" value="${esc(((r.rasff || {}).izvor || []).join(","))}" style="width:120px"></label><button class="btn" id="um_rs">Shrani</button></div></div>` : ""}`;
    if ($("#um_s")) $("#um_s").onchange = e => { sid = e.target.value; sessionStorage.setItem("umiki_sid", sid); draw(); };
    $$("[data-d]", v).forEach(b => b.onclick = async () => { if (!window.confirm("Odstranim obvestilo?")) return; try { await api("DELETE", "/api/umiki/" + b.dataset.d); draw(); } catch (e) { fail(e); } });
    if ($("#um_o")) $("#um_o").onclick = async () => { try { const x = await api("POST", "/api/umiki/osvezi"); toast(x.napake.length ? "Napaka: " + x.napake.join("; ") : "Novih obvestil: " + x.novih, !!x.napake.length); draw(); } catch (e) { fail(e); } };
    if ($("#um_rs")) $("#um_rs").onclick = async () => { try { await api("PUT", "/api/umiki/rasff", { vklopljeno: $("#um_r").checked, klasifikacija: $("#um_rk").value, izvor: $("#um_ri").value }); toast("Shranjeno"); } catch (e) { fail(e); } };
    if ($("#um_vs")) $("#um_vs").onclick = async () => { const viri = $("#um_v").value.split("\\n").map(l => l.trim()).filter(Boolean).map(l => { const i = l.lastIndexOf("|"); return i < 0 ? { ime: "", url: l } : { ime: l.slice(0, i).trim(), url: l.slice(i + 1).trim() }; }); try { await api("PUT", "/api/umiki/viri", { viri }); toast("Shranjeno"); } catch (e) { fail(e); } };
    if ($("#um_n")) $("#um_n").onclick = () => modal("Novo obvestilo o umiku / odpoklicu", `<div class="fgrid"><label class="f req wide"><span>Naslov</span><input id="um_t"></label><label class="f wide"><span>Povezava</span><input id="um_l" placeholder="https://…"></label><label class="f wide"><span>Opis (izdelek, šarža, razlog)</span><textarea id="um_d"></textarea></label></div>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Shrani", fn: async () => { if (!$("#um_t").value.trim()) { toast("Vnesite naslov.", true); return false; } await api("POST", "/api/umiki", { naslov: $("#um_t").value, povezava: $("#um_l").value, opis: $("#um_d").value }); draw(); } }]);
  };
  draw();
}
route(/^\/umiki$/, pageUmiki, "Umiki in odpoklici", "umiki");
navItem("umiki", "Umiki in odpoklici", "#/umiki"); NAVITEMS.splice(2, 0, NAVITEMS.pop());
