// Testno okolje: napis TESTNA RAZLIČICA, testni računi na prijavi, prijava napake/predloga, ponastavitev testnih podatkov.
const ERRLOG = [];
window.addEventListener("error", e => { ERRLOG.push(new Date().toISOString().slice(11, 19) + " " + (e.message || "napaka")); if (ERRLOG.length > 10) ERRLOG.shift(); });
window.addEventListener("unhandledrejection", e => { ERRLOG.push(new Date().toISOString().slice(11, 19) + " " + String((e.reason && e.reason.message) || e.reason)); if (ERRLOG.length > 10) ERRLOG.shift(); });

function testLoginHint() {
  if (!STATE.testno) return;
  const card = $("#login .card"); if (!card) return;
  card.insertAdjacentHTML("beforeend", `<div id="testhint" class="note info" style="margin-top:14px"><b>TESTNA RAZLIČICA ${esc(STATE.verzija || "")}</b>: podatki niso resnični.<br>Testni računi (geslo za vse: <code>${esc(STATE.geslo)}</code>). Kliknite račun za vnos:<div style="display:grid;gap:6px;margin-top:8px">${(STATE.racuni || []).map(r => `<button type="button" class="btn sm ghost sec" data-t="${esc(r.email)}" style="text-align:left">${esc(r.email)}<br><small>${esc(r.opis)}</small></button>`).join("")}</div></div>`);
  $$("[data-t]", card).forEach(b => b.onclick = () => { $("#le").value = b.dataset.t; $("#lp").value = STATE.geslo; });
}
function drawTestBar() {
  const old = $("#testbar"); if (old) old.remove();
  if (!STATE.testno) { // običajni program: samo majhen gumb za prijavo napake v stranskem meniju
    if (!$("#nbug") && $(".who")) { $(".who").insertAdjacentHTML("beforebegin", '<div style="padding:0 16px 10px"><button class="btn sm ghost" id="nbug" style="width:100%">Prijavi napako</button></div>'); $("#nbug").onclick = prijavaNapake; }
    return;
  }
  $("#main").insertAdjacentHTML("afterbegin", `<div id="testbar" class="note" role="status" style="margin:0;border-radius:0;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#fde8c8"><b>TESTNA RAZLIČICA ${esc(STATE.verzija || "")}</b><span>Podatki niso resnični. Ne vnašajte pravih osebnih ali poslovnih podatkov.</span><span class="sp"></span><button class="btn sm" id="tbug">Prijavi napako ali predlog</button>${ME.u && ME.u.vloga === "admin" && !ME.real ? '<button class="btn sm ghost sec" id="treset">Ponastavi testne podatke</button>' : ""}</div>`);
  $("#tbug").onclick = prijavaNapake;
  if ($("#treset")) $("#treset").onclick = () => confirmBox("Vsi testni podatki se zbrišejo in zamenjajo z začetnimi. Nadaljujem?", async () => { await api("POST", "/api/testno/ponastavi"); toast("Testni podatki ponastavljeni"); setTimeout(() => { location.hash = ""; location.reload(); }, 700); }, true);
}
function prijavaNapake() {
  modal("Prijava napake ali predloga", `<p class="mut">Opišite, kaj ste počeli. Datoteko pošljite lastniku programa (po e-pošti). Če je mogoče, priložite posnetek zaslona (tipke Windows + Shift + S).</p><div class="fgrid"><label class="f wide"><span>Vrsta</span><select id="pb_v"><option>Napaka</option><option>Predlog</option><option>Vprašanje / nejasnost</option></select></label><label class="f wide"><span>Kaj ste delali (koraki)</span><textarea id="pb_k"></textarea></label><label class="f wide"><span>Kaj se je zgodilo</span><textarea id="pb_z"></textarea></label><label class="f wide"><span>Kaj ste pričakovali</span><textarea id="pb_p"></textarea></label><label class="f"><span>Resnost</span><select id="pb_r"><option>ne vem</option><option>nizka (kozmetika)</option><option>srednja (ovira delo)</option><option>visoka (ne morem nadaljevati / izguba podatkov)</option></select></label><label class="f"><span>Vaše ime</span><input id="pb_i"></label></div>`, [{ t: "Prekliči", cls: "ghost sec" }, { t: "Kopiraj besedilo", cls: "ghost", fn: async () => { try { await navigator.clipboard.writeText(pbText()); toast("Kopirano"); } catch { toast("Kopiranje ni uspelo, uporabite prenos datoteke.", true); } return false; } }, { t: "Prenesi datoteko", fn: () => { const b = new Blob(["\ufeff" + pbText()], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "povratna-informacija-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); } }]);
}
function pbText() {
  const g = id => ($("#" + id) || {}).value || "";
  return ["PRIJAVA: " + g("pb_v"), "Resnost: " + g("pb_r"), "Tester: " + g("pb_i"), "", "KORAKI:", g("pb_k"), "", "KAJ SE JE ZGODILO:", g("pb_z"), "", "PRIČAKOVANO:", g("pb_p"), "", "--- TEHNIČNI PODATKI ---",
    "Različica: " + (STATE.verzija || "?") + (STATE.testno ? " (testna)" : " (originalni program)"), "Čas: " + new Date().toLocaleString("sl-SI"), "Račun: " + (ME.u ? ME.u.email + " (" + ME.u.vloga + ")" : "ni prijave"), "Stran: " + location.hash, "Brskalnik: " + navigator.userAgent, "Zaslon: " + innerWidth + "x" + innerHeight, "Napake v konzoli: " + (ERRLOG.length ? "\n  " + ERRLOG.join("\n  ") : "ni")].join("\n");
}
