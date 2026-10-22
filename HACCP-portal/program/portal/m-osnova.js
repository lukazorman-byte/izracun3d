// Nadzorna plošča in seznam strank.
const COLLS = ["stranke", "obrati", "nacrti", "navodila", "evidence", "capa", "usposabljanja", "oprema", "osebje", "dogodki", "dobavitelji", "storitve", "ciscenje_nacrt", "kemikalije"];
async function loadAll(q) {
  const out = {};
  await Promise.all(COLLS.map(async c => { try { out[c] = await D.list(c, q && c !== "stranke" ? q : undefined); } catch { out[c] = []; } }));
  if (q && q.stranka_id) out.stranke = out.stranke.filter(s => s.id === q.stranka_id);
  return out;
}
const mapOf = (arr, k) => Object.fromEntries((arr || []).map(x => [x.id, x[k || "naziv"]]));

// zbere vse roke iz podatkov (nadzorna plošča, koledar)
function collectDeadlines(d) {
  const L = [], sm = mapOf(d.stranke);
  const add = (datum, tip, naslov, sid, tab, bad) => { if (datum) L.push({ datum: String(datum).slice(0, 10), tip, naslov, stranka_id: sid, stranka: sm[sid] || "", href: sid ? `#/stranka/${sid}/${tab}` : "#/koledar" }); };
  for (const s of d.stranke) add(s.naslednji_pregled, "Pregled stranke", "Pregled: " + s.naziv, s.id, "podatki");
  for (const n of d.nacrti) if (n.status !== "zastarelo") add(n.naslednji_pregled, "Pregled načrta", "Pregled HACCP načrta: " + n.naziv, n.stranka_id, "nacrti");
  for (const n of d.navodila) if (n.status !== "zastarelo") add(n.naslednji_pregled, "Pregled dokumenta", "Pregled navodila: " + n.naslov, n.stranka_id, "navodila");
  for (const o of d.osebje) { add(o.higienski_do, "Izobraževanje", "Poteče izobraževanje: " + o.ime, o.stranka_id, "osebje"); add(o.zdravniski_do, "Zdravniški pregled", "Poteče zdravniški pregled: " + o.ime, o.stranka_id, "osebje"); }
  for (const u of d.usposabljanja) add(u.veljavno_do, "Usposabljanje", "Poteče usposabljanje: " + u.tema, u.stranka_id, "osebje");
  for (const o of d.oprema) add(o.naslednji_servis, "Oprema", "Servis/umerjanje: " + o.naziv, o.stranka_id, "oprema");
  for (const o of d.dobavitelji) add(o.naslednja_ocena, "Dobavitelj", "Ocena dobavitelja: " + o.naziv, o.stranka_id, "dobavitelji");
  for (const c of d.capa) if (c.status !== "zaprto") add(c.rok, "CAPA", "Rok ukrepa: " + (c.opis || "").slice(0, 60), c.stranka_id, "capa");
  for (const e of d.dogodki) if (e.status !== "opravljeno") add(e.datum, e.vrsta || "Dogodek", e.naslov, e.stranka_id, "koledar");
  for (const c of ciscenjeStanje(d.ciscenje_nacrt || [], d.evidence || [])) add(c.next, "Čiščenje", "Čiščenje: " + (c.n.podrocje ? c.n.podrocje + " – " : "") + c.n.opravilo, c.n.stranka_id, "higiena");
  for (const k of d.kemikalije || []) add(k.rok_uporabe, "Čistilo", "Poteče rok uporabe: " + k.naziv, k.stranka_id, "higiena");
  for (const s of d.storitve) add(s.naslednji_pregled, "Priporočen pregled", "Priporočen naslednji pregled (storitev)", s.stranka_id, "storitve");
  return L.sort((a, b) => a.datum.localeCompare(b.datum));
}

// manjkajoči podatki po stranki
function missingData(d, s) {
  const m = [];
  if (!s.odgovorna_oseba) m.push("odgovorna oseba");
  if (!s.naslov) m.push("naslov");
  if (!s.dejavnost) m.push("vrsta dejavnosti");
  if (!d.obrati.some(o => o.stranka_id === s.id)) m.push("noben obrat");
  else if (d.obrati.some(o => o.stranka_id === s.id && !o.opis_prostorov)) m.push("opis prostorov");
  if (!d.osebje.some(o => o.stranka_id === s.id)) m.push("seznam zaposlenih");
  if (!d.nacrti.some(o => o.stranka_id === s.id)) m.push("HACCP načrt");
  if (!d.dobavitelji.some(o => o.stranka_id === s.id)) m.push("dobavitelji");
  return m;
}

async function pageDashboard(v) {
  const flt = JSON.parse(sessionStorage.getItem("dflt") || "{}");
  const d = await loadAll(flt.sid ? { stranka_id: flt.sid } : null);
  const sm = mapOf(d.stranke), t = today();
  const stOk = s => !flt.st || s.status === flt.st;
  const strs = d.stranke.filter(stOk), ids = new Set(strs.map(s => s.id));
  const inScope = x => ids.has(x.stranka_id);
  const dl = collectDeadlines(Object.fromEntries(Object.entries(d).map(([k, a]) => [k, k === "stranke" ? strs : a.filter(inScope)]))).filter(x => (!flt.od || x.datum >= flt.od) && (!flt.do || x.datum <= flt.do));
  const due = dl.filter(x => daysTo(x.datum) <= 30), over = dl.filter(x => daysTo(x.datum) < 0);
  const count = (arr, f) => arr.filter(x => inScope(x) && f(x)).length;
  const kpi = (n, l, cls, href) => `<a class="kpi ${cls || ""}" href="${href || "#"}"><b>${n}</b><span>${l}</span></a>`;
  const rec = d.evidence.filter(inScope), capaOpen = d.capa.filter(c => inScope(c) && c.status !== "zaprto");
  const devs = rec.filter(r => r.skladno === false || r.skladno === "ne");
  const dbz = await baza(); const pravno = d.navodila.filter(n => inScope(n) && navodiloOpozorila(n, dbz).length).length;
  const stale = pravno + d.navodila.filter(n => inScope(n) && (n.status === "zastarelo" || (n.naslednji_pregled && daysTo(n.naslednji_pregled) < 0))).length + d.nacrti.filter(n => inScope(n) && (n.status === "zastarelo" || (n.naslednji_pregled && daysTo(n.naslednji_pregled) < 0))).length;
  const exp = dl.filter(x => ["Izobraževanje", "Zdravniški pregled", "Usposabljanje", "Oprema"].includes(x.tip) && daysTo(x.datum) <= 30).length;
  const recent = [];
  for (const c of COLLS) for (const x of d[c]) if (c === "stranke" || inScope(x)) recent.push({ c, x, t: x.spremenjeno || x.ustvarjeno || "" });
  recent.sort((a, b) => b.t.localeCompare(a.t));
  const NAMES = { stranke: "Stranka", obrati: "Obrat", nacrti: "HACCP načrt", navodila: "Navodilo", evidence: "Zapis", capa: "Neskladnost / CAPA", usposabljanja: "Usposabljanje", oprema: "Oprema", osebje: "Zaposleni", dogodki: "Dogodek", dobavitelji: "Dobavitelj", storitve: "Storitev" };
  const miss = strs.map(s => ({ s, m: missingData(d, s) })).filter(x => x.m.length);
  v.innerHTML = `
  <div class="row">${isStaff() ? `<select id="fs" style="max-width:240px"><option value="">Vse stranke</option>${d.stranke.map(s => `<option value="${s.id}" ${flt.sid === s.id ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select>` : ""}
    <select id="fst" style="max-width:200px"><option value="">Vsa stanja sistema</option>${STATUS_SISTEMA.map(s => `<option ${flt.st === s ? "selected" : ""}>${s}</option>`).join("")}</select>
    <label class="mut">Roki od <input type="date" id="fod" value="${flt.od || ""}" style="width:auto"></label><label class="mut">do <input type="date" id="fdo" value="${flt.do || ""}" style="width:auto"></label>
    <button class="btn ghost sec sm" id="fx">Počisti filter</button></div>
  <div class="kpis">
    ${isStaff() ? kpi(strs.length, "strank", "", "#/stranke") : ""}
    ${kpi(strs.filter(s => s.status === "aktivna").length, "aktivnih HACCP sistemov", "", "#/stranke")}
    ${kpi(count(d.nacrti, n => n.status === "osnutek"), "načrtov v pripravi")}
    ${kpi(count(d.nacrti, n => n.status === "v pregledu"), "načrtov v potrjevanju")}
    ${kpi(count(d.nacrti, n => n.status === "potrjeno"), "potrjenih načrtov")}
    ${kpi(due.length, "rokov v 30 dneh", due.length ? "warn" : "")}
    ${kpi(over.length, "rokov v zamudi", over.length ? "bad" : "")}
    ${kpi(rec.filter(r => r.status === "vneseno").length, "zapisov za pregled", "", "#/pregled-zapisov")}
    ${kpi(devs.length, "odstopanj v zapisih", devs.length ? "warn" : "")}
    ${kpi(capaOpen.length, "odprtih CAPA", capaOpen.some(c => c.rok && daysTo(c.rok) < 0) ? "bad" : capaOpen.length ? "warn" : "")}
    ${kpi(stale, "dokumentov za posodobitev", stale ? "warn" : "")}
    ${kpi(exp, "poteka: izobraževanja/oprema", exp ? "warn" : "")}
    ${kpi(ciscenjeStanje(d.ciscenje_nacrt.filter(inScope), d.evidence.filter(inScope)).filter(x => x.zamuda).length, "opravil čiščenja v zamudi", ciscenjeStanje(d.ciscenje_nacrt.filter(inScope), d.evidence.filter(inScope)).some(x => x.zamuda) ? "warn" : "")}
  </div>
  <div class="grid g2">
    <div class="card"><h2>Prihajajoči roki in zamude</h2>${dl.length ? `<div class="tw"><table class="t"><tr><th>Rok</th><th>Kaj</th>${isStaff() ? "<th>Stranka</th>" : ""}</tr>${dl.filter(x => daysTo(x.datum) <= 60).slice(0, 25).map(x => `<tr class="click" onclick="location.hash='${x.href.slice(1)}'"><td>${dueBadge(x.datum)}</td><td>${esc(x.naslov)}</td>${isStaff() ? `<td>${esc(x.stranka)}</td>` : ""}</tr>`).join("") || `<tr><td colspan="3" class="empty">Ni rokov v naslednjih 60 dneh.</td></tr>`}</table></div>` : '<div class="empty">Ni vnesenih rokov.</div>'}</div>
    <div class="card"><h2>Opozorila o manjkajočih podatkih</h2>${miss.length ? `<div class="tw"><table class="t"><tr><th>Stranka</th><th>Manjka</th></tr>${miss.slice(0, 20).map(x => `<tr class="click" onclick="location.hash='#/stranka/${x.s.id}/podatki'"><td>${esc(x.s.naziv)}</td><td>${x.m.map(esc).join(", ")}</td></tr>`).join("")}</table></div>` : '<div class="empty">Vsi osnovni podatki so izpolnjeni.</div>'}</div>
    <div class="card"><h2>Zadnje aktivnosti</h2>${recent.length ? `<div class="tw"><table class="t"><tr><th>Kdaj</th><th>Kaj</th><th>Stranka</th></tr>${recent.slice(0, 12).map(r => `<tr><td>${fdt(r.t)}</td><td>${NAMES[r.c]}: ${esc(r.x.naziv || r.x.naslov || r.x.ime || r.x.vrsta || r.x.tema || r.x.opis || fdate(r.x.datum) || "")}</td><td>${esc(sm[r.c === "stranke" ? r.x.id : r.x.stranka_id] || "")}</td></tr>`).join("")}</table></div>` : '<div class="empty">Še ni aktivnosti.</div>'}</div>
    <div class="card"><h2>Odprta odstopanja in CAPA</h2>${capaOpen.length ? `<div class="tw"><table class="t"><tr><th>Opis</th><th>Rok</th><th>Stranka</th></tr>${capaOpen.slice(0, 12).map(c => `<tr class="click" onclick="location.hash='#/stranka/${c.stranka_id}/capa'"><td>${esc((c.opis || "").slice(0, 80))}</td><td>${dueBadge(c.rok)}</td><td>${esc(sm[c.stranka_id] || "")}</td></tr>`).join("")}</table></div>` : '<div class="empty">Ni odprtih ukrepov.</div>'}</div>
  </div>`;
  const save = () => { sessionStorage.setItem("dflt", JSON.stringify({ sid: $("#fs") ? $("#fs").value : "", st: $("#fst").value, od: $("#fod").value, do: $("#fdo").value })); pageDashboard(v); };
  for (const id of ["fs", "fst", "fod", "fdo"]) if ($("#" + id)) $("#" + id).onchange = save;
  $("#fx").onclick = () => { sessionStorage.removeItem("dflt"); pageDashboard(v); };
  if (typeof dashDodatki === "function") dashDodatki(v, d); // prvi koraki, opozorila sistema
}

async function pageStranke(v) {
  const el = document.createElement("div"); v.innerHTML = ""; v.appendChild(el);
  await listView(el, "stranke", null, { open: r => location.hash = "#/stranka/" + r.id + "/podatki", create: reload => openForm("stranke", null, null, reload) });
}

navItem("nadzorna", "Nadzorna plošča", "#/nadzorna");
navItem("stranke", "Stranke", "#/stranke", ["admin", "svetovalec"]);
navItem("moja", "Moje podjetje", "#/moja", ["odgovorna", "zaposleni"]);
route(/^\/nadzorna$/, pageDashboard, "Nadzorna plošča", "nadzorna");
route(/^\/stranke$/, pageStranke, "Stranke", "stranke");
route(/^\/moja$/, async v => { const s = await D.list("stranke"); if (s[0]) location.hash = "#/stranka/" + (s.find(x => x.id === ME.u.stranka_id) || s[0]).id + "/podatki"; else v.innerHTML = '<p class="empty">Za vaš uporabniški račun ni določene stranke.</p>'; }, "Moje podjetje", "moja");
