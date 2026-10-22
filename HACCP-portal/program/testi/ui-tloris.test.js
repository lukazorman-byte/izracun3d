const path = require("path"), fs = require("fs");
const B = process.env.BASE || process.argv[2] || "http://127.0.0.1:3999", OUT = process.env.OUT || path.join(require("os").tmpdir(), "haccp-testi-out"), TMP = process.env.TMP || require("os").tmpdir(), FIX = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("./pw.js");
const O=OUT;let f=0;const ok=(c,m)=>{if(!c){f++;console.log("NAPAKA:",m)}else console.log("ok:",m)};
(async()=>{const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});const ctx=await br.newContext({acceptDownloads:true,viewport:{width:1300,height:900}});const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));pg.on("dialog",d=>d.accept());
await pg.goto(B+"/");await pg.fill("#le","a@t.si");await pg.fill("#ln","A");await pg.fill("#lp","dolgogeslo123");await pg.click("#lf button");await pg.waitForSelector("#shell:not([hidden])");
const ids=await pg.evaluate(async()=>{const s=await D.add("stranke",{naziv:"Tloris d.o.o."});const o=await D.add("obrati",{stranka_id:s.id,naziv:"Kuhinja"});await D.add("oprema",{stranka_id:s.id,naziv:"Hladilnik 1",tip:"hladilnik"});await D.add("vabe",{stranka_id:s.id,oznaka:"V1",vrsta:"vaba za glodavce"});await D.add("vabe",{stranka_id:s.id,oznaka:"V2",vrsta:"svetlobna past (UV)"});const n=await D.add("nacrti",{stranka_id:s.id,obrat_id:o.id,naziv:"Plan"});return {sid:s.id,nid:n.id}});
await pg.goto(B+"/#/stranka/"+ids.sid+"/tloris");await pg.waitForSelector("#ladd");await pg.click("#ladd");await pg.fill("#tn","Tloris kuhinje");await pg.selectOption("#f_obrat_id",{index:1});await pg.click("#dlg-f .btn:last-child");await pg.waitForSelector("#tc svg");ok(true,"nov tloris ustvarjen, urejevalnik odprt");
const box=await pg.locator("#tc svg").boundingBox();const px=(mx,my)=>[box.x+mx/12*box.width,box.y+my/8*box.height];
const drag=async(a,b)=>{const [x1,y1]=px(...a),[x2,y2]=px(...b);await pg.mouse.move(x1,y1);await pg.mouse.down();await pg.mouse.move((x1+x2)/2,(y1+y2)/2);await pg.mouse.move(x2,y2);await pg.mouse.up()};
const n=async()=>pg.evaluate(()=>0);
// soba
await pg.click("[data-tool=soba]");await drag([1,1],[6,5]);ok(await pg.locator("#tc svg rect[stroke='#2f6f4f'][stroke-width='2.5']").count()===1,"soba narisana");
await pg.fill("[data-p=ime]","Kuhinja");await pg.selectOption("[data-p=tip]","kuhinja / priprava");ok(await pg.locator("#tc svg text:has-text('Kuhinja')").count()>=1,"lastnosti: ime sobe");
// druga soba
await pg.click("[data-tool=soba]");await drag([6,1],[11,5]);await pg.fill("[data-p=ime]","Skladišče");await pg.selectOption("[data-p=tip]","hladno skladišče");
// stena
await pg.click("[data-tool=stena]");await drag([1,6],[11,6]);
// vrata
await pg.click("[data-tool=vrata]");{const [x,y]=px(6,3);await pg.mouse.click(x,y)}
// oprema
await pg.selectOption("#tvo","hladilnik");await pg.click("[data-tool=oprema]");{const [x,y]=px(2,1.5);await pg.mouse.click(x,y)}await pg.selectOption("[data-p=ime]",{label:"Hladilnik 1"});
// vabe iz registra (prosta oznaka)
await pg.click("[data-tool=vaba]");{const [x,y]=px(1.5,5.5);await pg.mouse.click(x,y)}
await pg.click("[data-tool=vaba]");{const [x,y]=px(10.5,5.5);await pg.mouse.click(x,y)}
ok(await pg.locator("#tc svg text:has-text('V1')").count()===1&&await pg.locator("#tc svg text:has-text('V2')").count()===1,"vabi dobita oznaki iz registra (V1, V2)");
ok(/Vse vabe iz registra so na tlorisu/.test(await pg.textContent("#tdd")),"DDD: vse vabe so na tlorisu");
// pot
await pg.selectOption("#tvp","nečista pot");await pg.click("[data-tool=pot]");for(const [a,b] of [[2,3],[5,3],[5,4.5]]){const [x,y]=px(a,b);await pg.mouse.click(x,y)}{const [x,y]=px(5,4.5);await pg.mouse.dblclick(x,y)}
ok(await pg.locator("#tc svg polyline[stroke='#b3261e']").count()===1,"pot narisana (nečista pot)");
const c=async l=>console.log("EL",l,await pg.locator("#tc svg [data-id]").count(),await pg.locator("#tc svg polyline").count());await c("po poti");
// premik sobe
await pg.click("[data-tool=izberi]");const before=await pg.locator("#tc svg rect[stroke-width='2.5']").first().getAttribute("x");await drag([3.2,4.5],[3.2,4.5]);
await c("po premiku");
// besedilo
await pg.click("[data-tool=besedilo]");{const [x,y]=px(1,7.5);await pg.mouse.click(x,y)}await pg.fill("[data-p=text]","Vhod osebje");
await pg.click("#tc svg text:has-text('Vhod osebje')");await c("po besedilu");
// brisanje + razveljavi
const cnt=await pg.locator("#tc svg [data-id]").count();await pg.keyboard.press("Delete");ok(await pg.locator("#tc svg [data-id]").count()===cnt-1,"Del izbriše izbrani element");await c("po Del");await pg.click("#tu");await c("po undo");ok(await pg.locator("#tc svg [data-id]").count()===cnt,"razveljavi vrne element");
await pg.click("#ts");await pg.waitForSelector(".toast.show:has-text('shranjen')");
const saved=await pg.evaluate(async()=>(await D.list("tlorisi"))[0]);console.log("TIPI",saved.elementi.map(e=>e.t).join(","));ok(saved.elementi.length>=7&&saved.verzija>=2,"shranjeno na strežnik: "+saved.elementi.length+" elementov, različica "+saved.verzija);
await pg.screenshot({path:O+"/tloris-urejevalnik.png"});
// ponovno odpri
await pg.reload();await pg.waitForSelector("#tc svg");ok(await pg.locator("#tc svg [data-id]").count()===saved.elementi.length,"po ponovnem odprtju je vse na mestu");
// izvoz PNG/SVG
await pg.click("#te");let [d]=await Promise.all([pg.waitForEvent("download"),pg.click("#dlg-f .btn:has-text('PNG')")]);await d.saveAs(O+"/tloris.png");
// v HACCP dokumentaciji
await pg.goto(B+"/#/carovnik/"+ids.nid);await pg.waitForSelector("#tl_sel");await pg.selectOption("#tl_sel",{index:1});await pg.click("#wsave");await pg.waitForSelector(".toast.show:has-text('Shranjeno (')");
await pg.click(".steps button >> nth=6");await pg.waitForSelector("#xpdf");[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#xpdf")]);await d.saveAs(O+"/tloris-haccp.pdf");[d]=await Promise.all([pg.waitForEvent("download"),pg.click("#xdoc")]);await d.saveAs(O+"/tloris-haccp.docx");
console.log("napake",errs);if(errs.length)f++;await br.close();console.log(f?"NEUSPEH":"VSE OK");process.exit(f)})();
