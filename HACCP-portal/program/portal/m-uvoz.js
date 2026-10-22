// Uvoz iz Excela (.xlsx) in CSV: predloge, preslikava stolpcev, predogled, preskakovanje obstoječih.
const UVOZ = {
  stranke: { ime: "Stranke", key: "naziv", staff: true, ex: { naziv: "Primer d.o.o.", maticna: "1234567000", naslov: "Glavna cesta 1, Ljubljana", odgovorna_oseba: "Janez Novak", email: "info@primer.si", telefon: "01 234 56 78", dejavnost: "Gostinstvo (restavracija, gostilna)" } },
  obrati: { ime: "Obrati", key: "naziv", ex: { naziv: "Kuhinja", naslov: "Glavna cesta 1", vrsta: "kuhinja", povrsina: 85, opis_prostorov: "Kuhinja, shramba" } },
  osebje: { ime: "Zaposleni", key: "ime", ex: { ime: "Ana Novak", funkcija: "Kuhar", email: "ana@primer.si", higienski_do: "2027-03-01", zdravniski_do: "2027-06-30" } },
  dobavitelji: { ime: "Dobavitelji", key: "naziv", ex: { naziv: "Mesarija Rožman", kategorija: "meso", kontakt: "041 123 456", ocena: "odobren" } },
  oprema: { ime: "Oprema in instrumenti", key: "naziv", ex: { naziv: "Hladilnik 1", tip: "hladilnik", lokacija: "Kuhinja", naslednji_servis: "2027-01-15", meja_min: 0, meja_max: 4 } },
  usposabljanja: { ime: "Usposabljanja", key: "tema", ex: { tema: "Higiena in alergeni", datum: "2026-09-01", veljavno_do: "2027-09-01", izvajalec: "HiGiFood" } },
  kemikalije: { ime: "Čistila in razkužila", key: "naziv", ex: { naziv: "Razkužilo X", namen: "razkuževanje površin", proizvajalec: "Dobavitelj d.o.o.", rok_uporabe: "2027-12-31" } },
  ciscenje_nacrt: { ime: "Načrt čiščenja", key: "opravilo", ex: { podrocje: "Delovne površine", opravilo: "Pranje in razkuževanje", sredstvo: "Razkužilo X", pogostost_dni: 1, odgovoren: "Kuhar" } },
  vabe: { ime: "Vabe in pasti (DDD)", key: "oznaka", ex: { oznaka: "V1", vrsta: "vaba za glodavce", lokacija: "Vhod za dostavo" } }
};
const norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
// ---- CSV ----
function parseCsv(text) {
  text = text.replace(/^﻿/, ""); const first = text.split(/\r?\n/)[0] || "", cnt = c => (first.match(new RegExp("\\" + c, "g")) || []).length;
  const d = cnt(";") >= cnt(",") && cnt(";") >= cnt("\t") ? ";" : cnt("\t") > cnt(",") ? "\t" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === d) { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}
// ---- XLSX (prvi list); razpakiranje z DecompressionStream ----
async function inflateRaw(u8) { const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
async function unzipEntries(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error("To ni datoteka .xlsx.");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), ln = dv.getUint16(lo + 26, true), lx = dv.getUint16(lo + 28, true), st = lo + 30 + ln + lx, raw = u8.subarray(st, st + csize);
    out[name] = { method, raw }; p += 46 + nl + xl + cl;
  }
  return { out, get: async name => { const f = out[name]; if (!f) return null; const d = f.method === 0 ? f.raw : await inflateRaw(f.raw); return new TextDecoder().decode(d); } };
}
async function parseXlsx(buf) {
  const z = await unzipEntries(buf), P = new DOMParser(), q = (doc, tag) => [...doc.getElementsByTagName(tag)];
  const wb = P.parseFromString(await z.get("xl/workbook.xml"), "text/xml"), rels = P.parseFromString(await z.get("xl/_rels/workbook.xml.rels"), "text/xml");
  const sh = q(wb, "sheet")[0]; if (!sh) throw new Error("Datoteka nima listov.");
  const rid = sh.getAttribute("r:id") || sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"), rel = q(rels, "Relationship").find(r => r.getAttribute("Id") === rid);
  let target = rel ? rel.getAttribute("Target") : "worksheets/sheet1.xml"; target = target.startsWith("/") ? target.slice(1) : "xl/" + target;
  const sst = []; const ss = await z.get("xl/sharedStrings.xml"); if (ss) for (const si of q(P.parseFromString(ss, "text/xml"), "si")) sst.push(q(si, "t").map(t => t.textContent).join(""));
  const sheet = P.parseFromString(await z.get(target), "text/xml"), rows = [];
  const col = ref => { const m = /^([A-Z]+)/.exec(ref)[1]; let n = 0; for (const c of m) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
  for (const r of q(sheet, "row")) {
    const row = [];
    for (const c of q(r, "c")) {
      const t = c.getAttribute("t"), vEl = c.getElementsByTagName("v")[0], idx = col(c.getAttribute("r") || "A1"); let v = "";
      if (t === "s") v = sst[+vEl.textContent] || ""; else if (t === "inlineStr") v = q(c, "t").map(x => x.textContent).join(""); else if (vEl) v = vEl.textContent;
      row[idx] = v;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = "";
    rows.push(row);
  }
  return rows.filter(r => r.some(x => String(x).trim() !== ""));
}
// ---- pretvorbe vrednosti ----
function toDate(v) {
  v = String(v).trim(); if (!v) return ""; let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if ((m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(v))) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v))) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  if (/^\d{4,6}(\.\d+)?$/.test(v) && +v > 20000 && +v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 864e5); return d.toISOString().slice(0, 10); }
  return v;
}
function convert(f, v, ctx) {
  v = v == null ? "" : String(v).trim(); if (v === "") return undefined;
  if (f.t === "num") { const n = Number(v.replace(",", ".")); return isNaN(n) ? v : n; }
  if (f.t === "date") return toDate(v);
  if (f.t === "bool") return /^(da|yes|true|1|x|✓)$/i.test(v);
  if (f.t === "tags") return v.split(/[,;]/).map(x => x.trim()).filter(Boolean);
  if (f.t === "sel") { const opts = (typeof f.o === "function" ? f.o(ctx) : f.o) || []; const hit = opts.find(o => norm(Array.isArray(o) ? o[1] : o) === norm(v) || norm(Array.isArray(o) ? o[0] : o) === norm(v)); return hit === undefined ? v : (Array.isArray(hit) ? hit[0] : hit); }
  return v;
}

async function pageUvoz(v) {
  const st = await D.list("stranke"), tmpl = Object.entries(UVOZ).filter(([k, c]) => !c.staff || isStaff());
  let S = { sid: sessionStorage.getItem("uvoz_sid") || (st[0] && st[0].id), coll: tmpl[0][0], rows: null, map: [], ime: "" };
  const draw = () => {
    v.innerHTML = `<p class="note info">Uvozite lahko podatke iz Excela (.xlsx) ali CSV. Prenesite predlogo, jo izpolnite in naložite. Stolpci se preslikajo samodejno po imenu, preslikavo lahko popravite. Že obstoječi zapisi (po ključnem polju) se privzeto preskočijo.</p>
    <div class="card"><div class="fgrid">${isStaff() && S.coll !== "stranke" ? `<label class="f"><span>Stranka</span><select id="u_s">${st.map(s => `<option value="${s.id}" ${s.id === S.sid ? "selected" : ""}>${esc(s.naziv)}</option>`).join("")}</select></label>` : ""}<label class="f"><span>Kaj uvažate</span><select id="u_c">${tmpl.map(([k, c]) => `<option value="${k}" ${k === S.coll ? "selected" : ""}>${esc(c.ime)}</option>`).join("")}</select></label></div>
    <div class="row"><button class="btn ghost sec" id="u_t">Prenesi predlogo (Excel)</button><input type="file" id="u_f" accept=".xlsx,.csv,.txt,.tsv" style="max-width:300px"></div><div id="u_b"></div></div>`;
    $("#u_c").onchange = e => { S.coll = e.target.value; S.rows = null; draw(); };
    if ($("#u_s")) $("#u_s").onchange = e => { S.sid = e.target.value; sessionStorage.setItem("uvoz_sid", S.sid); };
    $("#u_t").onclick = async () => { const ctx = await mkctx(), fl = fieldsFor(SPEC[S.coll], ctx), c = UVOZ[S.coll]; downloadXlsx("predloga-" + S.coll + ".xlsx", [{ ime: c.ime.slice(0, 30), glava: fl.map(f => f.l + (f.req ? " *" : "")), vrste: [fl.map(f => c.ex[f.k] === undefined ? "" : c.ex[f.k])] }]); };
    $("#u_f").onchange = onFile; if (S.rows) preview();
  };
  const mkctx = async () => { const ob = S.coll === "stranke" ? [] : await D.list("obrati", { stranka_id: ME.u.vloga === "odgovorna" || ME.u.vloga === "zaposleni" ? undefined : S.sid }); return { stranka_id: S.sid, obrati: mapOf(ob) }; };
  const onFile = async e => {
    const f = e.target.files[0]; if (!f) return; S.ime = f.name;
    try { S.rows = /\.xlsx$/i.test(f.name) ? await parseXlsx(await f.arrayBuffer()) : parseCsv(await f.text()); } catch (er) { return fail(er); }
    if (S.rows.length < 2) { S.rows = null; return toast("Datoteka nima podatkovnih vrstic.", true); }
    S.ctx = await mkctx(); S.fields = fieldsFor(SPEC[S.coll], S.ctx).filter(x => x.k !== "obrat_id"); const hdr = S.rows[0].map(norm);
    S.map = S.fields.map(fl => { const a = [norm(fl.l), norm(fl.k), norm(fl.l.replace(/\s*\(.*\)/, ""))]; return hdr.findIndex(h => a.includes(h.replace(/^\*$/, "")) || a.some(x => x && h === x + "")); });
    S.obratCol = hdr.findIndex(h => h === "obrat" || h === "obratnaziv"); preview();
  };
  const build = () => {
    const key = UVOZ[S.coll].key; const out = [], errs = [];
    S.rows.slice(1).forEach((r, i) => { const o = {}; S.fields.forEach((fl, j) => { if (S.map[j] >= 0) { const val = convert(fl, r[S.map[j]], S.ctx); if (val !== undefined) o[fl.k] = val; } });
      if (S.obratCol >= 0 && r[S.obratCol]) { const hit = Object.entries(S.ctx.obrati).find(([id, n]) => norm(n) === norm(r[S.obratCol])); if (hit) o.obrat_id = hit[0]; }
      const miss = S.fields.filter(fl => fl.req && (o[fl.k] === undefined || o[fl.k] === "")); if (miss.length) errs.push({ vrstica: i + 2, napaka: "manjka: " + miss.map(m => m.l).join(", ") }); else out.push({ vrstica: i + 2, o }); });
    return { out, errs, key };
  };
  const preview = () => {
    const { out, errs } = build();
    $("#u_b").innerHTML = `<h3>Preslikava stolpcev (${esc(S.ime)}, ${S.rows.length - 1} vrstic)</h3><div class="fgrid">${S.fields.map((fl, j) => `<label class="f"><span>${esc(fl.l)}${fl.req ? " *" : ""}</span><select data-j="${j}"><option value="-1">– ne uvozi –</option>${S.rows[0].map((h, i) => `<option value="${i}" ${S.map[j] === i ? "selected" : ""}>${esc(h || "stolpec " + (i + 1))}</option>`).join("")}</select></label>`).join("")}</div>
    <h3>Predogled (prvih 8)</h3><div class="tw"><table class="t"><tr>${S.fields.filter((fl, j) => S.map[j] >= 0).map(fl => `<th>${esc(fl.l)}</th>`).join("")}</tr>${out.slice(0, 8).map(x => `<tr>${S.fields.filter((fl, j) => S.map[j] >= 0).map(fl => `<td>${esc(Array.isArray(x.o[fl.k]) ? x.o[fl.k].join(", ") : x.o[fl.k] === undefined ? "" : x.o[fl.k])}</td>`).join("")}</tr>`).join("") || '<tr><td class="empty">Ni veljavnih vrstic.</td></tr>'}</table></div>
    ${errs.length ? `<p class="note">Vrstic z napako: ${errs.length} (${errs.slice(0, 5).map(e => "vrstica " + e.vrstica + " " + e.napaka).join("; ")}${errs.length > 5 ? " …" : ""}). Te se ne uvozijo.</p>` : ""}
    <label class="f"><span><input type="checkbox" id="u_sk" checked> Preskoči zapise, ki že obstajajo (po polju »${esc((S.fields.find(f => f.k === UVOZ[S.coll].key) || {}).l || UVOZ[S.coll].key)}«)</span></label><div class="row"><button class="btn" id="u_go" ${out.length ? "" : "disabled"}>Uvozi ${out.length} vrstic</button></div><div id="u_r"></div>`;
    $$("[data-j]", $("#u_b")).forEach(s => s.onchange = () => { S.map[+s.dataset.j] = +s.value; preview(); });
    $("#u_go").onclick = async () => {
      const key = UVOZ[S.coll].key, ex = await D.list(S.coll, S.coll === "stranke" ? undefined : { stranka_id: S.sid }), have = new Set(ex.map(x => norm(x[key]))); let ok = 0, skip = 0; const bad = [];
      $("#u_go").disabled = true;
      for (const x of out) { if ($("#u_sk").checked && have.has(norm(x.o[key]))) { skip++; continue; } try { if (S.coll !== "stranke") x.o.stranka_id = S.sid; await D.add(S.coll, x.o); have.add(norm(x.o[key])); ok++; } catch (er) { bad.push("vrstica " + x.vrstica + ": " + er.message); } }
      $("#u_r").innerHTML = `<p class="note ${bad.length ? "" : "info"}">Uvoženo: <b>${ok}</b>, preskočeno (že obstaja): ${skip}, napak: ${bad.length}${errs.length ? ", vrstic z manjkajočimi polji: " + errs.length : ""}.${bad.length ? "<br>" + bad.slice(0, 8).map(esc).join("<br>") : ""}</p>`; toast("Uvoz končan: " + ok); };
  };
  draw();
}
navItem("uvoz", "Uvoz podatkov", "#/uvoz", ["admin", "svetovalec", "odgovorna"]);
route(/^\/uvoz$/, pageUvoz, "Uvoz podatkov (Excel/CSV)", "uvoz");
