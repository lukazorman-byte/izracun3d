// Specifikacije zbirk: polja obrazcev in stolpci tabel.
const DEJAVNOSTI = ["Gostinstvo (restavracija, gostilna)", "Catering / priprava obrokov", "Pekarna / slaščičarna", "Mesnica / predelava mesa", "Mlekarna / sirarna", "Trgovina z živili", "Proizvodnja živil", "Vrtec / šola / zavod", "Turistična kmetija / dopolnilna dejavnost", "Pakiranje / skladišče", "Drugo"];
const STATUS_SISTEMA = ["v pripravi", "v potrjevanju", "aktivna", "neaktivna"];
const STATUS_DOK = ["osnutek", "v pregledu", "potrjeno", "zastarelo"];
const T = (k, l, o) => Object.assign({ k, l, t: "text" }, o);
const strankaName = (m, id) => (m || {})[id] || "";

const SPEC = {
  stranke: {
    ime: "stranka", sort: (a, b) => (a.naziv || "").localeCompare(b.naziv || "", "sl"), add: () => isStaff(),
    fields: () => [
      T("naziv", "Naziv podjetja", { req: 1, wide: 1 }), T("maticna", "Matična številka"), T("davcna", "Davčna številka"),
      T("naslov", "Naslov sedeža", { wide: 1 }), T("odgovorna_oseba", "Odgovorna oseba"), T("email", "E-naslov", { t: "email" }), T("telefon", "Telefon"),
      { k: "dejavnost", l: "Vrsta dejavnosti", t: "sel", o: DEJAVNOSTI }, { k: "status", l: "Stanje HACCP sistema", t: "sel", o: STATUS_SISTEMA, def: "v pripravi" },
      T("opis_dejavnosti", "Opis dejavnosti", { t: "area", h: "Kaj se v podjetju dela, za koga, v kakšnem obsegu." }),
      T("paket", "Paket storitev (HiGiFood)"), T("naslednji_pregled", "Naslednji načrtovani pregled", { t: "date" }),
      T("notranje", "Interne opombe HiGiFood", { t: "area", h: "Vidno samo osebju HiGiFood." })
    ].filter(f => isStaff() || !["paket", "notranje"].includes(f.k)),
    cols: () => [{ l: "Naziv", f: r => `<a href="#/stranka/${r.id}/podatki"><b>${esc(r.naziv)}</b></a>` }, { l: "Dejavnost", k: "dejavnost" }, { l: "Odgovorna oseba", k: "odgovorna_oseba" }, { l: "Stanje", f: r => badge(r.status) }, { l: "Naslednji pregled", f: r => dueBadge(r.naslednji_pregled) }]
  },
  obrati: {
    ime: "obrat / lokacija", sort: (a, b) => (a.naziv || "").localeCompare(b.naziv || "", "sl"),
    fields: () => [
      T("naziv", "Naziv obrata", { req: 1 }), T("naslov", "Naslov"), T("vrsta", "Vrsta obrata (kuhinja, proizvodnja, trgovina …)"), T("povrsina", "Površina (m²)", { t: "num" }),
      T("opis_prostorov", "Opis prostorov", { t: "area", h: "Prostori, razporeditev, čiste/nečiste poti, garderobe, sanitarije." }),
      T("oprema_opis", "Oprema in naprave", { t: "area" }),
      T("shranjevanje", "Shranjevanje živil", { t: "area", h: "Hladilniki, zamrzovalniki, suho skladišče, režimi." }),
      T("priprava", "Priprava in obdelava", { t: "area" }), T("toplotna", "Toplotna obdelava, hlajenje, ohranjanje toplote", { t: "area" }), T("pakiranje", "Pakiranje, označevanje", { t: "area" }), T("prodaja", "Prodaja / izdaja / dostava", { t: "area" }),
      T("ciscenje", "Čiščenje in razkuževanje", { t: "area" }), T("ddd", "DDD (deratizacija, dezinsekcija, dezinfekcija)", { t: "area" }), T("odpadki", "Ravnanje z odpadki", { t: "area" }), T("voda", "Oskrba z vodo", { t: "area" }),
      { k: "status", l: "Stanje", t: "sel", o: ["aktiven", "neaktiven"], def: "aktiven" }
    ],
    cols: () => [{ l: "Obrat", k: "naziv" }, { l: "Naslov", k: "naslov" }, { l: "Vrsta", k: "vrsta" }, { l: "Površina", f: r => r.povrsina ? r.povrsina + " m²" : "" }, { l: "Stanje", f: r => badge(r.status) }]
  },
  osebje: {
    ime: "zaposleni", fields: () => [T("ime", "Ime in priimek", { req: 1 }), T("funkcija", "Delovno mesto / vloga"), T("email", "E-naslov", { t: "email" }), T("higienski_do", "Higienski minimum / izobraževanje veljavno do", { t: "date" }), T("zdravniski_do", "Zdravniški pregled veljaven do", { t: "date" }), T("datum_odhoda", "Datum odhoda (za rok hrambe osebnih podatkov)", { t: "date" }), T("opomba", "Opomba", { t: "area" })],
    cols: () => [{ l: "Ime", k: "ime" }, { l: "Vloga", k: "funkcija" }, { l: "Izobraževanje do", f: r => dueBadge(r.higienski_do) }, { l: "Zdravniški do", f: r => dueBadge(r.zdravniski_do) }]
  },
  usposabljanja: {
    ime: "usposabljanje", sort: (a, b) => (b.datum || "").localeCompare(a.datum || ""),
    fields: ctx => [T("tema", "Tema", { req: 1, wide: 1 }), T("datum", "Datum", { t: "date", def: () => today() }), T("veljavno_do", "Veljavno do", { t: "date" }), T("izvajalec", "Izvajalec"), T("udelezenci", "Udeleženci", { t: "area" }), T("opomba", "Opomba / dokazilo", { t: "area" })],
    cols: () => [{ l: "Tema", k: "tema" }, { l: "Datum", f: r => fdate(r.datum) }, { l: "Veljavno do", f: r => dueBadge(r.veljavno_do) }, { l: "Izvajalec", k: "izvajalec" }]
  },
  dobavitelji: {
    ime: "dobavitelj", fields: () => [T("naziv", "Naziv", { req: 1 }), T("kategorija", "Kategorija (meso, zelenjava, embalaža …)"), T("kontakt", "Kontakt"), T("registracija", "Registracija / odobritev (št.)"), { k: "ocena", l: "Ocena dobavitelja", t: "sel", o: ["odobren", "pogojno odobren", "ni ocenjen", "zavrnjen"] }, T("naslednja_ocena", "Naslednja ocena", { t: "date" }), T("prevzem", "Kontrola ob prevzemu (kaj preverjamo)", { t: "area" })],
    cols: () => [{ l: "Dobavitelj", k: "naziv" }, { l: "Kategorija", k: "kategorija" }, { l: "Ocena", f: r => badge(r.ocena) }, { l: "Naslednja ocena", f: r => dueBadge(r.naslednja_ocena) }]
  },
  oprema: {
    ime: "oprema / merilni instrument", fields: ctx => [T("naziv", "Naziv", { req: 1 }), { k: "tip", l: "Vrsta", t: "sel", o: ["hladilnik", "zamrzovalnik", "hladilna vitrina", "termometer / sonda", "tehtnica", "pečica / štedilnik", "pomivalni stroj", "drugo"] }, obratField(ctx), T("lokacija", "Lokacija v obratu"), T("naslednji_servis", "Naslednji servis / umerjanje", { t: "date" }), T("interval_dni", "Interval (dni)", { t: "num" }), T("opomba", "Opomba", { t: "area" })],
    cols: ctx => [{ l: "Naziv", k: "naziv" }, { l: "Vrsta", k: "tip" }, { l: "Obrat", f: r => esc(((ctx && ctx.obrati) || {})[r.obrat_id] || "") }, { l: "Servis / umerjanje", f: r => dueBadge(r.naslednji_servis) }]
  },
  navodila: {
    ime: "navodilo", sort: (a, b) => (a.naslov || "").localeCompare(b.naslov || "", "sl"), rev: true,
    fields: ctx => [T("naslov", "Naslov", { req: 1, wide: 1 }), { k: "vrsta", l: "Vrsta", t: "sel", o: ["Delovno navodilo", "Predpogojni program", "Obrazec", "Postopek", "Drugo"] }, obratField(ctx), T("verzija_oznaka", "Različica", { def: "1.0" }), { k: "status", l: "Stanje", t: "sel", o: STATUS_DOK, def: "osnutek" }, T("naslednji_pregled", "Naslednji pregled", { t: "date" }), T("vsebina", "Vsebina", { t: "area", wide: 1 })],
    cols: ctx => [{ l: "Naslov", k: "naslov" }, { l: "Vrsta", k: "vrsta" }, { l: "Različica", k: "verzija_oznaka" }, { l: "Stanje", f: r => badge(r.status) }, { l: "Pregled", f: r => dueBadge(r.naslednji_pregled) }]
  },
  nacrti: {
    ime: "HACCP načrt", rev: true, intro: "Podrobno vsebino načrta urejate v čarovniku (gumb »Čarovnik«).",
    fields: ctx => [T("naziv", "Naziv načrta", { req: 1, wide: 1 }), obratField(ctx), T("verzija_oznaka", "Različica", { def: "1.0" }), { k: "status", l: "Stanje", t: "sel", o: ["osnutek", "v pregledu", "potrjeno", "zastarelo"], def: "osnutek" }, T("potrdil", "Strokovno potrdil (ime)"), T("datum_potrditve", "Datum potrditve", { t: "date" }), T("naslednji_pregled", "Naslednji pregled", { t: "date" })],
    cols: ctx => [{ l: "Načrt", k: "naziv" }, { l: "Obrat", f: r => esc(((ctx && ctx.obrati) || {})[r.obrat_id] || "") }, { l: "Različica", f: r => esc(r.verzija_oznaka || "") }, { l: "Stanje", f: r => badge(r.status) }, { l: "Pregled", f: r => dueBadge(r.naslednji_pregled) }]
  },
  dogodki: {
    ime: "dogodek v koledarju", sort: (a, b) => (a.datum || "").localeCompare(b.datum || ""),
    fields: ctx => [T("naslov", "Naslov", { req: 1, wide: 1 }), T("datum", "Datum", { t: "date", req: 1, def: () => today() }), T("ura", "Ura"), { k: "vrsta", l: "Vrsta", t: "sel", o: ["Notranja kontrola", "Obisk HiGiFood", "Pregled dokumentacije", "Usposabljanje", "Servis / umerjanje opreme", "CAPA rok", "Drugo"] }, obratField(ctx), { k: "opomnik_dni", l: "Opomnik (dni prej)", t: "num", def: 3 }, { k: "status", l: "Stanje", t: "sel", o: ["načrtovano", "opravljeno"], def: "načrtovano" }, T("opomba", "Opomba", { t: "area" })],
    cols: () => [{ l: "Datum", f: r => fdate(r.datum) + (r.ura ? " " + esc(r.ura) : "") }, { l: "Naslov", k: "naslov" }, { l: "Vrsta", k: "vrsta" }, { l: "Stanje", f: r => badge(r.status) }]
  },
  storitve: {
    ime: "opravljena storitev", sort: (a, b) => (b.datum || "").localeCompare(a.datum || ""),
    fields: () => [T("datum", "Datum obiska / storitve", { t: "date", req: 1, def: () => today() }), { k: "vrsta", l: "Vrsta", t: "sel", o: ["Obisk na lokaciji", "Svetovanje (na daljavo)", "Izdelava dokumentacije", "Usposabljanje", "Notranja presoja", "Pomoč pri inšpekciji", "Drugo"] }, T("minute", "Trajanje (minute)", { t: "num" }), T("paket", "Paket"), T("opis", "Kaj je bilo opravljeno", { t: "area" }), { k: "stanje_dokumentacije", l: "Stanje dokumentacije po storitvi", t: "sel", o: ["ni začeta", "v pripravi", "pripravljena za potrditev", "potrjena", "potrebna posodobitev"] }, T("manjkajoci_podatki", "Manjkajoči podatki (kaj čakamo od stranke)", { t: "area" }), T("naslednji_pregled", "Priporočen naslednji pregled", { t: "date" }), T("cena", "Cena (EUR), neobvezno", { t: "num" })],
    cols: () => [{ l: "Datum", f: r => fdate(r.datum) }, { l: "Vrsta", k: "vrsta" }, { l: "Minut", k: "minute" }, { l: "Dokumentacija", f: r => esc(r.stanje_dokumentacije || "") }, { l: "Naslednji pregled", f: r => dueBadge(r.naslednji_pregled) }]
  }
};
SPEC.ciscenje_nacrt = {
  ime: "opravilo čiščenja", sort: (a, b) => (a.podrocje || "").localeCompare(b.podrocje || "", "sl") || (a.opravilo || "").localeCompare(b.opravilo || "", "sl"),
  intro: "Pogostost in način določi odgovorna oseba po HACCP načrtu. Program pripravi dnevni seznam opravil in opozori na zamude.",
  fields: ctx => [T("podrocje", "Področje / površina / naprava", { wide: 1 }), T("opravilo", "Opravilo", { req: 1, wide: 1, ph: "npr. pranje in razkuževanje delovnih površin" }), obratField(ctx), T("sredstvo", "Čistilo / razkužilo"), T("metoda", "Način izvedbe (kratko)", { t: "area" }), T("pogostost_dni", "Pogostost (na koliko dni)", { t: "num", h: "1 = dnevno, 7 = tedensko, 30 = mesečno. Prazno = po potrebi (brez opomnika)." }), T("odgovoren", "Odgovoren"), T("zacetek", "Začetek izvajanja", { t: "date", def: () => today() }), T("kontrola", "Kako preverimo (vizualno, ATP, bris …)", { t: "area" }), { k: "aktivno", l: "Aktivno", t: "bool", def: true }],
  cols: ctx => [{ l: "Področje", k: "podrocje" }, { l: "Opravilo", k: "opravilo" }, { l: "Sredstvo", k: "sredstvo" }, { l: "Pogostost", f: r => r.pogostost_dni ? "vsakih " + r.pogostost_dni + " d" : "po potrebi" }, { l: "Odgovoren", k: "odgovoren" }, { l: "Stanje", f: r => r.aktivno === false ? badge("neaktivna") : badge("aktivna") }]
};
SPEC.vabe = {
  ime: "vaba / past (DDD)", sort: (a, b) => (a.oznaka || "").localeCompare(b.oznaka || "", "sl", { numeric: true }),
  fields: ctx => [T("oznaka", "Oznaka (št. na tlorisu)", { req: 1 }), { k: "vrsta", l: "Vrsta", t: "sel", o: ["vaba za glodavce", "lepilna past", "svetlobna past (UV)", "feromonska past", "drugo"] }, obratField(ctx), T("lokacija", "Lokacija", { wide: 1 }), { k: "status", l: "Stanje", t: "sel", o: ["aktivna", "odstranjena"], def: "aktivna" }, T("opomba", "Opomba", { t: "area" })],
  cols: ctx => [{ l: "Oznaka", k: "oznaka" }, { l: "Vrsta", k: "vrsta" }, { l: "Lokacija", k: "lokacija" }, { l: "Obrat", f: r => esc(((ctx && ctx.obrati) || {})[r.obrat_id] || "") }, { l: "Stanje", f: r => badge(r.status) }]
};
SPEC.kemikalije = {
  ime: "čistilo / razkužilo", sort: (a, b) => (a.naziv || "").localeCompare(b.naziv || "", "sl"),
  fields: () => [T("naziv", "Naziv", { req: 1, wide: 1 }), T("namen", "Namen (čiščenje, razkuževanje, strojno pranje …)"), T("proizvajalec", "Proizvajalec / dobavitelj"), T("koncentracija", "Delovna koncentracija in čas delovanja", { h: "Po navodilu proizvajalca." }), T("rok_uporabe", "Rok uporabe", { t: "date" }), T("shranjevanje", "Mesto shranjevanja"), T("varnostni_list", "Varnostni list (datoteka ali povezava)", { wide: 1 }), T("opomba", "Opomba", { t: "area" })],
  cols: () => [{ l: "Naziv", k: "naziv" }, { l: "Namen", k: "namen" }, { l: "Koncentracija", k: "koncentracija" }, { l: "Rok uporabe", f: r => dueBadge(r.rok_uporabe) }, { l: "Varnostni list", f: r => r.varnostni_list ? esc(r.varnostni_list) : '<span class="badge warn">manjka</span>' }]
};
function obratField(ctx) { return { k: "obrat_id", l: "Obrat", t: "sel", o: Object.entries((ctx && ctx.obrati) || {}) }; }
