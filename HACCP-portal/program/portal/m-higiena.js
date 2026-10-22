// Higiena: načrt čiščenja z dnevnim seznamom, DDD, mikrobiološki brisi in hitri testi, zdravstvene izjave, čistila.
const HSUB = [["danes", "Danes za opraviti"], ["nacrt", "Načrt čiščenja"], ["testi", "Brisi in hitri testi"], ["ddd", "DDD (škodljivci)"], ["zdravje", "Zdravje zaposlenih"], ["kemikalije", "Čistila in razkužila"]];

// naslednji rok čiščenja po opravilu (iz načrta in evidenc)
function ciscenjeStanje(nacrt, evid) {
  const t = today();
  return nacrt.filter(n => n.aktivno !== false && +n.pogostost_dni > 0).map(n => {
    const last = evid.filter(e => e.vrsta === "ciscenje" && e.nacrt_id === n.id && e.izvedeno).map(e => String(e.cas).slice(0, 10)).sort().pop();
    const next = last ? addDays(last, +n.pogostost_dni) : (n.zacetek || String(n.ustvarjeno || t).slice(0, 10));
    return { n, last, next, zamuda: daysTo(next) < 0, danes: daysTo(next) <= 0 };
  });
}

async function tabHigiena(el, ctx0) {
  const sub = sessionStorage.getItem("hsub") || "danes";
  const ctx = await evCtx(ctx0);
  el.innerHTML = `<div class="steps">${HSUB.map(([k, l]) => `<button data-s="${k}" class="${k === sub ? "on" : ""}">${l}</button>`).join("")}</div><div id="hbody"></div>`;
  $$(".steps button", el).forEach(b => b.onclick = () => { sessionStorage.setItem("hsub", b.dataset.s); tabHigiena(el, ctx0); });
  const body = $("#hbody", el);
  ({ danes: () => hDanes(body, ctx), nacrt: () => listView(body, "ciscenje_nacrt", ctx), testi: () => hTesti(body, ctx), ddd: () => hDDD(body, ctx), zdravje: () => hMini(body, ctx, ["zdravje"], "Zdravstvene izjave zaposlenih", "Zaposleni pred delom izjavi, da nima simptomov bolezni. Simptomi se obravnavajo kot odstopanje; odločitev o delu sprejme odgovorna oseba."), kemikalije: () => listView(body, "kemikalije", ctx) }[sub])();
}

async function hDanes(el, ctx) {
  const [nacrt, evid] = await Promise.all([D.list("ciscenje_nacrt", { stranka_id: ctx.stranka_id }), D.list("evidence", { stranka_id: ctx.stranka_id })]);
  const st = ciscenjeStanje(nacrt, evid).sort((a, b) => a.next.localeCompare(b.next));
  const brez = nacrt.filter(n => n.aktivno !== false && !(+n.pogostost_dni > 0)).length;
  const due = st.filter(x => x.danes);
  el.innerHTML = `<p class="note info">Seznam opravil čiščenja iz načrta, ki so danes na vrsti ali v zamudi. Z »Opravljeno« se ustvari zapis v evidencah (čas in uporabnik samodejno).${brez ? ` Opravil brez pogostosti (po potrebi): ${brez}.` : ""}</p>
  ${nacrt.length ? "" : '<p class="empty">Načrt čiščenja je prazen. Dodajte opravila v zavihku »Načrt čiščenja«.</p>'}
  <div class="tw"><table class="t"><tr><th>Področje</th><th>Opravilo</th><th>Sredstvo</th><th>Zadnjič</th><th>Rok</th><th></th></tr>${st.map(x => `<tr><td>${esc(x.n.podrocje || "")}</td><td>${esc(x.n.opravilo)}</td><td>${esc(x.n.sredstvo || "")}</td><td>${x.last ? fdate(x.last) : '<span class="mut">še ni</span>'}</td><td>${x.danes ? `<span class="badge ${x.zamuda ? "bad" : "warn"}">${x.zamuda ? "zamuda " + -daysTo(x.next) + " d" : "danes"}</span>` : dueBadge(x.next)}</td><td>${x.danes ? `<button class="btn sm" data-done="${x.n.id}">Opravljeno</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">Ni opravil s pogostostjo.</td></tr>'}</table></div>
  <p class="mut" style="margin-top:8px">Za danes/zamudo: ${due.length} opravil.</p>`;
  $$("[data-done]", el).forEach(b => b.onclick = () => {
    const n = nacrt.find(x => x.id === b.dataset.done);
    modal("Opravljeno: " + n.opravilo, `<p class="mut">${esc(n.podrocje || "")}${n.sredstvo ? " · " + esc(n.sredstvo) : ""}</p><label class="f"><span><input type="checkbox" id="dn_k" checked> Vizualna kontrola: čisto</span></label><label class="f"><span>Opomba</span><input id="dn_o"></label>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Potrdi", fn: async () => {
      const ok = $("#dn_k").checked;
      await D.add("evidence", { stranka_id: ctx.stranka_id, obrat_id: n.obrat_id || null, vrsta: "ciscenje", nacrt_id: n.id, obmocje: [n.podrocje, n.opravilo].filter(Boolean).join(": "), sredstvo: n.sredstvo || "", izvedeno: true, kontrola_ok: ok, skladno: ok, opomba: $("#dn_o").value, cas: new Date().toISOString(), status: "vneseno" });
      toast(ok ? "Zapisano" : "Zapisano – kontrola ni bila v redu, ustvarite neskladnost", !ok); hDanes(el, ctx);
    } }]);
  });
}

// mini seznam evidenc določenih vrst + gumbi za nov zapis
async function hMini(el, ctx, vrste, naslov, opis, extra) {
  const rows = (await D.list("evidence", { stranka_id: ctx.stranka_id })).filter(r => vrste.includes(r.vrsta)).sort((a, b) => (b.cas || "").localeCompare(a.cas || ""));
  const reload = () => hMini(el, ctx, vrste, naslov, opis, extra);
  el.innerHTML = `<h2>${naslov}</h2>${opis ? `<p class="note info">${esc(opis)}</p>` : ""}<div class="row">${vrste.map(v => `<button class="btn" data-n="${v}">+ ${esc(EV[v].ime)}</button>`).join("")}<span class="sp"></span><button class="btn ghost sec" id="hx">Excel</button></div>
  <div class="tw"><table class="t"><thead><tr><th>Čas</th><th>Vrsta</th><th>Podatek</th><th>Ocena</th><th>Vnesel</th><th>Stanje</th></tr></thead><tbody>${rows.map(r => `<tr class="click" data-id="${r.id}"><td>${fdt(r.cas)}</td><td>${esc(EV[r.vrsta].ime)}</td><td>${evSummary(r)}</td><td>${skladnoBadge(r)}</td><td>${esc(r.ustvaril_ime || "")}</td><td>${badge(r.status)}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">Ni zapisov.</td></tr>'}</tbody></table></div>`;
  $$("[data-n]", el).forEach(b => b.onclick = () => evForm(null, ctx, reload, b.dataset.n));
  $("tbody", el).onclick = e => { const tr = e.target.closest("tr[data-id]"); if (tr) evForm(rows.find(r => r.id === tr.dataset.id), ctx, reload); };
  $("#hx").onclick = () => downloadXlsx("evidence-" + naslov + "-" + ctx.stranka.naziv + ".xlsx", [{ ime: naslov.slice(0, 30), glava: ["Čas", "Vrsta", "Podatek", "Ocena", "Vnesel", "Stanje", "Opomba"], vrste: rows.map(r => [fdt(r.cas), EV[r.vrsta].ime, evSummary(r).replace(/&[a-z#0-9]+;/g, ""), r.skladno === true ? "skladno" : r.skladno === false ? "odstopanje" : "brez ocene", r.ustvaril_ime || "", r.status, r.opomba || ""]) }]);
  if (extra) extra(el, rows);
}

// graf gibanja številčnih rezultatov (npr. ATP) s črto praga
function lineChart(pts, prag) {
  if (!pts.length) return '<p class="mut">Ni številčnih rezultatov za graf.</p>';
  const W = 640, H = 200, P = 34, xs = pts.map((p, i) => i), vals = pts.map(p => p.v), mx = Math.max(...vals, prag || 0) * 1.1 || 1, mn = Math.min(0, ...vals);
  const X = i => P + (pts.length === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (pts.length - 1)), Y = v => H - P - (v - mn) / (mx - mn) * (H - 2 * P);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;background:var(--card);border:1px solid var(--line);border-radius:8px" role="img" aria-label="Gibanje rezultatov"><line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="var(--line)"/><line x1="${P}" y1="${P / 2}" x2="${P}" y2="${H - P}" stroke="var(--line)"/>${prag ? `<line x1="${P}" y1="${Y(prag)}" x2="${W - P}" y2="${Y(prag)}" stroke="var(--bad)" stroke-dasharray="5 4"/><text x="${W - P}" y="${Y(prag) - 4}" text-anchor="end" font-size="11" fill="var(--bad)">prag ${prag}</text>` : ""}<path d="${line}" fill="none" stroke="var(--acc)" stroke-width="2"/>${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4" fill="${prag && p.v > prag ? "var(--bad)" : "var(--acc)"}"><title>${esc(fdt(p.t))}: ${p.v}</title></circle>`).join("")}<text x="${P}" y="${H - 10}" font-size="11" fill="var(--mut)">${esc(fdate(pts[0].t))}</text><text x="${W - P}" y="${H - 10}" font-size="11" text-anchor="end" fill="var(--mut)">${esc(fdate(pts[pts.length - 1].t))}</text><text x="${P - 4}" y="${P / 2 + 8}" font-size="11" text-anchor="end" fill="var(--mut)">${Math.round(mx)}</text></svg>`;
}

function hTesti(el, ctx) {
  return hMini(el, ctx, ["hitri_test", "bris"], "Mikrobiološki brisi in hitri testi", "Rezultate vnašate iz laboratorijskih poročil ali s hitrih testov. Mejnih vrednosti program ne predpisuje: vnesete jih sami po HACCP načrtu, navodilu naprave ali poročilu laboratorija. Če meje niso vnesene, ocena ni mogoča. Odstopanje: ponovno čiščenje, ponovni test in po potrebi neskladnost (CAPA).", (box, rows) => {
    const num2 = rows.filter(r => r.vrsta === "hitri_test" && r.vrednost !== undefined && r.vrednost !== "" && r.tip_testa === "ATP (bioluminiscenca)");
    const places = [...new Set(num2.map(r => r.mesto))];
    const neskl = rows.filter(r => r.skladno === false).length, cnt = rows.length;
    const info = document.createElement("div");
    info.innerHTML = `<div class="kpis" style="margin-top:14px"><div class="kpi"><b>${cnt}</b><span>zapisov</span></div><div class="kpi ${neskl ? "warn" : ""}"><b>${neskl}</b><span>odstopanj${cnt ? " (" + Math.round(neskl / cnt * 100) + " %)" : ""}</span></div><div class="kpi"><b>${rows.filter(r => r.vrsta === "bris").length}</b><span>mikrobioloških brisov</span></div></div>
    <h3>Gibanje ATP rezultatov</h3>${places.length ? `<div class="row"><select id="gm" style="max-width:300px">${places.map(p => `<option>${esc(p)}</option>`).join("")}</select></div><div id="gg"></div>` : '<p class="mut">Za graf vnesite hitre teste vrste ATP s številčnim rezultatom.</p>'}`;
    box.appendChild(info);
    if (places.length) { const draw = () => { const sel = num2.filter(r => r.mesto === $("#gm", box).value).sort((a, b) => (a.cas || "").localeCompare(b.cas || "")); const pr = [...sel].reverse().map(r => num(r.max)).find(x => x !== null); $("#gg", box).innerHTML = lineChart(sel.map(r => ({ t: r.cas, v: Number(r.vrednost) })), pr === undefined ? null : pr); }; $("#gm", box).onchange = draw; draw(); }
  });
}

async function hDDD(el, ctx) {
  el.innerHTML = '<h2>Vabe in pasti (register)</h2><div id="h_v"></div><div id="h_e" style="margin-top:24px"></div>';
  await listView($("#h_v", el), "vabe", ctx);
  await hMini($("#h_e", el), ctx, ["ddd_obisk", "skodljivci"], "Obiski izvajalca DDD in opažanja škodljivcev", "Poročilo izvajalca priložite kot fotografijo ali v zavihku »Priloge«. Opažanje škodljivcev z navedenim številom se šteje za odstopanje.");
}

