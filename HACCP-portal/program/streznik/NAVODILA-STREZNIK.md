# HiGiFood HACCP na strežniku

Strežnik potrebujete, če želite, da več ljudi z različnih računalnikov ali telefonov dela na **istih podatkih** prek interneta. Za enega uporabnika na enem računalniku strežnika ne potrebujete (uporabite Windows program).

## Kaj potrebujete
| | |
|---|---|
| Strežnik | Linux (npr. Ubuntu 22.04 ali 24.04), 1 GB RAM, 10 GB diska. Najet VPS stane nekaj evrov na mesec. |
| Domena | npr. `haccp.vasa-domena.si`; njen A-zapis mora kazati na IP strežnika (potrebno za HTTPS). |
| Odprta vrata | 80 in 443. Vrat 3000 navzven **ne** odpirajte. |
| Programi | Docker (pot A) ali Node.js 18+ in Caddy (pot B). |

V programu so osebni podatki: izberite strežnik v EU in preverite pogodbo s ponudnikom.

## Pot A: Docker (priporočeno)
1. Namestite Docker (Ubuntu): `curl -fsSL https://get.docker.com | sudo sh`
2. Mapo s programom (v paketu HACCP-portal je to mapa `program`) prekopirajte na strežnik, npr. v `/opt/higifood` (WinSCP, `scp` ali `rsync`).
3. V `streznik/Caddyfile` zamenjajte `haccp.vasa-domena.si` z vašo domeno.
4. Zaženite:
   ```
   cd /opt/higifood/streznik
   sudo docker compose up -d --build
   ```
5. Počakajte minuto, odprite `https://vasa-domena` in ustvarite administratorja. Caddy sam pridobi HTTPS potrdilo (Let's Encrypt).
6. Stanje: `sudo docker compose ps` (aplikacija mora biti `healthy`); dnevnik: `sudo docker compose logs -f app`.

Vsi podatki so v enem Docker nosilcu `streznik_data` (v kontejnerju `/data`): `baza` (baza znanja) in `podatki` (uporabniki, evidence, priloge, kopije, seje). Aplikacija v kontejnerju teče kot neprivilegiran uporabnik `node`, ima preverjanje zdravja in se ob `docker compose stop` čisto zaustavi.

### Ključ za gesla v nastavitvah
SMTP geslo in geslo za šifrirane kopije sta na disku šifrirana. Ključ se ob prvem zagonu ustvari v `/data/podatki/_kljuc` (isti nosilec kot podatki). Za večjo varnost ga podajte zunaj nosilca: v `docker-compose.yml` pri `app` dodajte `HACCP_KLJUC: "<dolg naključen niz>"` (npr. iz `openssl rand -hex 32`) in ga shranite v upravljalnik gesel. Ob selitvi strežnika uporabite isti ključ, sicer ti dve gesli vnesete znova.

### Posodobitev programa
```
cd /opt/higifood/streznik
# prekopirajte novo različico čez mapo /opt/higifood (nosilec s podatki ostane)
sudo docker compose up -d --build
```
Nove zbirke in nove sestavine v privzeti bazi znanja se ob zagonu dodajo obstoječi namestitvi; vaših sprememb baze ne prepišejo.

Neobvezno: samodejne posodobitve baze znanja z vašega naslova. V `docker-compose.yml` odkomentirajte `HACCP_POSODOBITVE_URL` in vpišite naslov JSON datoteke s posodobitvijo (ali seznamom posodobitev, enaka oblika kot v mapi `posodobitve`). Strežnik jo preveri ob zagonu in vsakih 24 ur; vsaka posodobitev se uporabi le enkrat.

### Varnostna kopija
- V programu: Administracija, prenos kopije (.zip), šifrirana kopija ali kopija v zunanjo mapo.
- Celoten nosilec (iz mape `streznik`):
  ```
  sudo docker run --rm -v streznik_data:/d -v $PWD:/b alpine tar czf /b/higifood-data.tgz -C /d .
  ```
  Ime nosilca preverite z `sudo docker volume ls`.
- Kopije redno shranjujte **izven** strežnika.

## Pot B: brez Dockerja (systemd)
1. Namestite Node.js 18+ in Caddy (`sudo apt install caddy`).
2. Mapo s programom (`program` iz paketa HACCP-portal) prekopirajte v `/opt/higifood`, ustvarite uporabnika: `sudo useradd -r -m higifood && sudo chown -R higifood /opt/higifood`.
3. `sudo cp streznik/higifood.service /etc/systemd/system/ && sudo systemctl enable --now higifood`
4. Caddy: v `/etc/caddy/Caddyfile` vpišite vsebino iz `streznik/Caddyfile`, vendar z `reverse_proxy 127.0.0.1:3000` namesto `app:3000`, nato `sudo systemctl reload caddy`.
5. Dnevnik: `journalctl -u higifood -f`.

## Uporabniki na Windows računalnikih
Uporabniki ne nameščajo ničesar: odprejo `https://vasa-domena` v brskalniku. Za ikono na namizju uporabite `HiGiFood-streznik.vbs` (ob prvem zagonu vpišete naslov strežnika) ali v brskalniku Edge/Chrome »Namesti aplikacijo«. Windows program (`HACCP-sistem.exe`) je samostojen in **ne** uporablja podatkov s strežnika.

Če dva uporabnika hkrati urejata isti zapis, drugi ob shranjevanju dobi opozorilo, da je zapis medtem spremenil nekdo drug; spremembe se ne prepišejo. Odprti zasloni se osvežijo ob vrnitvi na zavihek in vsakih 5 minut.

## Testno okolje na strežniku (neobvezno)
V `docker-compose.yml` pri `app` → `environment` dodajte `HACCP_TEST: "1"`. Podatki so takrat v `/data/podatki-test` (ločeno od pravih), na prijavi so testni računi z geslom `Testiram-123`. Povezave ne delite javno in ne vnašajte pravih podatkov.

## Varnostni kontrolni seznam
- [ ] Dostop samo prek `https://` (Caddy pošilja HSTS). Vrata 3000 niso dostopna od zunaj.
- [ ] Administratorsko geslo je dolgo in edinstveno; za administratorje in svetovalce je vklopljena dvostopenjska prijava (Moj račun).
- [ ] Uporabniki imajo najmanjšo potrebno vlogo; v Administraciji so nastavljene vidnosti in tiskanje.
- [ ] Redne kopije izven strežnika.
- [ ] Strežnik se posodablja (`sudo apt update && sudo apt upgrade`), SSH z ključem namesto gesla.
- [ ] `HACCP_KLJUC` je nastavljen zunaj nosilca (gesla v nastavitvah so šifrirana), dostop do strežnika in kopij nosilca je omejen.

## Kaj je preizkušeno
- `docker compose up -d --build` zgradi in zažene aplikacijo (`healthy`, uporabnik `node`) in Caddy; HTTP se preusmeri na HTTPS, HSTS je nastavljen.
- Prek HTTPS je uspel celoten uporabniški test (34 od 34). Piškotek prijave ima `Secure`.
- Podatki in prijave ostanejo po ponovni gradnji in ponovnem zagonu; `docker stop` se zaključi v manj kot sekundi.
- Nova zbirka v privzeti bazi znanja po ponovni gradnji doseže obstoječo namestitev.
- Revizijska sled beleži IP uporabnika (X-Forwarded-For iz Caddyja).
- Preizkus je bil izveden z lokalnim potrdilom za `localhost`, ne s pravo domeno. Pridobitev potrdila Let's Encrypt za vašo domeno in pot B (systemd) **nista bila preizkušena**.
