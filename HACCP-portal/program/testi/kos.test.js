// Koš: mehko brisanje, obnova (tudi cele stranke s podrejenimi zapisi), pravice in ločenost strank.
const B = process.env.BASE; let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
function client() { let ck = ""; return async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { "Content-Type": "application/json", Cookie: ck, Origin: B }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get("set-cookie"); if (sc) ck = sc.split(";")[0]; let j; try { j = await r.json(); } catch { j = null; } return { s: r.status, j }; }; }
(async () => {
  const A = client(), O1 = client(), O2 = client();
  await A("POST", "/api/auth/nastavi", { email: "a@t.si", geslo: "dolgogeslo123", ime: "A" });
  const s1 = (await A("POST", "/api/d/stranke", { naziv: "S1" })).j, s2 = (await A("POST", "/api/d/stranke", { naziv: "S2" })).j;
  for (const [e, s] of [["o1@t.si", s1.id], ["o2@t.si", s2.id]]) await A("POST", "/api/uporabniki", { email: e, geslo: "dolgogeslo123", vloga: "odgovorna", stranka_id: s, ime: e });
  await O1("POST", "/api/auth/prijava", { email: "o1@t.si", geslo: "dolgogeslo123" }); await O2("POST", "/api/auth/prijava", { email: "o2@t.si", geslo: "dolgogeslo123" });
  const ob = (await O1("POST", "/api/d/osebje", { ime: "Obrat X" })).j;
  let r = await O1("DELETE", "/api/d/osebje/" + ob.id); ok(r.s === 200, "brisanje zaposlenega");
  ok((await O1("GET", "/api/d/osebje")).j.length === 0, "zapis ni več na seznamu");
  let kos = (await O1("GET", "/api/kos")).j; ok(kos.length === 1 && kos[0].ime === "Obrat X" && kos[0].preostalo_dni >= 29, "zapis je v košu (30 dni)");
  ok((await O2("GET", "/api/kos")).j.length === 0, "druga stranka koša ne vidi");
  ok((await O2("POST", "/api/kos/" + kos[0].id + "/obnovi")).s === 404, "druga stranka ne more obnoviti");
  ok((await O1("DELETE", "/api/kos/" + kos[0].id)).s === 403, "odgovorna oseba ne briše trajno");
  ok((await O1("POST", "/api/kos/" + kos[0].id + "/obnovi")).s === 200 && (await O1("GET", "/api/d/osebje")).j.length === 1, "obnova zapisa");
  // brisanje stranke s podrejenimi zapisi
  await A("POST", "/api/d/obrati", { naziv: "Obrat Y", stranka_id: s2.id }); await A("POST", "/api/d/oprema", { naziv: "Hladilnik", stranka_id: s2.id });
  ok((await A("DELETE", "/api/d/stranke/" + s2.id)).s === 200 && (await A("GET", "/api/d/stranke")).j.length === 1, "izbris stranke");
  kos = (await A("GET", "/api/kos")).j; const ks = kos.find(x => x.zbirka === "stranke"); ok(ks && ks.otrok === 2, "stranka v košu z 2 podrejenima zapisoma");
  ok((await A("POST", "/api/d/obrati", { naziv: "Sirota", stranka_id: s2.id })).s === 400, "zapisa ni mogoče dodati izbrisani stranki");
  const rr = await A("POST", "/api/kos/" + ks.id + "/obnovi"); ok(rr.s === 200, "obnova stranke");
  console.log("DBG", JSON.stringify((await A("GET", "/api/d/obrati?stranka_id=" + s2.id)).j.map(x=>x.naziv)), JSON.stringify((await A("GET", "/api/d/oprema?stranka_id=" + s2.id)).j.map(x=>x.naziv)));
  ok((await A("GET", "/api/d/obrati?stranka_id=" + s2.id)).j.length === 1 && (await A("GET", "/api/d/oprema?stranka_id=" + s2.id)).j.length === 1, "obnovljeni obrati in oprema stranke");
  ok((await O2("GET", "/api/d/stranke")).j.length === 1, "odgovorna oseba spet vidi svojo stranko");
  // trajni izbris (admin)
  const o3 = (await A("POST", "/api/d/vabe", { oznaka: "V9", stranka_id: s1.id })).j; await A("DELETE", "/api/d/vabe/" + o3.id);
  const k3 = (await A("GET", "/api/kos")).j.find(x => x.zbirka === "vabe"); ok((await A("DELETE", "/api/kos/" + k3.id)).s === 200 && !(await A("GET", "/api/kos")).j.some(x => x.zbirka === "vabe"), "administrator trajno izbriše");
  ok((await A("GET", "/api/revizijska-sled?n=50")).j.vnosi.some(e => e.akcija === "obnovi"), "obnova v revizijski sledi");
  ok((await A("GET", "/api/revizijska-sled?n=5")).j.preveritev.ok, "veriga zgoščenk veljavna");
  console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})();
