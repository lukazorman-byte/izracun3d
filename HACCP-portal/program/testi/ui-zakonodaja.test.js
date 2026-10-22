const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
let f=0;const ok=(c,m)=>{if(!c){f++;console.log("NAPAKA:",m)}else console.log("ok:",m)};
(async()=>{const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});const pg=await (await br.newContext({acceptDownloads:true})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));pg.on("dialog",d=>d.accept());
await pg.goto(B+"/");await pg.fill("#le","a@t.si");await pg.fill("#ln","A");await pg.fill("#lp","dolgogeslo123");await pg.click("#lf button");await pg.waitForSelector("#shell:not([hidden])");
const sid=await pg.evaluate(async()=>{const s=await D.add("stranke",{naziv:"Test"});return s.id});
await pg.goto(B+"/#/stranka/"+sid+"/navodila");await pg.waitForSelector("#npred");await pg.click("#npred");await pg.waitForSelector(".pp");await pg.click("#dlg-f .btn:last-child");
await pg.waitForSelector("td:has-text('skladno z bazo')");ok(true,"navodila skladna z bazo");
// razveljavi 852/2004 v bazi
await pg.evaluate(async()=>{const z=await api("GET","/api/baza/zakonodaja");z.find(x=>x.predpis==="Uredba (ES) št. 852/2004").status="razveljavljen";await api("PUT","/api/baza/zakonodaja",z);_baza=null});
await pg.reload();await pg.waitForSelector("td:has-text('preveri')");ok(await pg.locator("td .badge.warn:has-text('preveri')").count()>5,"opozorilo ob razveljavljenem predpisu");
const t=await pg.evaluate(async()=>{const db=await baza();const n=(await D.list("navodila"))[0];return navodiloOpozorila(n,db).join("|")});ok(/RAZVELJAVLJEN/.test(t),"besedilo opozorila: "+t.slice(0,90));
await pg.goto(B+"/#/nadzorna");await pg.waitForSelector(".kpis");ok(/[1-9]\d*\s*dokumentov za posodobitev/.test((await pg.textContent("#view")).replace(/\s+/g," ")),"nadzorna plošča šteje dokumente za posodobitev");
// PDF navodila vsebuje pravno podlago
await pg.goto(B+"/#/stranka/"+sid+"/navodila");
const txt=await pg.evaluate(async()=>{const db=await baza();const n=(await D.list("navodila"))[0];const b=navodiloPdf(n,{naziv:"Test"},db);return b.size});ok(txt>1000,"PDF navodila se generira");
await pg.evaluate(async()=>{const z=await api("GET","/api/baza/zakonodaja");z.find(x=>x.predpis==="Uredba (ES) št. 852/2004").status="veljaven";await api("PUT","/api/baza/zakonodaja",z)});
console.log("napake",errs);await br.close();console.log(f?"NEUSPEH":"VSE OK");process.exit(f)})();
