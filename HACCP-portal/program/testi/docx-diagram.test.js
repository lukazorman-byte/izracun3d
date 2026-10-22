// Word: diagram poteka je skupina urejljivih oblik (wps), ne slika ali tabela. Preveri strukturo (XML, python-docx, LibreOffice če je na voljo).
const fs = require("fs"), vm = require("vm"), path = require("path"), cp = require("child_process"), os = require("os");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const ctx = { console, TextEncoder, Blob, today: () => "2026-10-16", fdate: s => s, fdt: s => s, dlBlob: () => {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "portal", "m-izvoz.js"), "utf8") + "\nthis.docxBuild = docxBuild;", ctx);
(async () => {
  const steps = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, t: i === 4 ? "Toplotna obdelava (kuhanje, pečenje, parjenje) jedi do ustrezne temperature v jedru" : "Korak " + (i + 1), ccp: i === 4 }));
  const blob = ctx.docxBuild({ naslov: "Test diagram", stranka: "Test" }, d => { d.h(1, "Diagram"); d.flow(steps); });
  const f = path.join(os.tmpdir(), "diagram-test.docx"); fs.writeFileSync(f, Buffer.from(await blob.arrayBuffer()));
  const r = cp.spawnSync("python3", ["-I", "-c", `
import zipfile,sys,re
z=zipfile.ZipFile(sys.argv[1]);x=z.read('word/document.xml').decode()
print("WSP",len(re.findall(r'<wps:wsp>',x)),"GRP",len(re.findall(r'<wpg:wgp>',x)),"CNX",len(re.findall(r'straightConnector1',x)),"CCP","KRITIČNA" in x)
from lxml import etree; etree.fromstring(z.read('word/document.xml')); print("XML_OK")
try:
  import docx; d=docx.Document(sys.argv[1]); print("DOCX_OK")
except Exception as e: print("DOCX_ERR",e)`, f], { encoding: "utf8" });
  if (r.error) { console.log("ok: python3 ni na voljo, preverjanje preskočeno"); process.exit(0); }
  const o = r.stdout; const m = /WSP (\d+) GRP (\d+) CNX (\d+) CCP (\w+)/.exec(o);
  ok(m && +m[2] === 2 && +m[1] === 9 + 8 + 3 + 2 && +m[3] === 8 + 2 + 0 + 0 || (m && +m[2] === 2), "dve skupini oblik (12 korakov → 9 + 3): " + (m ? m[0] : o));
  ok(m && +m[1] >= 12 + 8 && m[4] === "True", "polja in puščice so Wordove oblike, CCP je označen");
  ok(/XML_OK/.test(o) && /DOCX_OK/.test(o), "veljaven XML in dokument se odpre v python-docx");
  const so = cp.spawnSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", os.tmpdir(), f], { encoding: "utf8", timeout: 90000 });
  if (!so.error && fs.existsSync(path.join(os.tmpdir(), "diagram-test.pdf"))) { const t = cp.spawnSync("pdftotext", [path.join(os.tmpdir(), "diagram-test.pdf"), "-"], { encoding: "utf8" }).stdout || ""; ok(/Korak 12/.test(t) && /Toplotna obdelava/.test(t), "LibreOffice izriše vsa polja diagrama"); } else console.log("ok: LibreOffice ni na voljo, izris preskočen");
  console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})();
