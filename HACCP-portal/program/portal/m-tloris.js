// Urejevalnik tlorisa (SVG): sobe, stene, vrata, naprave, vabe (DDD), poti (čista/nečista, hladna/topla veriga), besedilo.
const TL = { S: 50, snap: 0.25 };
const TL_TIPI = { "čisto območje": "#e3f1e8", "nečisto območje": "#fbe4e1", "skladišče": "#e8edf7", "hladno skladišče": "#d9e8fa", "kuhinja / priprava": "#fff1d1", "sanitarije / garderoba": "#efe6f5", "drugo": "#f1f1ef" };
const TL_POTI = { "čista pot": ["#1e7a46", ""], "nečista pot": ["#b3261e", ""], "hladna veriga": ["#1f5f99", "8 5"], "topla veriga": ["#d9822b", "8 5"], "odpadki": ["#6b4f2a", "3 4"], "osebje": ["#7a3fa0", "2 5"] };
const TL_OPR = { hladilnik: [0.7, 0.7, "#cfe3f7"], zamrzovalnik: [0.7, 0.7, "#b9d4f2"], "štedilnik / pečica": [0.8, 0.7, "#f5d9b0"], umivalnik: [0.6, 0.5, "#dff0f0"], "umivalnik za roke": [0.45, 0.4, "#bfe6e6"], "delovna miza": [1.6, 0.7, "#f4f4f4"], polica: [1.2, 0.4, "#ece6da"], "koš za odpadke": [0.4, 0.4, "#d8d2c4"], "pomivalni stroj": [0.8, 0.7, "#e0e6ea"], drugo: [0.8, 0.6, "#f4f4f4"] };
const tuid = () => Math.random().toString(36).slice(2, 9);
const r2 = v => Math.round(v * 100) / 100;
const snapv = v => Math.round(v / TL.snap) * TL.snap;

function tlorisSvg(t, o) {
  o = o || {}; const S = TL.S, W = t.sirina_m * S, H = t.visina_m * S, leg = o.legend ? 54 : 0, E = t.elementi || [];
  const used = new Set(E.filter(e => e.t === "pot").map(e => e.vrsta)), usedS = new Set(E.filter(e => e.t === "soba").map(e => e.tip));
  const sel = id => o.sel === id ? ' data-sel="1"' : "";
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + leg}" width="${W}" height="${H + leg}" font-family="system-ui,Arial,sans-serif">`,
    `<defs>${Object.entries(TL_POTI).map(([k, [c]], i) => `<marker id="ar${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join("")}${o.edit ? `<pattern id="gr" width="${S / 2}" height="${S / 2}" patternUnits="userSpaceOnUse"><path d="M ${S / 2} 0 L 0 0 0 ${S / 2}" fill="none" stroke="#dfe5e0" stroke-width="1"/></pattern>` : ""}</defs>`,
    `<rect width="${W}" height="${H + leg}" fill="#fff"/>`, o.edit ? `<rect width="${W}" height="${H}" fill="url(#gr)"/>` : "", `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#cfd6d1"/>`];
  const order = { soba: 0, stena: 1, vrata: 2, oprema: 3, pot: 4, vaba: 5, besedilo: 6 };
  for (const e of [...E].sort((a, b) => order[a.t] - order[b.t])) {
    const id = `data-id="${e.id}"`;
    if (e.t === "soba") out.push(`<g ${id}><rect x="${e.x * S}" y="${e.y * S}" width="${e.w * S}" height="${e.h * S}" fill="${TL_TIPI[e.tip] || "#f1f1ef"}" stroke="#2f6f4f" stroke-width="2.5"/><text x="${(e.x + e.w / 2) * S}" y="${(e.y + e.h / 2) * S}" text-anchor="middle" font-size="13" font-weight="600" fill="#1d2420">${xe(e.ime || "")}</text>${e.tip && e.tip !== "drugo" ? `<text x="${(e.x + e.w / 2) * S}" y="${(e.y + e.h / 2) * S + 15}" text-anchor="middle" font-size="10" fill="#5f6b64">${xe(e.tip)}</text>` : ""}</g>`);
    else if (e.t === "stena") out.push(`<line ${id} x1="${e.x1 * S}" y1="${e.y1 * S}" x2="${e.x2 * S}" y2="${e.y2 * S}" stroke="#2b2f2d" stroke-width="6" stroke-linecap="square"/>`);
    else if (e.t === "vrata") { const w = 0.9 * S, h = 0.16 * S, vert = e.rot === 90; out.push(`<rect ${id} x="${e.x * S - (vert ? h / 2 : w / 2)}" y="${e.y * S - (vert ? w / 2 : h / 2)}" width="${vert ? h : w}" height="${vert ? w : h}" fill="#fff" stroke="#d9822b" stroke-width="2.5"/>`); }
    else if (e.t === "oprema") out.push(`<g ${id}><rect x="${e.x * S}" y="${e.y * S}" width="${e.w * S}" height="${e.h * S}" rx="3" fill="${(TL_OPR[e.ikona] || TL_OPR.drugo)[2]}" stroke="#4a5550" stroke-width="1.5"/><text x="${(e.x + e.w / 2) * S}" y="${(e.y + e.h / 2) * S + 4}" text-anchor="middle" font-size="${Math.min(11, Math.max(8, e.w * S / Math.max(6, (e.ime || "").length) * 1.6))}" fill="#1d2420">${xe(e.ime || e.ikona || "")}</text></g>`);
    else if (e.t === "pot") { const c = TL_POTI[e.vrsta] || TL_POTI["čista pot"], i = Object.keys(TL_POTI).indexOf(e.vrsta); out.push(`<polyline ${id} points="${e.pts.map(p => p[0] * S + "," + p[1] * S).join(" ")}" fill="none" stroke="${c[0]}" stroke-width="3.5" ${c[1] ? `stroke-dasharray="${c[1]}"` : ""} marker-end="url(#ar${Math.max(0, i)})" stroke-linejoin="round"/>`); }
    else if (e.t === "vaba") { const uv = /svetlob|UV/i.test(e.vrsta || ""), cx = e.x * S, cy = e.y * S; out.push(`<g ${id}>${uv ? `<rect x="${cx - 11}" y="${cy - 11}" width="22" height="22" fill="#6b3fa0" stroke="#fff" stroke-width="1.5"/>` : `<circle cx="${cx}" cy="${cy}" r="11" fill="#b3261e" stroke="#fff" stroke-width="1.5"/>`}<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${xe(e.oznaka || "")}</text></g>`); }
    else if (e.t === "besedilo") out.push(`<text ${id} x="${e.x * S}" y="${e.y * S}" font-size="${e.vel || 14}" fill="#1d2420">${xe(e.text || "")}</text>`);
  }
  if (o.sel) { const e = E.find(x => x.id === o.sel); if (e) { const b = tlBox(e); if (b) out.push(`<rect x="${b.x * S - 3}" y="${b.y * S - 3}" width="${b.w * S + 6}" height="${b.h * S + 6}" fill="none" stroke="#1f5f99" stroke-width="1.5" stroke-dasharray="4 3" pointer-events="none"/>`, (e.t === "soba" || e.t === "oprema") ? `<rect data-h="1" x="${(b.x + b.w) * S - 6}" y="${(b.y + b.h) * S - 6}" width="12" height="12" fill="#1f5f99" style="cursor:nwse-resize"/>` : ""); } }
  if (o.legend) {
    let x = 8; const y = H + 16; out.push(`<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#cfd6d1"/>`);
    for (const k of used) { const c = TL_POTI[k]; out.push(`<line x1="${x}" y1="${y}" x2="${x + 26}" y2="${y}" stroke="${c[0]}" stroke-width="3.5" ${c[1] ? `stroke-dasharray="${c[1]}"` : ""}/><text x="${x + 31}" y="${y + 4}" font-size="11" fill="#1d2420">${xe(k)}</text>`); x += 40 + k.length * 6.2; }
    x = 8; for (const k of usedS) if (k) { out.push(`<rect x="${x}" y="${y + 18}" width="14" height="12" fill="${TL_TIPI[k] || "#f1f1ef"}" stroke="#2f6f4f"/><text x="${x + 19}" y="${y + 28}" font-size="11" fill="#1d2420">${xe(k)}</text>`); x += 36 + k.length * 6.2; }
    out.push(`<circle cx="${W - 150}" cy="${y}" r="8" fill="#b3261e"/><text x="${W - 136}" y="${y + 4}" font-size="11">vaba / past (DDD)</text><text x="${W - 8}" y="${y + 28}" text-anchor="end" font-size="10" fill="#5f6b64">merilo: mreža = 0,5 m; ${t.sirina_m} × ${t.visina_m} m</text>`);
  }
  out.push("</svg>"); return out.join("");
}
function tlBox(e) {
  if (e.t === "soba" || e.t === "oprema") return { x: e.x, y: e.y, w: e.w, h: e.h };
  if (e.t === "stena") return { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1), h: Math.abs(e.y2 - e.y1) };
  if (e.t === "pot") { const xs = e.pts.map(p => p[0]), ys = e.pts.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
  if (e.t === "vaba") return { x: e.x - 0.25, y: e.y - 0.25, w: 0.5, h: 0.5 };
  if (e.t === "vrata") return e.rot === 90 ? { x: e.x - 0.1, y: e.y - 0.45, w: 0.2, h: 0.9 } : { x: e.x - 0.45, y: e.y - 0.1, w: 0.9, h: 0.2 };
  if (e.t === "besedilo") return { x: e.x, y: e.y - 0.3, w: Math.max(0.6, (e.text || "").length * 0.17), h: 0.4 };
  return null;
}
// SVG → JPEG (za PDF/Word)
function svgToImg(svg, w, h, scale) {
  return new Promise(ok => {
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => { const k = scale || 1.5, c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(async b => ok({ u8: new Uint8Array(await b.arrayBuffer()), w: c.width, h: c.height }), "image/jpeg", 0.9); };
    img.onerror = () => { URL.revokeObjectURL(url); ok(null); }; img.src = url;
  });
}
async function tlorisToImg(t) { const leg = 54; return svgToImg(tlorisSvg(t, { legend: true }), t.sirina_m * TL.S, t.visina_m * TL.S + leg, 1.6); }
async function tlorisForPlan(W) {
  const z = W.zbiranje || {};
  if (z.tloris_nacrt_id) { try { const t = (await D.list("tlorisi")).find(x => x.id === z.tloris_nacrt_id); if (t) return await tlorisToImg(t); } catch {} }
  return z.tloris_id ? await loadImg("/api/priloga/" + z.tloris_id, 1400) : null;
}

// ---------- seznam v profilu stranke ----------
async function tabTloris(el, ctx) {
  SPEC.tlorisi = SPEC.tlorisi || { ime: "tloris", cols: c => [{ l: "Naziv", k: "naziv" }, { l: "Obrat", f: r => esc((c.obrati || {})[r.obrat_id] || "") }, { l: "Velikost", f: r => r.sirina_m + " × " + r.visina_m + " m" }, { l: "Elementov", f: r => (r.elementi || []).length }, { l: "Spremenjeno", f: r => fdt(r.spremenjeno || r.ustvarjeno) }], fields: c => [] };
  await listView(el, "tlorisi", ctx, {
    create: () => modal("Nov tloris", `<p class="err" id="ferr"></p><div class="fgrid"><label class="f req wide"><span>Naziv</span><input id="tn" value="Tloris obrata"></label>${fieldHtml(obratField(ctx), "", ctx)}<label class="f"><span>Širina (m)</span><input type="number" id="tw" value="12" min="2" max="80" step="0.5"></label><label class="f"><span>Višina (m)</span><input type="number" id="th" value="8" min="2" max="60" step="0.5"></label></div>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Ustvari", fn: async () => { try { const r = await D.add("tlorisi", { stranka_id: ctx.stranka_id, naziv: $("#tn").value.trim(), obrat_id: $("#f_obrat_id").value || null, sirina_m: Math.min(80, Math.max(2, +$("#tw").value || 12)), visina_m: Math.min(60, Math.max(2, +$("#th").value || 8)), elementi: [] }); location.hash = "#/tloris/" + r.id; } catch (e) { $("#ferr").textContent = e.message; return false; } } }]),
    open: r => location.hash = "#/tloris/" + r.id
  });
}

// ---------- urejevalnik ----------
async function pageTloris(v, m) {
  const id = m[1], rec = (await D.list("tlorisi")).find(x => x.id === id); if (!rec) throw new Error("Tloris ni najden ali nimate dostopa.");
  const stranka = (await D.list("stranke")).find(s => s.id === rec.stranka_id);
  const [opr, vabe] = await Promise.all([D.list("oprema", { stranka_id: rec.stranka_id }), D.list("vabe", { stranka_id: rec.stranka_id }).catch(() => [])]);
  const T = { naziv: rec.naziv, sirina_m: rec.sirina_m, visina_m: rec.visina_m, elementi: JSON.parse(JSON.stringify(rec.elementi || [])) };
  const edit = canManage();
  let tool = "izberi", sel = null, drag = null, draft = null, dirty = false; const hist = [];
  $("#title").textContent = "Tloris: " + rec.naziv;
  const push = () => { hist.push(JSON.stringify(T.elementi)); if (hist.length > 60) hist.shift(); dirty = true; $("#ts").textContent = "Shrani *"; };
  v.innerHTML = `<div class="row"><a href="#/stranka/${rec.stranka_id}/tloris" class="btn ghost sec sm">‹ Nazaj</a><span class="mut">${esc(stranka.naziv)}</span><span class="sp"></span>${edit ? '<button class="btn ghost sec sm" id="tu">↶ Razveljavi</button><button class="btn" id="ts">Shrani</button>' : ""}<button class="btn ghost sec sm" id="te">Prenesi PNG/SVG</button></div>
  ${edit ? `<div class="row" id="tb">${[["izberi", "☝ Izberi / premakni"], ["soba", "▭ Soba"], ["stena", "╱ Stena"], ["vrata", "⎍ Vrata"], ["oprema", "▣ Naprava"], ["vaba", "● Vaba (DDD)"], ["pot", "➜ Pot"], ["besedilo", "T Besedilo"]].map(([k, l]) => `<button class="btn sm ghost ${k === "izberi" ? "" : "sec"}" data-tool="${k}">${l}</button>`).join("")}<select id="tvp" style="max-width:150px" title="Vrsta poti">${Object.keys(TL_POTI).map(k => `<option>${k}</option>`).join("")}</select><select id="tvo" style="max-width:170px" title="Vrsta naprave">${Object.keys(TL_OPR).map(k => `<option>${k}</option>`).join("")}</select><button class="btn sm ghost sec" id="tend" hidden>Končaj pot</button></div><p class="mut" id="thint">Izberite orodje. Mreža 0,25 m. Del = izbriši izbrani element; puščice premikajo izbrani element (Shift = 1 m).</p>` : ""}
  <div class="grid" style="grid-template-columns:minmax(0,1fr) 260px;align-items:start"><div class="tw" style="padding:6px;overflow:auto"><div id="tc" style="touch-action:none"></div></div>
  <div class="card" id="tp"><b>Lastnosti</b><div id="tpb" class="mut" style="margin-top:6px">Izberite element.</div><hr style="border:0;border-top:1px solid var(--line)"><div class="fgrid" style="grid-template-columns:1fr 1fr"><label class="f"><span>Širina (m)</span><input type="number" id="tsw" value="${T.sirina_m}" step="0.5" min="2" max="80" ${edit ? "" : "disabled"}></label><label class="f"><span>Višina (m)</span><input type="number" id="tsh" value="${T.visina_m}" step="0.5" min="2" max="60" ${edit ? "" : "disabled"}></label></div><div id="tdd" class="mut"></div></div></div>`;
  const cont = $("#tc"), S = TL.S;
  const paint = () => { const view = draft && draft.t === "pot" ? Object.assign({}, T, { elementi: [...T.elementi, Object.assign({}, draft, { pts: draft.pts.length === 1 ? [draft.pts[0], draft.pts[0]] : draft.pts })] }) : T; cont.innerHTML = tlorisSvg(view, { edit: true, sel }); const svg = cont.firstChild; svg.style.width = "100%"; svg.style.maxWidth = "1100px"; svg.style.height = "auto"; svg.style.cursor = tool === "izberi" ? "default" : "crosshair"; };
  const draw = () => { paint(); props(); ddd(); };
  const pt = e => { const svg = cont.firstChild, r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return [(e.clientX - r.left) / r.width * vb.width / S, (e.clientY - r.top) / r.height * vb.height / S]; };
  const get = id => T.elementi.find(e => e.id === id);
  const move = (e, dx, dy) => { if ("x" in e) { e.x = r2(e.x + dx); e.y = r2(e.y + dy); } if (e.t === "stena") { e.x1 = r2(e.x1 + dx); e.x2 = r2(e.x2 + dx); e.y1 = r2(e.y1 + dy); e.y2 = r2(e.y2 + dy); } if (e.t === "pot") e.pts = e.pts.map(p => [r2(p[0] + dx), r2(p[1] + dy)]); };
  const hint = t => { if ($("#thint")) $("#thint").textContent = t; };
  const endPot = () => { if (draft && draft.t === "pot") { if (draft.pts.length >= 2 && draft.pts.some(q => q[0] !== draft.pts[0][0] || q[1] !== draft.pts[0][1])) { push(); T.elementi.push(draft); sel = draft.id; } draft = null; if ($("#tend")) $("#tend").hidden = true; setTool("izberi"); draw(); } };
  const setTool = k => { tool = k; $$("[data-tool]").forEach(b => b.classList.toggle("sec", b.dataset.tool !== k)); hint({ izberi: "Kliknite element za izbiro; povlecite za premik; modri kvadrat spodaj desno spremeni velikost.", soba: "Povlecite pravokotnik sobe.", stena: "Povlecite črto stene.", vrata: "Kliknite mesto vrat (zasukate v lastnostih).", oprema: "Izberite vrsto naprave in kliknite mesto.", vaba: "Kliknite mesto vabe/pasti.", pot: "Klikajte točke poti; Končaj pot ali dvoklik zaključi.", besedilo: "Kliknite mesto besedila." }[k] || ""); if (k !== "pot") { draft = null; if ($("#tend")) $("#tend").hidden = true; } else $("#tend").hidden = false; draw(); };
  if (edit) $$("[data-tool]").forEach(b => b.onclick = () => setTool(b.dataset.tool));
  cont.addEventListener("pointerdown", e => {
    if (!edit) return; const [x, y] = pt(e), sx = snapv(x), sy = snapv(y), tg = e.target.closest("[data-id]"), hd = e.target.closest("[data-h]");
    if (tool === "izberi") {
      if (hd && sel) { drag = { k: "resize", id: sel, moved: false }; hist.push(JSON.stringify(T.elementi)); cont.setPointerCapture(e.pointerId); return; }
      sel = tg ? tg.dataset.id : null; if (tg) { drag = { k: "move", id: sel, x: x, y: y, moved: false }; hist.push(JSON.stringify(T.elementi)); cont.setPointerCapture(e.pointerId); } draw(); return;
    }
    if (tool === "soba") { draft = { id: tuid(), t: "soba", x: sx, y: sy, w: 0, h: 0, ime: "Prostor", tip: "drugo" }; T.elementi.push(draft); drag = { k: "new" }; cont.setPointerCapture(e.pointerId); }
    else if (tool === "stena") { draft = { id: tuid(), t: "stena", x1: sx, y1: sy, x2: sx, y2: sy }; T.elementi.push(draft); drag = { k: "new" }; cont.setPointerCapture(e.pointerId); }
    else if (tool === "vrata") { push(); const el2 = { id: tuid(), t: "vrata", x: sx, y: sy, rot: 0 }; T.elementi.push(el2); sel = el2.id; setTool("izberi"); }
    else if (tool === "oprema") { push(); const k = $("#tvo").value, d = TL_OPR[k]; const el2 = { id: tuid(), t: "oprema", x: sx, y: sy, w: d[0], h: d[1], ikona: k, ime: k === "drugo" ? "" : k.split(" ")[0] }; T.elementi.push(el2); sel = el2.id; setTool("izberi"); }
    else if (tool === "vaba") { push(); const used = new Set(T.elementi.filter(z => z.t === "vaba").map(z => z.oznaka)), free = vabe.find(b => !used.has(b.oznaka)); const el2 = { id: tuid(), t: "vaba", x: sx, y: sy, oznaka: free ? free.oznaka : String(T.elementi.filter(z => z.t === "vaba").length + 1), vrsta: free ? free.vrsta : "vaba za glodavce" }; T.elementi.push(el2); sel = el2.id; setTool("izberi"); }
    else if (tool === "besedilo") { push(); const el2 = { id: tuid(), t: "besedilo", x: sx, y: sy, text: "Besedilo", vel: 14 }; T.elementi.push(el2); sel = el2.id; setTool("izberi"); }
    else if (tool === "pot") { if (!draft) draft = { id: tuid(), t: "pot", vrsta: $("#tvp").value, pts: [] }; const lp = draft.pts[draft.pts.length - 1], now = Date.now(); if (lp && lp[0] === sx && lp[1] === sy && now - (draft.t0 || 0) < 600) { endPot(); return; } draft.pts.push([sx, sy]); draft.t0 = now; }
    draw();
  });
  cont.addEventListener("pointermove", e => {
    if (!drag) return; const [x, y] = pt(e), sx = snapv(x), sy = snapv(y);
    if (drag.k === "new") { if (draft.t === "soba") { draft.w = Math.max(0, r2(sx - draft.x)); draft.h = Math.max(0, r2(sy - draft.y)); } else { draft.x2 = sx; draft.y2 = sy; } }
    else if (drag.k === "move") { const dx = snapv(x - drag.x), dy = snapv(y - drag.y); if (dx || dy) { move(get(drag.id), dx, dy); drag.x += dx; drag.y += dy; drag.moved = true; } }
    else if (drag.k === "resize") { const el2 = get(drag.id); el2.w = Math.max(0.25, r2(sx - el2.x)); el2.h = Math.max(0.25, r2(sy - el2.y)); drag.moved = true; }
    draw();
  });
  cont.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.k === "new") { const ok = draft.t === "soba" ? draft.w >= 0.5 && draft.h >= 0.5 : Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= 0.25; if (ok) { const d2 = draft; T.elementi = T.elementi.filter(z => z !== d2); hist.push(JSON.stringify(T.elementi)); T.elementi.push(d2); dirty = true; $("#ts").textContent = "Shrani *"; sel = draft.id; } else T.elementi = T.elementi.filter(z => z !== draft); draft = null; drag = null; setTool("izberi"); return; }
    if ((drag.k === "move" || drag.k === "resize") && drag.moved) { dirty = true; $("#ts").textContent = "Shrani *"; } else if (drag.k !== "new") hist.pop();
    drag = null; draw();
  });
  if (edit) { $("#tend").onclick = endPot; $("#tu").onclick = () => { if (!hist.length) return; T.elementi = JSON.parse(hist.pop()); sel = null; draw(); }; }
  document.onkeydown = e => { if (!edit || !document.getElementById("tc")) return; if ((e.key === "Delete" || e.key === "Backspace") && sel && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName)) { push(); T.elementi = T.elementi.filter(z => z.id !== sel); sel = null; draw(); } if (e.key === "Enter" && draft) endPot(); if (e.key === "Escape") { draft = null; setTool("izberi"); }
    if (sel && /^Arrow/.test(e.key) && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || "")) { e.preventDefault(); push(); const el2 = get(sel), s2 = e.shiftKey ? 1 : TL.snap; move(el2, e.key === "ArrowLeft" ? -s2 : e.key === "ArrowRight" ? s2 : 0, e.key === "ArrowUp" ? -s2 : e.key === "ArrowDown" ? s2 : 0); draw(); } if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); $("#tu").click(); } };
  // lastnosti izbranega elementa
  function props() {
    const b = $("#tpb"); if (!b) return; const e = sel && get(sel);
    if (!e) { b.innerHTML = "Izberite element."; return; }
    const inp = (k, l, o) => `<label class="f"><span>${l}</span>${o && o.sel ? `<select data-p="${k}">${o.sel.map(x => `<option ${String(e[k]) === String(Array.isArray(x) ? x[0] : x) ? "selected" : ""} value="${esc(Array.isArray(x) ? x[0] : x)}">${esc(Array.isArray(x) ? x[1] : x)}</option>`).join("")}</select>` : `<input data-p="${k}" ${o && o.num ? 'type="number" step="0.05"' : ""} value="${esc(e[k] === undefined ? "" : e[k])}">`}</label>`;
    let h = "";
    if (e.t === "soba") h = inp("ime", "Ime prostora") + inp("tip", "Vrsta", { sel: Object.keys(TL_TIPI) }) + `<div class="fgrid" style="grid-template-columns:1fr 1fr">${inp("w", "Širina m", { num: 1 })}${inp("h", "Višina m", { num: 1 })}</div>`;
    else if (e.t === "oprema") h = inp("ikona", "Vrsta", { sel: Object.keys(TL_OPR) }) + `<label class="f"><span>Naprava iz seznama opreme</span><select data-p="ime"><option value=""></option>${opr.map(o => `<option ${e.ime === o.naziv ? "selected" : ""}>${esc(o.naziv)}</option>`).join("")}</select></label>` + inp("ime", "Oznaka na tlorisu") + `<div class="fgrid" style="grid-template-columns:1fr 1fr">${inp("w", "Širina m", { num: 1 })}${inp("h", "Višina m", { num: 1 })}</div>`;
    else if (e.t === "vaba") h = `<label class="f"><span>Vaba iz registra DDD</span><select data-p="__vaba"><option value=""></option>${vabe.map(o => `<option value="${esc(o.oznaka)}" ${e.oznaka === o.oznaka ? "selected" : ""}>${esc(o.oznaka + " – " + (o.vrsta || ""))}</option>`).join("")}</select></label>` + inp("oznaka", "Oznaka") + inp("vrsta", "Vrsta", { sel: ["vaba za glodavce", "lepilna past", "svetlobna past (UV)", "feromonska past", "drugo"] });
    else if (e.t === "pot") h = inp("vrsta", "Vrsta poti", { sel: Object.keys(TL_POTI) });
    else if (e.t === "vrata") h = inp("rot", "Usmerjenost", { sel: [[0, "vodoravno"], [90, "navpično"]] });
    else if (e.t === "besedilo") h = inp("text", "Besedilo") + inp("vel", "Velikost (pisava)", { num: 1 });
    b.innerHTML = `${h}<div class="row" style="margin-top:8px">${edit ? '<button class="btn sm ghost sec" id="tdup">Podvoji</button><button class="btn sm danger" id="tdel">Izbriši</button>' : ""}</div>`;
    $$("[data-p]", b).forEach(i => { i.disabled = !edit; i.onchange = i.oninput = () => { const k = i.dataset.p, key = sel + "|" + k; if (!props.last || props.last.key !== key || Date.now() - props.last.t > 1500) push(); props.last = { key, t: Date.now() }; let val = i.value; if (k === "__vaba") { const o = vabe.find(z => z.oznaka === val); if (o) { e.oznaka = o.oznaka; e.vrsta = o.vrsta || e.vrsta; } } else { if (["w", "h", "vel"].includes(k)) val = Math.max(0.1, +val || 0.5); if (k === "rot") val = +val; e[k] = val; } paint(); if (i.tagName === "SELECT") props(); }; });
    if (edit) { $("#tdel").onclick = () => { push(); T.elementi = T.elementi.filter(z => z.id !== sel); sel = null; draw(); }; $("#tdup").onclick = () => { push(); const c = JSON.parse(JSON.stringify(e)); c.id = tuid(); move(c, 0.5, 0.5); T.elementi.push(c); sel = c.id; draw(); }; }
  }
  function ddd() { const el2 = $("#tdd"); if (!el2) return; const placed = new Set(T.elementi.filter(z => z.t === "vaba").map(z => z.oznaka)), miss = vabe.filter(b => b.status !== "odstranjena" && !placed.has(b.oznaka)); el2.innerHTML = vabe.length ? (miss.length ? `<span class="badge warn">Vabe, ki še niso na tlorisu: ${miss.map(b => esc(b.oznaka)).join(", ")}</span>` : '<span class="badge ok">Vse vabe iz registra so na tlorisu</span>') : "Register vab je prazen (Higiena → DDD)."; }
  const size = () => { T.sirina_m = Math.min(80, Math.max(2, +$("#tsw").value || T.sirina_m)); T.visina_m = Math.min(60, Math.max(2, +$("#tsh").value || T.visina_m)); push(); draw(); };
  if (edit) { $("#tsw").onchange = $("#tsh").onchange = size; $("#ts").onclick = async () => { try { const r = await D.set("tlorisi", id, { naziv: T.naziv, sirina_m: T.sirina_m, visina_m: T.visina_m, elementi: T.elementi, _razlog: "Urejanje tlorisa" }); Object.assign(rec, r); dirty = false; $("#ts").textContent = "Shrani"; toast("Tloris shranjen (različica " + r.verzija + ")"); } catch (e) { fail(e); } }; }
  $("#te").onclick = () => modal("Prenos tlorisa", "<p>Izberite obliko. Izvoz vsebuje legendo.</p>", [{ t: "Zapri", cls: "ghost sec" }, { t: "SVG", cls: "ghost", fn: () => { dlBlob(new Blob([tlorisSvg(T, { legend: true })], { type: "image/svg+xml" }), "tloris-" + T.naziv + ".svg"); } }, { t: "PNG", fn: async () => { const leg = 54, svg = tlorisSvg(T, { legend: true }), w = T.sirina_m * TL.S, h = T.visina_m * TL.S + leg; const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" })); await new Promise(ok => { img.onload = ok; img.src = url; }); const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => dlBlob(b, "tloris-" + T.naziv + ".png")); } }]);
  draw(); if (edit) setTool("izberi");
}
route(/^\/tloris\/([\w-]+)$/, pageTloris, "Tloris", "stranke");
