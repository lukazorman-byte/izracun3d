// Nastavitve vidnosti (administrator) in predogled kot Stranka / Odgovorna oseba.
// "Stranka" = zaposleni stranke. Administrator in svetovalec vidita vse. Dostop preverja tudi strežnik.
function applyPreview() {
  const pv = effPrev();
  if (!pv || !ME.u || ME.u.vloga !== "admin") { try { sessionStorage.removeItem("haccp_prev"); } catch {} return; }
  ME.real = ME.u;
  ME.u = Object.assign({}, ME.u, { vloga: pv.kot === "stranka" ? "zaposleni" : "odgovorna", stranka_id: pv.sid || null });
}
function drawPreviewBar() {
  const old = $("#prevbar"); if (old) old.remove();
  if (!ME.real) return;
  const pv = effPrev() || {};
  $("#main").insertAdjacentHTML("afterbegin", `<div id="prevbar" class="note" role="status" style="margin:0;border-radius:0;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b>Predogled kot ${pv.kot === "stranka" ? "Stranka (zaposleni)" : "Odgovorna oseba stranke"}</b><span>Prikazana je samo vidnost menija in razdelkov; podatki so še vedno administratorjevi.</span><button class="btn sm" id="prevexit">Izhod iz predogleda</button></div>`);
  $("#prevexit").onclick = () => { try { sessionStorage.removeItem("haccp_prev"); } catch {} location.hash = "#/vidnost"; location.reload(); };
}
async function pageVidnost(v) {
  const [cfg, st] = await Promise.all([api("GET", "/api/vidnost"), D.list("stranke")]);
  let sid = sessionStorage.getItem("vid_sid") || ""; if (sid && !st.some(s => s.id === sid)) sid = "";
  const VL = [["stranka", "Stranka (zaposleni)"], ["odgovorna", "Odgovorna oseba"]];
  const eff = (m, k) => { const o = sid && cfg.stranke[sid] && cfg.stranke[sid][m] && cfg.stranke[sid][m][k]; if (typeof o === "boolean") return { v: o, own: true }; const d = cfg.privzeto[m] && cfg.privzeto[m][k]; return { v: typeof d === "boolean" ? d : !((cfg.sistemsko || {})[m] || []).includes(k), own: false }; };
  const groups = [...new Set(cfg.moduli.map(m => m.skupina))];
  const draw = () => {
    const hasOwn = sid && cfg.stranke[sid] && Object.keys(cfg.stranke[sid]).length;
    v.innerHTML = `<p class="note info">Določite, kaj vidita <b>Stranka</b> (zaposleni stranke) in <b>Odgovorna oseba stranke</b>. Administrator in svetovalec vidita vse. Skriti razdelki so odstranjeni iz menija, neposreden dostop prek naslova pa preusmeri na nadzorno ploščo; dostop preverja tudi strežnik. Nastavitve za posamezno stranko prepišejo privzete. Za zaposlene so privzeto skriti Certifikacija, Potrditve, Inšpekcija in Generator (preprostejši meni); z vklopom stikala jih prikažete.</p>
    <div class="row"><label class="f" style="margin:0;min-width:280px"><span>Veljavnost nastavitev</span><select id="vs"><option value="">Privzeto za vse stranke</option>${st.map(s => `<option value="${s.id}" ${s.id === sid ? "selected" : ""}>${esc(s.naziv)}${cfg.stranke[s.id] && Object.keys(cfg.stranke[s.id]).length ? " (prepisano)" : ""}</option>`).join("")}</select></label>
      ${sid ? `<button class="btn ghost sec" id="vr" ${hasOwn ? "" : "disabled"}>Ponastavi na privzeto</button>` : ""}<span class="sp"></span><button class="btn ghost" id="vp1">Predogled kot Stranka</button><button class="btn ghost" id="vp2">Predogled kot Odgovorna oseba</button></div>
    <div class="tw"><table class="t"><thead><tr><th>Razdelek</th>${VL.map(x => `<th style="text-align:center">${x[1]}</th>`).join("")}</tr></thead><tbody>${groups.map(g => `<tr><th colspan="3" style="text-align:left;background:var(--acc2)">${esc(g)}</th></tr>` + cfg.moduli.filter(m => m.skupina === g).map(m => `<tr><td>${esc(m.label)}</td>${VL.map(x => { const e = eff(m.id, x[0]); return `<td style="text-align:center"><input type="checkbox" role="switch" data-m="${esc(m.id)}" data-k="${x[0]}" aria-label="${esc(m.label + ": " + x[1])}" ${e.v ? "checked" : ""}>${e.own ? ' <small class="mut">prepisano</small>' : ""}</td>`; }).join("")}</tr>`).join("")).join("")}</tbody></table></div>`;
    $("#vs").onchange = e => { sid = e.target.value; sessionStorage.setItem("vid_sid", sid); draw(); };
    $$("input[data-m]", v).forEach(c => c.onchange = async () => {
      try { await api("PUT", "/api/vidnost", { stranka_id: sid || null, modul: c.dataset.m, vloga: c.dataset.k, vidno: c.checked }); const tgt = sid ? (cfg.stranke[sid] = cfg.stranke[sid] || {}) : cfg.privzeto; tgt[c.dataset.m] = Object.assign({}, tgt[c.dataset.m], { [c.dataset.k]: c.checked }); draw(); toast("Shranjeno"); } catch (e) { c.checked = !c.checked; fail(e); }
    });
    if ($("#vr")) $("#vr").onclick = () => confirmBox("Odstranim vse nastavitve te stranke in uporabim privzete?", async () => { await api("PUT", "/api/vidnost", { stranka_id: sid, ponastavi: true }); delete cfg.stranke[sid]; draw(); toast("Ponastavljeno"); });
    const prev = kot => { try { sessionStorage.setItem("haccp_prev", JSON.stringify({ kot, sid })); } catch {} location.hash = "#/nadzorna"; location.reload(); };
    $("#vp1").onclick = () => prev("stranka"); $("#vp2").onclick = () => prev("odgovorna");
  };
  draw();
}
route(/^\/vidnost$/, pageVidnost, "Nastavitve vidnosti", "vidnost");
navItem("vidnost", "Nastavitve vidnosti", "#/vidnost", ["admin"]);
{ const a = NAVITEMS.findIndex(n => n.id === "admin"); if (a >= 0) NAVITEMS.splice(a + 1, 0, NAVITEMS.pop()); }
