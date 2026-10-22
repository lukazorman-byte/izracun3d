// QR kode za naprave: tiskanje nalepk in hiter vnos zapisa po skeniranju (#/vnos/<id naprave>).
// Lasten QR kodirnik (bajtni način, popravljanje napak L/M, različice 1–10).
const QR = (() => {
  const ECC = { L: { f: 1, w: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], b: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4] }, M: { f: 0, w: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], b: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] } };
  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e].w[v] * ECC[e].b[v];
  // GF(256)
  const EXP = [], LOG = []; (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gmul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  const rsGen = d => { let g = [1]; for (let i = 0; i < d; i++) { const n = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= gmul(g[j], EXP[i]); } g = n; } return g; };
  const rsRem = (data, d) => { const g = rsGen(d), r = new Array(d).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < d; i++) r[i] ^= gmul(g[i + 1], f); } return r; };
  function encode(text, ecl, fm) {
    const bytes = [...new TextEncoder().encode(text)];
    for (const e of ecl === "L" ? ["L"] : ["M", "L"]) for (let v = 1; v <= 10; v++) {
      const cc = v < 10 ? 8 : 16, bits = 4 + cc + bytes.length * 8;
      if (bits > dataCw(v, e) * 8) continue;
      return build(bytes, v, e, fm);
    }
    throw new Error("Besedilo je predolgo za QR kodo.");
  }
  function build(bytes, ver, ecl, fm) {
    const cap = dataCw(ver, ecl) * 8, bb = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap - bb.length)); while (bb.length % 8) bb.push(0);
    for (let p = 0xEC; bb.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bb.length; i += 8) data.push(parseInt(bb.slice(i, i + 8).join(""), 2));
    // bloki + RS
    const nb = ECC[ecl].b[ver], eccLen = ECC[ecl].w[ver], raw = Math.floor(rawModules(ver) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const len = shortLen - eccLen + (i < nShort ? 0 : 1), d = data.slice(k, k + len); k += len; blocks.push(d.concat(i < nShort ? [0] : [], rsRem(d, eccLen))); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) all.push(b[i]); });
    const size = ver * 4 + 17, M = Array.from({ length: size }, () => new Array(size).fill(false)), F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ver === 1 ? [] : (() => { const n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2, r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; })();
    for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const fmt = mask => { const d = (ECC[ecl].f << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const bits = ((d << 10) | r) ^ 0x5412, g = i => ((bits >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i)); set(8, size - 8, true); };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const bits = (ver << 12) | r; for (let i = 0; i < 18; i++) { const b = ((bits >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, b); set(c, a, b); } }
    // podatki cik-cak
    let bi = 0; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!F[y][x] && bi < all.length * 8) { M[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; } } }
    const mk = (m, x, y) => [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, x * y % 2 + x * y % 3 === 0, (x * y % 2 + x * y % 3) % 2 === 0, ((x + y) % 2 + x * y % 3) % 2 === 0][m];
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && mk(m, x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => { let p = 0; for (let t = 0; t < 2; t++) for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b < size; b++) { const c = t ? M[b][a] : M[a][b], pr = t ? M[b - 1][a] : M[a][b - 1]; if (c === pr) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      let dark = 0; for (const r of M) for (const c of r) if (c) dark++; p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10; return p; };
    let best = 0, bp = 1e9; for (let m = 0; m < 8; m++) { apply(m); fmt(m); const p = penalty(); if (p < bp) { bp = p; best = m; } apply(m); }
    if (fm !== undefined) best = fm;
    apply(best); fmt(best);
    return M;
  }
  const svg = (text, o) => { o = o || {}; const M = encode(text, o.ecl || "M"), n = M.length, q = 4; let d = ""; M.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + q},${y + q}h1v1h-1z`; })); return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${(o.label || "QR koda").replace(/"/g, "")}" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" width="${o.px || 160}" height="${o.px || 160}"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`; };
  return { encode, svg };
})();

const vrstaVnosa = op => /hlad|zamrz/i.test((op.tip || "") + " " + (op.naziv || "")) ? "temperatura" : "oprema";
async function pageQR(v, m) {
  const sid = m[1], s = (await D.list("stranke")).find(x => x.id === sid); if (!s) throw new Error("Stranka ni najdena.");
  const op = await D.list("oprema", { stranka_id: sid }), base = location.origin;
  $("#title").textContent = "QR kode naprav: " + s.naziv;
  v.innerHTML = `<div class="row"><a class="btn ghost sec sm" href="#/stranka/${sid}/oprema">‹ Nazaj</a><span class="sp"></span><button class="btn" id="qp">Natisni nalepke</button></div>
  <p class="note info">Nalepko prilepite na napravo. Skeniranje s telefonom odpre vnos zapisa za to napravo (potrebna je prijava). Telefon mora imeti dostop do strežnika: v omrežju zaženite z <code>HOST=0.0.0.0</code> in v kodi je naslov <b>${esc(base)}</b>. Če naslov ni pravi, ga zamenjajte v spodnjem polju.</p>
  <label class="f" style="max-width:420px"><span>Naslov aplikacije v kodi</span><input id="qb" value="${esc(base)}"></label>
  <div id="qg" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px"></div>`;
  const draw = () => { const b = $("#qb").value.replace(/\/+$/, ""); $("#qg").innerHTML = op.map(o => { let svg = ""; try { svg = QR.svg(b + "/#/vnos/" + o.id, { px: 150, label: "QR koda za napravo " + o.naziv }); } catch (e) { svg = '<span class="err">' + esc(e.message) + "</span>"; } return `<div class="card" style="text-align:center;break-inside:avoid;margin:0"><div>${svg}</div><b>${esc(o.naziv)}</b><br><span class="mut">${esc(o.tip || "")}${o.lokacija ? " · " + esc(o.lokacija) : ""}</span><br><small class="mut">${esc(s.naziv)}</small></div>`; }).join("") || '<p class="empty">Ni naprav. Dodajte jih na zavihku »Oprema«.</p>'; };
  draw(); $("#qb").oninput = draw; $("#qp").onclick = () => { if (canPrint("qr")) window.print(); };
}
async function pageVnos(v, m) {
  const op = (await D.list("oprema")).find(x => x.id === m[1]); if (!op) throw new Error("Naprava ni najdena ali nimate dostopa.");
  const s = (await D.list("stranke")).find(x => x.id === op.stranka_id), obrati = await D.list("obrati", { stranka_id: op.stranka_id });
  const ctx = await evCtx({ stranka_id: op.stranka_id, stranka: s, obrati: mapOf(obrati) });
  $("#title").textContent = op.naziv;
  v.innerHTML = `<div class="card"><h2>${esc(op.naziv)}</h2><p class="mut">${esc(s.naziv)}${op.lokacija ? " · " + esc(op.lokacija) : ""}</p><div class="row"><button class="btn" id="vn">Nov vnos</button><a class="btn ghost sec" href="#/stranka/${s.id}/evidence">Vse evidence</a></div><div id="vl"></div></div>`;
  const vrsta = vrstaVnosa(op);
  const open = () => { evForm(null, ctx, () => { toast("Zapis shranjen"); list(); }, vrsta); const sel = $("#f_oprema"); if (sel) { sel.value = op.naziv; sel.dispatchEvent(new Event("change")); } };
  const list = async () => { const rows = (await D.list("evidence", { stranka_id: s.id })).filter(r => r.oprema === op.naziv).sort((a, b) => (b.cas || "").localeCompare(a.cas || "")).slice(0, 8); $("#vl").innerHTML = `<h3>Zadnji zapisi</h3>` + (rows.length ? `<div class="tw"><table class="t">${rows.map(r => `<tr><td>${fdt(r.cas)}</td><td>${evSummary(r)}</td><td>${skladnoBadge(r)}</td></tr>`).join("")}</table></div>` : '<p class="mut">Še ni zapisov.</p>'); };
  $("#vn").onclick = open; await list(); open();
}
route(/^\/qr\/([\w-]+)$/, pageQR, "QR kode naprav", "stranke");
route(/^\/vnos\/([\w-]+)$/, pageVnos, "Vnos zapisa", "stranke");
