# HiGiFood HACCP platforma

Večstrankarska platforma za pripravo in vodenje HACCP dokumentacije. Vse prejšnje funkcije (generator dokumentacije, baza znanja, urejevalnik baze, posodobitve zakonodaje, Word izvoz) ostanejo; dodani so prijava, vloge, stranke, čarovnik, evidence, CAPA, koledar in storitve.

## Zagon in prva prijava
Potrebujete Node.js 18+. Windows: dvoklik `zagon.bat`; Mac/Linux: `./zagon.sh`; ali `node server.js`.
Ob prvem zagonu odprite http://127.0.0.1:3000/ in ustvarite **administratorja** (e-naslov + geslo, vsaj 10 znakov). Brez prijave ni dostopa do podatkov. Samostojna datoteka `dist/haccp-aplikacija.html` (samo generator) deluje brez strežnika in prijave.

## Zagon brez črnega okna in dostop od koderkoli
- **Windows (.exe):** dvoklik na `HiGiFood.vbs` zažene program skrito in odpre brskalnik (`HACCP-sistem.exe` neposredno odpre okno terminala). Ustavitev: Administracija → »Ustavi program«. Dvojen zagon ni mogoč: drugi zagon samo odpre brskalnik.
- **Samodejni zagon ob prijavi v Windows:** `samodejni-zagon-vklopi.bat` (izklop: `samodejni-zagon-izklopi.bat`); program se zažene skrit, brskalnika ne odpre.
- **Dostop od drugod:** program teče samo na računalniku, kjer je zagnan. Za dostop s telefona ali od drugod mora računalnik teči in biti dosegljiv: zasebno prek Tailscale, v domačem omrežju (`HOST=0.0.0.0`) ali na najetem strežniku. Podrobnosti in komplet za strežnik (Docker, Caddy, systemd) so v mapi `streznik/` (`NAVODILA-STREZNIK.md`).

## Pozabljeno geslo
Aplikacijo ustavite in zaženite `ponastavi-geslo.bat` (Mac/Linux: `./ponastavi-geslo.sh`; pri `.exe`: `HACCP-sistem.exe --ponastavi-geslo`). Izberete uporabnika in vnesete novo geslo. Ponastavitev deluje samo na računalniku, kjer so podatki, in se zapiše v revizijsko sled.

## Vloge (dostop preverja strežnik)
| Vloga | Kaj lahko |
|---|---|
| Administrator HiGiFood | vse: stranke, uporabniki, baza znanja, kopije/obnova, revizijska sled, nastavitve obvestil |
| HACCP-svetovalec | samo dodeljene stranke: podatki, načrti, evidence, CAPA, storitve |
| Odgovorna oseba stranke | samo lastna stranka: podatki, zaposleni (dodaja uporabnike), načrti, potrjevanje evidenc |
| Zaposleni stranke | lastna stranka: vnos evidenc in neskladnosti, branje; ne more potrditi ali spreminjati potrjenih zapisov |
Interne opombe in cene so za stranko skrite že v odgovoru strežnika.

## Moduli
- **Nadzorna plošča**: število strank, aktivni sistemi, načrti po stanju, roki in zamude, zapisi za pregled, odstopanja, odprti CAPA, dokumenti za posodobitev, poteki izobraževanj/opreme, zadnje aktivnosti, opozorila o manjkajočih podatkih; filtri po stranki, stanju in datumu.
- **Stranke**: profil (podjetje, odgovorna oseba, dejavnost), več obratov (opis prostorov, procesov, čiščenje, DDD, odpadki, voda), zaposleni in usposabljanja, dobavitelji, oprema/instrumenti z mejami, HACCP načrti, navodila, evidence, CAPA, koledar, priloge, storitve, uporabniki.
- **Čarovnik HACCP (7 korakov)**: zbiranje podatkov → dejavnost in živila (predloga dejavnosti iz baze, prilagodljiva) → procesni koraki (dodaj/uredi/premakni, diagram poteka, izvoz v PDF) → analiza nevarnosti (B/K/F/alergen/navzkrižna/čas-temperatura; ocena verjetnost × teža z zapisano metodologijo) → kontrolni ukrepi PRP/OPRP/CCP (odločitveno drevo daje samo predlog; CCP se nikoli ne določi samodejno) → pregled osnutka z opozorili → izvoz PDF/Excel. Predlogi iz baze so označeni »predlog« in zahtevajo potrditev. Mejnih vrednosti program ne izmišlja: vnese jih uporabnik ali jih vstavi kot predlog iz baze (označeno »potrebna strokovna potrditev«).
- **Navodila**: 19 predlog (higiena, čiščenje, prevzem, skladiščenje, temperature, navzkrižna kontaminacija, alergeni, odpadki, DDD, voda, vzdrževanje, merilni instrumenti, sledljivost, odpoklic, reklamacije, usposabljanje, notranja kontrola, pregled dokumentacije, hlajenje); dodajo se kot osnutek in se prilagodijo; vsaka ima različico, datum in pravno podlago. Zbirka `navodila_predloge` v bazi znanja.
- **Evidence**: prevzem, temperature, toplotna obdelava, hlajenje, čiščenje, higienski pregled, kontrola opreme, sledljivost/odpoklic, prilagojeno. Čas in uporabnik se zapišeta samodejno; obvezna polja; fotografija; skladnost se oceni samo, če so mejne vrednosti določene (sicer »brez ocene«); nastavljiva pogostost z opozorili za manjkajoče vnose; izvoz v PDF in Excel. Zapisov ni mogoče brisati; vsak popravek je nova različica z razlogom, potrjene zapise lahko popravi samo odgovorna oseba/svetovalec z razlogom.
- **Neskladnosti / CAPA**: vsa polja (čas, obrat/proces, opis, tveganje, nujnost, takojšnji ukrep, odločitev o živilu, vzrok, dolgoročni ukrep, odgovoren, rok, dokaz, učinkovitost, zapiranje); zaprtje zahteva izpolnjena polja; odprti ukrepi na nadzorni plošči in v opomnikih.
- **Inšpekcija** (zavihek pri stranki; izpis vsebuje tudi tlorise obrata): kontrolni seznam stanja (potrjen načrt, navodila, izobraževanja in zdravniški pregledi, oprema, dobavitelji, evidence v obdobju, odprti CAPA) in izpis dokazil za izbrano obdobje v PDF, Word in Excel. Prikazuje samo vneseno stanje in ne ocenjuje skladnosti.
- **QR kode naprav**: Stranka → Oprema → »QR kode naprav« natisne nalepke. Skeniranje odpre vnos zapisa (temperatura za hladilnike in zamrzovalnike, sicer kontrola opreme) z že izbrano napravo in mejami. Telefon potrebuje dostop do strežnika (npr. `HOST=0.0.0.0` v lokalnem omrežju, naslov v kodi lahko spremenite) in prijavo.
- **Tloris** (zavihek pri stranki): risanje tlorisa v aplikaciji (SVG): sobe z vrsto (čisto/nečisto območje, skladišče, hladno skladišče …), stene, vrata, naprave (povezava s seznamom opreme), vabe/pasti DDD (povezava z registrom vab; opozorilo, katere vabe še niso na tlorisu), poti (čista, nečista, hladna in topla veriga, odpadki, osebje), besedilo. Mreža 0,25 m, premikanje, spreminjanje velikosti, podvoji, razveljavi (Ctrl+Z), Del. Shrani z revizijami; izvoz PNG/SVG z legendo; v čarovniku HACCP (korak 1) izberete tloris, ki se vstavi v dokumentacijo (PDF/Word).
- **Higiena** (zavihek pri stranki): *Danes za opraviti* (opravila iz načrta čiščenja, ki so na vrsti ali v zamudi; »Opravljeno« ustvari zapis), *Načrt čiščenja* (področje, opravilo, sredstvo, pogostost, odgovoren), *Brisi in hitri testi* (mikrobiološki brisi/odtisi z rezultati po parametrih ter hitri testi: ATP, beljakovine, alergen, koncentracija razkužila; mejne vrednosti vnesete sami, graf gibanja ATP s pragom, odstopanja in delež), *DDD* (register vab in pasti, obiski izvajalca, opažanja škodljivcev), *Zdravje zaposlenih* (zdravstvene izjave), *Čistila in razkužila* (register z roki in varnostnimi listi). Zamude čiščenja so na nadzorni plošči, v koledarju in v dnevnih e-poštnih opomnikih (če je SMTP nastavljen; opomnik čistil 14 dni pred potekom); higienske vrstice so tudi v inšpekciji. Dodani sta predlogi navodil »Preverjanje čiščenja: brisi in hitri testi« in »Ravnanje s čistili in razkužili«. Program ne predpisuje mejnih vrednosti: brez vnesenih mej ocena ni mogoča.
- **Koledar**: roki iz celotne baze (pregledi, usposabljanja, oprema, CAPA, dobavitelji) in lastni dogodki; izvoz .ics.
- **Storitve**: opravljene storitve po stranki (datum, trajanje, paket, stanje dokumentacije, manjkajoči podatki, naslednji pregled), povzetek dela za stranko, izvoz v Excel. Cena je neobvezno polje (cenika program nima).
- **Slike v dokumentih**: v Administraciji naložite logotip (PNG/JPEG/WebP, do 1,5 MB), ki se prikaže na naslovnici PDF in Word. Fotografije, priložene evidencam, se pri izvozu evidenc v PDF/Word vstavijo v razdelek »Fotografije« s podnapisom (čas, vrsta, podatek). Fotografije pri neskladnostih (CAPA) se vstavijo v izvoz CAPA (Word/PDF). Tloris obrata naložite v koraku 1 čarovnika; vstavi se v poglavje »Podatki o podjetju in obratu«.
- **Poglavja**: v koraku 7 čarovnika poglavja dokumentacije poljubno vključite/izključite, preimenujete, premaknete in dodate lastna (z besedilom); številke so samodejne, nastavitev se shrani z načrtom.
- **Word (.docx)**: isti dokument (12 poglavij) in posamezna navodila se izvozijo tudi v Word (tudi evidence in seznam CAPA); besedilo, tabele in diagram poteka (polja in puščice) urejate v Wordu. Ob odprtju Word vpraša, ali naj osveži polja (kazalo, številke strani) – potrdite. Urejanje poteka samo v Wordu; spremembe se ne vračajo nazaj v aplikacijo (vsebino, ki naj ostane v sistemu, popravite v čarovniku).
- **PDF dokumentacija**: naslovnica, kazalo, številke strani, različica/datum, 12 poglavij + priloga s pravno podlago in datumom preverjanja. Dokument je označen kot OSNUTEK, dokler načrta ne potrdi strokovnjak; ne pomeni uradne odobritve in ne zagotavlja samodejne skladnosti.
- **Obvestila po e-pošti**: Administracija → SMTP (neobvezno). Brez SMTP-ja ostanejo opozorila v aplikaciji. Pošiljanje preizkusite z gumbom »Pošlji test« (pošiljanje s STARTTLS/SSL je odvisno od vašega ponudnika; samodejno preverjeno je bilo samo nešifrirano omrežje).

## Podatki, varnost in kopije
- Podatki strank so v mapi `podatki/` (JSON + `priloge/`), baza znanja v `baza/`. Mapi ne objavljajte javno; vsebujeta osebne podatke.
- Gesla: scrypt; seja: HttpOnly, SameSite=Strict piškotek (Secure za HTTPS za posredniškim strežnikom); omejitev poskusov prijave; Origin preverjanje za spreminjanje podatkov; varnostne glave (CSP, X-Frame-Options).
- **Revizijska sled** (`podatki/_revizijska-sled.jsonl`): prijave, ustvarjanje, spremembe, brisanja, pisanje baze; veriga zgoščenk razkrije naknadno spreminjanje; pregled v Administraciji.
- **Kopije**: samodejno vsak dan (zadnjih 30 v `podatki/_kopije`), ročni prenos in obnova (zip) v Administraciji; pred obnovo se naredi kopija stanja. **Kopija na drugo mesto**: v Administraciji določite mapo (USB, zunanji disk, sinhronizirana mapa), kamor se dnevna kopija prepiše še enkrat (zadnjih 30); prikazano je stanje zadnje kopije. Nadrejena mapa mora obstajati.
- Strežnik privzeto posluša samo na 127.0.0.1. Za uporabo v omrežju/internetu ga postavite za HTTPS posredniški strežnik (npr. Caddy, nginx) in nastavite `HOST` ter `x-forwarded-proto`.
- Gesla za SMTP so v `podatki/_nastavitve.json` na strežniku, nikoli v kodi odjemalca.
- Skladnost zapisov (»skladno/odstopanje«) izračuna odjemalec ob vnosu; sprememba je sledljiva (revizije, revizijska sled), ni pa kriptografsko zaščitena pred zaposlenim, ki ima pravico vnosa.

## Preostali del dokumentacije (prej)

Ločeni deli, povezani prek API-ja:

| Del | Mapa | Naloga |
|---|---|---|
| Baza | `baza/*.json` | Podatki: branže, zakonodaja, temperaturni režimi, standardi, alergeni … |
| Strežnik | `server.js` | Ponuja API (`/api/baza`) in postreže obema aplikacijama. Brez odvisnosti. |
| Glavna aplikacija | `app/` | Generator HACCP dokumentacije. Vse podatke bere iz baze. |
| Urejevalnik baze | `baza-admin/` | Urejanje baze v brskalniku. Pred vsakim zapisom naredi varnostno kopijo v `baza/_backup/`. |

## Posodobitev (različica z nabori sestavin)
Pri izdelku zdaj izbirate sestavine iz baze (195 sestavin): alergeni se obkljukajo sami, v dokumentaciji so receptura, osnutek seznama sestavin za etiketo, nevarnosti iz sestavin in specifikacije surovin, zakonodaja pa se dopolni glede na sestavine.
Ob posodobitvi nadomestite samo program (.exe ali mapo `app`, `baza-admin`, `server.js`). Vaša mapa `baza` ostane, manjkajoča zbirka `sestavine` pa se doda sama ob prvem zagonu.

## Redne posodobitve zakonodaje
Zakonodaja v bazi (EU in Slovenija, standardi) ima pri vsakem predpisu polji `status` (veljaven ali razveljavljen) in `preverjeno` (datum). Razveljavljeni predpisi se v dokumentaciji ne prikažejo. Baza se posodablja s paketi posodobitev (`posodobitev-LLLL-MM.json`), ki lahko dodajo, zamenjajo ali odstranijo predpise (in zapise v drugih zbirkah):
- v urejevalniku baze kliknite **Uvozi posodobitev** in izberite datoteko, ali
- datoteko prekopirajte v mapo `posodobitve` (ob programu ali v mapi `haccp-sistem`) in znova zaženite program.
Vsaka posodobitev se uporabi samo enkrat (evidenca v `baza/_posodobitve.json`, pregled v urejevalniku baze). Pred spremembo se naredi varnostna kopija v `baza/_backup/`. Mesečno pripravo paketa opravlja načrtovana naloga (1. v mesecu); paket se pošlje v pogovor.

## Nadgradnje (zadnji sklop)
- **Testi**: `npm test` (mapa `testi/`, glej `testi/README.md`). UI-testi potrebujejo Playwright + Chromium; brez njih se preskočijo.
- **Skladnost vnosa** ocenjuje strežnik (brskalnik jo le prikaže), zato je ni mogoče ponarediti z odjemalcem.
- **Delo brez povezave (PWA)**: namestljiva aplikacija; vnosi evidenc se brez povezave shranijo v čakalno vrsto in se ob vrnitvi povezave samodejno pošljejo. Deluje na `localhost` ali prek HTTPS. Fotografije brez povezave niso na voljo.
- **Koš**: izbrisani zapisi ostanejo 30 dni in jih je mogoče obnoviti; trajno brisanje samo administrator.
- **Uvoz iz Excela/CSV** z naložljivimi predlogami (osebje, dobavitelji, oprema ...).
- **Tiskani prazni obrazci** za vnos na papir.
- **Globalno iskanje**: polje zgoraj ali tipka `/`.
- **Šifrirane kopije** (AES-256-GCM, `.hfbk`). Geslo za zunanje kopije je shranjeno na strežniku; izgubljeno geslo pomeni, da kopije ni mogoče obnoviti.
- **Dostopnost**: povezava za preskok, oznake, upravljanje fokusa v oknih.
- **Word diagram poteka**: urejljivi liki in puščice (do 9 korakov na risbo). V pravem Wordu ni preverjeno.

- **Tiskanje po vlogah**: Administracija → "Tiskanje dokumentacije". Administrator za vsako skupino dokumentov (HACCP načrt, navodila, evidence, CAPA, inšpekcijska mapa, prazni obrazci, QR, ostalo) določi, ali jo smejo izpisati svetovalec, odgovorna oseba in zaposleni. Omejitev velja za izpisovanje v aplikaciji (podatke še vedno vidijo glede na vlogo).
- **Kartoteke zaposlenih**: zavihek "Zaposleni in usposabljanja" → PDF z listom na osebo (podatki, veljavnosti, usposabljanja, podpis).

- **Potrditve in različice** (zavihek v profilu stranke): odgovorna oseba potrdi trenutno različico HACCP načrta ali navodila (kdo, kdaj, katera različica). Vsaka sprememba potrditev razveljavi. Pri vsakem dokumentu je pregled različic z razlikami in vrnitev na prejšnjo različico (zapiše se kot nova).
- **Danes (opravila)**: v meniju; prikaže manjkajoče redne vnose (po pogostosti vnosov), čiščenje za danes in ukrepe z rokom v tednu. Vnos se opravi z enim klikom.
- **Obvestila o manjkajočih vnosih**: e-poštni opomnik odgovorni osebi in svetovalcu, če vnos po pogostosti (urnik) zamuja.
- **Sledljivost in odpoklic**: evidenca šarž (dobavitelj, rok, kje uporabljeno), iskanje po šarži/izdelku, PDF poročilo in samodejna neskladnost (CAPA) ter oznaka "umaknjeno".
- **Alergeni in jedilnik**: matrika jedi × 14 alergenov, predlog alergenov iz sestavin (vedno ga pregleda odgovorna oseba), jedilnik z oznakami v PDF in Excel.
- **Pripravljenost na certifikacijo**: seznam zahtev za izbrani standard z samodejnim preverjanjem iz podatkov in ročno oceno; izvoz v Excel/PDF. Ni nadomestilo za presojo.
- **Arhiv evidenc** (Administracija): evidence starejše od izbranih let se stisnejo v `podatki/_arhiv` in odstranijo iz žive baze; arhiv je mogoče prenesti in vrniti. Upoštevajte zakonske roke hrambe.

- **Umiki in odpoklici živil**: stran "Umiki in odpoklici". Administrator vpiše naslove virov RSS/Atom (program jih bere vsakih 6 ur), svetovalec in administrator pa lahko obvestilo dodata ročno. Program obvestila samodejno primerja z izdelki in šaržami (Sledljivost), dobavitelji in sestavinami jedi vsake stranke; ujemanja se prikažejo na strani Danes in pridejo po e-pošti. Ujemanje je opozorilo, ki ga potrdi človek. Uradni objavi umikov sta na gov.si; ali ponujata RSS vir, ni preverjeno, zato so vnos virov in ročno dodajanje obe možnosti.

- **RASFF**: v Umiki in odpoklici (administrator) je vklop uvoza iz EU sistema RASFF. Uporablja neuradni, nedokumentirani endpoint RASFF Window (lahko se spremeni; z živim strežnikom ni preizkušeno, ker razvojno okolje nima dostopa). Uvoz je enkrat na dan, 15 s timeout, 3 poskusi, `User-Agent: MojaPlatforma/1.0`, stran 1 (50 zapisov). Šifri filtra (privzeto klasifikacija 306, izvor 5075) sta nastavljivi. Imena polj v odgovoru so uganjena (tolerantno branje), zato po prvem uvozu preverite, ali so obvestila smiselna. Zapisi pridejo v isti seznam in se samodejno primerjajo s šaržami (tudi po EAN), dobavitelji in sestavinami.

- **Nastavitve vidnosti** (Administracija → Nastavitve vidnosti): za vsak razdelek menija, zavihek v profilu stranke in generator administrator s stikali določi, ali ga vidi Stranka (zaposleni stranke) in/ali Odgovorna oseba stranke. Nastavitve veljajo privzeto za vse stranke, za posamezno stranko jih je mogoče prepisati; "Ponastavi na privzeto" prepise odstrani. Skrit razdelek ni v meniju, neposreden naslov preusmeri na nadzorno ploščo z obvestilom "Nimate dostopa", podatkovne zbirke tega razdelka pa zavrne tudi strežnik (403), generator pa strežnik preusmeri. Zbirka podatkov je dostopna, če je viden vsaj en razdelek, ki jo uporablja (npr. oprema je potrebna tudi v evidencah). Administrator in svetovalec vidita vse. Gumba "Predogled kot Stranka" / "Predogled kot Odgovorna oseba" prikažeta platformo z izbrano vidnostjo (samo vmesnik; podatki ostanejo administratorjevi).
- **Generator**: gumb "← Nazaj na platformo" v glavi; če so v obrazcu neshranjene spremembe (po zadnjem prenosu ali tisku), vpraša za potrditev.

- **Brez terminala (Windows)**: `HACCP-sistem.exe` je okenski program brez konzole, zato se dvoklik nanj ali na `HiGiFood.vbs` ne odpre noben črn zaslon. Sporočila in napake se zapišejo v `zagon.log` ob programu. `HACCP-sistem-konzola.exe` je enak program s konzolo; uporablja ga samo `ponastavi-geslo.bat` (vpis gesla v oknu). Konzolni exe se pripravi z `pkg`, okenski pa z `node scripts/pe-gui.js`. Pri zagonu iz izvorne kode (`zagon.bat`, Node.js) se terminal odpre, ker teče Node; takrat uporabite `HiGiFood.vbs`.

- **Testno okolje za druge testerje**: zagon `HiGiFood-test.vbs` (ali `node server.js --testno`) uporabi ločeno mapo `podatki-test`, ustvari testne račune (admin@, svetovalec@, odgovorna@, zaposleni@ `test.si`, geslo `Testiram-123`) in demo podatke, prikaže napis TESTNA RAZLIČICA, gumb za prijavo napake (prenese besedilno datoteko) in gumb za ponastavitev testnih podatkov (admin). E-poštna obvestila so v testnem načinu izklopljena. `HiGiFood-test-omrezje.vbs` (`--testno --omrezje`) je dosegljiv tudi drugim računalnikom v istem omrežju; dovoljeno samo v testnem načinu, ker povezava ni šifrirana. Požarni zid: `odpri-pozarni-zid.bat` / `zapri-pozarni-zid.bat` (kot skrbnik), čiščenje: `odstrani-test.bat`. Navodila: `NAVODILA-ZA-TESTIRANJE.html`. V Dockerju: `HACCP_TEST=1`.

- **Več uporabnikov na strežniku**: hkratno urejanje istega zapisa vrne opozorilo (409) namesto tihega prepisa; odprti zasloni se osvežijo ob vrnitvi na zavihek in vsakih 5 minut. `HiGiFood-streznik.vbs` na Windows odpre program na strežniku.
- **Varnost in robustnost**: seje preživijo ponovni zagon (`_seje.json`, samo zgoščenke); sprememba gesla odjavi druge naprave in ima omejitev poskusov; prijava z neznanim e-naslovom traja enako dolgo; preverjanje izvora vrne 403 tudi za `Origin: null` in `Sec-Fetch-Site: cross-site`; vsebina naloženih datotek se preveri po prvih bajtih; telo zahteve se dekodira kot celota (šumniki); zapisi z `fsync`; `baza/_backup` hrani zadnjih 30 kopij na zbirko; čista zaustavitev ob SIGTERM; neobravnavane napake v dnevnik; neobvezno `HACCP_DOSTOPNI_DNEVNIK=1` (dnevnik zahtevkov), `HACCP_PROXY=1` (IP iz X-Forwarded-For za posrednikom), `HACCP_POSODOBITVE_URL` (samodejne posodobitve baze znanja). Docker: en nosilec `/data`, uporabnik `node`, preverjanje zdravja, HSTS v Caddyju.

- **Dvostopenjska prijava (TOTP)**: klik na svoje ime spodaj levo, »Moj račun«: vklop s kodo QR (Google/Microsoft Authenticator), 8 rezervnih kod za enkratno uporabo. Administrator jo lahko izklopi uporabniku, ki je izgubil telefon (Uporabniki, uredi). `ponastavi-geslo` jo izklopi tudi lokalno.
- **Gesla v nastavitvah** (SMTP, geslo za šifrirane kopije) so na disku šifrirana s ključem `podatki/_kljuc` (ali okoljsko spremenljivko `HACCP_KLJUC`). Ključ ni del varnostnih kopij: ob selitvi na drug računalnik ta gesla vnesete znova ali prekopirate `_kljuc`.
- **Revizijska sled** se pri ~5 MB arhivira (`_revizijska-sled-<čas>.jsonl`); veriga zgoščenk se nadaljuje čez datoteke in se preverja v celoti (arhivi le enkrat).
- **Preverjanje kode**: `npm run lint` (sintaksa vseh datotek, JSON baze); `npm test` (27 sklopov); `.github/workflows/testi.yml` za samodejno preverjanje na GitHubu.

- **Prvi koraki**: na nadzorni plošči seznam korakov za začetek (napredek se izračuna iz podatkov); zaposleni vidijo kratko pomoč. Za zaposlene so privzeto skriti Certifikacija, Potrditve, Inšpekcija in Generator (vklop v Nastavitvah vidnosti).
- **Vzdrževanje** (Administracija): stanje sistema (disk, velikost podatkov, zadnja kopija, napake), **preizkus obnove** (zadnja kopija se odpre v pomnilniku in preveri), opozorila na nadzorni plošči in po e-pošti administratorjem (malo prostora, stara ali neuspela kopija, nepreizkušena obnova). Dnevna kopija se osveži, kadar se podatki spremenijo.
- **Varstvo podatkov (GDPR)**: izvoz vseh podatkov osebe (JSON), anonimizacija osebe (tudi v zgodovini sprememb; revizijska sled ostane), rok hrambe za nekdanje zaposlene (polje Datum odhoda), predlogi pogodbe o obdelavi in evidence dejavnosti obdelave (Word).
- **Strokovni pregled baze**: izvoz zakonodaje za strokovnjaka (Excel/Word) in oznaka, kdo in kdaj je predpis pregledal.
- **Pilotna uporaba**: `PILOTNI-NACRT.md` (koraki, tedenski pregled, prava vaja obnove, merila za konec).

## Zavihka in segmenti
Aplikacija ima dva zavihka: **Živila (HACCP)** (izdelek, sestavine, alergeni, hranilna vrednost, HACCP) in **Živilski objekt** (prostori, poti, režimi, verige, čiščenje, DDD, predpogojni programi). Vsak ima svoj izpis. Segmenti (poglavja) se dodajo ali odstranijo posamezno s klikom na gumb nad izpisom; »Priporočeni« doda segmente glede na izbrane standarde.

## Codex Alimentarius
HACCP dokumentacija vsebuje oznake Codexovih korakov in načel (CXC 1-1969) pri poglavjih, segment **Skladnost s Codexom** (preslikava 12 korakov v poglavja in obrazce) ter **Odločitveno drevo za CCP** (klasično drevo s štirimi vprašanji in delovni list; uporaba ni obvezna). Pri razlikah velja zavezujoča zakonodaja EU in RS pred Codexom.

## Presoje
Tretji zavihek **Presoje** ima obrazec (vrsta presoje, datum, obseg, vodja, presojevalci, presojana področja) in segmente: podatki o presoji, letni program, načrt z urnikom, kontrolni seznami po standardih (HACCP/Codex, predpogojni programi, ISO 22000, FSSC 22000, IFS Food, BRCGS), presoja dobavitelja, poročilo, korektivni ukrepi, seznam dokazil (iz obrazcev) in priprava na zunanjo presojo. Vprašanja so v zbirki `presoje` (119 vprašanj) in jih urejate v urejevalniku baze. Področja kontrolnih seznamov lahko izberete.

## Obrazci po standardih
V zavihku **Živilski objekt** je 42 obrazcev za izpolnjevanje (prevzem, temperature, CCP/OPRP, čiščenje, DDD, alergeni, sledljivost, odpoklic, presoje, pregled vodstva, food defence, food fraud …), povezanih s klavzulami standardov HACCP/852, ISO 22000 (vključno z ISO/TS 22002-1), FSSC 22000, IFS Food in BRCGS. Izbrani so glede na označene standarde (lahko tudi ročno). Segment »Kazalo obrazcev« prikaže povezavo obrazec × standard. Zbirka `obrazci` je v bazi in jo urejate v urejevalniku baze. Številke klavzul preverite v aktualni izdaji standarda.

## Izvoz v Word
Gumb **Prenesi Word (.docx, urejljivi diagrami)** ustvari pravi dokument Word (ležeča A4). Diagrami (shema čistih in nečistih poti, diagram poteka) niso slike, ampak Wordove oblike (polja, puščice, besedilo), ki jih v Wordu urejate: premikate, spreminjate besedilo, barve in povezave (po potrebi z desnim klikom »Razdruži«). Starejši gumb »Word (.doc, preprosto)« ustvari preprosto datoteko brez urejljivih diagramov.

## Hranilna vrednost
Receptura se vnese v gramih pri izdelku. Program izračuna hranilne vrednosti na 100 g in na porcijo (z upoštevanjem izgube mase pri obdelavi) ter % referenčnega vnosa. Izračun je ocena po povprečnih vrednostih sestavin iz baze.

## Hitri zagon
- **Windows:** dvoklik na `zagon.bat`
- **Mac/Linux:** `./zagon.sh`
- **Brez Node.js:** odprite `dist/haccp-aplikacija.html` (samostojna različica z vgrajeno kopijo baze; baze v tem načinu ne morete urejati). Po urejanju baze jo osvežite z `node build.js`.

## Zagon
Potrebujete Node.js 18 ali novejši.

    node server.js

- Portal (prijava): http://127.0.0.1:3000/
- Generator dokumentacije: http://127.0.0.1:3000/generator/
- Urejevalnik baze (samo administrator): http://127.0.0.1:3000/baza/

Vrata in naslov: `PORT=8080 HOST=0.0.0.0 node server.js`. Z HOST=0.0.0.0 odprete dostop v omrežju; podatki so zaščiteni s prijavo, vendar strežnik ne podpira HTTPS: za omrežje uporabite HTTPS posredniški strežnik.

## API
- (vse zahteva prijavo) `GET /api/baza` vse zbirke
- `GET /api/baza/<zbirka>` ena zbirka
- `PUT /api/baza/<zbirka>` zamenja zbirko (telo: JSON)

## Opombe za urejanje
- ID temperaturnih režimov (`zam, hl0, hl4, hl6, hl8, sob, kuh, hlaj, vro, pon`) uporablja koda aplikacije, zato jih ne preimenujte.
- Oznake v zakonodaji (`oznake`) določajo, kdaj predpis velja: `*` = vedno; branžne oznake (npr. `animal`, `meat`); lastnosti izdelka (`bio`, `add` …); `std_<id standarda>`; `proto`, `rte`.
- Vsebina je izhodišče. Predpise preverite v EUR-Lex in PISRS.
