(async () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // nova različica programa: stran se enkrat osveži sama (če ni odprto okno z obrazcem), da se ne prikazuje stara
    const imel = !!navigator.serviceWorker.controller; let osvezeno = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!imel || osvezeno) return; osvezeno = true; const d = document.getElementById("dlg"); if (d && d.open) { if (typeof toast === "function") toast("Na voljo je nova različica programa. Osvežite stran (F5)."); } else location.reload(); });
  }
  try {
    ME.u = await api("GET", "/api/auth/jaz");
    try { Object.assign(STATE, await fetch("/api/auth/stanje").then(r => r.json())); } catch {}
    applyPreview(); await loadTisk(); await loadVidnost(); start(); syncOffQueue();
    if (/[?&]nedostop=1/.test(location.search)) { history.replaceState(null, "", "/"); toast("Nimate dostopa.", true); }
  } catch (e) {
    if (e.offline) { // brez povezave: uporabi shranjenega uporabnika (podatki iz predpomnilnika)
      let u = null; try { u = JSON.parse(localStorage.getItem("haccp_me") || "null"); } catch {}
      if (u) { ME.u = u; await loadTisk(); await loadVidnost(); start(); return; }
    }
    try { const s = await fetch("/api/auth/stanje").then(r => r.json()); Object.assign(STATE, s); showLogin(!s.nastavljeno); } catch (e2) { document.body.innerHTML = "<p style='padding:20px'>Strežnik ni dosegljiv.</p>"; }
  }
})();
