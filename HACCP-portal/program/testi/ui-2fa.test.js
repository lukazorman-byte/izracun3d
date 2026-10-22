// Dvostopenjska prijava (TOTP): vklop s kodo QR/ključem, prijava s kodo, zaščita pred ponovno uporabo, rezervne kode, izklop.
const crypto = require("crypto");
const B = process.env.BASE; const { chromium } = require("./pw.js");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const dec = s => { let bits = 0, val = 0; const out = []; for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, "")) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (key, ctr) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(ctr)); const h = crypto.createHmac("sha1", key).update(b).digest(), o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0"); };
(async () => {
  // RFC 6238 testni vektor (SHA-1, T=59 s -> 94287082, zadnjih 6 števk 287082)
  ok(totp(Buffer.from("12345678901234567890"), 1) === "287082", "TOTP izračun ustreza RFC 6238");
  const br = await chromium.launch(); const errs = [];
  const pg = await (await br.newContext()).newPage(); pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(B + "/"); await pg.fill("#le", "a@t.si"); await pg.fill("#ln", "A"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])");
  await pg.click("#whoami"); await pg.waitForSelector("text=Vklopi dvostopenjsko prijavo"); await pg.click("text=Vklopi dvostopenjsko prijavo");
  await pg.waitForSelector("#f2k"); ok(await pg.locator("#dlg svg").count() >= 1, "prikazana koda QR");
  const key = dec(await pg.textContent("#f2k")), c0 = Math.floor(Date.now() / 30000);
  await pg.fill("#f2c", "000000"); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("#f2e:not(:empty)"); ok(true, "napačna koda zavrnjena");
  const k0 = totp(key, c0); await pg.fill("#f2c", k0); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector("#f2r");
  const rez = (await pg.textContent("#f2r")).trim().split(/\s+/); ok(rez.length === 8, "8 rezervnih kod");
  await pg.click("#dlg-f .btn"); await pg.click("#logout"); await pg.waitForSelector("#lf");
  const login = async koda => { await pg.goto(B + "/"); await pg.waitForSelector("#lf"); await pg.fill("#le", "a@t.si"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#lk"); await pg.fill("#lk", koda); await pg.click("#lf button"); await pg.waitForFunction(() => !document.querySelector("#shell").hidden || (document.querySelector("#lerr").textContent && document.querySelector("#lk").value === "")  || /Koda ni pravilna/.test(document.querySelector("#lerr").textContent), null, { timeout: 8000 }); return !(await pg.locator("#shell").isHidden()); };
  ok(!(await login(k0)), "ista koda drugič ne deluje (ponovna uporaba)");
  ok(await login(totp(key, c0 + 1)), "prijava z novo kodo");
  ok(await pg.evaluate(() => ME.u.totp === true), "račun označen z 2FA");
  await pg.click("#logout"); await pg.waitForSelector("#lf");
  ok(await login(rez[0]), "prijava z rezervno kodo");
  await pg.click("#logout"); await pg.waitForSelector("#lf");
  ok(!(await login(rez[0])), "rezervna koda deluje samo enkrat");
  ok(await login(rez[1]), "druga rezervna koda");
  // admin seznam: stolpec 2FA
  await pg.goto(B + "/#/uporabniki"); await pg.waitForSelector("table.t"); ok((await pg.textContent("table.t")).includes("2FA"), "seznam uporabnikov prikazuje 2FA");
  // izklop
  await pg.click("#whoami"); await pg.click("text=Izklopi dvostopenjsko prijavo"); await pg.waitForSelector("#f2p"); await pg.fill("#f2p", "dolgogeslo123"); await pg.fill("#f2c", rez[2]); await pg.click("#dlg-f .btn:last-child"); await pg.waitForSelector(".toast.show:not(.err)");
  await pg.click("#logout"); await pg.waitForSelector("#lf"); await pg.fill("#le", "a@t.si"); await pg.fill("#lp", "dolgogeslo123"); await pg.click("#lf button"); await pg.waitForSelector("#shell:not([hidden])"); ok(true, "po izklopu prijava brez kode");
  console.log("napake", errs); if (errs.length) fails++; await br.close(); console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); process.exit(2); });
