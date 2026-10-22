const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
const mock = require("child_process").spawn(process.execPath, [path.join(__dirname, "smtp-mock.js")], { stdio: "ignore" });
process.on("exit", () => { try { mock.kill(); } catch {} });
const O=OUT;let f=0;const ok=(c,m)=>{if(!c){f++;console.log("NAPAKA:",m)}else console.log("ok:",m)};
function client(){let ck="";return async(m,p,b)=>{const r=await fetch(B+p,{method:m,headers:{"Content-Type":"application/json",Cookie:ck,Origin:B},body:b?JSON.stringify(b):undefined});const sc=r.headers.get("set-cookie");if(sc)ck=sc.split(";")[0];let j;try{j=await r.json()}catch{j=null}return{s:r.status,j}}}
(async()=>{const A=client();await A("POST","/api/auth/nastavi",{email:"a@t.si",geslo:"dolgogeslo123",ime:"A"});
const s=(await A("POST","/api/d/stranke",{naziv:"Mail d.o.o."})).j;await A("POST","/api/uporabniki",{email:"o@t.si",geslo:"dolgogeslo123",vloga:"odgovorna",stranka_id:s.id,ime:"O"});
await A("POST","/api/d/ciscenje_nacrt",{stranka_id:s.id,podrocje:"Pult",opravilo:"Razkuževanje",pogostost_dni:1,zacetek:"2020-01-01"});
await A("POST","/api/d/ciscenje_nacrt",{stranka_id:s.id,podrocje:"Hladilnica",opravilo:"Mesečno",pogostost_dni:30,zacetek:"2099-01-01"});
await A("POST","/api/d/kemikalije",{stranka_id:s.id,naziv:"Razkužilo Y",rok_uporabe:new Date(Date.now()+5*864e5).toISOString().slice(0,10)});
await A("PUT","/api/nastavitve",{streznik:"127.0.0.1",vrata:2525,varnost:"brez",uporabnik:"u",geslo:"p",od:"HiGiFood <n@t.si>"});
let r=(await A("POST","/api/obvestila/zdaj")).j;const t=(r.predogled[0]||{}).tekst||[];
ok(r.poslano===1&&t.some(x=>/Čiščenje: Pult/.test(x)),"e-pošta vsebuje zamujeno čiščenje: "+JSON.stringify(t));
ok(!t.some(x=>/Mesečno/.test(x)),"čiščenje, ki še ni na vrsti, ni v sporočilu");
ok(t.some(x=>/Razkužilo Y/.test(x)),"opomnik za potek čistila");
// opravi čiščenje -> izgine iz opomnika
const nac=(await A("GET","/api/d/ciscenje_nacrt?stranka_id="+s.id)).j.find(x=>x.podrocje==="Pult");
await A("POST","/api/d/evidence",{stranka_id:s.id,vrsta:"ciscenje",nacrt_id:nac.id,izvedeno:true,kontrola_ok:true,skladno:true,cas:new Date().toISOString()});
r=(await A("POST","/api/obvestila/zdaj")).j;ok(!(((r.predogled[0]||{}).tekst)||[]).some(x=>/Čiščenje: Pult/.test(x)),"po opravljenem čiščenju opomnika ni več");
// inšpekcija s tlorisom
const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});const pg=await (await br.newContext({acceptDownloads:true})).newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
await pg.goto(B+"/");await pg.fill("#le","a@t.si");await pg.fill("#lp","dolgogeslo123");await pg.click("#lf button");await pg.waitForSelector("#shell:not([hidden])");
await pg.evaluate(async sid=>{await D.add("tlorisi",{stranka_id:sid,naziv:"Tloris testni",sirina_m:8,visina_m:5,elementi:[{id:"a",t:"soba",x:1,y:1,w:4,h:3,ime:"Kuhinja",tip:"kuhinja / priprava"},{id:"b",t:"vaba",x:1.5,y:3.5,oznaka:"V1",vrsta:"vaba za glodavce"}]})},s.id);
await pg.goto(B+"/#/stranka/"+s.id+"/inspekcija");await pg.reload();await pg.waitForSelector("#i_body table");
let [d]=await Promise.all([pg.waitForEvent("download"),pg.click("#i_pdf")]);await d.saveAs(O+"/insp-tloris.pdf");[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#i_doc")]);await d.saveAs(O+"/insp-tloris.docx");
console.log("napake",errs);if(errs.length)f++;await br.close();console.log(f?"NEUSPEH":"VSE OK");process.exit(f)})();
