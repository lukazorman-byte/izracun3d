// Koledar, storitve (pregled), uporabniki, administracija.
let calState = { y: new Date().getFullYear(), m: new Date().getMonth() };
async function pageKoledar(v) {
  const flt = JSON.parse(sessionStorage.getItem("cflt") || "{}");
  const d = await loadAll(flt.sid ? { stranka_id: flt.sid } : null);
  const all = collectDeadlines(d);
  const types = [...new Set(all.map(x => x.tip))].sort();
  const dl = all.filter(x => !flt.tip || x.tip === flt.tip);
  const { y, m } = calState, first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, nd = new Date(y, m + 1, 0).getDate();
  const MES = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let dd = 1; dd <= nd; dd++) cells.push(`${y}-${pad(m + 1)}-${pad(dd)}`);
  const sm = mapOf(d.stranke);
  v.innerHTML = `<div class="row"><button class="btn ghost sec sm" id="cp">‹</button><b style="min-width:150px;text-align:center">${MES[m]} ${y}</b><button class="btn ghost sec sm" id="cn">›</button><button class="btn ghost sec sm" id="ct">Danes</button><span class="sp"></span>
   ${isStaff() ? `<select id="cs" style="max-width:220px"><option value="">Vse stranke</option>${d.stranke.map(s => `<option value="${s.id}" ${flt.sid === s.id ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select>` : ""}
   <select id="ctip" style="max-width:200px"><option value="">Vse vrste</option>${types.map(t => `<option ${flt.tip === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
   ${isStaff() || ME.u.vloga === "odgovorna" ? '<button class="btn" id="cadd">+ Dogodek</button>' : ""}</div>
   <div class="cal">${["pon", "tor", "sre", "čet", "pet", "sob", "ned"].map(x => `<div class="h">${x}</div>`).join("")}${cells.map(c => c ? `<div class="d ${c === today() ? "today" : ""}"><b>${+c.slice(8)}</b>${dl.filter(x => x.datum === c).slice(0, 4).map(x => `<a class="ev ${daysTo(x.datum) < 0 ? "bad" : ""}" href="${x.href}" title="${esc(x.naslov + (x.stranka ? " – " + x.stranka : ""))}">${esc(x.naslov)}</a>`).join("")}${dl.filter(x => x.datum === c).length > 4 ? `<span class="mut">+${dl.filter(x => x.datum === c).length - 4}</span>` : ""}</div>` : '<div class="d o"></div>').join("")}</div>
   <h2 style="margin-top:20px">Roki v naslednjih 30 dneh</h2><div class="tw"><table class="t"><tr><th>Rok</th><th>Vrsta</th><th>Kaj</th>${isStaff() ? "<th>Stranka</th>" : ""}</tr>${dl.filter(x => daysTo(x.datum) <= 30).slice(0, 60).map(x => `<tr class="click" onclick="location.hash='${x.href.slice(1)}'"><td>${dueBadge(x.datum)}</td><td>${esc(x.tip)}</td><td>${esc(x.naslov)}</td>${isStaff() ? `<td>${esc(x.stranka)}</td>` : ""}</tr>`).join("") || '<tr><td colspan="4" class="empty">Ni rokov.</td></tr>'}</table></div>
   <div class="row" style="margin-top:12px"><button class="btn ghost sec" id="cics">Izvozi v koledar (.ics)</button><span class="mut">Datoteko .ics uvozite v Google Koledar, Outlook ali telefon.</span></div>`;
  $("#cp").onclick = () => { calState = m ? { y, m: m - 1 } : { y: y - 1, m: 11 }; pageKoledar(v); };
  $("#cn").onclick = () => { calState = m < 11 ? { y, m: m + 1 } : { y: y + 1, m: 0 }; pageKoledar(v); };
  $("#ct").onclick = () => { calState = { y: new Date().getFullYear(), m: new Date().getMonth() }; pageKoledar(v); };
  const sv = () => { sessionStorage.setItem("cflt", JSON.stringify({ sid: $("#cs") ? $("#cs").value : "", tip: $("#ctip").value })); pageKoledar(v); };
  if ($("#cs")) $("#cs").onchange = sv; $("#ctip").onchange = sv;
  if ($("#cadd")) $("#cadd").onclick = () => {
    const pick = isStaff() ? `<label class="f req"><span>Stranka</span><select id="ps">${d.stranke.map(s => `<option value="${s.id}">${esc(s.naziv)}</option>`).join("")}</select></label>` : "";
    const sid = isStaff() ? null : d.stranke[0] && d.stranke[0].id;
    if (!isStaff() && !sid) return toast("Ni stranke.", true);
    if (isStaff()) modal("Dogodek za stranko", pick, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Naprej", fn: () => { const s = $("#ps").value; setTimeout(() => openForm("dogodki", null, { stranka_id: s, obrati: {} }, () => pageKoledar(v)), 50); } }]);
    else openForm("dogodki", null, { stranka_id: sid, obrati: {} }, () => pageKoledar(v));
  };
  $("#cics").onclick = () => {
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HiGiFood//HACCP//SL", "CALSCALE:GREGORIAN"];
    dl.forEach((x, i) => { const dt = x.datum.replace(/-/g, ""); L.push("BEGIN:VEVENT", `UID:${i}-${dt}@higifood`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${dt}`, `SUMMARY:${(x.naslov + (x.stranka ? " – " + x.stranka : "")).replace(/[,;\n]/g, " ")}`, "END:VEVENT"); });
    L.push("END:VCALENDAR");
    dlBlob(new Blob([L.join("\r\n")], { type: "text/calendar" }), "higifood-roki.ics");
  };
}

async function pageStoritve(v) {
  const d = await loadAll();
  const rows = d.stranke.map(s => {
    const st = d.storitve.filter(x => x.stranka_id === s.id).sort((a, b) => b.datum.localeCompare(a.datum));
    const last = st[0], min = st.reduce((a, r) => a + (Number(r.minute) || 0), 0), nxt = st.map(x => x.naslednji_pregled).filter(Boolean).sort().pop() || s.naslednji_pregled;
    return { s, n: st.length, last, min, nxt, miss: missingData(d, s) };
  });
  v.innerHTML = `<p class="note info">Pregled opravljenih storitev po strankah. Posamezne storitve vnesete v profilu stranke (zavihek »Storitve«).</p><div class="tw"><table class="t"><tr><th>Stranka</th><th>Storitev</th><th>Zadnja</th><th>Čas</th><th>Paket</th><th>Dokumentacija</th><th>Naslednji pregled</th><th>Manjka</th></tr>${rows.map(r => `<tr class="click" onclick="location.hash='#/stranka/${r.s.id}/storitve'"><td><b>${esc(r.s.naziv)}</b></td><td>${r.n}</td><td>${r.last ? fdate(r.last.datum) + " – " + esc(r.last.vrsta || "") : "–"}</td><td>${(r.min / 60).toFixed(1)} h</td><td>${esc(r.s.paket || "")}</td><td>${esc(r.last ? r.last.stanje_dokumentacije || "" : "")}</td><td>${dueBadge(r.nxt)}</td><td>${r.miss.length}</td></tr>`).join("") || '<tr><td colspan="8" class="empty">Ni strank.</td></tr>'}</table></div>
  <div class="row" style="margin-top:12px"><button class="btn ghost sec" id="sx">Izvozi povzetek (Excel)</button></div>`;
  $("#sx").onclick = () => downloadXlsx("storitve-povzetek.xlsx", [{ ime: "Storitve", glava: ["Stranka", "Št. storitev", "Zadnja storitev", "Skupaj minut", "Paket", "Naslednji pregled", "Manjkajoči podatki"], vrste: rows.map(r => [r.s.naziv, r.n, r.last ? r.last.datum : "", r.min, r.s.paket || "", r.nxt || "", r.miss.join("; ")]) }]);
}

async function pageUporabniki(v) {
  const us = await api("GET", "/api/uporabniki"), st = await D.list("stranke"), sm = mapOf(st);
  v.innerHTML = `<div class="row"><span class="sp"></span><button class="btn" id="un">+ Nov uporabnik</button></div><div class="tw"><table class="t"><tr><th>Ime</th><th>E-naslov</th><th>Vloga</th><th>Stranka / dodeljene stranke</th><th>Stanje</th><th>2FA</th><th>Zadnja prijava</th></tr>${us.map(u => `<tr class="click" data-id="${u.id}"><td>${esc(u.ime)}</td><td>${esc(u.email)}</td><td>${esc(ROLE[u.vloga])}</td><td>${u.vloga === "svetovalec" ? esc(u.stranke.map(i => sm[i] || "?").join(", ") || "–") : esc(sm[u.stranka_id] || "–")}</td><td>${u.aktiven ? '<span class="badge ok">aktiven</span>' : '<span class="badge bad">onemogočen</span>'}</td><td>${u.totp ? '<span class="badge ok">da</span>' : '<span class="mut">ne</span>'}</td><td>${fdt(u.zadnja_prijava)}</td></tr>`).join("")}</table></div>`;
  const form = (u) => {
    const isNew = !u;
    modal(isNew ? "Nov uporabnik" : "Uredi uporabnika", `<p class="err" id="ferr"></p><div class="fgrid"><label class="f req"><span>Ime in priimek</span><input id="u_i" value="${esc(u ? u.ime : "")}"></label><label class="f req"><span>E-naslov</span><input id="u_e" type="email" value="${esc(u ? u.email : "")}" ${u ? "disabled" : ""}></label>
    <label class="f"><span>Vloga</span><select id="u_v" ${u ? "disabled" : ""}>${Object.keys(ROLE).map(r => `<option value="${r}" ${u && u.vloga === r ? "selected" : ""}>${ROLE[r]}</option>`).join("")}</select></label>
    <label class="f"><span>Stranka (za odgovorno osebo / zaposlenega)</span><select id="u_s"><option value=""></option>${st.map(s => `<option value="${s.id}" ${u && u.stranka_id === s.id ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select></label>
    <label class="f wide"><span>Dodeljene stranke (za svetovalca; Ctrl/⌘ za več)</span><select id="u_ss" multiple size="5">${st.map(s => `<option value="${s.id}" ${u && (u.stranke || []).includes(s.id) ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select></label>
    <label class="f ${u ? "" : "req"}"><span>${u ? "Novo začasno geslo (prazno = brez spremembe)" : "Začasno geslo (vsaj 10 znakov)"}</span><input id="u_p" autocomplete="off"></label>${u ? `<label class="f"><span>Aktiven</span><input type="checkbox" id="u_a" ${u.aktiven ? "checked" : ""}></label>` : ""}${u && u.totp && ME.u.vloga === "admin" ? `<label class="f wide"><span><input type="checkbox" id="u_2f"> Izklopi dvostopenjsko prijavo (uporabnik je izgubil telefon in rezervne kode)</span></label>` : ""}</div>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Shrani", fn: async () => {
      try {
        const sel = [...$("#u_ss").selectedOptions].map(o => o.value);
        if (u) { const b = { ime: $("#u_i").value, aktiven: $("#u_a").checked, stranke: sel, stranka_id: $("#u_s").value }; if ($("#u_p").value) b.geslo = $("#u_p").value; if ($("#u_2f") && $("#u_2f").checked) b.izklopi_2fa = true; await api("PUT", "/api/uporabniki/" + u.id, b); }
        else await api("POST", "/api/uporabniki", { ime: $("#u_i").value, email: $("#u_e").value, geslo: $("#u_p").value, vloga: $("#u_v").value, stranka_id: $("#u_s").value || null, stranke: sel });
        toast("Shranjeno"); pageUporabniki(v);
      } catch (e) { $("#ferr").textContent = e.message; return false; }
    } }]);
  };
  $("#un").onclick = () => form(null);
  $$("tr[data-id]", v).forEach(tr => tr.onclick = () => form(us.find(u => u.id === tr.dataset.id)));
}

async function pageAdmin(v) {
  const [audit, upd, ns, kn] = await Promise.all([api("GET", "/api/revizijska-sled?n=100"), api("GET", "/api/posodobitve").catch(() => []), api("GET", "/api/nastavitve"), api("GET", "/api/kopija/nastavitve")]);
  v.innerHTML = `<div class="grid g2">
  <div class="card"><h2>Varnostne kopije</h2><p class="mut">Kopija vsebuje bazo znanja, vse podatke strank, priloge in uporabnike. Samodejna kopija se naredi vsak dan (zadnjih 30 se hrani v mapi <code>podatki/_kopije</code>). Kopijo hranite na varnem mestu: vsebuje osebne podatke.</p>
   <div class="row"><a class="btn" href="/api/kopija" download>Prenesi kopijo (.zip)</a><button class="btn ghost" id="kenc">Prenesi šifrirano kopijo (.hfbk)</button><label class="btn ghost sec" style="display:inline-block">Obnovi iz kopije<input type="file" id="rf" accept=".zip,.hfbk" hidden></label></div><p class="mut">Pred obnovo se samodejno naredi kopija trenutnega stanja.</p></div>
  <div class="card"><h2>Kopija na drugo mesto</h2><p class="mut">Dnevna kopija se poleg mape <code>podatki/_kopije</code> prepiše še v mapo, ki jo določite (npr. USB-ključ, zunanji disk ali sinhronizirana mapa Dropbox/OneDrive). Hrani se zadnjih 30.</p>
   <div class="row"><input id="k_m" value="${esc(kn.mapa)}" placeholder="npr. D:\\Kopije\\HACCP ali /Volumes/USB/HACCP" style="max-width:420px"><button class="btn" id="k_s">Shrani in naredi kopijo</button><button class="btn ghost sec" id="k_z">Kopija zdaj</button></div>
   <div class="row"><label class="f" style="margin:0;min-width:300px"><span>Geslo za šifriranje kopij na drugem mestu (neobvezno, vsaj 8 znakov)</span><input type="password" id="k_g" value="${kn.sifrirano ? "********" : ""}" autocomplete="new-password"></label><span class="mut">Geslo je shranjeno na strežniku (varuje kopijo na USB/oblaku, ne pa strežnika samega). Brez njega kopije ne morete obnoviti; zapišite ga.</span></div>
   <p id="k_st" class="mut">${kn.stanje && kn.stanje.cas ? (kn.stanje.ok ? `<span class="badge ok">Zadnja kopija na drugo mesto: ${fdt(kn.stanje.cas)}</span> ${esc(kn.stanje.mapa)}` : `<span class="badge bad">Zadnja kopija ni uspela: ${esc(kn.stanje.napaka)}</span>`) : "Ni nastavljeno."}</p></div>
  <div class="card"><h2>E-poštna obvestila</h2><p class="mut">Neobvezno. Če vnesete SMTP strežnik, sistem enkrat dnevno pošlje opomnike o rokih (pregledi, poteki izobraževanj in opreme, odprti CAPA, dogodki iz koledarja) odgovornim osebam strank in svetovalcem. Geslo se hrani samo na strežniku. Brez SMTP-ja ostanejo opozorila na nadzorni plošči.</p>
   <div class="fgrid"><label class="f"><span>SMTP strežnik</span><input id="n_s" value="${esc(ns.streznik || "")}"></label><label class="f"><span>Vrata</span><input id="n_v" type="number" value="${esc(ns.vrata || "")}" placeholder="587"></label><label class="f"><span>Varnost</span><select id="n_z"><option value="starttls" ${ns.varnost === "starttls" ? "selected" : ""}>STARTTLS (587)</option><option value="ssl" ${ns.varnost === "ssl" ? "selected" : ""}>SSL/TLS (465)</option><option value="brez" ${ns.varnost === "brez" ? "selected" : ""}>brez (samo notranje omrežje)</option></select></label><label class="f"><span>Uporabniško ime</span><input id="n_u" value="${esc(ns.uporabnik || "")}" autocomplete="off"></label><label class="f"><span>Geslo</span><input id="n_p" type="password" value="${esc(ns.geslo || "")}" autocomplete="new-password"></label><label class="f"><span>Pošiljatelj (Od)</span><input id="n_o" value="${esc(ns.od || "")}" placeholder="HiGiFood &lt;obvestila@domena.si&gt;"></label><label class="f wide"><span>Naslov aplikacije v sporočilu</span><input id="n_a" value="${esc(ns.naslov_aplikacije || "")}" placeholder="https://haccp.vasa-domena.si"></label></div>
   <div class="row"><button class="btn" id="n_save">Shrani nastavitve</button><input id="n_t" placeholder="testni e-naslov" style="max-width:220px"><button class="btn ghost sec" id="n_test">Pošlji test</button><button class="btn ghost sec" id="n_now">Pošlji opomnike zdaj</button></div></div>
  <div class="card" id="tiskc"><h2>Tiskanje dokumentacije</h2><p class="mut">Določite, katero dokumentacijo si lahko posamezne vloge izpišejo (PDF, Word, Excel, tisk). Administrator lahko izpisuje vse. Omejitev velja za izpisovanje v aplikaciji.</p><div id="tiskb"></div></div>
  <div class="card" id="omrc"><h2>Dostop iz omrežja (testiranje)</h2><div id="omrb"><p class="mut">Nalaganje …</p></div></div>
  <div class="card" id="arhc"><h2>Arhiv evidenc</h2><p class="mut">Evidence starejše od izbranega števila let se stisnejo v datoteko v mapi <code>podatki/_arhiv</code> in odstranijo iz žive baze. Arhiv lahko prenesete ali vrnete. Zakonski roki hrambe veljajo za vas: pred arhiviranjem preverite zahteve.</p><div class="row"><label class="f" style="margin:0"><span>Starejše od (let)</span><input type="number" id="ah_l" value="5" min="1" max="30" style="width:110px"></label><button class="btn ghost sec" id="ah_p">Preveri</button><button class="btn" id="ah_a">Arhiviraj</button></div><div id="ah_r"></div></div>
  <div class="card"><h2>Logotip v dokumentih</h2><p class="mut">Logotip (PNG, JPEG ali WebP do 1,5 MB) se prikaže na naslovnici PDF in Word dokumentov. Če lastnega logotipa ne naložite, se uporabi logotip HiGiFood.</p><div class="row"><img id="lg_prev" alt="" style="max-height:60px;max-width:180px;border:1px solid var(--line);border-radius:6px;padding:4px;background:#fff" hidden><input type="file" id="lg_f" accept="image/png,image/jpeg,image/webp" style="max-width:260px"><button class="btn" id="lg_up">Naloži</button><button class="btn ghost sec" id="lg_del">Odstrani</button></div></div>
  <div class="card"><h2>Program</h2><p class="mut">Če program teče skrito (brez okna), ga tu ustavite. Ponovni zagon: <code>HiGiFood.vbs</code> ali <code>HACCP-sistem.exe</code>.</p><button class="btn danger" id="p_stop">Ustavi program</button></div>
  <div class="card"><h2>Baza znanja in orodja</h2><div class="row"><a class="btn ghost" href="/baza/">Urejevalnik baze znanja</a><a class="btn ghost" href="/generator/">Generator dokumentacije</a></div><h3>Uporabljene posodobitve baze</h3>${upd.length ? `<div class="tw"><table class="t"><tr><th>ID</th><th>Datum</th><th>Opis</th></tr>${upd.slice(-6).reverse().map(u => `<tr><td>${esc(u.id)}</td><td>${esc(u.datum)}</td><td>${esc(u.opis)}</td></tr>`).join("")}</table></div>` : '<p class="mut">Ni.</p>'}</div></div>
  <div class="card"><h2>Revizijska sled</h2><p>${audit.preveritev.ok ? `<span class="badge ok">Veriga zgoščenk veljavna (${audit.preveritev.vnosov} vnosov)</span>` : '<span class="badge bad">Revizijska sled je bila spremenjena!</span>'}</p><div class="tw" style="max-height:420px;overflow:auto"><table class="t"><tr><th>Kdaj</th><th>Kdo</th><th>Dejanje</th><th>Zbirka</th><th>Opis</th></tr>${audit.vnosi.map(e => `<tr><td>${fdt(e.cas)}</td><td>${esc(e.ime || "–")}</td><td>${esc(e.akcija)}</td><td>${esc(e.zbirka)}</td><td>${esc(e.opis)}</td></tr>`).join("")}</table></div></div>`;
  fetch("/api/logo").then(r => { if (r.ok) { const im = $("#lg_prev"); im.src = "/api/logo?t=" + Date.now(); im.hidden = false; } });
  api("GET", "/api/tisk").then(t => {
    const V = [["svetovalec", "Svetovalec"], ["odgovorna", "Odgovorna oseba"], ["zaposleni", "Zaposleni"]];
    $("#tiskb").innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Dokumentacija</th>${V.map(x => `<th>${x[1]}</th>`).join("")}</tr></thead><tbody>${Object.keys(t.kategorije).map(k => `<tr><td>${esc(t.kategorije[k])}</td>${V.map(x => `<td><input type="checkbox" data-k="${k}" data-v="${x[0]}" aria-label="${esc(t.kategorije[k] + ": " + x[1])}" ${t.pravila[k][x[0]] ? "checked" : ""}></td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="row"><button class="btn" id="tisks">Shrani</button></div>`;
    $("#tisks").onclick = async () => { const pr = {}; $$("#tiskb input[data-k]").forEach(c => { (pr[c.dataset.k] = pr[c.dataset.k] || {})[c.dataset.v] = c.checked; }); try { await api("PUT", "/api/tisk", { pravila: pr }); toast("Shranjeno"); } catch (e) { fail(e); } };
  }).catch(() => {});
  api("GET", "/api/omrezje").then(r => { $("#omrb").innerHTML = r.omrezje ? `<p>Program je dosegljiv drugim računalnikom v istem omrežju na naslovih:</p><ul>${r.naslovi.map(a => `<li><code>${esc(a)}</code></li>`).join("") || "<li>naslova ni mogoče ugotoviti</li>"}</ul><p class="mut">Povezava ni šifrirana (http): uporabljajte samo testne podatke. Če se drugi računalnik ne more povezati, zaženite <code>odpri-pozarni-zid.bat</code> kot administrator.</p>` : `<p class="mut">Program je trenutno dosegljiv samo na tem računalniku. Za testiranje na drugih računalnikih v istem omrežju ga zaženite z <code>HiGiFood-test-omrezje.vbs</code> (testni način).</p>`; }).catch(() => { $("#omrb").innerHTML = ""; });
  const arhList = async () => { const L = await api("GET", "/api/arhiv"); $("#ah_r").innerHTML = L.length ? `<div class="tw"><table class="t">${L.map(f => `<tr><td>${esc(f.ime)}</td><td>${Math.round(f.velikost / 1024)} kB</td><td>${fdt(f.cas)}</td><td style="white-space:nowrap"><a class="btn sm ghost sec" href="/api/arhiv/${encodeURIComponent(f.ime)}" download>Prenesi</a> <button class="btn sm ghost sec" data-ar="${esc(f.ime)}">Vrni v bazo</button></td></tr>`).join("")}</table></div>` : '<p class="mut">Arhiva še ni.</p>'; $$("[data-ar]").forEach(b => b.onclick = async () => { if (!window.confirm("Vrnem zapise iz arhiva v bazo?")) return; try { const r = await api("POST", "/api/arhiv/" + encodeURIComponent(b.dataset.ar) + "/obnovi"); toast("Vrnjenih zapisov: " + r.stevilo); arhList(); } catch (e) { fail(e); } }); };
  arhList().catch(() => {});
  $("#ah_p").onclick = async () => { try { const r = await api("POST", "/api/arhiv", { leta: +$("#ah_l").value, samo_preveri: true }); toast(r.stevilo + " zapisov starejših od " + fdate(r.meja)); } catch (e) { fail(e); } };
  $("#ah_a").onclick = async () => { try { const pr = await api("POST", "/api/arhiv", { leta: +$("#ah_l").value, samo_preveri: true }); if (!pr.stevilo) return toast("Ni zapisov za arhiviranje."); if (!window.confirm("Arhiviram " + pr.stevilo + " zapisov?")) return; const r = await api("POST", "/api/arhiv", { leta: +$("#ah_l").value }); toast("Arhiviranih zapisov: " + r.stevilo); arhList(); } catch (e) { fail(e); } };
  $("#lg_up").onclick = () => { const f = $("#lg_f").files[0]; if (!f) return toast("Izberite datoteko.", true); const rd = new FileReader(); rd.onload = async () => { try { await api("POST", "/api/logo", { tip: f.type, podatki: String(rd.result).split(",")[1] }); await loadLogo(); toast("Logotip shranjen"); pageAdmin(v); } catch (e) { fail(e); } }; rd.readAsDataURL(f); };
  $("#lg_del").onclick = async () => { try { await api("DELETE", "/api/logo"); await loadLogo(); toast("Logotip odstranjen"); pageAdmin(v); } catch (e) { fail(e); } };
  $("#k_s").onclick = async () => { try { const r = await api("PUT", "/api/kopija/nastavitve", { mapa: $("#k_m").value, geslo: $("#k_g").value }); toast(r.stanje && r.stanje.ok === false ? "Kopija ni uspela: " + r.stanje.napaka : "Shranjeno, kopija narejena", r.stanje && r.stanje.ok === false); pageAdmin(v); } catch (e) { fail(e); } };
  $("#k_z").onclick = async () => { try { const r = await api("POST", "/api/kopija/zdaj"); toast(r.stanje && r.stanje.ok === false ? "Kopija ni uspela: " + r.stanje.napaka : "Kopija narejena", r.stanje && r.stanje.ok === false); pageAdmin(v); } catch (e) { fail(e); } };
  $("#p_stop").onclick = () => confirmBox("Program se bo ustavil. Za ponoven zagon zaženite HiGiFood.vbs oziroma HACCP-sistem.exe. Nadaljujem?", async () => { try { await api("POST", "/api/ustavi"); document.body.innerHTML = '<div style="padding:40px;font:16px system-ui"><h2>Program je ustavljen.</h2><p>To okno lahko zaprete. Za ponoven zagon zaženite HiGiFood.vbs ali HACCP-sistem.exe.</p></div>'; } catch (e) { fail(e); } }, true);
  const nv = () => ({ streznik: $("#n_s").value, vrata: $("#n_v").value, varnost: $("#n_z").value, uporabnik: $("#n_u").value, geslo: $("#n_p").value, od: $("#n_o").value, naslov_aplikacije: $("#n_a").value });
  $("#n_save").onclick = () => api("PUT", "/api/nastavitve", nv()).then(() => toast("Shranjeno")).catch(fail);
  $("#n_test").onclick = async () => { try { await api("PUT", "/api/nastavitve", nv()); await api("POST", "/api/obvestila/test", { komu: $("#n_t").value }); toast("Testno sporočilo poslano"); } catch (e) { fail(e); } };
  $("#n_now").onclick = async () => { try { const r = await api("POST", "/api/obvestila/zdaj"); toast(`Prejemnikov: ${r.prejemniki}, poslano: ${r.poslano}${r.napake.length ? ", napake: " + r.napake.join("; ") : ""}`, !!r.napake.length); } catch (e) { fail(e); } };
  $("#kenc").onclick = () => modal("Šifrirana kopija", `<p class="err" id="ferr"></p><label class="f req"><span>Geslo (vsaj 8 znakov)</span><input type="password" id="kg1" autocomplete="new-password"></label><label class="f req"><span>Ponovite geslo</span><input type="password" id="kg2" autocomplete="new-password"></label><p class="note">Če geslo pozabite, kopije ni mogoče obnoviti.</p>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Prenesi", fn: async () => { if ($("#kg1").value !== $("#kg2").value) { $("#ferr").textContent = "Gesli se ne ujemata."; return false; } try { const r = await fetch("/api/kopija/sifrirana", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geslo: $("#kg1").value }) }); if (!r.ok) throw new Error((await r.json()).napaka); dlBlob(await r.blob(), "higifood-kopija-" + today() + ".hfbk"); } catch (e) { $("#ferr").textContent = e.message; return false; } } }]);
  $("#rf").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const enc = /\.hfbk$/i.test(f.name); let geslo = "";
    const go = () => confirmBox("Obnova prepiše vse trenutne podatke s kopijo. Nadaljujem?", async () => {
      const buf = await f.arrayBuffer(); let bin = ""; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      const r = await fetch("/api/obnovi", { method: "POST", headers: Object.assign({ "Content-Type": "text/plain" }, geslo ? { "X-Kopija-Geslo": geslo } : {}), body: btoa(bin) }); const j = await r.json();
      if (!r.ok) throw new Error(j.napaka); toast("Obnovljeno: " + j.datotek + " datotek"); setTimeout(() => location.reload(), 800);
    }, true);
    if (enc) modal("Šifrirana kopija", `<label class="f req"><span>Geslo kopije</span><input type="password" id="kg0" autocomplete="off"></label>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Naprej", fn: () => { geslo = $("#kg0").value; if (!geslo) return false; setTimeout(go, 60); } }]); else go();
  };
}

navItem("koledar", "Koledar in roki", "#/koledar");
navItem("kos", "Koš (izbrisano)", "#/kos", ["admin", "svetovalec", "odgovorna"]);
navItem("storitve", "Storitve", "#/storitve", ["admin", "svetovalec"]);
navItem("-", "Orodja");
navItem("generator", "Generator dokumentacije", "/generator/");
navItem("uporabniki", "Uporabniki", "#/uporabniki", ["admin", "svetovalec"]);
navItem("admin", "Administracija", "#/admin", ["admin"]);
route(/^\/koledar$/, pageKoledar, "Koledar in roki", "koledar");
route(/^\/storitve$/, pageStoritve, "Storitve po strankah", "storitve");
route(/^\/uporabniki$/, pageUporabniki, "Uporabniki", "uporabniki");
route(/^\/admin$/, pageAdmin, "Administracija", "admin");

async function pageKos(v) {
  const L = await api("GET", "/api/kos"), IME = { sarze: "Šarža", jedi: "Jed", certifikacija: "Ocena certifikacije", potrditve: "Potrditev", stranke: "Stranka", obrati: "Obrat", osebje: "Zaposleni", dobavitelji: "Dobavitelj", oprema: "Oprema", usposabljanja: "Usposabljanje", nacrti: "HACCP načrt", navodila: "Navodilo", dogodki: "Dogodek", storitve: "Storitev", urnik: "Urnik vnosov", priloge: "Priloga", ciscenje_nacrt: "Opravilo čiščenja", vabe: "Vaba", kemikalije: "Čistilo", tlorisi: "Tloris" };
  v.innerHTML = `<p class="note info">Izbrisani zapisi se hranijo 30 dni; v tem času jih lahko obnovite. Pri izbrisani stranki se obnovijo tudi njeni obrati, zaposleni, načrti in drugo. Evidence in neskladnosti se ne brišejo nikoli.</p><div class="tw"><table class="t"><tr><th>Kaj</th><th>Vrsta</th><th>Stranka</th><th>Izbrisano</th><th>Izbrisal</th><th>Še dni</th><th></th></tr>${L.map(x => `<tr><td>${esc(x.ime)}${x.otrok ? ` <span class="mut">(+ ${x.otrok} podrejenih)</span>` : ""}</td><td>${esc(IME[x.zbirka] || x.zbirka)}</td><td>${esc(x.stranka)}</td><td>${fdt(x.cas)}</td><td>${esc(x.izbrisal || "")}</td><td>${x.preostalo_dni}</td><td style="white-space:nowrap"><button class="btn sm" data-ob="${x.id}">Obnovi</button>${ME.u.vloga === "admin" ? ` <button class="btn sm danger" data-tr="${x.id}">Izbriši trajno</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">Koš je prazen.</td></tr>'}</table></div>`;
  $$("[data-ob]", v).forEach(b => b.onclick = async () => { try { await api("POST", "/api/kos/" + b.dataset.ob + "/obnovi"); toast("Obnovljeno"); pageKos(v); } catch (e) { fail(e); } });
  $$("[data-tr]", v).forEach(b => b.onclick = () => confirmBox("Zapis bo trajno izbrisan. Nadaljujem?", async () => { await api("DELETE", "/api/kos/" + b.dataset.tr); toast("Izbrisano trajno"); pageKos(v); }, true));
}
route(/^\/kos$/, pageKos, "Koš (izbrisano)", "kos");
