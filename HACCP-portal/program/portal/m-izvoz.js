// Izvoz: XLSX in PDF (brez knjižnic). PDF uporablja standardni pisavi Helvetica z dodanimi glifi č, ć, đ.
const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const utf8 = s => new TextEncoder().encode(s);
function zipStoreU8(files) {
  const parts = [], cen = []; let off = 0;
  const u16 = (v, a, o) => { a[o] = v & 255; a[o + 1] = v >> 8 & 255; }, u32 = (v, a, o) => { u16(v & 0xFFFF, a, o); u16(v >>> 16, a, o + 2); };
  for (const f of files) {
    const nm = utf8(f.name), c = crc32(f.data), h = new Uint8Array(30), e = new Uint8Array(46);
    u32(0x04034b50, h, 0); u16(20, h, 4); u16(0x0800, h, 6); u32(c, h, 14); u32(f.data.length, h, 18); u32(f.data.length, h, 22); u16(nm.length, h, 26);
    u32(0x02014b50, e, 0); u16(20, e, 4); u16(20, e, 6); u16(0x0800, e, 8); u32(c, e, 16); u32(f.data.length, e, 20); u32(f.data.length, e, 24); u16(nm.length, e, 28); u32(off, e, 42);
    parts.push(h, nm, f.data); cen.push(e, nm); off += 30 + nm.length + f.data.length;
  }
  const cl = cen.reduce((a, x) => a + x.length, 0), end = new Uint8Array(22);
  u32(0x06054b50, end, 0); u16(files.length, end, 8); u16(files.length, end, 10); u32(cl, end, 12); u32(off, end, 16);
  return new Blob([...parts, ...cen, end]);
}
const xe = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
function colName(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function downloadXlsx(name, sheets) {
  if (!canPrint(name)) return;
  const used = new Set();
  const sx = sheets.map(sh => {
    const rows = [sh.glava, ...sh.vrste];
    const widths = sh.glava.map((_, c) => Math.min(60, Math.max(10, ...rows.map(r => String(r[c] == null ? "" : r[c]).length + 2))));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const ref = colName(ci) + (ri + 1); if (typeof v === "number" && isFinite(v) && ri > 0) return `<c r="${ref}"><v>${v}</v></c>`; return `<c r="${ref}" t="inlineStr" s="${ri === 0 ? 1 : 2}"><is><t xml:space="preserve">${xe(v)}</t></is></c>`; }).join("")}</row>`).join("")}</sheetData></worksheet>`;
  });
  const sn = sheets.map(s => { let n = String(s.ime).replace(/[\\\/?*\[\]:]/g, " ").slice(0, 31) || "List"; while (used.has(n)) n += "_"; used.add(n); return n; });
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sn.map((n, i) => `<sheet name="${xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F6F4F"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>`],
    ...sx.map((x, i) => [`xl/worksheets/sheet${i + 1}.xml`, x])
  ].map(([name, t]) => ({ name, data: utf8(t) }));
  dlBlob(zipStoreU8(files), name.endsWith(".xlsx") ? name : name + ".xlsx");
}

// ---------- PDF ----------
const HW = { r: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
  b: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584] };
const DIA = { "Č": [128, "C"], "č": [129, "c"], "Ć": [130, "C"], "ć": [131, "c"], "Đ": [132, "D"], "đ": [133, "d"] };
const WANSI = { "š": 0x9A, "Š": 0x8A, "ž": 0x9E, "Ž": 0x8E, "–": 0x96, "—": 0x97, "“": 0x93, "”": 0x94, "„": 0x84, "‘": 0x91, "’": 0x92, "•": 0x95, "€": 0x80 };
function pdfCode(ch) {
  if (DIA[ch]) return DIA[ch][0];
  if (WANSI[ch]) return WANSI[ch];
  const c = ch.charCodeAt(0);
  if (c >= 32 && c < 127) return c;
  if (c >= 0xA0 && c <= 0xFF) return c;
  if (c === 9 || c === 10) return 32;
  return 63;
}
function pdfW(ch, bold, size) {
  if (DIA[ch]) { const b = DIA[ch][1]; return pdfW(b, bold, size); }
  if (ch === "š" || ch === "ž") return (bold ? 500 : 500) * size / 1000;
  if (ch === "Š") return 667 * size / 1000; if (ch === "Ž") return 611 * size / 1000;
  const c = ch.charCodeAt(0), t = bold ? HW.b : HW.r;
  if (c >= 32 && c <= 126) return t[c - 32] * size / 1000;
  if (ch === "–" || ch === "—") return (ch === "–" ? 556 : 1000) * size / 1000;
  if (ch === "•") return 350 * size / 1000;
  return 556 * size / 1000;
}
const hexOf = s => Array.from(s).map(ch => pdfCode(ch).toString(16).padStart(2, "0")).join("");
const f2 = n => (Math.round(n * 100) / 100).toString();

class Pdf {
  constructor(o) {
    this.o = Object.assign({ naslov: "Dokument", podnaslov: "", verzija: "1.0", datum: today(), stranka: "", noga: true }, o);
    this.W = o && o.landscape ? 841.89 : 595.28; this.H = o && o.landscape ? 595.28 : 841.89; this.M = 48; this.pages = []; this.imgs = []; this.toc = []; this.offset = o && o.offset || 0;
    this.newPage();
  }
  newPage() { this.pages.push({ s: [], links: [], im: new Set() }); this.y = this.H - this.M - 18; return this.pages[this.pages.length - 1]; }
  get cur() { return this.pages[this.pages.length - 1]; }
  need(h) { if (this.y - h < this.M + 22) this.newPage(); }
  color(c) { return c === "g" ? "0.184 0.435 0.31" : c === "r" ? "0.7 0.15 0.12" : c === "m" ? "0.4 0.45 0.42" : c === "w" ? "1 1 1" : c === "l" ? "0.9 0.95 0.92" : "0.1 0.13 0.11"; }
  text(x, y, s, size, bold, col) { this.cur.s.push(`BT ${this.color(col)} rg /${bold ? "F2" : "F1"} ${size} Tf ${f2(x)} ${f2(y)} Td <${hexOf(s)}> Tj ET`); }
  wrap(s, w, size, bold) {
    const out = [];
    for (const para of String(s == null ? "" : s).split("\n")) {
      let line = "", lw = 0;
      for (const word of para.split(/(\s+)/)) {
        if (!word) continue;
        const ww = Array.from(word).reduce((a, ch) => a + pdfW(ch, bold, size), 0);
        if (lw + ww > w && line.trim()) { out.push(line.trimEnd()); line = ""; lw = 0; if (/^\s+$/.test(word)) continue; }
        if (ww > w) { for (const ch of word) { const cw = pdfW(ch, bold, size); if (lw + cw > w) { out.push(line); line = ""; lw = 0; } line += ch; lw += cw; } continue; }
        line += word; lw += ww;
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  h(level, s) {
    const size = level === 1 ? 16 : level === 2 ? 13 : 11;
    this.need(size + 30); this.y -= level === 1 ? 10 : 6;
    this.toc.push({ level, s, page: this.pages.length + this.offset });
    this.text(this.M, this.y, s, size, true, "g"); this.y -= size + 6;
    if (level === 1) { this.cur.s.push(`${this.color("g")} RG 0.8 w ${f2(this.M)} ${f2(this.y + 3)} m ${f2(this.W - this.M)} ${f2(this.y + 3)} l S`); this.y -= 12; }
  }
  p(s, o) {
    o = o || {}; const size = o.size || 10, lead = size * 1.4, w = this.W - 2 * this.M - (o.indent || 0);
    for (const l of this.wrap(s, w, size, o.bold)) { this.need(lead); this.text(this.M + (o.indent || 0), this.y, l, size, o.bold, o.col); this.y -= lead; }
    this.y -= o.gap === undefined ? 4 : o.gap;
  }
  bullets(list, o) { for (const t of list) { const size = 10, w = this.W - 2 * this.M - 14; const ls = this.wrap(t, w, size); ls.forEach((l, i) => { this.need(14); if (!i) this.text(this.M + 2, this.y, "•", size, false); this.text(this.M + 14, this.y, l, size, false); this.y -= 14; }); } this.y -= 4; }
  imgIdx(im) { let i = this.imgs.indexOf(im); if (i < 0) { i = this.imgs.length; this.imgs.push(im); } return i; }
  img(im, maxW, maxH, cap) {
    if (!im) return;
    const sc = Math.min((maxW || 300) / im.w, (maxH || 220) / im.h, 1), w = im.w * sc, h = im.h * sc, capL = cap ? this.wrap(cap, this.W - 2 * this.M, 8.5) : [];
    this.need(h + capL.length * 11 + 10);
    const i = this.imgIdx(im); this.cur.im.add(i);
    this.cur.s.push(`q ${f2(w)} 0 0 ${f2(h)} ${f2(this.M)} ${f2(this.y - h)} cm /Im${i} Do Q`); this.y -= h + 4;
    for (const l of capL) { this.text(this.M, this.y - 7, l, 8.5, false, "m"); this.y -= 11; }
    this.y -= 8;
  }
  gap(n) { this.y -= n; }
  box(s, col) { const w = this.W - 2 * this.M - 16, ls = this.wrap(s, w, 9.5); const h = ls.length * 13 + 10; this.need(h + 6); this.cur.s.push(`${col === "r" ? "1 0.93 0.91" : "0.99 0.96 0.85"} rg ${f2(this.M)} ${f2(this.y - h + 4)} ${f2(this.W - 2 * this.M)} ${f2(h)} re f`); let yy = this.y - 8; for (const l of ls) { this.text(this.M + 8, yy, l, 9.5, false, col === "r" ? "r" : "d"); yy -= 13; } this.y -= h + 6; }
  table(glava, vrste, sirine, o) {
    o = o || {}; const size = o.size || 8.5, lead = size * 1.35, tw = this.W - 2 * this.M;
    const sum = sirine.reduce((a, b) => a + b, 0), cw = sirine.map(x => x / sum * tw);
    const hl = glava.map((g, i) => this.wrap(g, cw[i] - 8, size, true)), hh = Math.max(...hl.map(l => l.length)) * lead + 8;
    const drawHead = () => { this.need(hh + 20); this.cur.s.push(`${this.color("g")} rg ${f2(this.M)} ${f2(this.y - hh + 4)} ${f2(tw)} ${f2(hh)} re f`); let x = this.M; glava.forEach((g, i) => { let yy = this.y - 8; for (const l of hl[i]) { this.text(x + 4, yy, l, size, true, "w"); yy -= lead; } x += cw[i]; }); this.y -= hh; };
    drawHead();
    vrste.forEach((r, ri) => {
      const cells = glava.map((_, i) => this.wrap(r[i] == null ? "" : r[i], cw[i] - 8, size));
      const h = Math.max(o.minH || 0, Math.max(...cells.map(c => c.length)) * lead + 6);
      if (this.y - h < this.M + 22) { this.newPage(); drawHead(); }
      if (ri % 2) this.cur.s.push(`0.95 0.97 0.95 rg ${f2(this.M)} ${f2(this.y - h + 4)} ${f2(tw)} ${f2(h)} re f`);
      let x = this.M; cells.forEach((c, i) => { let yy = this.y - 7; for (const l of c) { this.text(x + 4, yy, l, size, false); yy -= lead; } x += cw[i]; });
      this.cur.s.push(`0.82 0.86 0.83 RG 0.4 w ${f2(this.M)} ${f2(this.y - h + 4)} m ${f2(this.W - this.M)} ${f2(this.y - h + 4)} l S`);
      if (o.grid) { let gx = this.M; this.cur.s.push(`0.7 0.74 0.71 RG 0.4 w`); for (let i = 0; i <= cw.length; i++) { this.cur.s.push(`${f2(gx)} ${f2(this.y + 4)} m ${f2(gx)} ${f2(this.y - h + 4)} l S`); gx += cw[i] || 0; } }
      this.y -= h;
    });
    this.y -= 8;
  }
  // diagram poteka: navpična veriga polj; koraki: [{t, ccp, opomba}]
  flow(steps) {
    const w = 330, x = (this.W - w) / 2;
    steps.forEach((st, i) => {
      const ls = this.wrap((st.n ? st.n + ". " : "") + st.t, w - 16, 9, st.ccp), h = ls.length * 12 + 10;
      this.need(h + 18);
      const stroke = st.ccp ? "0.7 0.15 0.12" : "0.184 0.435 0.31";
      this.cur.s.push(`1 1 1 rg ${stroke} RG 1.2 w ${f2(x)} ${f2(this.y - h)} ${f2(w)} ${f2(h)} re B`);
      let yy = this.y - 12; for (const l of ls) { this.text(x + 8, yy, l, 9, !!st.ccp, st.ccp ? "r" : "d"); yy -= 12; }
      if (st.tag) this.text(x + w + 8, this.y - h / 2 - 3, st.tag, 8, true, st.ccp ? "r" : "m");
      this.y -= h;
      if (i < steps.length - 1) { this.cur.s.push(`${this.color("g")} RG ${this.color("g")} rg 1 w ${f2(this.W / 2)} ${f2(this.y)} m ${f2(this.W / 2)} ${f2(this.y - 12)} l S ${f2(this.W / 2 - 3)} ${f2(this.y - 8)} m ${f2(this.W / 2 + 3)} ${f2(this.y - 8)} l ${f2(this.W / 2)} ${f2(this.y - 13)} l f`); this.y -= 14; }
    });
    this.y -= 10;
  }
  // sestavi končni PDF; cover + TOC pred vsebino (prvi dve vsebinski strani sta rezervirani)
  build(tocPages) {
    if (this.o.plain) tocPages = 0;
    const o = this.o, objs = [], add = s => { objs.push(s); return objs.length; };
    const logo = o.logo === undefined ? LOGO.pdf || LOGO.im : o.logo, okvir = !(o.logo === undefined && LOGO.privzeti); if (logo) this.imgIdx(logo);
    const slogo = o.strankaLogo === undefined ? strankaLogoZa(o.stranka) : o.strankaLogo; if (slogo) this.imgIdx(slogo);
    const body = this.pages, total = body.length + (o.plain ? 0 : 1) + tocPages;
    add("<< /Type /Catalog /Pages 2 0 R >>"); add(""); // pages se zapolni kasneje
    const enc = "<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [128 /Ccaron /ccaron /Cacute /cacute /Dcroat /dcroat] >>";
    const f1 = add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding ${enc} >>`), f2o = add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding ${enc} >>`);
    const imObj = this.imgs.map(im => add({ dict: `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.u8.length} >>`, data: im.u8 }));
    const kids = [];
    const mkPage = (stream, used) => { const c = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`); const p = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(this.W)} ${f2(this.H)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2o} 0 R >>${used && used.size ? ` /XObject << ${[...used].map(i => `/Im${i} ${imObj[i]} 0 R`).join(" ")} >>` : ""} >> /Contents ${c} 0 R >>`); kids.push(p); };
    const T = this, tx = (x, y, s, size, bold, col) => `BT ${T.color(col)} rg /${bold ? "F2" : "F1"} ${size} Tf ${f2(x)} ${f2(y)} Td <${hexOf(s)}> Tj ET\n`;
    // naslovnica
    let cv = `${T.color("g")} rg 0 ${f2(T.H - 250)} ${f2(T.W)} 250 re f\n` + tx(T.M, T.H - 90, "HiGiFood", 30, true, "w") + "\n" + tx(T.M, T.H - 115, "HACCP dokumentacija", 13, false, "w") + "\n";
    const tl = T.wrap(o.naslov, T.W - 2 * T.M, 24, true); let yy = T.H - 330; for (const l of tl) { cv += tx(T.M, yy, l, 24, true, "d") + "\n"; yy -= 30; }
    if (o.podnaslov) for (const l of T.wrap(o.podnaslov, T.W - 2 * T.M, 12, false)) { cv += tx(T.M, yy - 6, l, 12, false, "m") + "\n"; yy -= 17; }
    yy = 200; for (const [k, v] of [["Podjetje", o.stranka], ["Različica", o.verzija], ["Datum", fdate(o.datum)], ["Pripravil", o.avtor || ""], ["Stanje", o.stanje || "osnutek – potrebna strokovna potrditev"]]) if (v) { cv += tx(T.M, yy, k, 10, true, "m") + tx(T.M + 90, yy, String(v), 10, false) + "\n"; yy -= 18; }
    cv += tx(T.M, 60, "Dokument je pripravljen s pomočjo orodja in ne pomeni uradne odobritve ali samodejne skladnosti z zakonodajo.", 8, false, "m") + "\n";
    let cvUsed = new Set();
    if (logo) { const i = this.imgIdx(logo), sc = Math.min(150 / logo.w, 70 / logo.h, 1), w = logo.w * sc, h = logo.h * sc, x = T.W - T.M - w - 10, yb = T.H - 60 - h; cv += `${okvir ? `1 1 1 rg ${f2(x - 10)} ${f2(yb - 8)} ${f2(w + 20)} ${f2(h + 16)} re f\n` : ""}q ${f2(w)} 0 0 ${f2(h)} ${f2(x)} ${f2(yb)} cm /Im${i} Do Q\n`; cvUsed.add(i); }
    if (slogo) { const i = this.imgIdx(slogo), sc = Math.min(160 / slogo.w, 70 / slogo.h, 1), w = slogo.w * sc, h = slogo.h * sc; cv += `q ${f2(w)} 0 0 ${f2(h)} ${f2(T.M)} 226 cm /Im${i} Do Q\n`; cvUsed.add(i); }
    if (!o.plain) mkPage(cv, cvUsed);
    // kazalo
    const perPage = 42, tocs = [];
    for (let p = 0; p < tocPages; p++) {
      let s = tx(T.M, T.H - T.M - 6, p ? "Kazalo (nadaljevanje)" : "Kazalo", 16, true, "g") + "\n", y = T.H - T.M - 36;
      for (const e of this.toc.slice(p * perPage, (p + 1) * perPage)) { s += tx(T.M + (e.level - 1) * 14, y, e.s.slice(0, 80), e.level === 1 ? 10.5 : 9.5, e.level === 1, "d") + tx(T.W - T.M - 24, y, String(e.page), 10, false, "m") + "\n"; y -= 15; }
      tocs.push(s);
    }
    tocs.forEach(s => { const idx = kids.length + 1; mkPage(s + this.foot(idx + 0, total)); });
    body.forEach((pg, i) => mkPage(pg.s.join("\n") + "\n" + this.foot((o.plain ? 1 : 2) + tocPages + i, total), pg.im));
    objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
    const chunks = []; let pos = 0, offs = [];
    const put = x => { const u = typeof x === "string" ? Uint8Array.from(x, c => c.charCodeAt(0) & 255) : x; chunks.push(u); pos += u.length; };
    put("%PDF-1.4\n");
    objs.forEach((s, i) => { offs.push(pos); if (typeof s === "string") put(`${i + 1} 0 obj\n${s}\nendobj\n`); else { put(`${i + 1} 0 obj\n${s.dict}\nstream\n`); put(s.data); put("\nendstream\nendobj\n"); } });
    const xr = pos;
    put(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(x => String(x).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info << /Title <FEFF${Array.from(this.o.naslov).map(c => c.charCodeAt(0).toString(16).padStart(4, "0")).join("")}> >> >>\nstartxref\n${xr}\n%%EOF`);
    const out = chunks;
    return new Blob(out, { type: "application/pdf" });
  }
  foot(pageNo, total) {
    const o = this.o, T = this, t = `HiGiFood HACCP | ${o.naslov.slice(0, 50)} | v${o.verzija} | ${fdate(o.datum)}`;
    return `0.8 0.85 0.82 RG 0.5 w ${f2(T.M)} 40 m ${f2(T.W - T.M)} 40 l S\nBT 0.4 0.45 0.42 rg /F1 8 Tf ${f2(T.M)} 28 Td <${hexOf(t)}> Tj ET\nBT 0.4 0.45 0.42 rg /F1 8 Tf ${f2(T.W - T.M - 50)} 28 Td <${hexOf("Stran " + pageNo + " / " + total)}> Tj ET`;
  }
}
// zgradi dokument z dvema prehodoma (število strani kazala vpliva na številke strani)
function pdfBuild(meta, fill) {
  let tp = 1, doc;
  for (let k = 0; k < 3; k++) {
    doc = new Pdf(Object.assign({}, meta, { offset: 1 + tp })); fill(doc);
    const need = Math.max(1, Math.ceil(doc.toc.length / 42));
    if (need === tp) break; tp = need;
  }
  return doc.build(tp);
}
function downloadPdf(name, spec) {
  const blob = pdfBuild({ naslov: spec.naslov, podnaslov: spec.podnaslov, stranka: spec.stranka || "" }, d => {
    d.h(1, spec.naslov);
    if (spec.tabela) d.table(spec.tabela.glava, spec.tabela.vrste, spec.tabela.sirine);
  });
  dlBlob(blob, name.endsWith(".pdf") ? name : name + ".pdf");
}

// ---------- Word (.docx): isti vmesnik kot Pdf (h, p, bullets, table, flow, box, gap), vse urejljivo v Wordu ----------
class Docx {
  constructor(o) { this.o = Object.assign({ naslov: "Dokument", podnaslov: "", verzija: "1.0", datum: today(), stranka: "" }, o); this.b = []; this.imgs = []; this.toc = []; }
  r(t, o) { o = o || {}; const parts = String(t == null ? "" : t).split("\n"); return parts.map((s, i) => `<w:r><w:rPr>${o.b ? "<w:b/>" : ""}${o.col ? `<w:color w:val="${o.col}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ""}</w:rPr>${i ? "<w:br/>" : ""}<w:t xml:space="preserve">${xe(s)}</w:t></w:r>`).join(""); }
  para(t, o) { o = o || {}; return `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}${o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang || 0}"/>` : ""}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}${o.after !== undefined ? `<w:spacing w:after="${o.after}"/>` : ""}${o.brk ? "<w:pageBreakBefore/>" : ""}</w:pPr>${this.r(t, o)}</w:p>`; }
  h(level, s) { this.toc.push({ level, s }); this.b.push(this.para(s, { style: "Heading" + Math.min(level, 3) })); }
  p(s, o) { o = o || {}; this.b.push(this.para(s, { b: o.bold, col: o.col === "m" ? "666666" : o.col === "r" ? "B3261E" : "", sz: o.size ? Math.round(o.size * 2) : 0, after: o.gap === 1 ? 20 : undefined })); }
  gap() { this.b.push(this.para("", { after: 40 })); }
  imgXml(im, maxW, maxH) {
    let i = this.imgs.indexOf(im); if (i < 0) { i = this.imgs.length; this.imgs.push(im); }
    const sc = Math.min(maxW / im.w, maxH / im.h, 1), cx = Math.round(im.w * sc * 12700), cy = Math.round(im.h * sc * 12700), id = i + 1;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Slika ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="slika${id}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  img(im, maxW, maxH, cap) { if (!im) return; this.b.push(`<w:p><w:pPr><w:keepNext/><w:spacing w:after="40"/></w:pPr>${this.imgXml(im, maxW || 300, maxH || 220)}</w:p>`); if (cap) this.b.push(this.para(cap, { col: "666666", sz: 17, after: 160 })); }
  bullets(list) { for (const t of list) this.b.push(this.para("•\t" + t, { ind: 360, hang: 360 })); }
  cell(t, w, o) { o = o || {}; return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}</w:tcPr>${this.para(t, { b: o.b, col: o.col, sz: o.sz || 18, after: 20, jc: o.jc })}</w:tc>`; }
  tbl(rows, widths, borders) { const bd = borders || `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="B8C4BC"/>`).join("")}</w:tblBorders>`; return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${bd}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows}</w:tbl>`; }
  table(glava, vrste, sirine) {
    const sum = sirine.reduce((a, b) => a + b, 0), W = sirine.map(x => Math.round(x / sum * 9638));
    const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${glava.map((g, i) => this.cell(g, W[i], { fill: "2F6F4F", b: 1, col: "FFFFFF" })).join("")}</w:tr>`;
    const rows = vrste.map((r, ri) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${glava.map((_, i) => this.cell(r[i], W[i], { fill: ri % 2 ? "F1F6F2" : "" })).join("")}</w:tr>`).join("");
    this.b.push(this.tbl(head + rows, W)); this.b.push(this.para("", { after: 80 }));
  }
  box(s, col) { this.b.push(this.tbl(`<w:tr>${this.cell(s, 9638, { fill: col === "r" ? "FDE8E6" : "FFF4D6", col: col === "r" ? "B3261E" : "" })}</w:tr>`, [9638])); this.b.push(this.para("", { after: 80 })); }
  // urejljiv diagram: Wordove oblike (polja + puščice) v skupini; vsak del do 9 korakov (da se prilega strani)
  shapes(items, W, H, label) {
    this.sid = this.sid || 100; const E = 9525, e = v => Math.round(v * E), WW = e(W), HH = e(H), hx = c => String(c || "000000").replace("#", "").toUpperCase(), sz = 18;
    const tx = (t, s, col, b) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr>${b ? "<w:b/>" : ""}<w:color w:val="${col}"/><w:sz w:val="${s}"/><w:szCs w:val="${s}"/></w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r></w:p>`;
    const sp = items.map(i => { const id = ++this.sid;
      if (i.t === "rect") return `<wps:wsp><wps:cNvPr id="${id}" name="Polje ${id}"/><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="${e(i.x)}" y="${e(i.y)}"/><a:ext cx="${e(i.w)}" cy="${e(i.h)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${hx(i.fill)}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="${hx(i.stroke)}"/></a:solidFill></a:ln></wps:spPr><wps:txbx><w:txbxContent>${tx(i.text, sz, "1D2420", i.bold)}${i.sub ? tx(i.sub, 14, "B3261E", true) : ""}</w:txbxContent></wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="36000" tIns="18000" rIns="36000" bIns="18000" anchor="ctr" anchorCtr="0"><a:noAutofit/></wps:bodyPr></wps:wsp>`;
      const x1 = e(i.x1), y1 = e(i.y1), x2 = e(i.x2), y2 = e(i.y2);
      return `<wps:wsp><wps:cNvPr id="${id}" name="Povezava ${id}"/><wps:cNvCnPr/><wps:spPr><a:xfrm><a:off x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}"/><a:ext cx="${Math.abs(x2 - x1)}" cy="${Math.abs(y2 - y1)}"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="25400"><a:solidFill><a:srgbClr val="${hx(i.c)}"/></a:solidFill><a:tailEnd type="triangle" w="med" len="med"/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp>`; }).join("");
    const did = ++this.sid;
    return `<w:p><w:pPr><w:keepLines/><w:spacing w:before="60" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><mc:AlternateContent><mc:Choice Requires="wpg"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${WW}" cy="${HH}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${did}" name="Diagram ${did}" descr="${xe(label || "Diagram poteka")}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${WW}" cy="${HH}"/><a:chOff x="0" y="0"/><a:chExt cx="${WW}" cy="${HH}"/></a:xfrm></wpg:grpSpPr>${sp}</wpg:wgp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict/></mc:Fallback></mc:AlternateContent></w:r></w:p>`;
  }
  flow(steps) {
    const W = 480, bw = 340, x0 = (W - bw) / 2, per = 9;
    for (let s = 0; s < steps.length; s += per) {
      const part = steps.slice(s, s + per), items = []; let y = 8;
      part.forEach((st, i) => {
        const txt = (st.n ? st.n + ". " : "") + st.t, lines = Math.max(1, Math.ceil(txt.length / ((bw - 30) / 6.6))), h = 24 + 14 * (lines - 1) + (st.ccp ? 14 : 0);
        items.push({ t: "rect", x: x0, y, w: bw, h, fill: "FFFFFF", stroke: st.ccp ? "B3261E" : "2F6F4F", text: txt, bold: !!st.ccp, sub: st.ccp ? "KRITIČNA KONTROLNA TOČKA (CCP)" : "" });
        y += h; if (i < part.length - 1) { items.push({ t: "line", x1: W / 2, y1: y, x2: W / 2, y2: y + 20, c: "2F6F4F" }); y += 20; }
      });
      this.b.push(this.shapes(items, W, y + 8, "Diagram poteka"));
      if (s + per < steps.length) this.b.push(this.para("▼ nadaljevanje diagrama", { jc: "center", col: "2F6F4F", sz: 18, after: 40 }));
    }
    this.b.push(this.para("", { after: 120 }));
  }
  build() {
    const o = this.o, NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
    const logo = o.logo === undefined ? LOGO.im : o.logo, slogo = o.strankaLogo === undefined ? strankaLogoZa(o.stranka) : o.strankaLogo;
    const cover = [logo ? `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${this.imgXml(logo, 150, 60)}</w:p>` : "", this.para("HiGiFood", { b: 1, col: "2F6F4F", sz: 56, after: 40 }), this.para("HACCP dokumentacija", { col: "2F6F4F", sz: 26, after: 1200 }), this.para(o.naslov, { b: 1, sz: 48, after: 120 }), o.podnaslov ? this.para(o.podnaslov, { col: "666666", sz: 26, after: 900 }) : "",
      slogo ? `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr>${this.imgXml(slogo, 160, 70)}</w:p>` : "",
      this.tbl([["Podjetje", o.stranka], ["Različica", o.verzija], ["Datum", fdate(o.datum)], ["Pripravil", o.avtor || ""], ["Stanje", o.stanje || "osnutek – potrebna strokovna potrditev"]].filter(r => r[1]).map(r => `<w:tr>${this.cell(r[0], 2000, { b: 1, col: "666666" })}${this.cell(r[1], 7638)}</w:tr>`).join(""), [2000, 7638], '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'),
      this.para("Dokument je pripravljen s pomočjo orodja in ne pomeni uradne odobritve ali samodejne skladnosti z zakonodajo. Urejate ga lahko v Wordu.", { col: "666666", sz: 16 })].join("");
    const tocE = this.toc.filter(t => t.level <= 2);
    const toc = this.para("Kazalo", { style: "Heading1", brk: 1 }) + (tocE.length ? tocE.map((t, i) => `<w:p><w:pPr><w:ind w:left="${(t.level - 1) * 280}"/><w:spacing w:after="40"/></w:pPr>${i === 0 ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : ""}${this.r(t.s, { b: t.level === 1 })}${i === tocE.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : ""}</w:p>`).join("") : "");
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${cover}${toc}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${this.b.join("")}<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567"/></w:sectPr></w:body></w:document>`;
    const H = (id, sz, col, bf) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id.replace("Heading", "heading ")}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${id === "Heading1" ? 360 : 200}" w:after="100"/><w:outlineLvl w:val="${+id.slice(-1) - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${col}"/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:lang w:val="sl-SI"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${H("Heading1", 32, "2F6F4F")}${H("Heading2", 26, "2F6F4F")}${H("Heading3", 23, "2F6F4F")}</w:styles>`;
    const t = `HiGiFood HACCP | ${o.naslov.slice(0, 50)} | v${o.verzija} | ${fdate(o.datum)}`;
    const fld = i => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${i} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="B8C4BC"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr><w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:color w:val="666666"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Stran </w:t></w:r>${fld("PAGE")}<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r>${fld("NUMPAGES")}</w:p></w:ftr>`;
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = [
      ["[Content_Types].xml", `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`],
      ["_rels/.rels", `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`],
      ["word/_rels/document.xml.rels", `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R}/settings" Target="settings.xml"/><Relationship Id="rId3" Type="${R}/footer" Target="footer1.xml"/>${this.imgs.map((_, i) => `<Relationship Id="rIdImg${i + 1}" Type="${R}/image" Target="media/slika${i + 1}.jpg"/>`).join("")}</Relationships>`],
      ["word/settings.xml", `${X}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>`],
      ["word/styles.xml", styles], ["word/footer1.xml", footer], ["word/document.xml", doc]
    ].map(([name, s]) => ({ name, data: utf8(s) })).concat(this.imgs.map((im, i) => ({ name: `word/media/slika${i + 1}.jpg`, data: im.u8 })));
    const z = zipStoreU8(files); return new Blob([z], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
}
function docxBuild(meta, fill) { const d = new Docx(meta); fill(d); return d.build(); }


// ---------- slike: nalaganje, pretvorba v JPEG (za PDF in Word), logotip ----------
const LOGO = { im: null };
async function loadImg(url, maxPx, bg) {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    const sc = Math.min(1, (maxPx || 1400) / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = bg || "#fff"; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.85));
    return { u8: new Uint8Array(await blob.arrayBuffer()), w, h };
  } catch { return null; }
}
// logotip stranke (predpomnjen po id); dokumenti ga uporabijo, če se naziv stranke ujema
const SLOGO = {};
async function loadStrankaLogo(s, force) { if (!s || !s.id) return null; if (force || !SLOGO[s.id]) SLOGO[s.id] = { naziv: s.naziv, im: await loadImg("/api/stranka-logo/" + s.id + "?t=" + Date.now(), 600) }; else SLOGO[s.id].naziv = s.naziv; return SLOGO[s.id].im; }
const strankaLogoZa = naziv => { if (!naziv) return null; const e = Object.values(SLOGO).find(x => x.naziv === naziv && x.im); return e ? e.im : null; };
async function navStrankaLogo() {
  const b = $("#stlogo"); if (!b) return; b.hidden = true; b.innerHTML = "";
  const sid = ME.u && ME.u.stranka_id; if (!sid) return;
  try { const r = await fetch("/api/stranka-logo/" + sid + "?t=" + Date.now()); if (r.status !== 200) return; const u = URL.createObjectURL(await r.blob()); b.innerHTML = `<img src="${u}" alt="Logotip podjetja">`; b.hidden = false; } catch {}
}
// lasten logotip (z belim okvirjem) ali privzeti logotip HiGiFood brez ozadja: za PDF na zeleni pasici, za Word na beli strani
async function loadLogo() {
  const own = await loadImg("/api/logo?t=" + Date.now(), 600);
  if (own) Object.assign(LOGO, { im: own, pdf: null, privzeti: false });
  else Object.assign(LOGO, { im: await loadImg("/logo-svetlo.png", 600), pdf: await loadImg("/logo-temno.png", 600, "rgb(47,111,79)"), privzeti: true });
}
