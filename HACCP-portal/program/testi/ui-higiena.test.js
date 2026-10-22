const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
const O=OUT;let f=0;const ok=(c,m)=>{if(!c){f++;console.log("NAPAKA:",m)}else console.log("ok:",m)};
(async()=>{const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});const ctx=await br.newContext({acceptDownloads:true,viewport:{width:1300,height:850}});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));pg.on("dialog",d=>d.accept());
await pg.goto(B+"/");await pg.fill("#le","a@t.si");await pg.fill("#ln","A");await pg.fill("#lp","dolgogeslo123");await pg.click("#lf button");await pg.waitForSelector("#shell:not([hidden])");
const sid=await pg.evaluate(async()=>{const s=await D.add("stranke",{naziv:"Higiena d.o.o."});await D.add("osebje",{stranka_id:s.id,ime:"Ana Novak"});
await D.add("ciscenje_nacrt",{stranka_id:s.id,podrocje:"Delovne površine",opravilo:"Pranje in razkuževanje",sredstvo:"Razkužilo X",pogostost_dni:1,zacetek:"2020-01-01"});
await D.add("ciscenje_nacrt",{stranka_id:s.id,podrocje:"Hladilnica",opravilo:"Mesečno čiščenje",pogostost_dni:30,zacetek:"2099-01-01"});
await D.add("kemikalije",{stranka_id:s.id,naziv:"Razkužilo X"});return s.id});
const go=async sub=>{await pg.evaluate(s=>sessionStorage.setItem("hsub",s),sub);await pg.goto(B+"/#/stranka/"+sid+"/higiena");await pg.reload();await pg.waitForSelector("#hbody");await pg.waitForTimeout(500)};
// 1) dnevni seznam
await go("danes");await pg.waitForSelector("[data-done]");ok(await pg.locator("[data-done]").count()===1&&/zamuda/.test(await pg.textContent("#hbody")),"dnevni seznam: 1 opravilo v zamudi, mesečno še ni na vrsti");
await pg.click("[data-done]");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(700);ok(await pg.locator("[data-done]").count()===0,"po »Opravljeno« opravilo izgine s seznama");
const ev=await pg.evaluate(async sid=>(await D.list("evidence",{stranka_id:sid})).filter(e=>e.vrsta==="ciscenje"),sid);ok(ev.length===1&&ev[0].nacrt_id&&ev[0].skladno===true,"zapis čiščenja z navezavo na načrt");
// 2) hitri testi in brisi
await go("testi");
for(const [v,place] of [[50,"Rezalnik"],[250,"Rezalnik"],[80,"Rezalnik"]]){await pg.click("[data-n=hitri_test]");await pg.selectOption("#f_tip_testa","ATP (bioluminiscenca)");await pg.fill("#f_mesto",place);await pg.fill("#f_vrednost",String(v));await pg.fill("#f_enota","RLU");await pg.fill("#f_max","100");
 if(v===250) ok((await pg.textContent("#ocena")).includes("ODSTOPANJE"),"ATP 250 > prag 100: živo opozorilo");
 await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(500)}
await pg.click("[data-n=hitri_test]");await pg.selectOption("#f_tip_testa","Alergen (hitri test)");await pg.fill("#f_mesto","Deska");await pg.selectOption("#f_kvalitativno","pozitiven");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(400);
await pg.click("[data-n=bris]");await pg.fill("#f_mesto","Pult");await pg.selectOption("#f_listeria","zaznano");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(500);
await pg.click("[data-n=bris]");await pg.fill("#f_mesto","Nož");await pg.fill("#f_sms","5");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(500);
const txt=await pg.textContent("#hbody");ok(/Listeria ZAZNANA/.test(txt),"bris z Listerijo prikazan");
ok(await pg.locator(".badge.bad:has-text('odstopanje')").count()===3,"3 odstopanja (ATP 250, alergen pozitiven, Listeria)");
ok(await pg.locator(".badge:has-text('brez ocene')").count()>=1,"bris brez mejne vrednosti: brez ocene");
ok(await pg.locator("#gg svg circle").count()===3,"graf ATP s 3 točkami");await pg.screenshot({path:O+"/higiena-testi.png",fullPage:true});
// 3) DDD
await go("ddd");await pg.waitForSelector("#ladd");await pg.click("#ladd");await pg.fill("#f_oznaka","V1");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(500);
await pg.click("[data-n=ddd_obisk]");await pg.fill("#f_izvajalec","DDD Servis");await pg.click("#f_brez_znakov");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(500);
await pg.click("[data-n=skodljivci]");await pg.selectOption("#f_skodljivec","ščurki");await pg.fill("#f_stevilo","3");await pg.click("#dlg-f .btn:last-child");await pg.waitForTimeout(500);
ok(await pg.locator("td:has-text('V1')").count()===1&&/DDD Servis/.test(await pg.textContent("#h_e"))&&await pg.locator("#h_e .badge.bad:has-text('odstopanje')").count()===1,"DDD: vaba, obisk in opažanje (odstopanje)");
// 4) zdravje
await go("zdravje");await pg.click("[data-n=zdravje]");await pg.selectOption("#f_oseba","Ana Novak");await pg.click("#f_simptomi");await pg.click("#dlg-f .btn:last-child");await pg.waitForSelector("td:has-text('SIMPTOMI')");await pg.waitForFunction(()=>!document.getElementById("dlg").open);ok(/SIMPTOMI/.test(await pg.textContent("#hbody"))&&await pg.locator("#hbody tbody .badge.bad:has-text('odstopanje')").count()===1,"zdravstvena izjava s simptomi = odstopanje");
// 5) kemikalije
await go("kemikalije");await pg.waitForSelector("td:has-text('Razkužilo X')");ok(await pg.locator(".badge.warn:has-text('manjka')").count()===1,"kemikalija brez varnostnega lista označena");
// 6) nadzorna plošča + inšpekcija + izvoz
await pg.goto(B+"/#/nadzorna");await pg.waitForSelector(".kpis");await pg.reload();await pg.waitForSelector(".kpis");ok(/opravil čiščenja v zamudi/.test(await pg.textContent("#view")),"KPI čiščenja na nadzorni plošči");
await pg.goto(B+"/#/stranka/"+sid+"/inspekcija");await pg.reload();await pg.waitForSelector("#i_body table");const it=await pg.textContent("#i_body");ok(/Čiščenje po načrtu/.test(it)&&/Brisi in hitri testi/.test(it)&&/DDD obiski/.test(it),"inšpekcija vsebuje higienske vrstice");
await pg.goto(B+"/#/stranka/"+sid+"/navodila");await pg.reload();await pg.waitForSelector("#npred");await pg.click("#npred");await pg.waitForSelector(".pp");ok(await pg.locator(".pp").count()===21,"21 predlog navodil");
console.log("napake",errs);if(errs.length)f++;await br.close();console.log(f?"NEUSPEH":"VSE OK");process.exit(f)})();
