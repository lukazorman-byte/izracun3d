const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
fs.mkdirSync(TMP+"/kopija-druga",{recursive:true});
const O=OUT;let f=0;const ok=(c,m)=>{if(!c){f++;console.log("NAPAKA:",m)}else console.log("ok:",m)};
(async()=>{const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});const ctx=await br.newContext({acceptDownloads:true,viewport:{width:1300,height:850}});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));pg.on("dialog",d=>d.accept());
await pg.goto(B+"/");await pg.fill("#le","a@t.si");await pg.fill("#ln","A");await pg.fill("#lp","dolgogeslo123");await pg.click("#lf button");await pg.waitForSelector("#shell:not([hidden])");
const ids=await pg.evaluate(async()=>{const t=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)};
const s=await D.add("stranke",{naziv:"Inspekcija d.o.o.",naslov:"Cesta 1",odgovorna_oseba:"Jan"});const o=await D.add("obrati",{stranka_id:s.id,naziv:"Obrat"});
const op=await D.add("oprema",{stranka_id:s.id,obrat_id:o.id,naziv:"Hladilnik A",tip:"hladilnik",meja_min:0,meja_max:4,naslednji_servis:t(-10)});
await D.add("oprema",{stranka_id:s.id,naziv:"Tehtnica",tip:"tehtnica"});
await D.add("osebje",{stranka_id:s.id,ime:"Mojca",higienski_do:t(-5)});
await D.add("evidence",{stranka_id:s.id,vrsta:"temperatura",oprema:"Hladilnik A",vrednost:9,min:0,max:4,skladno:false,status:"vneseno"});
const n=await D.add("nacrti",{stranka_id:s.id,obrat_id:o.id,naziv:"Plan"});
return {sid:s.id,opid:op.id,nid:n.id}});
// --- inšpekcija ---
await pg.goto(B+"/#/stranka/"+ids.sid+"/inspekcija");await pg.waitForSelector("#i_body table");
const txt=await pg.textContent("#i_body");ok(/Potrjenega načrta ni/.test(txt)&&/pretečeno veljavnostjo/.test(txt)&&/1 odstopanj/.test(txt)&&/pretečenim servisom/.test(txt),"kontrolni seznam: zaznane zamude in vrzeli");
let [d]=await Promise.all([pg.waitForEvent("download"),pg.click("#i_pdf")]);await d.saveAs(O+"/insp.pdf");
[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#i_doc")]);await d.saveAs(O+"/insp.docx");
[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#i_xl")]);await d.saveAs(O+"/insp.xlsx");
// --- CAPA s fotografijo ---
await pg.goto(B+"/#/stranka/"+ids.sid+"/capa");await pg.waitForSelector("#ladd");await pg.click("#ladd");await pg.fill("#f_opis","Umazana površina");await pg.setInputFiles("#f__foto",FIX+"/foto.jpg");await pg.click("#dlg-f .btn:last-child");await pg.waitForSelector("td:has-text('Umazana')");
[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#cdoc")]);await d.saveAs(O+"/capa-foto.docx");
[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#cpdf")]);await d.saveAs(O+"/capa-foto.pdf");
// --- tloris v načrtu ---
await pg.goto(B+"/#/carovnik/"+ids.nid);await pg.waitForSelector("#tl_f");await pg.setInputFiles("#tl_f",FIX+"/foto.jpg");await pg.click("#tl_up");await pg.waitForSelector("#tl_st a");await pg.click("#wsave");await pg.waitForSelector(".toast.show:has-text('Shranjeno (')");
await pg.click(".steps button >> nth=6");await pg.waitForSelector("#xpdf");[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#xpdf")]);await d.saveAs(O+"/tloris.pdf");[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#xdoc")]);await d.saveAs(O+"/tloris.docx");
// --- QR ---
await pg.goto(B+"/#/stranka/"+ids.sid+"/oprema");await pg.waitForSelector("a:has-text('QR kode naprav')");await pg.click("a:has-text('QR kode naprav')");await pg.waitForSelector("#qg svg");ok(await pg.locator("#qg svg").count()===2,"2 QR kodi za 2 napravi");await pg.screenshot({path:O+"/qr.png"});
await pg.goto(B+"/#/vnos/"+ids.opid);await pg.waitForSelector("#f_oprema");ok((await pg.inputValue("#f_oprema"))==="Hladilnik A"&&(await pg.inputValue("#f_max"))==="4","vnos po skeniranju: naprava in meje prednastavljene");
await pg.fill("#f_vrednost","3");await pg.click("#dlg-f .btn:last-child");await pg.waitForSelector("#vl td:has-text('3 °C')");ok(true,"zapis shranjen prek QR strani");
// --- admin: kopija ---
await pg.goto(B+"/#/admin");await pg.waitForSelector("#k_m");await pg.fill("#k_m",TMP+"/kopija-druga");await pg.click("#k_s");await pg.waitForSelector("text=Zadnja kopija na drugo mesto");ok(require("fs").readdirSync(TMP+"/kopija-druga").some(x=>/^kopija-.*\.zip$/.test(x)),"kopija v drugi mapi");
console.log("napake",errs);if(errs.length)f++;await br.close();console.log(f?"NEUSPEH":"VSE OK");process.exit(f)})();
