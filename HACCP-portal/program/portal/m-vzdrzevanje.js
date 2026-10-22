// Prvi koraki in opozorila na nadzorni plošči, vzdrževanje (stanje sistema, preizkus obnove),
// varstvo osebnih podatkov (izvoz, anonimizacija, roki hrambe, pogodba o obdelavi, evidenca obdelav) in strokovni pregled baze znanja.
const fb = n => n == null ? "–" : n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " kB";
const skrito = k => { try { return localStorage.getItem("skrij_" + k + "_" + (ME.u || {}).id) === "1"; } catch { return false; } };
const skrij = k => { try { localStorage.setItem("skrij_" + k + "_" + ME.u.id, "1"); } catch {} };

// ---------- nadzorna plošča: prvi koraki, opozorila sistema ----------
async function dashDodatki(v, d) {
  const u0 = ME.u; if (!u0) return;
  const kartice = [];
  if (u0.vloga === "admin" && !ME.real) {
    const s = await api("GET", "/api/sistem").catch(() => null);
    if (s && s.opozorila.length) kartice.push(`<div class="note" style="border-left:4px solid var(--bad)"><b>Opozorila sistema:</b><ul style="margin:6px 0 0">${s.opozorila.map(o => `<li>${esc(o)}</li>`).join("")}</ul><a href="#/vzdrzevanje">Odpri vzdrževanje</a></div>`);
  }
  if (u0.vloga === "zaposleni") {
    if (!skrito("pomoc")) kartice.push(`<div class="note info" id="pk"><b>Kako vnesem zapis?</b> Odprite <a href="#/danes">Danes (opravila)</a> in kliknite <i>Vnesi</i> pri opravilu, ali skenirajte kodo QR na napravi. Za neskladnost uporabite zavihek <i>Neskladnosti / CAPA</i>. Če kaj ne deluje: <i>Prijavi napako</i> (levo spodaj). <button class="btn sm ghost sec" data-skrij="pomoc">Razumem</button></div>`);
  } else if (!skrito("prvi")) {
    const st = d.stranke, us = await api("GET", "/api/uporabniki").catch(() => []), sis = u0.vloga === "admin" ? await api("GET", "/api/sistem").catch(() => null) : null;
    const urnik = await D.list("urnik").catch(() => []);
    const k = [
      ["Ustvarite stranko (podjetje) in obrat", st.length > 0 && d.obrati.length > 0, "#/stranke"],
      ["Vnesite opremo z mejnimi vrednostmi (hladilniki …)", d.oprema.length > 0, st[0] ? `#/stranka/${st[0].id}/oprema` : "#/stranke"],
      ["Vnesite zaposlene in usposabljanja", d.osebje.length > 0, st[0] ? `#/stranka/${st[0].id}/osebje` : "#/stranke"],
      ["Določite pogostost vnosov (urnik evidenc)", urnik.length > 0, st[0] ? `#/stranka/${st[0].id}/evidence` : "#/stranke"],
      ["Pripravite načrt čiščenja", d.ciscenje_nacrt.length > 0, st[0] ? `#/stranka/${st[0].id}/higiena` : "#/stranke"],
      ["Izdelajte HACCP načrt (čarovnik)", d.nacrti.length > 0, st[0] ? `#/stranka/${st[0].id}/nacrti` : "#/stranke"],
      ["Dodajte uporabnike stranke (odgovorna oseba, zaposleni)", us.some(u => u.vloga === "odgovorna" || u.vloga === "zaposleni"), "#/uporabniki"],
      ["Vklopite dvostopenjsko prijavo za svoj račun", !!u0.totp, null, "mojRacun"],
      ...(sis ? [["Nastavite kopijo v zunanjo mapo (USB, OneDrive …)", !!(sis.kopija_zunaj && sis.kopija_zunaj.ok), "#/admin"], ["Preizkusite obnovo iz varnostne kopije", !!(sis.preizkus_obnove && sis.preizkus_obnove.ok), "#/vzdrzevanje"]] : [])
    ];
    const opr = k.filter(x => x[1]).length;
    if (opr < k.length) kartice.push(`<div class="card" id="pk"><div class="row" style="margin:0"><h2 style="margin:0">Prvi koraki</h2><span class="sp"></span><span class="mut">${opr} od ${k.length}</span><button class="btn sm ghost sec" data-skrij="prvi">Skrij</button></div><ol style="margin:8px 0 0;padding-left:20px">${k.map(x => `<li style="margin:4px 0">${x[1] ? "<s class='mut'>" + esc(x[0]) + "</s> ✓" : x[3] ? `<a href="#" data-akc="${x[3]}">${esc(x[0])}</a>` : `<a href="${x[2]}">${esc(x[0])}</a>`}</li>`).join("")}</ol></div>`);
  }
  if (!kartice.length || ME.u !== u0 || !v.isConnected) return; // med nalaganjem odjava ali drug zaslon
  v.insertAdjacentHTML("afterbegin", kartice.join(""));
  $$("[data-skrij]", v).forEach(b => b.onclick = () => { skrij(b.dataset.skrij); $("#pk").remove(); });
  $$("[data-akc=mojRacun]", v).forEach(a => a.onclick = e => { e.preventDefault(); mojRacun(); });
}

// ---------- vzdrževanje ----------
async function pageVzdrzevanje(v) {
  const s = await api("GET", "/api/sistem");
  const pr = s.preizkus_obnove;
  v.innerHTML = `${s.opozorila.length ? `<div class="note" style="border-left:4px solid var(--bad)"><b>Opozorila</b><ul style="margin:6px 0 0">${s.opozorila.map(o => `<li>${esc(o)}</li>`).join("")}</ul></div>` : '<p class="note info">Brez opozoril. Sistem deluje normalno.</p>'}
  <div class="grid g2">
  <div class="card"><h2>Preizkus obnove</h2><p class="mut">Program vzame zadnjo varnostno kopijo, jo odpre v pomnilniku in preveri vse datoteke, uporabnike in revizijsko sled. Pravih podatkov ne spremeni. Priporočeno enkrat na mesec; prava vaja na drugem računalniku je opisana v navodilih.</p>
   ${pr ? `<p>Zadnji preizkus: ${fdt(pr.cas)} – ${pr.ok ? '<span class="badge ok">uspešen</span>' : '<span class="badge bad">neuspešen</span>'} <span class="mut">${esc(pr.datoteka || "")}</span></p>${pr.ok ? `<ul>${pr.podrobnosti.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="err">${esc(pr.napaka || "")}</p>`}` : '<p class="mut">Preizkus še ni bil narejen.</p>'}
   <div class="row"><button class="btn" id="vz_p">Preizkusi obnovo zdaj</button></div></div>
  <div class="card"><h2>Stanje sistema</h2><table class="t">
   <tr><td>Različica</td><td>${esc(s.verzija)}${s.testno ? " (testna)" : ""} · Node ${esc(s.node)}</td></tr>
   <tr><td>Deluje od</td><td>${fdt(s.deluje_od)}</td></tr>
   <tr><td>Prostor na disku</td><td>${s.disk ? fb(s.disk.prosto) + " prosto od " + fb(s.disk.skupaj) : "–"}</td></tr>
   <tr><td>Velikost podatkov</td><td>${fb(s.velikost_podatkov)}</td></tr>
   <tr><td>Zadnja samodejna kopija</td><td>${esc(s.zadnja_kopija || "ni")}</td></tr>
   <tr><td>Kopija v zunanjo mapo</td><td>${s.kopija_zunaj && s.kopija_zunaj.cas ? fdt(s.kopija_zunaj.cas) + (s.kopija_zunaj.ok === false ? " – napaka" : "") : "ni nastavljena"}</td></tr>
   <tr><td>E-pošta (SMTP)</td><td>${s.smtp ? "nastavljena" : "ni nastavljena (opozorila pridejo samo na nadzorno ploščo)"}</td></tr>
   <tr><td>Zapisov</td><td>${Object.entries(s.zbirke).filter(x => x[1]).map(([k, n]) => esc(k) + ": " + n).join(", ")}</td></tr></table></div>
  <div class="card"><h2>Zadnje napake strežnika</h2>${s.napake.length ? `<div class="tw"><table class="t">${s.napake.map(n => `<tr><td style="white-space:nowrap">${fdt(n.cas)}</td><td>${esc(n.sporocilo)}</td></tr>`).join("")}</table></div>` : '<p class="mut">Ni napak.</p>'}</div>
  </div>`;
  $("#vz_p").onclick = async () => { try { const r = await api("POST", "/api/kopija/preizkus"); toast(r.ok ? "Preizkus obnove uspešen" : "Preizkus ni uspel: " + r.napaka, !r.ok); pageVzdrzevanje(v); } catch (e) { fail(e); } };
}

// ---------- varstvo osebnih podatkov ----------
const IZV = () => { try { return JSON.parse(localStorage.getItem("gdpr_izvajalec") || "{}"); } catch { return {}; } };
async function pageGdpr(v) {
  const [nas, pot, st] = await Promise.all([api("GET", "/api/gdpr/nastavitve"), api("GET", "/api/gdpr/potekli"), D.list("stranke")]);
  const iz = IZV();
  v.innerHTML = `<p class="note info">Orodja za uresničevanje pravic posameznikov in obveznosti po Splošni uredbi o varstvu podatkov (GDPR). Revizijska sled (kdo je kaj spremenil) se zaradi celovitosti ne spreminja; v njej ostanejo imena izvajalcev dejanj.</p>
  <div class="grid g2">
  <div class="card"><h2>Pravice posameznika</h2><p class="mut">Izvoz vseh podatkov o osebi (pravica do dostopa in prenosljivosti) ali anonimizacija (pravica do izbrisa). Iskanje po imenu in priimku ali e-naslovu v vseh zbirkah, tudi v zgodovini sprememb.</p>
   <div class="fgrid"><label class="f"><span>Ime in priimek</span><input id="g_i"></label><label class="f"><span>E-naslov</span><input id="g_e" type="email"></label></div>
   <div class="row"><button class="btn ghost" id="g_x">Izvoz podatkov osebe</button><button class="btn danger" id="g_a">Anonimiziraj osebo …</button></div></div>
  <div class="card"><h2>Rok hrambe za nekdanje zaposlene</h2><p class="mut">Pri zaposlenem vpišite <i>Datum odhoda</i>. Po izteku roka se oseba prikaže spodaj; anonimizirate jo z enim klikom (samodejnega brisanja ni).</p>
   <div class="row"><label class="f" style="margin:0"><span>Rok hrambe (let po odhodu)</span><input id="g_l" type="number" min="0" max="50" value="${nas.hramba_osebje_let}" style="width:110px"></label><button class="btn ghost sec" id="g_ls">Shrani</button></div>
   ${pot.osebe.length ? `<div class="tw"><table class="t"><tr><th>Oseba</th><th>Stranka</th><th>Odhod</th><th></th></tr>${pot.osebe.map(o => `<tr><td>${esc(o.ime)}</td><td>${esc(o.stranka)}</td><td>${fdate(o.datum_odhoda)}</td><td><button class="btn sm danger" data-an="${esc(o.ime)}" data-em="${esc(o.email)}">Anonimiziraj</button></td></tr>`).join("")}</table></div>` : `<p class="mut">Ni oseb s preteklim rokom (meja: odhod pred ${fdate(pot.meja)}).</p>`}</div>
  <div class="card"><h2>Dokumenti</h2><p class="mut">Predlogi v Wordu z vpisanimi podatki. Pred podpisom naj ju pregleda pravnik.</p>
   <div class="fgrid"><label class="f"><span>Stranka (upravljavec)</span><select id="g_s">${st.map(s => `<option value="${s.id}">${esc(s.naziv)}</option>`).join("")}</select></label>
   <label class="f"><span>Vaše podjetje (obdelovalec)</span><input id="g_n" value="${esc(iz.naziv || "")}"></label><label class="f"><span>Naslov</span><input id="g_na" value="${esc(iz.naslov || "")}"></label><label class="f"><span>Davčna / matična številka</span><input id="g_d" value="${esc(iz.davcna || "")}"></label><label class="f"><span>Zastopnik</span><input id="g_z" value="${esc(iz.zastopnik || "")}"></label><label class="f"><span>Gostovanje strežnika (podobdelovalec)</span><input id="g_h" value="${esc(iz.gostovanje || "")}" placeholder="npr. lasten računalnik / ponudnik VPS v EU"></label></div>
   <div class="row"><button class="btn ghost" id="g_p">Pogodba o obdelavi (Word)</button><button class="btn ghost" id="g_ev">Evidenca dejavnosti obdelave (Word)</button></div></div>
  </div>`;
  const oseba = () => ({ ime: $("#g_i").value.trim(), email: $("#g_e").value.trim() });
  $("#g_x").onclick = async () => { try { const o = oseba(), r = await api("POST", "/api/gdpr/izvoz", o); const n = Object.values(r.zapisi).reduce((a, x) => a + x.length, 0); dlBlob(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }), "izvoz-osebnih-podatkov-" + (o.ime || o.email).replace(/\s+/g, "-") + ".json"); toast("Izvoženih zapisov: " + n + (r.uporabniski_racuni.length ? ", uporabniških računov: " + r.uporabniski_racuni.length : "")); } catch (e) { fail(e); } };
  const anon = (ime, email) => modal("Anonimizacija osebe", `<p>Vsi zapisi z <b>${esc(ime || email)}</b> se nepovratno zamenjajo z »[izbrisana oseba]«, uporabniški račun se onemogoči. Pred tem naredite varnostno kopijo ali izvoz.</p><label class="f"><span>Za potrditev vpišite IZBRIŠI</span><input id="g_c"></label>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Anonimiziraj", cls: "danger", fn: async () => { if ($("#g_c").value.trim() !== "IZBRIŠI") { toast("Vpišite IZBRIŠI.", true); return false; } const r = await api("POST", "/api/gdpr/anonimiziraj", { ime, email, potrdi: true }); toast(`Anonimizirano: ${r.zapisov} zapisov, ${r.racunov} računov`); pageGdpr(v); } }]);
  $("#g_a").onclick = () => { const o = oseba(); if (o.ime.length < 3 && o.email.length < 5) return toast("Vnesite ime ali e-naslov.", true); anon(o.ime, o.email); };
  $$("[data-an]", v).forEach(b => b.onclick = () => anon(b.dataset.an, b.dataset.em));
  $("#g_ls").onclick = async () => { try { await api("PUT", "/api/gdpr/nastavitve", { hramba_osebje_let: +$("#g_l").value }); toast("Shranjeno"); pageGdpr(v); } catch (e) { fail(e); } };
  const izv = () => { const o = { naziv: $("#g_n").value, naslov: $("#g_na").value, davcna: $("#g_d").value, zastopnik: $("#g_z").value, gostovanje: $("#g_h").value }; try { localStorage.setItem("gdpr_izvajalec", JSON.stringify(o)); } catch {} return o; };
  const str = () => st.find(s => s.id === $("#g_s").value) || {};
  $("#g_p").onclick = async () => { const o = izv(), s = str(); await loadStrankaLogo(s); dlBlob(docxBuild({ naslov: "Pogodba o obdelavi osebnih podatkov", podnaslov: "po 28. členu Splošne uredbe (EU) 2016/679", stranka: s.naziv || "", stanje: "PREDLOGA – pred podpisom pregleda pravnik" }, d => pogodbaDoc(d, s, o)), "pogodba-o-obdelavi-" + (s.naziv || "stranka") + ".docx"); };
  $("#g_ev").onclick = async () => { const o = izv(), s = str(); await loadStrankaLogo(s); dlBlob(docxBuild({ naslov: "Evidenca dejavnosti obdelave", podnaslov: "po 30. členu Splošne uredbe (EU) 2016/679", stranka: s.naziv || "", stanje: "PREDLOGA" }, d => evidencaObdelavDoc(d, s, o)), "evidenca-obdelav-" + (s.naziv || "stranka") + ".docx"); };
}
function pogodbaDoc(d, s, o) {
  const x = (t, f) => t && String(t).trim() ? t : f;
  d.p("PREDLOGA. Pred podpisom naj jo pregleda pravnik in prilagodi dejanskemu razmerju.", { col: "r" });
  d.h(1, "Pogodbeni stranki");
  d.table(["Vloga", "Podatki"], [["Upravljavec", [s.naziv, s.naslov, s.davcna || s.maticna].filter(Boolean).join(", ") || "________________"], ["Obdelovalec", [o.naziv, o.naslov, o.davcna].filter(Boolean).join(", ") || "________________"]], [25, 75]);
  d.h(1, "1. Predmet in trajanje");
  d.p("Obdelovalec za upravljavca vodi in vzdržuje sistem HACCP v aplikaciji HiGiFood (evidence, usposabljanja, neskladnosti, dokumentacija). Pogodba velja ves čas trajanja osnovne pogodbe o storitvah in preneha z njo.");
  d.h(1, "2. Narava in namen obdelave, vrste podatkov, posamezniki");
  d.table(["Postavka", "Opis"], [["Namen", "Zagotavljanje varnosti živil in izpolnjevanje obveznosti po živilski zakonodaji (HACCP, dobra higienska praksa)."], ["Posamezniki", "Zaposleni upravljavca, kontaktne osebe dobaviteljev, uporabniki aplikacije."], ["Vrste podatkov", "Ime in priimek, delovno mesto, e-naslov, podatki o usposabljanjih, datumi veljavnosti higienskega minimuma in zdravniškega pregleda (brez diagnoz), zapisi o opravljenih nalogah (kdo, kdaj), dnevnik dostopa."], ["Posebne vrste podatkov", "Se ne obdelujejo. Upravljavec v aplikacijo ne vnaša podatkov o zdravstvenem stanju razen datuma veljavnosti pregleda."]], [25, 75]);
  d.h(1, "3. Obveznosti obdelovalca");
  d.bullets(["podatke obdeluje samo po dokumentiranih navodilih upravljavca;", "zagotavlja, da so osebe, pooblaščene za obdelavo, zavezane k zaupnosti;", "izvaja ustrezne tehnične in organizacijske ukrepe (32. člen), zlasti: dostop po vlogah, dvostopenjsko prijavo, šifrirane varnostne kopije, šifrirano povezavo (HTTPS) pri dostopu prek interneta, revizijsko sled sprememb in redne preizkuse obnove;", "brez predhodnega pisnega dovoljenja upravljavca ne angažira drugega obdelovalca; že odobreni podobdelovalec: " + x(o.gostovanje, "________________") + ";", "upravljavcu pomaga pri odgovarjanju na zahteve posameznikov (dostop, popravek, izbris, prenosljivost) – aplikacija omogoča izvoz in anonimizacijo podatkov osebe;", "o kršitvi varstva osebnih podatkov upravljavca obvesti brez nepotrebnega odlašanja, najpozneje v 48 urah od seznanitve;", "upravljavcu da na voljo vse informacije, potrebne za dokazovanje skladnosti, in omogoči revizije;", "po koncu storitev po izbiri upravljavca vse podatke vrne (izvoz) ali izbriše, razen če hrambo zahteva zakon."]);
  d.h(1, "4. Hramba");
  d.p("Evidence HACCP se hranijo v skladu z roki, ki jih določa upravljavec oziroma živilska zakonodaja. Podatki nekdanjih zaposlenih se anonimizirajo po izteku roka hrambe, ki ga določi upravljavec.");
  d.h(1, "5. Končne določbe");
  d.p("Za razmerja, ki niso urejena s to pogodbo, se uporabljajo Splošna uredba (EU) 2016/679 in Zakon o varstvu osebnih podatkov (ZVOP-2).");
  d.table(["Upravljavec", "Obdelovalec"], [["Kraj in datum: ____________", "Kraj in datum: ____________"], ["Podpis: ____________", "Podpis: ____________ (" + x(o.zastopnik, "zastopnik") + ")"]], [50, 50]);
}
function evidencaObdelavDoc(d, s, o) {
  d.p("PREDLOGA. Dopolnite in prilagodite dejanskim obdelavam.", { col: "r" });
  d.table(["Postavka", "Vsebina"], [
    ["Upravljavec", [s.naziv, s.naslov].filter(Boolean).join(", ") || "________________"],
    ["Obdelovalec", [o.naziv, o.naslov].filter(Boolean).join(", ") || "________________"],
    ["Namen obdelave", "Sistem HACCP in dobra higienska praksa: evidence meritev in čiščenja, usposabljanja, neskladnosti, sledljivost."],
    ["Pravna podlaga", "Izpolnjevanje zakonskih obveznosti (točka (c) prvega odstavka 6. člena GDPR) po Uredbi (ES) 852/2004 in predpisih o živilih."],
    ["Kategorije posameznikov", "Zaposleni, kontaktne osebe dobaviteljev, uporabniki aplikacije."],
    ["Kategorije podatkov", "Ime in priimek, delovno mesto, e-naslov, podatki o usposabljanjih, datumi veljavnosti higienskega minimuma in zdravniškega pregleda, avtorji zapisov in časi vnosov."],
    ["Uporabniki podatkov", "Odgovorna oseba in zaposleni upravljavca, obdelovalec (HACCP svetovalec), na zahtevo pristojni inšpekcijski organi."],
    ["Prenos v tretje države", "Ne." + (o.gostovanje ? " Gostovanje: " + o.gostovanje + "." : "")],
    ["Roki hrambe", "Evidence HACCP v skladu z zakonodajo oziroma odločitvijo upravljavca; podatki nekdanjih zaposlenih: anonimizacija po izteku roka (nastavitev v aplikaciji)."],
    ["Tehnični in organizacijski ukrepi", "Dostop po vlogah in nastavitve vidnosti, dvostopenjska prijava, gesla shranjena kot zgoščenke, šifrirane varnostne kopije in preizkus obnove, revizijska sled z verigo zgoščenk, HTTPS pri dostopu prek interneta."]
  ], [30, 70]);
}

// ---------- strokovni pregled baze znanja ----------
async function pageStrokovniPregled(v) {
  const db = await api("GET", "/api/baza/zakonodaja"); const nep = db.filter(z => !z.strokovno_pregledano).length;
  v.innerHTML = `<p class="note info">Zakonodajo in vsebine predlog naj pregleda strokovnjak za varnost živil. Izvozite seznam v Excel ali Word, strokovnjak vpiše opombe, nato tu označite pregledane predpise (kdo in kdaj). Strokovno nepregledanih: <b>${nep}</b> od ${db.length}.</p>
  <div class="row"><button class="btn ghost" id="sp_x">Izvoz za strokovnjaka (Excel)</button><button class="btn ghost" id="sp_w">Izvoz za strokovnjaka (Word)</button><span class="sp"></span><label class="f" style="margin:0"><span>Pregledal (ime, naziv)</span><input id="sp_k" style="width:220px"></label><button class="btn" id="sp_o">Označi izbrane kot pregledane</button></div>
  <div class="tw"><table class="t"><thead><tr><th><input type="checkbox" id="sp_all" aria-label="Izberi vse"></th><th>Predpis</th><th>Skupina</th><th>Stanje</th><th>Strokovni pregled</th></tr></thead><tbody>${db.map((z, i) => `<tr><td><input type="checkbox" data-i="${i}" aria-label="Izberi ${esc(z.predpis)}"></td><td>${esc(z.predpis)}<br><small class="mut">${esc((z.vsebina || "").slice(0, 120))}</small></td><td>${esc(z.skupina || "")}</td><td>${esc(z.status || "")}</td><td>${z.strokovno_pregledano ? `<span class="badge ok">${fdate(z.strokovno_pregledano)}</span><br><small>${esc(z.pregledal || "")}</small>` : '<span class="badge warn">ni pregledano</span>'}</td></tr>`).join("")}</tbody></table></div>`;
  $("#sp_all").onchange = e => $$("[data-i]", v).forEach(c => c.checked = e.target.checked);
  const vrste = () => db.map(z => [z.skupina || "", z.predpis, z.vsebina || "", z.status || "", z.strokovno_pregledano || "", z.pregledal || "", ""]);
  $("#sp_x").onclick = () => downloadXlsx("strokovni-pregled-zakonodaje.xlsx", [{ ime: "Zakonodaja", glava: ["Skupina", "Predpis", "Vsebina", "Stanje", "Strokovno pregledano", "Pregledal", "Opomba strokovnjaka"], vrste: vrste() }]);
  $("#sp_w").onclick = () => dlBlob(docxBuild({ naslov: "Strokovni pregled zakonodaje", podnaslov: "Baza znanja HiGiFood, " + fdate(today()), stanje: "za pregled" }, d => { d.p("Za vsak predpis preverite veljavnost, pravilnost opisa in uporabnost. Opombe vpišite v zadnji stolpec."); d.table(["Predpis", "Vsebina", "Stanje", "Opomba strokovnjaka"], db.map(z => [z.predpis, z.vsebina || "", z.status || "", ""]), [22, 48, 10, 20]); }), "strokovni-pregled-zakonodaje.docx");
  $("#sp_o").onclick = async () => {
    const izb = $$("[data-i]:checked", v).map(c => +c.dataset.i), k = $("#sp_k").value.trim();
    if (!izb.length) return toast("Izberite predpise.", true); if (!k) return toast("Vpišite, kdo je pregledal.", true);
    for (const i of izb) { db[i].strokovno_pregledano = today(); db[i].pregledal = k; }
    try { await api("PUT", "/api/baza/zakonodaja", db); _baza = null; toast("Označeno: " + izb.length); pageStrokovniPregled(v); } catch (e) { fail(e); }
  };
}

route(/^\/vzdrzevanje$/, pageVzdrzevanje, "Vzdrževanje in stanje sistema", "vzdrzevanje");
route(/^\/gdpr$/, pageGdpr, "Varstvo osebnih podatkov", "gdpr");
route(/^\/strokovni-pregled$/, pageStrokovniPregled, "Strokovni pregled baze znanja", "strokovni-pregled");
navItem("vzdrzevanje", "Vzdrževanje", "#/vzdrzevanje", ["admin"]);
navItem("gdpr", "Varstvo podatkov (GDPR)", "#/gdpr", ["admin"]);
navItem("strokovni-pregled", "Strokovni pregled baze", "#/strokovni-pregled", ["admin"]);
{ const a = NAVITEMS.findIndex(n => n.id === "vidnost"); if (a >= 0) NAVITEMS.splice(a + 1, 0, ...NAVITEMS.splice(NAVITEMS.length - 3, 3)); }
