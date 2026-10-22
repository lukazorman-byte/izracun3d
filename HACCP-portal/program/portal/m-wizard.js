// Čarovnik HACCP: 7 korakov. Predlogi so označeni in zahtevajo strokovno potrditev; CCP/OPRP/PRP vedno izbere uporabnik.
const WSTEPS = ["Zbiranje podatkov", "Dejavnost in živila", "Procesni koraki", "Analiza nevarnosti", "Kontrolni ukrepi", "Pregled osnutka", "Izvoz"];
const HTIPI = { B: "Biološka", K: "Kemična", F: "Fizikalna", A: "Alergen", C: "Navzkrižna kontaminacija", T: "Čas / temperatura", D: "Druga" };
const KTIPI = ["tehnološki", "prevzem", "skladiščenje", "priprava", "toplotna obdelava", "hlajenje", "pakiranje", "prodaja / izdaja", "drugo"];
const DEF_METODA = { nizko_do: 4, srednje_do: 11, verjetnost: ["1 – zelo malo verjetno", "2 – malo verjetno", "3 – možno", "4 – verjetno", "5 – zelo verjetno"], teza: ["1 – neznatne posledice", "2 – lažje posledice", "3 – zmerne posledice", "4 – hude posledice", "5 – zelo hude / smrtne posledice"] };
const rizikRazred = (r, m) => r <= m.nizko_do ? "nizko" : r <= m.srednje_do ? "srednje" : "visoko";
const rizik = h => (+h.verjetnost || 0) * (+h.teza || 0);
const CCPPOL = ["kaj", "mejna", "mejna_vir", "spremljanje", "pogostost", "odgovoren", "korektivni", "verifikacija"];
const uidc = () => Math.random().toString(36).slice(2, 9);

async function pageCarovnik(v, m) {
  const id = m[1];
  const plans = await D.list("nacrti"), rec = plans.find(p => p.id === id);
  if (!rec) throw new Error("Načrt ni najden ali nimate dostopa.");
  const stranka = (await D.list("stranke")).find(s => s.id === rec.stranka_id); await loadStrankaLogo(stranka);
  const obrati = await D.list("obrati", { stranka_id: rec.stranka_id });
  const tlorisi = await D.list("tlorisi", { stranka_id: rec.stranka_id }).catch(() => []);
  const db = await baza();
  const W = rec.vsebina && typeof rec.vsebina === "object" ? rec.vsebina : {};
  W.zbiranje = W.zbiranje || {}; W.zivila = W.zivila || []; W.koraki = W.koraki || []; W.nevarnosti = W.nevarnosti || []; W.kontrole = W.kontrole || {}; W.metoda = Object.assign({}, DEF_METODA, W.metoda || {}); W.pregled = W.pregled || {}; W.besedila = W.besedila || {}; W.branza = W.branza || "";
  const editable = canManage() && rec.status !== "potrjeno";
  let step = +(sessionStorage.getItem("wstep:" + id) || 0), dirty = false;
  $("#title").textContent = "Čarovnik: " + rec.naziv;
  const mark = () => { dirty = true; const b = $("#wsave"); if (b) b.textContent = "Shrani spremembe *"; };
  const save = async (razlog) => { const r = await D.set("nacrti", id, { vsebina: W, _razlog: razlog || "Posodobitev vsebine v čarovniku" }); Object.assign(rec, r); dirty = false; const b = $("#wsave"); if (b) b.textContent = "Shrani"; toast("Shranjeno (različica " + r.verzija + ")"); };
  const korakIme = kid => (W.koraki.find(k => k.id === kid) || {}).naziv || "–";
  const num = i => { const k = W.koraki.findIndex(x => x.id === i); return k < 0 ? "" : k + 1; };

  const draw = () => {
    sessionStorage.setItem("wstep:" + id, step);
    v.innerHTML = `${!editable ? `<p class="note">${rec.status === "potrjeno" ? "Načrt je potrjen in zaklenjen za urejanje. Za spremembo najprej spremenite stanje načrta (z razlogom) v osnovnih podatkih." : "Za urejanje nimate pravic."}</p>` : ""}
    <div class="row"><a href="#/stranka/${rec.stranka_id}/nacrti" class="btn ghost sec sm">‹ Nazaj</a><span class="mut">${esc(stranka.naziv)} · ${badge(rec.status)} · različica zapisa ${rec.verzija}</span><span class="sp"></span>${editable ? '<button class="btn" id="wsave">Shrani</button>' : ""}</div>
    <div class="steps">${WSTEPS.map((s, i) => `<button data-s="${i}" class="${i === step ? "on" : ""}">${i + 1}. ${s}</button>`).join("")}</div><div id="wbody"></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost sec" id="wprev" ${step === 0 ? "disabled" : ""}>‹ Nazaj</button><span class="sp"></span><button class="btn" id="wnext" ${step === 6 ? "disabled" : ""}>Naprej ›</button></div>`;
    $$(".steps button", v).forEach(b => b.onclick = () => { step = +b.dataset.s; draw(); });
    $("#wprev").onclick = () => { step--; draw(); }; $("#wnext").onclick = () => { step++; draw(); };
    if ($("#wsave")) $("#wsave").onclick = () => save().catch(fail);
    const body = $("#wbody");
    [s1, s2, s3, s4, s5, s6, s7][step](body);
    if (!editable) $$("#wbody input,#wbody select,#wbody textarea,#wbody .edit").forEach(e => { if (e.tagName === "BUTTON") e.disabled = true; else e.disabled = true; });
  };
  // povezava vnosnega polja na objekt
  const bindAll = (el, obj) => $$("[data-k]", el).forEach(i => { const k = i.dataset.k; if (i.type === "checkbox") i.checked = !!obj[k]; else i.value = obj[k] === undefined ? "" : obj[k]; i.oninput = i.onchange = () => { obj[k] = i.type === "checkbox" ? i.checked : i.value; mark(); }; });
  const inp = (k, l, o) => `<label class="f ${o && o.wide ? "wide" : ""}"><span>${l}</span>${o && o.area ? `<textarea data-k="${k}"></textarea>` : o && o.sel ? `<select data-k="${k}"><option value=""></option>${o.sel.map(x => `<option value="${esc(Array.isArray(x) ? x[0] : x)}">${esc(Array.isArray(x) ? x[1] : x)}</option>`).join("")}</select>` : `<input data-k="${k}" ${o && o.type ? `type="${o.type}"` : ""}>`}</label>`;

  // 1. zbiranje podatkov
  function s1(el) {
    const Z = W.zbiranje, ob = obrati.find(o => o.id === rec.obrat_id);
    const miss = missingData({ obrati, osebje: [{ stranka_id: stranka.id }], nacrti: [rec], dobavitelji: [{ stranka_id: stranka.id }] }, stranka).filter(x => !["seznam zaposlenih", "dobavitelji", "HACCP načrt"].includes(x));
    el.innerHTML = `<div class="card"><h2>1. Zbiranje podatkov</h2>${miss.length ? `<p class="note">V profilu stranke manjka: ${miss.map(esc).join(", ")}. <a href="#/stranka/${stranka.id}/podatki">Dopolni profil</a></p>` : ""}
    <p class="mut">Podatki podjetja in obrata se prevzamejo iz profila stranke. Tu dodajte, kar je pomembno za HACCP načrt.</p>
    <table class="t"><tr><th style="width:30%">Podjetje</th><td>${esc(stranka.naziv)}, ${esc(stranka.naslov || "naslov ni vnesen")}</td></tr><tr><th>Odgovorna oseba</th><td>${esc(stranka.odgovorna_oseba || "ni vnesena")}</td></tr><tr><th>Obrat</th><td>${ob ? esc(ob.naziv + (ob.naslov ? ", " + ob.naslov : "")) : "ni izbran (izberite v osnovnih podatkih načrta)"}</td></tr><tr><th>Opis prostorov</th><td>${esc(ob ? ob.opis_prostorov || "ni vnesen" : "")}</td></tr></table>
    <div class="fgrid" style="margin-top:12px">${inp("zaposleni", "Število zaposlenih", { type: "number" })}${inp("delovni_cas", "Delovni čas / sezonskost")}${inp("kupci", "Kupci in ciljne skupine (npr. splošna populacija, otroci, bolniki)")}${inp("prodaja", "Način prodaje / distribucije")}${inp("obseg", "Obseg HACCP načrta (kaj pokriva)", { wide: 1, area: 1 })}${inp("posebnosti", "Posebnosti (nove tehnologije, sezonske ponudbe, dostava …)", { wide: 1, area: 1 })}${inp("hacc_ekipa", "HACCP skupina (člani in vloge)", { wide: 1, area: 1 })}<div class="wide" style="grid-column:1/-1"><label class="f"><span>Tloris, narisan v aplikaciji (vstavi se v dokumentacijo)</span><select id="tl_sel"><option value="">brez / uporabi naloženo sliko</option>${tlorisi.map(t => `<option value="${t.id}" ${Z.tloris_nacrt_id === t.id ? "selected" : ""}>${esc(t.naziv)}</option>`).join("")}</select></label><span class="mut">ali naložena slika tlorisa</span><div class="row" style="margin-top:4px"><input type="file" id="tl_f" accept="image/*" style="max-width:300px"><button class="btn ghost edit" id="tl_up">Naloži tloris</button><button class="btn ghost sec edit" id="tl_del">Odstrani</button><span id="tl_st" class="mut">${Z.tloris_id ? '<a href="/api/priloga/' + Z.tloris_id + '" target="_blank" rel="noopener">tloris je naložen</a>' : "ni naloženega"}</span></div></div></div></div>`;
    bindAll(el, Z);
    $("#tl_sel").onchange = e => { Z.tloris_nacrt_id = e.target.value; mark(); };
    $("#tl_up").onclick = async () => { const f = $("#tl_f").files[0]; if (!f) return toast("Izberite sliko.", true); try { const up = await uploadFile(f, rec.stranka_id, "tloris", rec.obrat_id || null); Z.tloris_id = up.id; mark(); toast("Tloris naložen (ne pozabite shraniti)"); s1(el); } catch (e) { fail(e); } };
    $("#tl_del").onclick = () => { delete Z.tloris_id; mark(); s1(el); };
  }

  // 2. dejavnost in živila
  function s2(el) {
    const al = (db.alergeni || []).map(a => a.naziv);
    el.innerHTML = `<div class="card"><h2>2. Dejavnost in živila</h2><div class="row"><label class="f" style="margin:0;min-width:280px"><span>Predloga dejavnosti (prilagodljiva)</span><select id="wb"><option value=""></option>${db.branze.map(b => `<option value="${b.id}" ${W.branza === b.id ? "selected" : ""}>${esc(b.naziv)}</option>`).join("")}</select></label><button class="btn ghost edit" id="wload">Naloži predlog korakov in nevarnosti</button></div>
    <p class="note info">Predlog iz baze znanja je izhodišče: korake in nevarnosti lahko dodajate, brišete in spreminjate. Naložene vrstice so označene kot »predlog« in zahtevajo vašo potrditev.</p>
    <h3>Živila / skupine živil</h3><div class="tw"><table class="t"><tr><th>Naziv</th><th>Skupina</th><th>Alergeni</th><th>RTE</th><th>Ciljna skupina</th><th>Shranjevanje, rok uporabe</th><th></th></tr>${W.zivila.map((z, i) => `<tr data-i="${i}"><td><input data-k="naziv"></td><td><input data-k="skupina"></td><td><input data-k="alergeni" list="al" placeholder="npr. mleko, jajca"></td><td><input type="checkbox" data-k="rte"></td><td><input data-k="ciljna"></td><td><input data-k="shranjevanje"></td><td><button class="btn sm ghost sec edit" data-del="${i}">✕</button></td></tr>`).join("") || '<tr><td colspan="7" class="empty">Dodajte živila.</td></tr>'}</table></div><datalist id="al">${al.map(a => `<option value="${esc(a)}">`).join("")}</datalist><div class="row" style="margin-top:8px"><button class="btn edit" id="zadd">+ Dodaj živilo</button></div></div>`;
    $$("tr[data-i]", el).forEach(tr => bindAll(tr, W.zivila[+tr.dataset.i]));
    $("#wb").onchange = e => { W.branza = e.target.value; mark(); };
    $("#zadd").onclick = () => { W.zivila.push({ id: uidc() }); mark(); s2(el); };
    $$("[data-del]", el).forEach(b => b.onclick = () => { W.zivila.splice(+b.dataset.del, 1); mark(); s2(el); });
    $("#wload").onclick = () => {
      const br = db.branze.find(b => b.id === W.branza); if (!br) return toast("Izberite dejavnost.", true);
      const apply = () => {
        W.koraki = br.koraki.map(n => ({ id: uidc(), naziv: n, tip: guessTip(n), predlog: true }));
        W.nevarnosti = (br.nevarnosti || []).map(h => ({ id: uidc(), korak_id: (W.koraki.find(k => k.naziv === h.faza) || {}).id || "", tip: ["B", "K", "F", "A"].includes(h.tip) ? h.tip : "D", nevarnost: h.nevarnost, obstojec: h.ukrep || "", verjetnost: "", teza: "", predlog: true, potrjeno: false }));
        W.kontrole = {}; mark(); toast("Predlog naložen: " + W.koraki.length + " korakov, " + W.nevarnosti.length + " nevarnosti. Verjetnost in težo ocenite sami."); step = 2; draw();
      };
      if (W.koraki.length || W.nevarnosti.length) confirmBox("Obstoječe korake in nevarnosti zamenjam s predlogom?", apply, true); else apply();
    };
  }
  const guessTip = n => { n = n.toLowerCase(); return /prevzem/.test(n) ? "prevzem" : /skladi/.test(n) ? "skladiščenje" : /toplotn|kuhan|peče|pečen|pasteriz/.test(n) ? "toplotna obdelava" : /hlaj/.test(n) ? "hlajenje" : /pakir/.test(n) ? "pakiranje" : /odprema|prodaj|izdaj|serv/.test(n) ? "prodaja / izdaja" : "priprava"; };

  // 3. procesni koraki
  function s3(el) {
    el.innerHTML = `<div class="grid g2"><div class="card"><h2>3. Procesni koraki</h2><p class="mut">Vrstni red določa diagram poteka. Korake dodajate, urejate, premikate in brišete.</p>${W.koraki.map((k, i) => `<div class="card" style="padding:10px;margin-bottom:8px" data-i="${i}"><div class="row" style="margin:0"><b style="min-width:26px">${i + 1}.</b><input data-k="naziv" placeholder="Naziv koraka" style="flex:1;min-width:160px"><select data-k="tip" style="max-width:160px">${KTIPI.map(t => `<option>${t}</option>`).join("")}</select><button class="btn sm ghost sec edit" data-up="${i}">↑</button><button class="btn sm ghost sec edit" data-dn="${i}">↓</button><button class="btn sm ghost sec edit" data-x="${i}">✕</button></div><input data-k="opis" placeholder="Opis (neobvezno)" style="margin-top:6px">${k.predlog ? '<small class="mut">predlog iz baze – potrdite ali popravite</small>' : ""}</div>`).join("") || '<p class="empty">Ni korakov. Naložite predlog (korak 2) ali dodajte ročno.</p>'}<button class="btn edit" id="kadd">+ Dodaj korak</button></div>
    <div class="card"><h2>Diagram poteka</h2><div class="flow">${W.koraki.map((k, i) => `${i ? '<div class="a">▼</div>' : ""}<div class="n" style="${(W.nevarnosti.some(h => h.korak_id === k.id) && Object.values(W.kontrole).some(c => c.vrsta === "CCP" && (W.nevarnosti.find(h => h.id === c.hid) || {}).korak_id === k.id)) ? "border-color:var(--bad)" : ""}">${i + 1}. ${esc(k.naziv || "(brez imena)")}</div>`).join("") || '<p class="empty">Diagram se izriše iz korakov.</p>'}</div><div class="row" style="margin-top:10px"><button class="btn ghost sec" id="dpdf">Diagram v PDF</button></div></div></div>`;
    $$("[data-i]", el).forEach(c => { const k = W.koraki[+c.dataset.i]; bindAll(c, k); $$("input[data-k=naziv]", c).forEach(i => i.addEventListener("change", () => { k.predlog = false; })); });
    $("#kadd").onclick = () => { W.koraki.push({ id: uidc(), naziv: "", tip: "priprava" }); mark(); s3(el); };
    $$("[data-x]", el).forEach(b => b.onclick = () => { const i = +b.dataset.x, k = W.koraki[i]; if (W.nevarnosti.some(h => h.korak_id === k.id) && !confirm("Korak ima povezane nevarnosti, ki bodo ostale brez koraka. Izbrišem?")) return; W.koraki.splice(i, 1); mark(); s3(el); });
    $$("[data-up]", el).forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i) { [W.koraki[i - 1], W.koraki[i]] = [W.koraki[i], W.koraki[i - 1]]; mark(); s3(el); } });
    $$("[data-dn]", el).forEach(b => b.onclick = () => { const i = +b.dataset.dn; if (i < W.koraki.length - 1) { [W.koraki[i + 1], W.koraki[i]] = [W.koraki[i], W.koraki[i + 1]]; mark(); s3(el); } });
    $("#dpdf").onclick = () => dlBlob(pdfBuild({ naslov: "Diagram poteka – " + rec.naziv, stranka: stranka.naziv, verzija: rec.verzija_oznaka || "1.0" }, d => { d.h(1, "Diagram poteka"); d.flow(W.koraki.map((k, i) => ({ n: i + 1, t: k.naziv, ccp: ccpAt(k.id), tag: ccpAt(k.id) ? "CCP" : "" }))); }), "diagram-poteka.pdf");
  }
  const ccpAt = kid => Object.values(W.kontrole).some(c => c.vrsta === "CCP" && (W.nevarnosti.find(h => h.id === c.hid) || {}).korak_id === kid);

  // 4. analiza nevarnosti
  function s4(el) {
    const M = W.metoda;
    el.innerHTML = `<div class="card"><h2>4. Analiza nevarnosti</h2>
    <details><summary><b>Metodologija ocene tveganja</b> (privzeta, prilagodljiva – potrdi strokovnjak)</summary><p>Tveganje = verjetnost (1–5) × teža posledic (1–5). Razredi: nizko ≤ <input type="number" data-k="nizko_do" style="width:70px;display:inline-block">, srednje ≤ <input type="number" data-k="srednje_do" style="width:70px;display:inline-block">, visoko nad tem. Pomembne nevarnosti (srednje in visoko) obravnavate v koraku 5. Verjetnost: ${M.verjetnost.join("; ")}. Teža: ${M.teza.join("; ")}. Metodologija se izpiše v dokumentaciji.</p></details>
    <p class="note info">Vrstice z oznako »predlog« so izhodišče iz baze znanja. Ocene verjetnosti in teže niso vnaprej določene – vnesete jih za konkretni obrat. Potrdite vsako vrstico.</p>
    <div class="row"><button class="btn edit" id="hadd">+ Dodaj nevarnost</button><button class="btn ghost sec edit" id="hok">Potrdi vse predloge</button></div>
    <div class="tw"><table class="t"><thead><tr><th>Korak</th><th>Vrsta</th><th>Nevarnost</th><th>Obstoječi ukrepi</th><th>V</th><th>T</th><th>Tveganje</th><th>Stanje</th></tr></thead><tbody>${W.nevarnosti.map(h => { const r = rizik(h); return `<tr class="click" data-h="${h.id}"><td>${num(h.korak_id)} ${esc(korakIme(h.korak_id))}</td><td>${esc(HTIPI[h.tip] || h.tip)}</td><td>${esc(h.nevarnost)}</td><td>${esc((h.obstojec || "").slice(0, 80))}</td><td>${h.verjetnost || "?"}</td><td>${h.teza || "?"}</td><td>${r ? `<span class="badge ${r <= M.nizko_do ? "ok" : r <= M.srednje_do ? "warn" : "bad"}">${r} ${rizikRazred(r, M)}</span>` : '<span class="badge">neocenjeno</span>'}</td><td>${h.predlog && !h.potrjeno ? '<span class="badge warn">predlog</span>' : '<span class="badge ok">potrjeno</span>'}</td></tr>`; }).join("") || '<tr><td colspan="8" class="empty">Ni nevarnosti.</td></tr>'}</tbody></table></div></div>`;
    bindAll($("details", el), M);
    $("#hadd").onclick = () => hazForm(null, () => s4(el));
    $("#hok").onclick = () => { W.nevarnosti.forEach(h => { if (h.predlog) h.potrjeno = true; }); mark(); s4(el); };
    $$("tr[data-h]", el).forEach(tr => tr.onclick = () => hazForm(W.nevarnosti.find(h => h.id === tr.dataset.h), () => s4(el)));
  }
  function hazForm(h, done) {
    const isNew = !h; h = h || { id: uidc(), korak_id: "", tip: "B" };
    const fl = [["korak_id", "Korak", "sel", W.koraki.map((k, i) => [k.id, (i + 1) + ". " + k.naziv])], ["tip", "Vrsta nevarnosti", "sel", Object.entries(HTIPI)], ["nevarnost", "Nevarnost (opis)", "area"], ["vir", "Vir nevarnosti", "area"], ["posledica", "Možna posledica", "area"], ["obstojec", "Obstoječi ukrepi", "area"], ["verjetnost", "Verjetnost (1–5)", "sel", W.metoda.verjetnost.map((x, i) => [i + 1, x])], ["teza", "Teža posledic (1–5)", "sel", W.metoda.teza.map((x, i) => [i + 1, x])], ["dodatni", "Dodatni ukrepi", "area"], ["odgovoren", "Odgovorna oseba"], ["preverjanje", "Preverjanje (verifikacija)"]];
    const html = `<div class="fgrid">${fl.map(([k, l, t, o]) => `<label class="f ${t === "area" ? "wide" : ""}"><span>${l}</span>${t === "area" ? `<textarea data-k="${k}"></textarea>` : t === "sel" ? `<select data-k="${k}"><option value=""></option>${o.map(x => `<option value="${esc(x[0])}">${esc(x[1])}</option>`).join("")}</select>` : `<input data-k="${k}">`}</label>`).join("")}</div><div id="rr"></div>${h.predlog ? `<label class="f"><input type="checkbox" data-k="potrjeno"> Predlog sem pregledal in potrjujem</label>` : ""}`;
    const copy = Object.assign({}, h);
    const d = modal(isNew ? "Nova nevarnost" : "Nevarnost", html, [{ t: "Prekliči", cls: "ghost sec" }, ...(!isNew && editable ? [{ t: "Izbriši", cls: "danger", fn: () => { W.nevarnosti = W.nevarnosti.filter(x => x.id !== h.id); delete W.kontrole[h.id]; mark(); done(); } }] : []), { t: "Shrani", fn: () => {
      if (!copy.nevarnost) { toast("Vnesite opis nevarnosti.", true); return false; }
      if (!isNew && (copy.nevarnost !== h.nevarnost)) copy.predlog = copy.predlog;
      Object.assign(h, copy); if (isNew) W.nevarnosti.push(h); mark(); done();
    } }]);
    bindAll(d, copy); const live = () => { const r = rizik(copy); $("#rr", d).innerHTML = r ? `Tveganje: <b>${r}</b> (${rizikRazred(r, W.metoda)})` : '<span class="mut">Vnesite verjetnost in težo.</span>'; };
    d.querySelectorAll("[data-k]").forEach(i => i.addEventListener("input", live)); live();
    if (!editable) d.querySelectorAll("input,select,textarea").forEach(e => e.disabled = true);
  }

  // 5. kontrolni ukrepi (PRP / OPRP / CCP)
  function s5(el) {
    const sig = W.nevarnosti.filter(h => rizik(h) > W.metoda.nizko_do);
    const unr = W.nevarnosti.filter(h => !rizik(h)).length;
    el.innerHTML = `<div class="card"><h2>5. Kontrolni ukrepi</h2>
    <p class="note info"><b>PRP</b> = predpogojni program (splošna higiena), <b>OPRP</b> = operativni predpogojni program (specifičen ukrep z merili), <b>CCP</b> = kritična kontrolna točka (zadnji korak nadzora, mejne vrednosti, spremljanje, korektivni ukrepi). Odločitveno drevo daje samo <b>predlog</b>; vrsto ukrepa vedno izberete vi. Ni vsak temperaturni nadzor CCP.</p>
    ${unr ? `<p class="note">${unr} nevarnosti še nima ocene tveganja (korak 4).</p>` : ""}
    <div class="tw"><table class="t"><thead><tr><th>Korak</th><th>Nevarnost</th><th>Tveganje</th><th>Vrsta ukrepa</th><th>Ukrep / opis</th><th></th></tr></thead><tbody>${sig.map(h => { const c = W.kontrole[h.id] || {}; return `<tr data-h="${h.id}"><td>${num(h.korak_id)} ${esc(korakIme(h.korak_id))}</td><td>${esc(h.nevarnost)}</td><td><span class="badge ${rizikRazred(rizik(h), W.metoda) === "visoko" ? "bad" : "warn"}">${rizikRazred(rizik(h), W.metoda)}</span></td><td>${c.vrsta ? `<span class="badge ${c.vrsta === "CCP" ? "bad" : c.vrsta === "OPRP" ? "warn" : "info"}">${c.vrsta}</span>` : '<span class="badge">ni izbrano</span>'}${c.vrsta === "CCP" && (c.mejna_predlog || CCPPOL.some(k => !c[k])) ? ' <span class="badge warn">potrebna strokovna potrditev</span>' : ""}</td><td>${esc((c.ukrep || h.obstojec || "").slice(0, 90))}</td><td><button class="btn sm edit" data-o="${h.id}">Uredi</button></td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">Ni pomembnih nevarnosti (ocenite tveganje v koraku 4).</td></tr>'}</tbody></table></div></div>`;
    $$("[data-o]", el).forEach(b => b.onclick = () => ctrlForm(W.nevarnosti.find(h => h.id === b.dataset.o), () => s5(el)));
  }
  function ctrlForm(h, done) {
    const c = Object.assign({ hid: h.id }, W.kontrole[h.id] || {});
    const reg = (db.rezimi || []).map(r => [r.naziv + " (" + r.od + " do " + r.do + " °C)", r.naziv + ": " + r.od + " do " + r.do + " °C"]);
    const html = `<p><b>${esc(h.nevarnost)}</b><br><span class="mut">Korak: ${esc(korakIme(h.korak_id))} · tveganje ${rizik(h)} (${rizikRazred(rizik(h), W.metoda)})</span></p>
    <details><summary><b>Odločitveno drevo (predlog)</b></summary><div id="dt">${["Ali na tem koraku že obstaja ukrep za obvladovanje te nevarnosti?", "Ali je ta korak posebej namenjen odstranitvi ali zmanjšanju nevarnosti na sprejemljivo raven?", "Ali bi lahko onesnaženje preseglo sprejemljive ravni ali se povečalo do nesprejemljivih ravni?", "Ali bo naslednji korak odstranil ali zmanjšal nevarnost na sprejemljivo raven?"].map((q, i) => `<label class="f"><span>V${i + 1}: ${q}</span><select data-q="${i}"><option value=""></option><option value="d">Da</option><option value="n">Ne</option></select></label>`).join("")}<div id="dtres" class="note info">Odgovorite na vprašanja.</div></div></details>
    <div class="fgrid"><label class="f req"><span>Vrsta ukrepa (izberete vi)</span><select data-k="vrsta"><option value=""></option><option>PRP</option><option>OPRP</option><option>CCP</option><option value="nobeno">Ni potreben dodaten nadzor</option></select></label>
    <label class="f wide"><span>Utemeljitev izbire</span><textarea data-k="utemeljitev"></textarea></label><label class="f wide"><span>Ukrep za obvladovanje / opis</span><textarea data-k="ukrep"></textarea></label>
    <div id="ccpf" class="wide fgrid" style="grid-column:1/-1"><p class="note wide">Za CCP in OPRP izpolnite spodaj. <b>Mejnih vrednosti ne predpisuje program</b>: vnesite jih sami ali uporabite predlog iz baze in ga strokovno potrdite.</p>
    <label class="f wide"><span>Kaj se nadzoruje</span><input data-k="kaj"></label><label class="f"><span>Mejna vrednost / merilo</span><input data-k="mejna"></label><label class="f"><span>Predlog iz baze režimov (neobvezno)</span><select id="regsel"><option value=""></option>${reg.map(r => `<option value="${esc(r[1])}">${esc(r[0])}</option>`).join("")}</select></label><label class="f wide"><span>Utemeljitev mejne vrednosti (vir)</span><textarea data-k="mejna_vir"></textarea></label>
    <label class="f"><span>Način spremljanja</span><input data-k="spremljanje"></label><label class="f"><span>Pogostost</span><input data-k="pogostost"></label><label class="f"><span>Odgovorna oseba</span><input data-k="odgovoren"></label><label class="f"><span>Povezane evidence</span><select data-k="evidenca">${[""].concat(Object.entries(EV).map(([k, v]) => k)).map(k => `<option value="${k}">${k ? EV[k].ime : ""}</option>`).join("")}</select></label>
    <label class="f wide"><span>Korektivni ukrepi ob preseganju</span><textarea data-k="korektivni"></textarea></label><label class="f wide"><span>Verifikacija</span><textarea data-k="verifikacija"></textarea></label></div></div>`;
    const d = modal("Kontrolni ukrep", html, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Shrani", fn: () => {
      if (!c.vrsta) { toast("Izberite vrsto ukrepa.", true); return false; }
      if (c.vrsta === "CCP") { const miss = ["kaj", "mejna", "mejna_vir", "spremljanje", "pogostost", "odgovoren", "korektivni", "verifikacija"].filter(k => !c[k]); if (miss.length && !confirm("Pri CCP manjkajo polja (" + miss.length + "). Shranim kot nepopolno? Dokument bo označen »potrebna strokovna potrditev«.")) return false; }
      W.kontrole[h.id] = c; mark(); done();
    } }]);
    bindAll(d, c);
    $("#regsel", d).onchange = e => { if (e.target.value) { $("[data-k=mejna]", d).value = c.mejna = e.target.value; c.mejna_predlog = true; if (!c.mejna_vir) { c.mejna_vir = "Predlog iz baze znanja (temperaturni režimi) – potrebna strokovna potrditev."; $("[data-k=mejna_vir]", d).value = c.mejna_vir; } mark(); } };
    const dt = () => { const a = $$("[data-q]", d).map(s => s.value); let r = "Odgovorite na vprašanja."; if (a[0] === "n") r = "V1 = Ne: uvedite ali spremenite ukrep na tem koraku/procesu; šele nato presodite razvrstitev."; else if (a[1] === "d") r = "Predlog: možna CCP (korak je namenjen obvladovanju nevarnosti). Presodite sami."; else if (a[1] === "n" && a[2] === "n") r = "Predlog: ni CCP – PRP ali OPRP."; else if (a[2] === "d" && a[3] === "d") r = "Predlog: ni CCP na tem koraku (nadzor na naslednjem koraku) – PRP ali OPRP."; else if (a[2] === "d" && a[3] === "n") r = "Predlog: možna CCP. Presodite sami."; $("#dtres", d).textContent = r; };
    $$("[data-q]", d).forEach(s => s.onchange = dt);
    if (!editable) d.querySelectorAll("input,select,textarea").forEach(e => e.disabled = true);
  }

  // 6. pregled osnutka
  function warnings() {
    const w = [];
    if (!W.koraki.length) w.push("Ni procesnih korakov.");
    if (!W.nevarnosti.length) w.push("Ni analize nevarnosti.");
    const pr = W.nevarnosti.filter(h => h.predlog && !h.potrjeno).length; if (pr) w.push(pr + " nevarnosti je še neprevrjenih predlogov.");
    const un = W.nevarnosti.filter(h => !rizik(h)).length; if (un) w.push(un + " nevarnosti nima ocene tveganja.");
    const sig = W.nevarnosti.filter(h => rizik(h) > W.metoda.nizko_do), nc = sig.filter(h => !(W.kontrole[h.id] || {}).vrsta).length; if (nc) w.push(nc + " pomembnih nevarnosti nima izbrane vrste kontrolnega ukrepa.");
    const ccpNep = Object.values(W.kontrole).filter(c => c.vrsta === "CCP" && ["kaj", "mejna", "mejna_vir", "spremljanje", "pogostost", "odgovoren", "korektivni", "verifikacija"].some(k => !c[k])).length; if (ccpNep) w.push(ccpNep + " CCP je nepopolnih (mejne vrednosti, spremljanje, korektivni ukrepi …).");
    const pm = Object.values(W.kontrole).filter(c => c.mejna_predlog).length; if (pm) w.push(pm + " mejnih vrednosti je predlog iz baze in zahteva strokovno potrditev.");
    if (!W.zivila.length) w.push("Niso vnesena živila.");
    if (!rec.obrat_id) w.push("Načrt ni povezan z obratom.");
    return w;
  }
  function s6(el) {
    const w = warnings(), P = W.pregled, B = W.besedila;
    el.innerHTML = `<div class="card"><h2>6. Pregled osnutka</h2>${w.length ? `<div class="note"><b>Pred potrditvijo:</b><ul style="margin:6px 0 0">${w.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : '<p class="note info">Osnutek ni vseboval opaženih vrzeli. Strokovni pregled je vseeno obvezen.</p>'}
    <p class="mut">Osnutek lahko urejate pred izvozom. Tekst spodaj se vključi v dokument.</p>
    <div class="fgrid">${inp("uvod", "Uvodno besedilo dokumenta", { wide: 1, area: 1 })}${inp("opombe", "Dodatne opombe", { wide: 1, area: 1 })}</div>
    <h3>Strokovna potrditev</h3><p class="mut">Končni HACCP načrt mora pregledati in potrditi odgovorna oseba / strokovnjak. Potrditev vpišete tukaj; stanje načrta spremenite v osnovnih podatkih.</p>
    <div class="fgrid">${inp("potrdil", "Strokovno potrdil (ime, funkcija)")}${inp("datum", "Datum potrditve", { type: "date" })}${inp("komentar", "Komentar pregledovalca", { wide: 1, area: 1 })}</div>
    <h3>Povzetek</h3><table class="t"><tr><td>Koraki</td><td>${W.koraki.length}</td></tr><tr><td>Nevarnosti</td><td>${W.nevarnosti.length} (pomembnih ${W.nevarnosti.filter(h => rizik(h) > W.metoda.nizko_do).length})</td></tr><tr><td>PRP / OPRP / CCP</td><td>${["PRP", "OPRP", "CCP"].map(t => Object.values(W.kontrole).filter(c => c.vrsta === t).length).join(" / ")}</td></tr></table></div>`;
    const bs = el.querySelectorAll("[data-k]"); bs.forEach(i => { const k = i.dataset.k, tgt = ["uvod", "opombe"].includes(k) ? B : P; i.value = tgt[k] || ""; i.oninput = () => { tgt[k] = i.value; mark(); }; });
  }

  // 7. izvoz
  function pglEditor(el) {
    const P = W.poglavja, nm = i => (PGL_DEF.find(d => d[0] === P[i].id) || [])[1];
    el.innerHTML = `<h3>Poglavja dokumentacije</h3><p class="mut">Poglavja lahko vključite ali izključite, preimenujete, premaknete in dodate svoja. Številke se v dokumentu prištejejo samodejno.</p><div class="tw"><table class="t"><tr><th>Vključi</th><th>Naslov</th><th>Besedilo (lastna poglavja)</th><th></th></tr>${P.map((c, i) => `<tr data-i="${i}"><td><input type="checkbox" data-k="on"></td><td><input data-k="naslov"></td><td>${c.custom ? '<textarea data-k="besedilo" style="min-height:60px"></textarea>' : '<span class="mut">samodejno iz podatkov načrta</span>'}</td><td style="white-space:nowrap"><button class="btn sm ghost sec edit" data-up="${i}">↑</button> <button class="btn sm ghost sec edit" data-dn="${i}">↓</button> ${c.custom ? `<button class="btn sm ghost sec edit" data-x="${i}">✕</button>` : ""}</td></tr>`).join("")}</table></div><div class="row" style="margin-top:8px"><button class="btn ghost edit" id="padd">+ Dodaj lastno poglavje</button><button class="btn ghost sec edit" id="preset">Ponastavi poglavja</button></div>`;
    $$("tr[data-i]", el).forEach(tr => bindAll(tr, P[+tr.dataset.i]));
    $("#padd").onclick = () => { P.splice(Math.max(0, P.length - 1), 0, { id: "x" + uidc(), custom: true, on: true, naslov: "Novo poglavje", besedilo: "" }); mark(); pglEditor(el); };
    $("#preset").onclick = () => confirmBox("Ponastavim poglavja na privzeta (lastna poglavja bodo odstranjena)?", () => { W.poglavja = poglavjaCfg({}); mark(); pglEditor(el); }, true);
    $$("[data-up]", el).forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i) { [P[i - 1], P[i]] = [P[i], P[i - 1]]; mark(); pglEditor(el); } });
    $$("[data-dn]", el).forEach(b => b.onclick = () => { const i = +b.dataset.dn; if (i < P.length - 1) { [P[i + 1], P[i]] = [P[i], P[i + 1]]; mark(); pglEditor(el); } });
    $$("[data-x]", el).forEach(b => b.onclick = () => { P.splice(+b.dataset.x, 1); mark(); pglEditor(el); });
    if (!editable) $$("input,textarea,button", el).forEach(e => e.disabled = true);
  }
  function s7(el) {
    W.poglavja = poglavjaCfg(W);
    el.innerHTML = `<div id="pgl" class="card"></div><div class="card"><h2>7. Izvoz dokumentacije</h2>${rec.status !== "potrjeno" ? '<p class="note">Načrt še ni potrjen – dokument bo označen kot OSNUTEK.</p>' : ""}${warnings().length ? '<p class="note">Odprte vrzeli iz koraka 6 bodo navedene v dokumentu.</p>' : ""}
    <div class="row"><button class="btn" id="xpdf">PDF dokumentacija (HiGiFood)</button><button class="btn" id="xdoc">Word (.docx, urejljivo)</button><button class="btn ghost sec" id="xxl">Excel (nevarnosti in ukrepi)</button><button class="btn ghost sec" id="xnav">PDF / Word posameznega navodila …</button></div>
    <p class="mut">Dokument vsebuje naslovnico, kazalo, številke strani, različico in datum. Ne pomeni uradne odobritve in ne zagotavlja samodejne skladnosti z zakonodajo.</p></div>`;
    pglEditor($("#pgl"));
    $("#xpdf").onclick = async () => { try { const navodila = await D.list("navodila", { stranka_id: rec.stranka_id }); const ex = { tloris: await tlorisForPlan(W) }; dlBlob(buildHaccpPdf(rec, W, stranka, obrati, navodila, db, warnings(), undefined, ex), "HACCP-" + stranka.naziv + ".pdf"); } catch (e) { fail(e); } };
    $("#xdoc").onclick = async () => { try { const navodila = await D.list("navodila", { stranka_id: rec.stranka_id }); const ex = { tloris: await tlorisForPlan(W) }; dlBlob(buildHaccpPdf(rec, W, stranka, obrati, navodila, db, warnings(), "docx", ex), "HACCP-" + stranka.naziv + ".docx"); } catch (e) { fail(e); } };
    $("#xxl").onclick = () => downloadXlsx("HACCP-analiza-" + stranka.naziv + ".xlsx", [
      { ime: "Koraki", glava: ["Št.", "Korak", "Vrsta", "Opis"], vrste: W.koraki.map((k, i) => [i + 1, k.naziv, k.tip, k.opis || ""]) },
      { ime: "Analiza nevarnosti", glava: ["Korak", "Vrsta", "Nevarnost", "Vir", "Posledica", "Obstoječi ukrepi", "Verjetnost", "Teža", "Tveganje", "Razred", "Dodatni ukrepi", "Odgovoren", "Preverjanje", "Stanje"], vrste: W.nevarnosti.map(h => [korakIme(h.korak_id), HTIPI[h.tip] || h.tip, h.nevarnost, h.vir || "", h.posledica || "", h.obstojec || "", +h.verjetnost || "", +h.teza || "", rizik(h) || "", rizik(h) ? rizikRazred(rizik(h), W.metoda) : "", h.dodatni || "", h.odgovoren || "", h.preverjanje || "", h.predlog && !h.potrjeno ? "predlog" : "potrjeno"]) },
      { ime: "Kontrolni ukrepi", glava: ["Nevarnost", "Vrsta", "Kaj se nadzoruje", "Mejna vrednost", "Utemeljitev", "Spremljanje", "Pogostost", "Odgovoren", "Korektivni ukrepi", "Verifikacija"], vrste: Object.values(W.kontrole).map(c => { const h = W.nevarnosti.find(x => x.id === c.hid) || {}; return [h.nevarnost || "", c.vrsta, c.kaj || "", c.mejna || "", c.mejna_vir || "", c.spremljanje || "", c.pogostost || "", c.odgovoren || "", c.korektivni || "", c.verifikacija || ""]; }) }]);
    $("#xnav").onclick = async () => { const nav = await D.list("navodila", { stranka_id: rec.stranka_id }); if (!nav.length) return toast("Ni navodil.", true); modal("Izberi navodilo", `<select id="nsel" size="8" style="min-height:180px">${nav.map(n => `<option value="${n.id}">${esc(n.naslov)}</option>`).join("")}</select>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Word", cls: "ghost", fn: () => { const n = nav.find(x => x.id === $("#nsel").value); if (!n) return false; dlBlob(navodiloPdf(n, stranka, db, "docx"), "navodilo-" + n.naslov + ".docx"); } }, { t: "PDF", fn: () => { const n = nav.find(x => x.id === $("#nsel").value); if (!n) return false; dlBlob(navodiloPdf(n, stranka, db), "navodilo-" + n.naslov + ".pdf"); } }]); };
  }
  draw();
  window.onbeforeunload = null;
}
function navodiloPravno(d, n, db) {
  const p = (db.navodila_predloge || []).find(x => x.id === n.predloga); if (!p) return;
  const zv = zakoniVrstice(p, db); if (!zv.length) return;
  d.h(2, "Pravna podlaga (stanje baze znanja na dan izpisa)");
  d.bullets(zv.map(x => x.txt));
  const w = navodiloOpozorila(n, db); if (w.length) d.box("Opozorilo: " + w.join("; ") + ".", "r");
}
function navodiloPdf(n, stranka, db, fmt) {
  return (fmt === "docx" ? docxBuild : pdfBuild)({ naslov: n.naslov, stranka: stranka.naziv, verzija: n.verzija_oznaka || "1.0", stanje: n.status }, d => { d.h(1, n.naslov); String(n.vsebina || "").split("\n").forEach(l => { if (/^8\. PRAVNA/.test(l)) return; if (/^\d+\. [A-ZČŠŽĆĐ ]+$/.test(l)) d.h(2, l); else if (l.trim() && !/^- /.test(l)) d.p(l); else if (!l.trim()) d.gap(4); }); navodiloPravno(d, n, db); });
}

// PDF celotne dokumentacije (12 poglavij)
const PGL_DEF = [["podjetje", "Podatki o podjetju in obratu"], ["dejavnost", "Dejavnost in obseg"], ["zivila", "Opis živil"], ["diagram", "Diagram poteka"], ["metodologija", "Metodologija ocene tveganja"], ["nevarnosti", "Analiza nevarnosti"], ["ukrepi", "Kontrolni ukrepi (PRP, OPRP, CCP)"], ["ccp", "Kritične kontrolne točke – nadzorni list"], ["navodila", "Delovna navodila in predpogojni programi"], ["evidence", "Evidence in obrazci"], ["verifikacija", "Verifikacija in validacija"], ["potrditev", "Potrditev in zgodovina različic"], ["priloga", "Priloga: pravna podlaga"]];
// vrstni red, vključenost in lastna poglavja (shranjeno v načrtu: W.poglavja)
function poglavjaCfg(W) {
  const sv = Array.isArray(W.poglavja) ? W.poglavja : [], out = sv.filter(c => c.custom || PGL_DEF.some(d => d[0] === c.id)).map(c => Object.assign({ on: true }, c));
  for (const [id, naslov] of PGL_DEF) if (!out.some(c => c.id === id)) out.splice(Math.max(0, out.length - (id === "priloga" ? 0 : 0)), 0, { id, naslov, on: true });
  return out;
}
function buildHaccpPdf(rec, W, stranka, obrati, navodila, db, warn, fmt, ex) {
  const ob = obrati.find(o => o.id === rec.obrat_id), M = W.metoda, korak = id => (W.koraki.find(k => k.id === id) || {}).naziv || "–";
  const stat = rec.status === "potrjeno" ? "potrjeno" : "OSNUTEK – potrebna strokovna potrditev";

  const CHS = {
    podjetje: (d, H) => {
      d.h(1, H);
      d.table(["Podatek", "Vrednost"], [["Naziv", stranka.naziv], ["Naslov", stranka.naslov || ""], ["Matična / davčna št.", [stranka.maticna, stranka.davcna].filter(Boolean).join(" / ")], ["Odgovorna oseba", stranka.odgovorna_oseba || ""], ["Obrat", ob ? ob.naziv + (ob.naslov ? ", " + ob.naslov : "") : ""], ["Površina", ob && ob.povrsina ? ob.povrsina + " m²" : ""], ["Število zaposlenih", W.zbiranje.zaposleni || ""], ["Delovni čas", W.zbiranje.delovni_cas || ""]].filter(r => r[1] !== ""), [30, 70]);
      if (ex && ex.tloris) { d.p("Tloris obrata", { bold: true }); d.img(ex.tloris, 470, 330, "Tloris obrata"); }
    },
    dejavnost: (d, H) => {
      d.h(1, H);
      d.p(stranka.opis_dejavnosti || stranka.dejavnost || ""); if (W.zbiranje.obseg) d.p("Obseg načrta: " + W.zbiranje.obseg); if (W.zbiranje.kupci) d.p("Kupci in ciljne skupine: " + W.zbiranje.kupci); if (W.zbiranje.prodaja) d.p("Prodaja / distribucija: " + W.zbiranje.prodaja);
      if (ob) { d.h(2, "Opis obrata"); for (const [k, l] of [["opis_prostorov", "Prostori"], ["oprema_opis", "Oprema"], ["shranjevanje", "Shranjevanje"], ["priprava", "Priprava"], ["toplotna", "Toplotna obdelava / hlajenje"], ["pakiranje", "Pakiranje"], ["prodaja", "Prodaja"], ["ciscenje", "Čiščenje"], ["ddd", "DDD"], ["odpadki", "Odpadki"], ["voda", "Voda"]]) if (ob[k]) d.p(l + ": " + ob[k]); }
    },
    zivila: (d, H) => {
      d.h(1, H);
      d.table(["Živilo", "Skupina", "Alergeni", "RTE", "Ciljna skupina", "Shranjevanje"], W.zivila.map(z => [z.naziv, z.skupina, z.alergeni, z.rte ? "da" : "ne", z.ciljna, z.shranjevanje]), [22, 14, 20, 6, 16, 22]);
    },
    diagram: (d, H) => {
      d.h(1, H);
      d.flow(W.koraki.map((k, i) => ({ n: i + 1, t: k.naziv, ccp: Object.values(W.kontrole).some(c => c.vrsta === "CCP" && (W.nevarnosti.find(h => h.id === c.hid) || {}).korak_id === k.id), tag: Object.values(W.kontrole).some(c => c.vrsta === "CCP" && (W.nevarnosti.find(h => h.id === c.hid) || {}).korak_id === k.id) ? "CCP" : "" })));
    },
    metodologija: (d, H) => {
      d.h(1, H);
      d.p(`Tveganje = verjetnost × teža posledic (obe na lestvici 1–5). Razredi: nizko (≤ ${M.nizko_do}), srednje (≤ ${M.srednje_do}), visoko (nad ${M.srednje_do}). Pomembne nevarnosti so v razredu srednje in visoko.`); d.p("Verjetnost: " + M.verjetnost.join("; ")); d.p("Teža posledic: " + M.teza.join("; "));
      d.p("Razvrstitev kontrolnih ukrepov (PRP, OPRP, CCP) je izvedla odgovorna oseba z uporabo odločitvenega drevesa Codex Alimentarius kot pripomočka. Mejne vrednosti so navedene z virom; vrednosti, označene kot predlog, zahtevajo strokovno potrditev.");
    },
    nevarnosti: (d, H) => {
      d.h(1, H);
      d.table(["Korak", "Vrsta", "Nevarnost / vir", "Obstoječi ukrepi", "V×T", "Razred", "Dodatni ukrepi"], W.nevarnosti.map(h => [korak(h.korak_id), HTIPI[h.tip] || h.tip, h.nevarnost + (h.vir ? " (vir: " + h.vir + ")" : ""), h.obstojec || "", rizik(h) ? (h.verjetnost + "×" + h.teza + "=" + rizik(h)) : "?", rizik(h) ? rizikRazred(rizik(h), M) : "neocenjeno", (h.dodatni || "") + (h.odgovoren ? " [" + h.odgovoren + "]" : "") + (h.predlog && !h.potrjeno ? " (predlog)" : "")]), [14, 9, 26, 22, 7, 8, 14]);
    },
    ukrepi: (d, H) => {
      d.h(1, H);
      d.table(["Nevarnost", "Vrsta", "Ukrep / utemeljitev"], Object.values(W.kontrole).map(c => { const h = W.nevarnosti.find(x => x.id === c.hid) || {}; return [(korak(h.korak_id)) + ": " + (h.nevarnost || ""), c.vrsta === "nobeno" ? "ni potreben" : c.vrsta, [c.ukrep, c.utemeljitev].filter(Boolean).join(" – ")]; }), [40, 10, 50]);
    },
    ccp: (d, H) => {
      d.h(1, H);
      const ccps = Object.values(W.kontrole).filter(c => c.vrsta === "CCP" || c.vrsta === "OPRP");
      if (!ccps.length) d.p("Kritične kontrolne točke ali OPRP niso določene.");
      ccps.forEach((c, i) => { const h = W.nevarnosti.find(x => x.id === c.hid) || {}; d.h(2, `${c.vrsta} ${i + 1}: ${korak(h.korak_id)}`); d.table(["Postavka", "Vsebina"], [["Nevarnost", h.nevarnost], ["Kaj se nadzoruje", c.kaj], ["Mejna vrednost / merilo", (c.mejna || "ni določeno – potrebna strokovna potrditev") + (c.mejna_predlog ? " (predlog iz baze)" : "")], ["Utemeljitev", c.mejna_vir], ["Spremljanje", c.spremljanje], ["Pogostost", c.pogostost], ["Odgovorna oseba", c.odgovoren], ["Korektivni ukrepi", c.korektivni], ["Verifikacija", c.verifikacija], ["Povezane evidence", c.evidenca ? (EV[c.evidenca] || {}).ime : ""]].filter(r => r[1]), [28, 72]); });
    },
    navodila: (d, H) => {
      d.h(1, H);
      if (navodila.length) { d.table(["Navodilo", "Vrsta", "Različica", "Stanje"], navodila.map(n => [n.naslov, n.vrsta, n.verzija_oznaka, n.status]), [50, 20, 12, 18]); navodila.forEach(n => { d.h(2, n.naslov); String(n.vsebina || "").split("\n").forEach(l => { if (l.trim() && !/^8\. PRAVNA/.test(l) && !(/^- /.test(l) && /preverjeno|RAZVELJAVLJEN|ni več v bazi/.test(l))) d.p(l, { size: 9, gap: 1 }); }); navodiloPravno(d, n, db); }); } else d.p("Navodila še niso dodana.");
    },
    evidence: (d, H) => {
      d.h(1, H);
      const ev = new Set(Object.values(W.kontrole).map(c => c.evidenca).filter(Boolean));
      d.p("Evidence se vodijo digitalno v sistemu HiGiFood (čas in uporabnik se beležita samodejno, popravki so sledljivi)." + (ev.size ? " Povezane evidence: " + [...ev].map(k => (EV[k] || {}).ime).join(", ") + "." : ""));
    },
    verifikacija: (d, H) => {
      d.h(1, H);
      d.p(W.pregled.komentar || "Verifikacija (notranje preverjanje evidenc, notranje presoje, preverjanje merilnih instrumentov) in validacija ukrepov se izvajata po internem programu. Podrobnosti vpiše odgovorna oseba."); if (W.besedila.opombe) d.p(W.besedila.opombe);
    },
    potrditev: (d, H) => {
      d.h(1, H);
      d.table(["Podatek", "Vrednost"], [["Stanje načrta", stat], ["Strokovno potrdil", W.pregled.potrdil || "ni potrjeno"], ["Datum potrditve", W.pregled.datum ? fdate(W.pregled.datum) : ""], ["Različica", rec.verzija_oznaka || "1.0"], ["Številka zapisa (revizije)", rec.verzija]], [30, 70]);
      if (rec.revizije && rec.revizije.length) d.table(["Ver.", "Kdaj", "Kdo", "Razlog"], rec.revizije.slice(-12).map(r => [r.n, fdt(r.cas), r.ime, r.razlog || ""]), [8, 22, 22, 48]);
    },
    priloga: (d, H) => {
      d.h(1, H);
      d.p("Seznam predpisov iz baze znanja z datumom zadnjega preverjanja. Pred uporabo preverite aktualno veljavnost v uradnih virih (EUR-Lex, PISRS).", { size: 9 });
      const tags = new Set(["*", W.branza]); const zak = (db.zakonodaja || []).filter(z => z.status !== "razveljavljen" && (z.oznake || []).some(o => tags.has(o)));
      d.table(["Predpis", "Vsebina", "Preverjeno"], zak.slice(0, 60).map(z => [z.predpis, (z.vsebina || "").slice(0, 120), z.preverjeno ? fdate(z.preverjeno) : "ni preverjeno"]), [38, 50, 12]);
    },
  };
  const cfg = poglavjaCfg(W).filter(c => c.on);
  return (fmt === "docx" ? docxBuild : pdfBuild)({ naslov: "HACCP načrt: " + rec.naziv, podnaslov: ob ? ob.naziv : "", stranka: stranka.naziv, verzija: rec.verzija_oznaka || "1.0", avtor: ME.u.ime, stanje: stat }, d => {
    if (W.besedila.uvod) d.p(W.besedila.uvod);
    if (warn.length) d.box("Odprte vrzeli osnutka: " + warn.join(" "), "w");
    let n = 0;
    for (const c of cfg) {
      const pr = c.id === "priloga"; if (!pr) n++;
      const H = (pr ? "" : n + ". ") + c.naslov;
      if (c.custom) { d.h(1, H); String(c.besedilo || "").split("\n").forEach(l => { if (l.trim()) d.p(l); else d.gap(4); }); }
      else CHS[c.id](d, H);
    }
  });
}
route(/^\/carovnik\/([\w-]+)$/, pageCarovnik, "Čarovnik HACCP", "stranke");
