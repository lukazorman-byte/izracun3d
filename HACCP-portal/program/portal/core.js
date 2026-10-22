// Jedro portala: API, pomočniki, obrazci, tabele, usmerjevalnik. Dostop vedno preverja strežnik; tu se skrivajo samo gumbi.
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ME = { u: null };
const ROLE = { admin: "Administrator HiGiFood", svetovalec: "HACCP-svetovalec", odgovorna: "Odgovorna oseba stranke", zaposleni: "Zaposleni stranke" };
const isStaff = () => ME.u && (ME.u.vloga === "admin" || ME.u.vloga === "svetovalec");
const STATE = {}; // stanje strežnika: testno okolje, različica
const VIS = { moje: null };
function effPrev() { try { return JSON.parse(sessionStorage.getItem("haccp_prev") || "null"); } catch { return null; } }
const vis = id => !VIS.moje || VIS.moje[id] !== false;
async function loadVidnost() {
  const pv = effPrev();
  try { const r = await api("GET", "/api/vidnost" + (pv && ME.real ? "?kot=" + pv.kot + (pv.sid ? "&stranka_id=" + pv.sid : "") : "")); VIS.moje = r.moje; } catch (e) { VIS.moje = null; }
}
const modulZaPot = h => /^\/carovnik\//.test(h) ? "tab:nacrti" : /^\/tloris\//.test(h) ? "tab:tloris" : /^\/qr\//.test(h) ? "tab:oprema" : /^\/vnos\//.test(h) ? "tab:evidence" : null;
const PRINT = { moje: null };
async function loadTisk() { try { const r = await api("GET", "/api/tisk"); PRINT.moje = r.moje; try { localStorage.setItem("haccp_tisk", JSON.stringify(r.moje)); } catch {} } catch (e) { try { PRINT.moje = JSON.parse(localStorage.getItem("haccp_tisk") || "null"); } catch {} } }
function printKey(name) { const n = String(name || "").toLowerCase(); return n.startsWith("haccp") ? "haccp" : n.startsWith("navodilo") ? "navodila" : n.startsWith("evidence") ? "evidence" : n.startsWith("capa") ? "capa" : n.startsWith("inspekcija") ? "inspekcija" : n.startsWith("obrazec") ? "obrazci" : n.startsWith("qr") ? "qr" : "ostalo"; }
function canPrint(name) { if (!ME.u || ME.u.vloga === "admin" || !PRINT.moje) return true; if (PRINT.moje[printKey(name)]) return true; toast("Izpis te dokumentacije vam je onemogočil administrator.", true); return false; }
const canManage = () => ME.u && ME.u.vloga !== "zaposleni";

async function api(method, url, body) {
  let r;
  try { r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { const er = new Error("Ni povezave s strežnikom."); er.offline = true; throw er; }
  let j = null; try { j = await r.json(); } catch {}
  if (r.status === 401 && !url.includes("/auth/prijava") && !url.includes("/auth/jaz")) { ME.u = null; showLogin(); throw new Error("Seja je potekla. Prijavite se znova."); }
  if (!r.ok) { const er = new Error((j && j.napaka) || "Napaka " + r.status); er.data = j; er.status = r.status; if (r.status === 503 && j && j.napaka === "Brez povezave") { er.offline = true; er.message = "Ni povezave s strežnikom."; } throw er; }
  return j;
}
// čakalna vrsta zapisov evidenc, ustvarjenih brez povezave (localStorage); pošlje se ob vrnitvi povezave
const OFFQ = "haccp_offq";
const offq = () => { try { return JSON.parse(localStorage.getItem(OFFQ) || "[]"); } catch { return []; } };
const offqSave = a => { try { localStorage.setItem(OFFQ, JSON.stringify(a)); } catch {} drawOffBadge(); };
function drawOffBadge() {
  const el = document.getElementById("offbadge"); if (!el) return; const n = offq().length, off = navigator.onLine === false;
  el.hidden = !n && !off; el.className = "badge " + (n ? "warn" : "info"); el.textContent = (off ? "Brez povezave" : "") + (n ? (off ? " · " : "") + "čaka na pošiljanje: " + n : "");
  el.title = n ? "Kliknite za pošiljanje" : "";
}
let syncing = false;
async function syncOffQueue(manual) {
  if (syncing || !ME.u) return; let q = offq(); if (!q.length) { drawOffBadge(); return; } syncing = true; let sent = 0, dropped = 0;
  try {
    for (const it of q.slice()) {
      try { await api("POST", "/api/d/" + it.c, it.body); sent++; q = q.filter(x => x !== it && x.t !== it.t); offqSave(q); }
      catch (e) { if (e.offline || /seja je potekla/i.test(e.message)) break; dropped++; q = q.filter(x => x.t !== it.t); offqSave(q); toast("Zapis iz čakalne vrste je bil zavrnjen: " + e.message, true); }
    }
    if (sent) { toast("Poslano zapisov, ustvarjenih brez povezave: " + sent); if (typeof render === "function") render(); }
    else if (manual && q.length) toast("Strežnik ni dosegljiv.", true);
  } finally { syncing = false; drawOffBadge(); }
}
window.addEventListener("online", () => { drawOffBadge(); syncOffQueue(); });
window.addEventListener("offline", drawOffBadge);
setInterval(() => { if (offq().length) syncOffQueue(); }, 30000);
const D = {
  list: (c, q) => api("GET", "/api/d/" + c + (q ? "?" + new URLSearchParams(q) : "")),
  add: async (c, o) => {
    try { return await api("POST", "/api/d/" + c, o); }
    catch (e) {
      if (e.offline && c === "evidence") { const body = Object.assign({ cas: new Date().toISOString() }, o), t = Date.now() + Math.random(); offqSave([...offq(), { t, c, body }]); toast("Brez povezave: zapis je shranjen v napravi in se pošlje, ko bo povezava."); return Object.assign({ id: "q" + t, ustvaril_ime: ME.u ? ME.u.ime : "", status: "čaka", verzija: 1, revizije: [] }, body); }
      throw e;
    }
  },
  set: (c, id, o) => api("PUT", "/api/d/" + c + "/" + id, o),
  del: (c, id) => api("DELETE", "/api/d/" + c + "/" + id)
};
let _baza = null;
const baza = async () => _baza || (_baza = await api("GET", "/api/baza"));

function toast(m, err) { const t = $("#toast"); t.textContent = m; t.className = "toast show" + (err ? " err" : ""); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "toast", err ? 5000 : 2500); }
const fail = e => toast(e.message || String(e), true);

// datumi
const pad = n => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const fdate = s => { if (!s) return ""; const m = String(s).match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : s; };
const fdt = s => { if (!s) return ""; const d = new Date(s); return isNaN(d) ? s : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const daysTo = s => s ? Math.ceil((new Date(String(s).slice(0, 10) + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5) : null;
const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
function dueBadge(s) {
  const n = daysTo(s); if (n === null) return '<span class="mut">–</span>';
  if (n < 0) return `<span class="badge bad">${fdate(s)} (zamuda ${-n} d)</span>`;
  if (n <= 30) return `<span class="badge warn">${fdate(s)} (čez ${n} d)</span>`;
  return `<span class="badge ok">${fdate(s)}</span>`;
}
const STAT = { aktivna: "ok", potrjeno: "ok", opravljeno: "ok", zaprto: "ok", skladno: "ok", "v pripravi": "warn", osnutek: "warn", "v pregledu": "info", "v potrjevanju": "info", vneseno: "info", odprto: "bad", neskladno: "bad", zamuda: "bad", zastarelo: "bad", načrtovano: "info", neaktivna: "" };
const badge = s => s ? `<span class="badge ${STAT[s] || ""}">${esc(s)}</span>` : "";

// ---------- modalno okno ----------
function modal(title, html, buttons) {
  const d = $("#dlg"); $("#dlg-t").textContent = title; $("#dlg-b").innerHTML = html;
  const f = $("#dlg-f"); f.innerHTML = "";
  for (const b of buttons || [{ t: "Zapri", cls: "ghost sec" }]) {
    const el = document.createElement("button"); el.className = "btn " + (b.cls || ""); el.textContent = b.t;
    el.onclick = async () => { if (!b.fn) return d.close(); el.disabled = true; try { const r = await b.fn(); if (r !== false) d.close(); } catch (e) { fail(e); } el.disabled = false; };
    f.appendChild(el);
  }
  if (!d.open) { modal.prev = document.activeElement; d.showModal(); }
  $$("label.f.req input,label.f.req select,label.f.req textarea", d).forEach(e => e.setAttribute("aria-required", "true"));
  const first = $("#dlg-b input:not([type=hidden]):not([disabled]),#dlg-b select,#dlg-b textarea", d); if (first && !/^(checkbox|file)$/.test(first.type)) setTimeout(() => { const ae = document.activeElement; if (!(ae && $("#dlg-b").contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName))) first.focus(); }, 30); // ne prestavi kurzorja, če uporabnik že piše v polje
  return d;
}
$("#dlg-x").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("close", () => { const p = modal.prev; modal.prev = null; if (p && document.contains(p) && p.focus) try { p.focus(); } catch {} });
const confirmBox = (msg, fn, danger) => modal("Potrditev", `<p>${esc(msg)}</p>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Potrdi", cls: danger ? "danger" : "", fn }]);

// ---------- obrazec iz specifikacije ----------
// polje: {k, l, t: text|area|num|date|datetime|email|sel|bool|tags|ref, o: [možnosti], req, wide, ph, ref: zbirka}
function fieldHtml(f, v, ctx) {
  const id = "f_" + f.k, val = v === undefined || v === null ? "" : v;
  let inp;
  const opts = typeof f.o === "function" ? f.o(ctx) : f.o;
  if (f.t === "area") inp = `<textarea id="${id}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}>${esc(val)}</textarea>`;
  else if (f.t === "sel") inp = `<select id="${id}"><option value=""></option>${(opts || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select>`;
  else if (f.t === "multi") inp = `<div id="${id}" class="multi" role="group" aria-label="${esc(f.l)}" style="display:flex;flex-wrap:wrap;gap:4px 14px">${(opts || []).map((o, i) => `<label style="display:flex;gap:5px;align-items:center;font-weight:400"><input type="checkbox" value="${esc(o)}" ${[].concat(val || []).includes(o) ? "checked" : ""}> ${i + 1}. ${esc(o)}</label>`).join("")}</div>`;
  else if (f.t === "bool") inp = `<input type="checkbox" id="${id}" ${val ? "checked" : ""}>`;
  else if (f.t === "tags") inp = `<input id="${id}" value="${esc([].concat(val || []).join(", "))}" placeholder="vrednosti, ločene z vejico">`;
  else if (f.t === "datetime") inp = `<input type="datetime-local" id="${id}" value="${esc(val ? toLocal(val) : "")}">`;
  else inp = `<input id="${id}" type="${{ num: "number", date: "date", email: "email" }[f.t] || "text"}" ${f.t === "num" ? 'step="any"' : ""} value="${esc(val)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}>`;
  return `<label class="f ${f.req ? "req" : ""} ${f.wide || f.t === "area" ? "wide" : ""}"><span>${esc(f.l)}</span>${inp}${f.h ? `<small class="mut">${esc(f.h)}</small>` : ""}</label>`;
}
function toLocal(s) { const d = new Date(s); return isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function readFields(fields) {
  const o = {};
  for (const f of fields) {
    const el = $("#f_" + f.k); if (!el) continue;
    let v;
    if (f.t === "multi") v = $$("input:checked", el).map(i => i.value);
    else if (f.t === "bool") v = el.checked;
    else if (f.t === "num") v = el.value === "" ? "" : Number(el.value);
    else if (f.t === "tags") v = el.value.split(",").map(x => x.trim()).filter(Boolean);
    else if (f.t === "datetime") v = el.value ? new Date(el.value).toISOString() : "";
    else v = el.value.trim();
    o[f.k] = v;
  }
  return o;
}
function fieldsFor(spec, ctx) { return typeof spec.fields === "function" ? spec.fields(ctx) : spec.fields; }

// odpre obrazec za dodajanje/urejanje zapisa zbirke
function openForm(coll, rec, ctx, done) {
  const spec = SPEC[coll], fields = fieldsFor(spec, ctx);
  const edit = !!rec, locked = edit && rec.status === "potrjeno" && spec.rec;
  const html = `<p class="err" id="ferr"></p>${spec.intro ? `<p class="note info">${esc(spec.intro)}</p>` : ""}<div class="fgrid">${fields.map(f => fieldHtml(f, edit ? rec[f.k] : (f.def !== undefined ? (typeof f.def === "function" ? f.def(ctx) : f.def) : ""), ctx)).join("")}${spec.foto ? `<label class="f wide"><span>Fotografija (neobvezno)</span><input type="file" id="f__foto" accept="image/*" capture="environment"></label>${edit && rec.slike && rec.slike.length ? `<p class="wide mut">Priloge: ${rec.slike.map((i, n) => `<a href="/api/priloga/${i}" target="_blank" rel="noopener">slika ${n + 1}</a>`).join(", ")}</p>` : ""}` : ""}${locked || (spec.rev && edit) ? `<label class="f wide ${locked ? "req" : ""}"><span>Razlog spremembe${locked ? " (obvezno, zapis je potrjen)" : ""}</span><input id="f__razlog"></label>` : ""}</div>${edit && rec.revizije && rec.revizije.length ? `<h3>Zgodovina sprememb</h3>${revHtml(rec)}` : ""}`;
  modal((edit ? "Uredi: " : "Dodaj: ") + spec.ime, html, [
    { t: "Prekliči", cls: "ghost sec" },
    ...(edit && spec.del !== false && !spec.rec ? [{ t: "Izbriši", cls: "danger", fn: async () => { await new Promise(r => setTimeout(r, 0)); if (!window.confirm("Res izbrišem zapis?")) return false; await D.del(coll, rec.id); toast("Izbrisano"); done && done(); } }] : []),
    { t: "Shrani", fn: async () => {
      const o = readFields(fields), err = $("#ferr");
      for (const f of fields) if (f.req && (o[f.k] === "" || o[f.k] === undefined)) { err.textContent = `Izpolnite polje »${f.l}«.`; return false; }
      if (spec.check) { const m = spec.check(o, ctx); if (m) { err.textContent = m; return false; } }
      if (ctx && ctx.stranka_id && coll !== "stranke") o.stranka_id = ctx.stranka_id;
      if (ctx && ctx.obrat_id && !o.obrat_id) o.obrat_id = ctx.obrat_id;
      if (spec.pre) spec.pre(o, ctx, rec);
      const fo = $("#f__foto"); if (fo && fo.files[0]) { const up = await uploadFile(fo.files[0], ctx.stranka_id, coll, o.obrat_id || null); o.slike = [...((rec && rec.slike) || []), up.id]; }
      const rz = $("#f__razlog"); if (rz && rz.value.trim()) o._razlog = rz.value.trim();
      if (edit) await D.set(coll, rec.id, Object.assign({ _ver: rec.spremenjeno || rec.ustvarjeno }, o)); else await D.add(coll, o); // _ver: zaznava hkratnega urejanja (409)
      toast("Shranjeno"); done && done();
    } }
  ]);
  if (spec.onOpen) spec.onOpen(fields, ctx, rec);
}
function revHtml(rec) {
  return `<div class="tw"><table class="t"><tr><th>Ver.</th><th>Kdaj</th><th>Kdo</th><th>Razlog</th><th>Prejšnje vrednosti</th></tr>${rec.revizije.slice().reverse().map(r => `<tr><td>${r.n}</td><td>${fdt(r.cas)}</td><td>${esc(r.ime)}</td><td>${esc(r.razlog || "")}</td><td><small>${Object.entries(r.prej).map(([k, v]) => `${esc(k)}: ${esc(typeof v === "object" ? JSON.stringify(v) : v)}`).join("<br>")}</small></td></tr>`).join("")}</table></div>`;
}

// seznam zbirke z iskanjem in obrazcem
async function listView(el, coll, ctx, opt) {
  opt = opt || {};
  const spec = SPEC[coll];
  const q = Object.assign({}, ctx && ctx.stranka_id ? { stranka_id: ctx.stranka_id } : {}, opt.q || {});
  let rows;
  try { rows = await D.list(coll, q); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  if (spec.sort) rows.sort(spec.sort);
  const cols = spec.cols(ctx || {});
  const mayAdd = opt.add !== false && (spec.add ? spec.add() : canManage());
  el.innerHTML = `<div class="row"><input type="search" id="lq" placeholder="Iskanje …" style="max-width:260px"><span class="sp"></span>${(opt.extra || "")}${mayAdd ? `<button class="btn" id="ladd">+ Dodaj</button>` : ""}</div>${spec.intro_list ? `<p class="note info">${esc(spec.intro_list)}</p>` : ""}<div class="tw"><table class="t"><thead><tr>${cols.map(c => `<th>${esc(c.l)}</th>`).join("")}</tr></thead><tbody id="lb"></tbody></table></div>`;
  const draw = () => {
    const f = $("#lq", el).value.toLowerCase();
    const sh = rows.filter(r => !f || JSON.stringify(r).toLowerCase().includes(f));
    $("#lb", el).innerHTML = sh.length ? sh.map(r => `<tr class="click" data-id="${r.id}">${cols.map(c => `<td>${c.f ? c.f(r) : esc(r[c.k] == null ? "" : r[c.k])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="empty">Ni zapisov.</td></tr>`;
  };
  draw(); $("#lq", el).oninput = draw;
  const reload = () => listView(el, coll, ctx, opt);
  $("#lb", el).onclick = e => { const tr = e.target.closest("tr[data-id]"); if (!tr) return; const r = rows.find(x => x.id === tr.dataset.id); (opt.open || ((r) => openForm(coll, r, ctx, reload)))(r, reload); };
  const add = $("#ladd", el); if (add) add.onclick = () => (opt.create || (() => openForm(coll, null, ctx, reload)))(reload);
  if (opt.bind) opt.bind(el, rows);
}

// ---------- usmerjevalnik in ogrodje ----------
const ROUTES = [];
const route = (re, fn, title, nav) => ROUTES.push({ re, fn, title, nav });
const NAVITEMS = [];
function navItem(id, label, hash, who) { NAVITEMS.push({ id, label, hash, who }); }
function drawNav() {
  const items = NAVITEMS.filter(n => n.id === "-" || ((!n.who || n.who.includes(ME.u.vloga)) && vis(n.id)));
  const shown = items.filter((n, i) => n.id !== "-" || (items[i + 1] && items[i + 1].id !== "-")); // ločilo brez elementov se skrije
  $("#menu").innerHTML = shown.map(n => n.id === "-" ? `<div class="sep">${n.label}</div>` : `<a href="${n.hash}" data-id="${n.id}">${n.label}</a>`).join("");
  drawPreviewBar(); if (typeof drawTestBar === "function") drawTestBar();
  $("#whoami").innerHTML = `<b>${esc(ME.u.ime)}</b><small>${esc(ROLE[ME.u.vloga])}</small>`;
  $("#whoami").setAttribute("role", "button"); $("#whoami").tabIndex = 0; $("#whoami").title = "Moj račun"; $("#whoami").style.cursor = "pointer";
  $("#whoami").onclick = mojRacun; $("#whoami").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); mojRacun(); } };
}
async function render() {
  render.n = render.n || 0;
  if (!ME.u) return;
  const h = location.hash.slice(1) || "/nadzorna";
  $("#nav").classList.remove("open");
  for (const r of ROUTES) {
    const m = h.match(r.re);
    if (m) {
      const need = modulZaPot(h) || r.nav;
      if (need && !vis(need)) { toast("Nimate dostopa.", true); location.hash = "#/nadzorna"; return; }
      $("#title").textContent = typeof r.title === "function" ? r.title(m) : r.title; document.title = ($("#title").textContent ? $("#title").textContent + " – " : "") + "HiGiFood HACCP";
      $("#topact").innerHTML = "";
      $$("#menu a").forEach(a => { const on = a.dataset.id === r.nav; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
      // vsak prikaz dobi svoj vsebnik: počasnejši prejšnji prikaz (npr. po hitrem kliku) ne more prepisati novejšega
      const tok = render.tok = (render.tok || 0) + 1, v = document.createElement("div");
      if (!render.tiho) v.innerHTML = '<p class="mut">Nalaganje …</p>';
      $("#view").replaceChildren(v);
      try { await r.fn(v, m); } catch (e) { if (tok === render.tok) v.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
      if (tok !== render.tok) return;
      render.cas = Date.now();
      if (render.tiho) return;
      window.scrollTo(0, 0); if (render.n++ > 0 && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") && !$("#dlg").open) $("#title").focus({ preventScroll: true });
      return;
    }
  }
  location.hash = "#/nadzorna";
}
window.addEventListener("hashchange", () => render());
// Osvežitev odprtega zaslona, da se vidijo spremembe drugih uporabnikov: ob vrnitvi na zavihek (po 1 min) in vsakih 5 min.
// Ne osveži med urejanjem (odprto okno, kurzor v polju) ali v urejevalnikih z neshranjenim stanjem.
async function osveziTiho(starost) {
  if (!ME.u || document.visibilityState !== "visible" || $("#dlg").open || Date.now() - (render.cas || 0) < starost) return;
  const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if (/^#\/(carovnik|tloris|uvoz|vidnost|admin)/.test(location.hash)) return;
  const y = window.scrollY; render.tiho = true; try { await render(); } finally { render.tiho = false; } window.scrollTo(0, y);
}
document.addEventListener("visibilitychange", () => osveziTiho(60e3));
setInterval(() => osveziTiho(5 * 60e3), 60e3);
$("#burger").onclick = () => $("#nav").classList.toggle("open");

function showLogin(setup) {
  $("#shell").hidden = true; const L = $("#login"); L.hidden = false;
  L.innerHTML = `<div class="card"><picture><source srcset="/logo-temno.png" media="(prefers-color-scheme: dark)"><img class="login-logo" src="/logo-svetlo.png" alt="HiGiFood – Z znanjem do varne hrane!"></picture><h1 class="login-h">${setup ? "Prva nastavitev: ustvarite administratorja" : "Prijava v HACCP platformo"}</h1><p class="err" id="lerr"></p><form id="lf"><label class="f"><span>E-naslov</span><input type="email" id="le" autocomplete="username" required></label>${setup ? '<label class="f"><span>Ime in priimek</span><input id="ln" required></label>' : ""}<label class="f"><span>Geslo${setup ? " (vsaj 10 znakov)" : ""}</span><input type="password" id="lp" autocomplete="${setup ? "new-password" : "current-password"}" required></label><button class="btn" style="width:100%">${setup ? "Ustvari in vstopi" : "Prijava"}</button></form></div>`;
  if (typeof testLoginHint === "function") testLoginHint();
  $("#lf").onsubmit = async e => {
    e.preventDefault();
    try {
      const kd = $("#lk") ? $("#lk").value : undefined;
      const u = await api("POST", setup ? "/api/auth/nastavi" : "/api/auth/prijava", { email: $("#le").value, geslo: $("#lp").value, ime: setup ? $("#ln").value : undefined, koda: kd || undefined });
      ME.u = u; await loadTisk(); await loadVidnost(); start();
    } catch (x) {
      $("#lerr").textContent = x.message;
      if (x.data && x.data.potrebna_koda && !$("#lk")) { $("#lp").closest("label").insertAdjacentHTML("afterend", '<label class="f"><span>Koda iz aplikacije za preverjanje (ali rezervna koda)</span><input id="lk" inputmode="numeric" autocomplete="one-time-code" maxlength="12"></label>'); $("#lk").focus(); }
    }
  };
}
function start() {
  $("#login").hidden = true; $("#shell").hidden = false;
  drawNav(); drawOffBadge(); if (typeof loadLogo === "function") loadLogo(); if (typeof navStrankaLogo === "function") navStrankaLogo(); try { const prev = JSON.parse(localStorage.getItem("haccp_me") || "null"); if (prev && prev.id !== ME.u.id && navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage("clear-api"); localStorage.setItem("haccp_me", JSON.stringify(ME.u)); } catch {}
  if (ME.u.mora_zamenjati) { changePw(true); }
  render();
}
function mojRacun() {
  modal("Moj račun", `<p><b>${esc(ME.u.ime)}</b><br><span class="mut">${esc(ME.u.email)} · ${esc(ROLE[ME.u.vloga])}</span></p>
    <p>Dvostopenjska prijava: ${ME.u.totp ? '<span class="badge ok">vklopljena</span>' : '<span class="badge warn">izklopljena</span>'}</p>
    <p class="mut">Ob prijavi poleg gesla vnesete 6-mestno kodo iz aplikacije na telefonu (npr. Google ali Microsoft Authenticator). Priporočeno za administratorje in svetovalce.</p>`,
    [{ t: "Zapri", cls: "ghost sec" }, { t: "Spremeni geslo", cls: "ghost", fn: () => { setTimeout(() => changePw(false), 0); } }, ME.u.totp ? { t: "Izklopi dvostopenjsko prijavo", cls: "danger", fn: () => { setTimeout(izklop2fa, 0); } } : { t: "Vklopi dvostopenjsko prijavo", fn: () => { setTimeout(vklop2fa, 0); } }]);
}
async function vklop2fa() {
  const r = await api("POST", "/api/auth/2fa/zacni"); let qr = "";
  try { qr = typeof QR !== "undefined" ? QR.svg(r.uri, { px: 190 }) : ""; } catch {}
  modal("Vklop dvostopenjske prijave", `<ol><li>Na telefonu odprite aplikacijo za preverjanje (Google Authenticator, Microsoft Authenticator …) in skenirajte kodo QR.</li><li>Če skeniranje ne deluje, vnesite ključ ročno: <code id="f2k">${esc(r.skrivnost)}</code></li><li>Vpišite 6-mestno kodo, ki jo prikaže aplikacija.</li></ol><div style="text-align:center">${qr}</div><p class="err" id="f2e"></p><label class="f"><span>Koda iz aplikacije</span><input id="f2c" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>`,
    [{ t: "Prekliči", cls: "ghost sec" }, { t: "Potrdi", fn: async () => {
      try { const x = await api("POST", "/api/auth/2fa/potrdi", { koda: $("#f2c").value }); ME.u.totp = true; setTimeout(() => modal("Rezervne kode", `<p class="note">Dvostopenjska prijava je vklopljena. Shranite te rezervne kode na varno (natisnite ali zapišite). Vsaka deluje <b>enkrat</b>, če nimate telefona.</p><pre id="f2r" style="font-size:16px;line-height:1.7">${x.rezervne.map(esc).join("\n")}</pre>`, [{ t: "Shranil sem kode" }]), 0); }
      catch (e) { $("#f2e").textContent = e.message; return false; }
    } }]);
}
function izklop2fa() {
  modal("Izklop dvostopenjske prijave", `<p class="err" id="f2e"></p><label class="f"><span>Geslo</span><input type="password" id="f2p" autocomplete="current-password"></label><label class="f"><span>Koda iz aplikacije ali rezervna koda</span><input id="f2c" autocomplete="one-time-code"></label>`,
    [{ t: "Prekliči", cls: "ghost sec" }, { t: "Izklopi", cls: "danger", fn: async () => { try { await api("POST", "/api/auth/2fa/izklopi", { geslo: $("#f2p").value, koda: $("#f2c").value }); ME.u.totp = false; toast("Dvostopenjska prijava je izklopljena"); } catch (e) { $("#f2e").textContent = e.message; return false; } } }]);
}
function changePw(forced) {
  modal("Sprememba gesla", `<p class="err" id="perr"></p>${forced ? '<p class="note">Administrator je nastavil začasno geslo. Prosimo, zamenjajte ga.</p>' : ""}<label class="f"><span>Trenutno geslo</span><input type="password" id="p0" autocomplete="current-password"></label><label class="f"><span>Novo geslo (vsaj 10 znakov)</span><input type="password" id="p1" autocomplete="new-password"></label>`, [{ t: "Kasneje", cls: "ghost sec" }, { t: "Spremeni", fn: async () => { try { await api("POST", "/api/auth/geslo", { staro: $("#p0").value, novo: $("#p1").value }); ME.u.mora_zamenjati = false; toast("Geslo spremenjeno"); } catch (e) { $("#perr").textContent = e.message; return false; } } }]);
}
$("#logout").onclick = async () => { try { await api("POST", "/api/auth/odjava"); } catch {} ME.u = null; try { localStorage.removeItem("haccp_me"); localStorage.removeItem(OFFQ); } catch {} if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage("clear-api"); showLogin(); };

// dostopnost: vrstice s klikom so dosegljive s tipkovnico (Enter/preslednica), gumbi brez besedila dobijo ime
(function a11y() {
  const names = { "✕": "Odstrani", "↑": "Premakni gor", "↓": "Premakni dol", "‹": "Nazaj", "›": "Naprej", "×": "Zapri" };
  const fix = root => {
    root.querySelectorAll("tr.click:not([tabindex])").forEach(t => { t.tabIndex = 0; });
    root.querySelectorAll("button:not([aria-label]),a.btn:not([aria-label])").forEach(b => { const t = b.textContent.trim(); if (names[t]) b.setAttribute("aria-label", names[t] + (b.closest("tr,.card") && b.closest("tr,.card").querySelector("input[data-k=naziv],b") ? "" : "")); });
    root.querySelectorAll("input:not([type=hidden]):not([aria-label]),select:not([aria-label]),textarea:not([aria-label])").forEach(e => { if ((e.labels && e.labels.length) || e.getAttribute("aria-labelledby") || e.title) return; const nm = e.placeholder || (e.type === "file" ? "Izberi datoteko" : e.type === "search" ? "Iskanje" : e.tagName === "SELECT" ? ((e.options[0] && e.options[0].textContent.trim()) || "Izbira") : ""); if (nm) e.setAttribute("aria-label", nm); });
    root.querySelectorAll(".err:not([role])").forEach(e => e.setAttribute("role", "alert"));
    root.querySelectorAll(".steps button").forEach(b => b.classList.contains("on") ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current"));
    root.querySelectorAll(".tabs a").forEach(a => a.classList.contains("on") ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  };
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fix(n.parentNode || document); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target && e.target.matches && e.target.matches("tr.click")) { e.preventDefault(); e.target.click(); } });
  document.addEventListener("DOMContentLoaded", () => fix(document));
})();
