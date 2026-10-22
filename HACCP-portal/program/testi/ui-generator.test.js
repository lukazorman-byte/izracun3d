const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
// regresija: generator (/generator/ po prijavi), urejevalnik baze, docx izvoz
let f=0;const ok=(c,m)=>{if(!c){f++;console.log("NAPAKA:",m)}else console.log("ok:",m)};
(async()=>{const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});const ctx=await br.newContext({acceptDownloads:true});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
// brez prijave -> preusmeritev
await fetch(B+"/api/auth/nastavi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@test.si",geslo:"dolgogeslo123",ime:"Admin"})});await pg.goto(B+"/generator/");await pg.waitForURL(B+"/");ok(true,"generator brez prijave preusmeri na prijavo");
await pg.waitForSelector("#lf");await pg.fill("#le","admin@test.si");await pg.fill("#lp","dolgogeslo123");await pg.click("#lf button");await pg.waitForSelector("#shell:not([hidden])");
await pg.goto(B+"/generator/");await pg.waitForFunction(()=>/branž/.test(document.getElementById("dbstat").textContent));ok(true,"generator naloži bazo po prijavi");
const r={};for(const t of ["haccp","objekt","presoje"]){await pg.click(`.tab[data-tab="${t}"]`);await pg.click("#gen");r[t]=await pg.locator("#out-"+t+" h2").count();}
ok(r.haccp>5&&r.objekt>5&&r.presoje>3,"3 zavihki generirajo: "+JSON.stringify(r));
await pg.click('.tab[data-tab="haccp"]');const [d]=await Promise.all([pg.waitForEvent("download"),pg.click("text=Prenesi Word (.docx")]);await d.saveAs(OUT+"/gen.docx");ok(true,"docx prenos");
const g=await pg.evaluate(async()=>{const x=await (await fetch("/api/baza")).json();return Object.keys(x)});ok(g.includes("navodila_predloge")&&g.includes("zakonodaja"),"baza zbirke: "+g.length);
await pg.goto(B+"/baza/");await pg.waitForSelector("nav button");const n=await pg.locator("nav button").count();ok(n>=13,"urejevalnik baze: "+n+" zbirk");
await pg.click("nav button:has-text('Predloge navodil')");await pg.waitForSelector("#tbl tr");ok(true,"predloge navodil v urejevalniku");
console.log("napake",errs);if(errs.length)f++;await br.close();console.log(f?"NEUSPEH":"VSE OK");process.exit(f?1:0)})();
