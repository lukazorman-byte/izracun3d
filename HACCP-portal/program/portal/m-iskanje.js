// Globalno iskanje po vseh podatkih (brez upoštevanja šumnikov) in po zbirki zakonodaje.
const ISK = [
  ["stranke", "Stranka", r => r.naziv, r => [r.dejavnost, r.odgovorna_oseba, r.naslov].filter(Boolean).join(" · "), r => `#/stranka/${r.id}/podatki`],
  ["obrati", "Obrat", r => r.naziv, r => r.naslov || r.vrsta || "", r => `#/stranka/${r.stranka_id}/obrati`],
  ["osebje", "Zaposleni", r => r.ime, r => r.funkcija || "", r => `#/stranka/${r.stranka_id}/osebje`],
  ["usposabljanja", "Usposabljanje", r => r.tema, r => (r.datum ? fdate(r.datum) : "") + (r.izvajalec ? " · " + r.izvajalec : ""), r => `#/stranka/${r.stranka_id}/osebje`],
  ["dobavitelji", "Dobavitelj", r => r.naziv, r => r.kategorija || "", r => `#/stranka/${r.stranka_id}/dobavitelji`],
  ["oprema", "Oprema", r => r.naziv, r => [r.tip, r.lokacija].filter(Boolean).join(" · "), r => `#/stranka/${r.stranka_id}/oprema`],
  ["nacrti", "HACCP načrt", r => r.naziv, r => r.status || "", r => `#/carovnik/${r.id}`],
  ["navodila", "Navodilo", r => r.naslov, r => [r.vrsta, r.status].filter(Boolean).join(" · "), r => `#/stranka/${r.stranka_id}/navodila`],
  ["evidence", "Zapis", r => ((EV[r.vrsta] || {}).ime || r.vrsta) + " – " + String(evSummary(r)).replace(/&[a-z#0-9]+;/g, ""), r => fdt(r.cas) + (r.opomba ? " · " + r.opomba : ""), r => `#/stranka/${r.stranka_id}/evidence`],
  ["capa", "Neskladnost", r => (r.opis || "").slice(0, 90), r => r.status || "", r => `#/stranka/${r.stranka_id}/capa`],
  ["dogodki", "Dogodek", r => r.naslov, r => fdate(r.datum), r => `#/stranka/${r.stranka_id}/koledar`],
  ["storitve", "Storitev", r => (r.vrsta || "Storitev") + " " + fdate(r.datum), r => r.opis || "", r => `#/stranka/${r.stranka_id}/storitve`],
  ["ciscenje_nacrt", "Čiščenje", r => r.opravilo, r => r.podrocje || "", r => `#/stranka/${r.stranka_id}/higiena`],
  ["kemikalije", "Čistilo", r => r.naziv, r => r.namen || "", r => `#/stranka/${r.stranka_id}/higiena`],
  ["vabe", "Vaba (DDD)", r => r.oznaka + " " + (r.vrsta || ""), r => r.lokacija || "", r => `#/stranka/${r.stranka_id}/higiena`],
  ["sarze", "Šarža", r => r.izdelek + (r.sarza ? " (" + r.sarza + ")" : ""), r => [r.dobavitelj, r.status].filter(Boolean).join(" · "), r => `#/stranka/${r.stranka_id}/sledljivost`],
  ["jedi", "Jed", r => r.naziv, r => [].concat(r.alergeni || []).join(", "), r => `#/stranka/${r.stranka_id}/alergeni`],
  ["tlorisi", "Tloris", r => r.naziv, r => (r.elementi || []).length + " elementov", r => `#/tloris/${r.id}`]
];
const iskText = r => Object.entries(r).filter(([k, v]) => !["vsebina", "elementi", "revizije", "slike", "id", "stranka_id", "obrat_id", "ustvaril", "spremenil", "nacrt_id", "predloga"].includes(k) && (typeof v !== "object" || (Array.isArray(v) && v.every(x => typeof x === "string")))).map(([k, v]) => Array.isArray(v) ? v.join(" ") : v).join(" ");
let ISKC = { t: 0, d: null };
async function iskData() {
  if (ISKC.d && Date.now() - ISKC.t < 20000) return ISKC.d;
  const d = {}; await Promise.all(ISK.map(async ([c]) => { try { d[c] = await D.list(c); } catch { d[c] = []; } })); d.zak = []; try { d.zak = (await baza()).zakonodaja || []; } catch {}
  ISKC = { t: Date.now(), d }; return d;
}
async function pageIskanje(v, m) {
  const q = decodeURIComponent(m[1] || "").trim(), terms = norm(q) ? q.toLowerCase().split(/\s+/).map(norm).filter(Boolean) : [];
  const gs = $("#gs"); if (gs && document.activeElement !== gs) gs.value = q;
  if (!terms.length) { v.innerHTML = '<p class="empty">Vnesite iskalni niz v polje zgoraj (npr. hladilnik, Novak, 852/2004).</p>'; return; }
  const d = await iskData(), sm = mapOf(d.stranke || []), match = txt => { const n = norm(txt); return terms.every(t => n.includes(t)); };
  const groups = [];
  for (const [c, lab, title, snip, href] of ISK) { const hits = (d[c] || []).filter(r => match(iskText(r))); if (hits.length) groups.push({ lab, hits: hits.map(r => ({ t: title(r), s: snip(r), h: href(r), st: c === "stranke" ? "" : sm[r.stranka_id] || "" })) }); }
  const zk = (d.zak || []).filter(z => z.status !== "razveljavljen" && match((z.predpis || "") + " " + (z.vsebina || "") + " " + (z.skupina || "")));
  if (zk.length) groups.push({ lab: "Zakonodaja (baza znanja)", hits: zk.map(z => ({ t: z.predpis, s: (z.vsebina || "").slice(0, 140) + (z.preverjeno ? " · preverjeno " + fdate(z.preverjeno) : ""), h: "", st: "" })) });
  const total = groups.reduce((a, g) => a + g.hits.length, 0);
  v.innerHTML = `<p class="mut">Zadetkov: <b>${total}</b> za »${esc(q)}«.</p>${groups.map(g => `<div class="card"><h3>${esc(g.lab)} <span class="badge">${g.hits.length}</span></h3><div class="tw"><table class="t">${g.hits.slice(0, 12).map(x => `<tr${x.h ? ` class="click" tabindex="0" onclick="location.hash='${x.h.slice(1)}'"` : ""}><td>${esc(x.t)}</td><td class="mut">${esc(x.s)}</td>${isStaff() ? `<td class="mut">${esc(x.st)}</td>` : ""}</tr>`).join("")}</table></div>${g.hits.length > 12 ? `<p class="mut">… in še ${g.hits.length - 12}. Zožite iskanje.</p>` : ""}</div>`).join("") || '<p class="empty">Ni zadetkov.</p>'}`;
}
navItem("-", "Iskanje");
route(/^\/iskanje(?:\/(.*))?$/, pageIskanje, "Iskanje", "");
(function wireSearch() {
  const el = document.getElementById("gs"); if (!el) return;
  el.addEventListener("keydown", e => { if (e.key === "Enter" && el.value.trim()) { ISKC.t = 0; location.hash = "#/iskanje/" + encodeURIComponent(el.value.trim()); } });
  document.addEventListener("keydown", e => { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "") && ME.u) { e.preventDefault(); el.focus(); } });
})();
