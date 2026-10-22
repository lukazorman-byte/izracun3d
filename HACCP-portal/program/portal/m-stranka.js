// Profil stranke z zavihki.
const TABS = [
  ["podatki", "Podatki"], ["obrati", "Obrati"], ["tloris", "Tloris"], ["osebje", "Zaposleni in usposabljanja"], ["dobavitelji", "Dobavitelji"], ["oprema", "Oprema in instrumenti"],
  ["nacrti", "HACCP načrti"], ["navodila", "Navodila in obrazci"], ["evidence", "Evidence"], ["higiena", "Higiena"], ["capa", "Neskladnosti / CAPA"], ["inspekcija", "Inšpekcija"], ["koledar", "Koledar"], ["priloge", "Priloge"], ["potrditve", "Potrditve in različice"], ["sledljivost", "Sledljivost"], ["alergeni", "Alergeni in jedilnik"], ["certifikacija", "Certifikacija"], ["storitve", "Storitve"], ["uporabniki", "Uporabniki"]
];
const TABEXT = {}; // zavihki, ki jih dodajajo drugi moduli: ime → (el, ctx)
async function pageStranka(v, m) {
  const sid = m[1], tab = m[2] || "podatki";
  let s;
  try { s = await D.list("stranke").then(a => a.find(x => x.id === sid)); } catch (e) { throw e; }
  if (!s) throw new Error("Stranka ni najdena ali nimate dostopa.");
  $("#title").textContent = s.naziv;
  await loadStrankaLogo(s);
  const obrati = await D.list("obrati", { stranka_id: sid });
  const ctx = { stranka_id: sid, stranka: s, obrati: mapOf(obrati) };
  const tabs = TABS.filter(t => !(t[0] === "storitve" && ME.u.vloga === "zaposleni") && !(t[0] === "uporabniki" && ME.u.vloga === "zaposleni") && !(t[0] === "osebje" && ME.u.vloga === "zaposleni") && (t[0] === "podatki" || vis("tab:" + t[0])));
  if (tab !== "podatki" && !vis("tab:" + tab)) { toast("Nimate dostopa.", true); location.hash = "#/stranka/" + sid + "/podatki"; return; }
  v.innerHTML = `<div class="tabs">${tabs.map(t => `<a href="#/stranka/${sid}/${t[0]}" class="${t[0] === tab ? "on" : ""}">${t[1]}</a>`).join("")}</div><div id="tabbody"></div>`;
  const el = $("#tabbody");
  const on = $(".tabs a.on"); if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest" });
  const T = {
    podatki: () => tabPodatki(el, ctx, obrati),
    obrati: () => listView(el, "obrati", ctx),
    tloris: () => tabTloris(el, ctx),
    osebje: async () => { el.innerHTML = '<h2>Zaposleni</h2><div id="t1"></div><h2 style="margin-top:20px">Usposabljanja</h2><div id="t2"></div>'; await listView($("#t1"), "osebje", ctx, { extra: '<button class="btn ghost sec" id="kart">Kartoteke zaposlenih (PDF)</button>' }); await listView($("#t2"), "usposabljanja", ctx); const kb = $("#kart"); if (kb) kb.onclick = () => kartotekePdf(ctx); },
    dobavitelji: () => listView(el, "dobavitelji", ctx),
    oprema: () => listView(el, "oprema", ctx, { extra: `<a class="btn ghost sec" href="#/qr/${sid}">QR kode naprav</a>` }),
    nacrti: () => tabNacrti(el, ctx),
    navodila: () => tabNavodila(el, ctx),
    evidence: () => tabEvidence(el, ctx),
    higiena: () => tabHigiena(el, ctx),
    capa: () => tabCapa(el, ctx),
    inspekcija: () => tabInspekcija(el, ctx),
    koledar: () => listView(el, "dogodki", ctx),
    priloge: () => tabPriloge(el, ctx),
    storitve: () => tabStoritve(el, ctx),
    uporabniki: () => tabUporabniki(el, ctx)
  };
  for (const [k, fn] of Object.entries(TABEXT)) T[k] = () => fn(el, ctx);
  await (T[tab] || T.podatki)();
}

// logotip stranke: prikaže se na naslovnici dokumentov te stranke in v meniju uporabnikov stranke
function logoStrankeCard(el, s) {
  const im = SLOGO[s.id] && SLOGO[s.id].im;
  el.insertAdjacentHTML("beforeend", `<div class="card"><h2>Logotip podjetja</h2><p class="mut">Prikaže se na naslovnici PDF in Word dokumentov te stranke ter v meniju njenih uporabnikov. PNG, JPEG ali WebP do 1,5 MB.</p><div class="row"><img id="sl_prev" alt="Logotip ${esc(s.naziv)}" style="max-height:60px;max-width:180px;border:1px solid var(--line);border-radius:6px;padding:4px;background:#fff" ${im ? "" : "hidden"}><input type="file" id="sl_f" accept="image/png,image/jpeg,image/webp" style="max-width:260px" aria-label="Datoteka z logotipom"><button class="btn" id="sl_up">Naloži</button>${im ? '<button class="btn ghost sec" id="sl_del">Odstrani</button>' : ""}</div></div>`);
  if (im) { const r = new FileReader(); r.onload = () => { const p = $("#sl_prev"); if (p) p.src = r.result; }; r.readAsDataURL(new Blob([im.u8], { type: "image/jpeg" })); }
  const po = async () => { await loadStrankaLogo(s, true); if (ME.u.stranka_id === s.id) navStrankaLogo(); render(); };
  $("#sl_up").onclick = () => { const f = $("#sl_f").files[0]; if (!f) return toast("Izberite datoteko.", true); const rd = new FileReader(); rd.onload = async () => { try { await api("POST", "/api/stranka-logo/" + s.id, { tip: f.type, podatki: String(rd.result).split(",")[1] }); toast("Logotip shranjen"); await po(); } catch (e) { fail(e); } }; rd.readAsDataURL(f); };
  if (im) $("#sl_del").onclick = () => confirmBox("Odstranim logotip podjetja?", async () => { try { await api("DELETE", "/api/stranka-logo/" + s.id); toast("Logotip odstranjen"); await po(); } catch (e) { fail(e); } }, true);
}
async function tabPodatki(el, ctx, obrati) {
  const s = ctx.stranka, d = await loadAll({ stranka_id: s.id });
  const miss = missingData(d, s);
  const row = (l, v) => v ? `<tr><th style="width:38%">${l}</th><td>${esc(v)}</td></tr>` : "";
  el.innerHTML = `<div class="row"><button class="btn" id="ed">Uredi podatke</button><span class="sp"></span>${badge(s.status)}</div>
  ${miss.length ? `<p class="note">Manjkajoči podatki: ${miss.map(esc).join(", ")}.</p>` : ""}
  <div class="grid g2"><div class="card"><h2>Podjetje</h2><table class="t">${row("Naziv", s.naziv)}${row("Matična št.", s.maticna)}${row("Davčna št.", s.davcna)}${row("Naslov", s.naslov)}${row("Odgovorna oseba", s.odgovorna_oseba)}${row("E-naslov", s.email)}${row("Telefon", s.telefon)}${row("Dejavnost", s.dejavnost)}${row("Opis dejavnosti", s.opis_dejavnosti)}${isStaff() ? row("Paket", s.paket) + row("Interne opombe", s.notranje) : ""}<tr><th>Naslednji pregled</th><td>${dueBadge(s.naslednji_pregled)}</td></tr></table></div>
  <div class="card"><h2>Povezano gradivo</h2><table class="t">
   <tr><td>Obrati</td><td>${d.obrati.length}</td></tr><tr><td>Zaposleni</td><td>${d.osebje.length}</td></tr><tr><td>Dobavitelji</td><td>${d.dobavitelji.length}</td></tr><tr><td>Oprema in instrumenti</td><td>${d.oprema.length}</td></tr>
   <tr><td>HACCP načrti</td><td>${d.nacrti.length} (potrjenih ${d.nacrti.filter(n => n.status === "potrjeno").length})</td></tr><tr><td>Navodila in obrazci</td><td>${d.navodila.length}</td></tr>
   <tr><td>Evidence (zapisi)</td><td>${d.evidence.length} (za pregled ${d.evidence.filter(e => e.status === "vneseno").length})</td></tr><tr><td>Odprte neskladnosti / CAPA</td><td>${d.capa.filter(c => c.status !== "zaprto").length}</td></tr></table></div></div>
  ${d.storitve.length ? `<div class="card"><h2>Zgodovina storitev in pregledov</h2><div class="tw"><table class="t"><tr><th>Datum</th><th>Vrsta</th><th>Minut</th><th>Opis</th></tr>${d.storitve.sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 8).map(x => `<tr><td>${fdate(x.datum)}</td><td>${esc(x.vrsta)}</td><td>${esc(x.minute || "")}</td><td>${esc((x.opis || "").slice(0, 120))}</td></tr>`).join("")}</table></div></div>` : ""}`;
  $("#ed").onclick = () => openForm("stranke", s, null, () => render());
  if (["admin", "svetovalec", "odgovorna"].includes(ME.u.vloga)) logoStrankeCard(el, s);
}

async function tabPriloge(el, ctx) {
  const rows = await D.list("priloge", { stranka_id: ctx.stranka_id });
  el.innerHTML = `<div class="row"><input type="file" id="pf" accept="image/*,application/pdf,text/plain" style="max-width:340px"><button class="btn" id="pu">Naloži prilogo</button><span class="mut">Slike, PDF, besedilo do 8 MB.</span></div><div class="tw"><table class="t"><tr><th>Datoteka</th><th>Velikost</th><th>Naloženo</th><th>Kdo</th></tr>${rows.map(r => `<tr><td><a href="/api/priloga/${r.id}" target="_blank" rel="noopener">${esc(r.ime)}</a></td><td>${Math.round(r.velikost / 1024)} kB</td><td>${fdt(r.ustvarjeno)}</td><td>${esc(r.ustvaril || "")}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">Ni prilog.</td></tr>'}</table></div>`;
  $("#pu").onclick = async () => {
    const f = $("#pf").files[0]; if (!f) return toast("Izberite datoteko.", true);
    try { await uploadFile(f, ctx.stranka_id, null); toast("Naloženo"); tabPriloge(el, ctx); } catch (e) { fail(e); }
  };
}
function uploadFile(f, sid, povezava, obrat) {
  return new Promise((ok, no) => {
    const rd = new FileReader();
    rd.onload = async () => { try { ok(await api("POST", "/api/priloga", { stranka_id: sid, obrat_id: obrat || null, ime: f.name, tip: f.type || "text/plain", povezava, podatki: String(rd.result).split(",")[1] })); } catch (e) { no(e); } };
    rd.onerror = () => no(new Error("Datoteke ni mogoče prebrati."));
    rd.readAsDataURL(f);
  });
}

async function tabStoritve(el, ctx) {
  const rows = await D.list("storitve", { stranka_id: ctx.stranka_id });
  const min = rows.reduce((a, r) => a + (Number(r.minute) || 0), 0);
  const el2 = document.createElement("div");
  el.innerHTML = `<div class="kpis"><div class="kpi"><b>${rows.length}</b><span>opravljenih storitev</span></div><div class="kpi"><b>${(min / 60).toFixed(1)} h</b><span>skupaj porabljenega časa</span></div><div class="kpi"><b>${rows.filter(r => r.vrsta === "Obisk na lokaciji").length}</b><span>obiskov na lokaciji</span></div></div>`;
  el.appendChild(el2);
  await listView(el2, "storitve", ctx, { extra: `<button class="btn ghost sec" id="povz">Povzetek dela za stranko</button>`, bind: e3 => { $("#povz", e3).onclick = () => {
    const txt = ["Povzetek dela za stranko: " + ctx.stranka.naziv, "Datum izpisa: " + fdate(today()), "", ...rows.slice().sort((a, b) => a.datum.localeCompare(b.datum)).map(r => `${fdate(r.datum)} | ${r.vrsta || ""} | ${r.minute || 0} min | ${r.opis || ""}`), "", "Skupaj: " + rows.length + " storitev, " + (min / 60).toFixed(1) + " ure."].join("\n");
    modal("Povzetek dela", `<textarea style="min-height:300px" readonly>${esc(txt)}</textarea>`, [{ t: "Zapri", cls: "ghost sec" }, { t: "Prenesi .txt", fn: () => { dlBlob(new Blob([txt], { type: "text/plain" }), "povzetek-" + ctx.stranka.naziv + ".txt"); return false; } }]);
  }; } });
}
function dlBlob(b, name) { if (!canPrint(name)) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name.replace(/[^\w.\-šđčćžŠĐČĆŽ ]/g, "_"); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

async function tabUporabniki(el, ctx) {
  const all = await api("GET", "/api/uporabniki");
  const us = all.filter(u => u.stranka_id === ctx.stranka_id);
  el.innerHTML = `<div class="row"><span class="sp"></span><button class="btn" id="un">+ Nov uporabnik</button></div><div class="tw"><table class="t"><tr><th>Ime</th><th>E-naslov</th><th>Vloga</th><th>Stanje</th><th>Zadnja prijava</th></tr>${us.map(u => `<tr class="click" data-id="${u.id}"><td>${esc(u.ime)}</td><td>${esc(u.email)}</td><td>${esc(ROLE[u.vloga])}</td><td>${u.aktiven ? '<span class="badge ok">aktiven</span>' : '<span class="badge bad">onemogočen</span>'}</td><td>${fdt(u.zadnja_prijava)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">Ni uporabnikov.</td></tr>'}</table></div><p class="mut">Zaposleni lahko vnašajo evidence; odgovorna oseba potrjuje zapise in ureja podatke podjetja.</p>`;
  $("#un").onclick = () => userForm(null, ctx.stranka_id, () => tabUporabniki(el, ctx));
  $$("tr[data-id]", el).forEach(tr => tr.onclick = () => userForm(us.find(u => u.id === tr.dataset.id), ctx.stranka_id, () => tabUporabniki(el, ctx)));
}
function userForm(u, sid, done) {
  const roles = ME.u.vloga === "odgovorna" ? ["zaposleni"] : ["odgovorna", "zaposleni"];
  modal(u ? "Uredi uporabnika" : "Nov uporabnik", `<p class="err" id="ferr"></p><div class="fgrid"><label class="f req"><span>Ime in priimek</span><input id="u_i" value="${esc(u ? u.ime : "")}"></label><label class="f req"><span>E-naslov</span><input id="u_e" type="email" value="${esc(u ? u.email : "")}" ${u ? "disabled" : ""}></label>${u ? "" : `<label class="f"><span>Vloga</span><select id="u_v">${roles.map(r => `<option value="${r}">${ROLE[r]}</option>`).join("")}</select></label>`}<label class="f ${u ? "" : "req"}"><span>${u ? "Novo začasno geslo (pustite prazno, če ne spreminjate)" : "Začasno geslo (vsaj 10 znakov)"}</span><input id="u_p" type="text" autocomplete="off"></label>${u ? `<label class="f"><span>Aktiven</span><input type="checkbox" id="u_a" ${u.aktiven ? "checked" : ""}></label>` : ""}</div>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Shrani", fn: async () => {
    try {
      if (u) { const b = { ime: $("#u_i").value, aktiven: $("#u_a").checked }; if ($("#u_p").value) b.geslo = $("#u_p").value; await api("PUT", "/api/uporabniki/" + u.id, b); }
      else await api("POST", "/api/uporabniki", { ime: $("#u_i").value, email: $("#u_e").value, geslo: $("#u_p").value, vloga: $("#u_v").value, stranka_id: sid });
      toast("Shranjeno"); done();
    } catch (e) { $("#ferr").textContent = e.message; return false; }
  } }]);
}

route(/^\/stranka\/([\w-]+)(?:\/([a-z]+))?$/, pageStranka, "Stranka", "stranke");

// Kartoteka zaposlenega: osnovni podatki, veljavnosti in usposabljanja, kjer je oseba navedena med udeleženci. En list na osebo, za podpis.
async function kartotekePdf(ctx) {
  try {
    const [os, us] = await Promise.all([D.list("osebje", { stranka_id: ctx.stranka_id }), D.list("usposabljanja", { stranka_id: ctx.stranka_id })]);
    if (!os.length) return toast("Ni zaposlenih.", true);
    const blob = pdfBuild({ naslov: "Kartoteke zaposlenih", stranka: ctx.stranka.naziv, verzija: "1.0" }, d => {
      os.forEach((o, i) => {
        if (i) d.newPage();
        d.h(1, o.ime);
        d.table(["Podatek", "Vrednost"], [["Delovno mesto", o.funkcija || ""], ["E-naslov", o.email || ""], ["Higienski minimum / izobraževanje do", o.higienski_do ? fdate(o.higienski_do) : ""], ["Zdravniški pregled do", o.zdravniski_do ? fdate(o.zdravniski_do) : ""], ["Opomba", o.opomba || ""]], [40, 60]);
        const mine = us.filter(u => (u.udelezenci || "").toLowerCase().includes((o.ime || "").toLowerCase()));
        d.h(2, "Usposabljanja");
        if (mine.length) d.table(["Tema", "Datum", "Veljavno do", "Izvajalec"], mine.map(u => [u.tema, u.datum ? fdate(u.datum) : "", u.veljavno_do ? fdate(u.veljavno_do) : "", u.izvajalec || ""]), [40, 16, 18, 26]);
        else d.p("Ni zabeleženih usposabljanj.", { col: "m" });
        d.p("Seznanjen(a) z navodili: ______________________   Podpis zaposlenega: ______________________   Datum: ______________", { size: 9, col: "m" });
      });
    });
    dlBlob(blob, "kartoteke-" + ctx.stranka.naziv + ".pdf");
  } catch (e) { fail(e); }
}
