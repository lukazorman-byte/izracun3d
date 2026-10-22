// Preverjanje kode brez dodatnih paketov (npm run lint): sintaksa vseh JS datotek in vgrajenih skript,
// veljavnost JSON datotek baze, prepovedani ostanki (debugger, console.log v portalu). Izhod 1 ob napaki.
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."); let napake = 0, opozorila = 0;
const napaka = m => { napake++; console.log("NAPAKA  " + m); }, opozori = m => { opozorila++; console.log("opozorilo " + m); };
const js = d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith(".js")).map(f => path.join(d, f));
const datoteke = ["server.js", "platform.js", "build.js", ...js("portal"), ...js("testi"), ...js("scripts")];
for (const f of datoteke) {
  const r = cp.spawnSync(process.execPath, ["--check", path.join(ROOT, f)], { encoding: "utf8" });
  if (r.status !== 0) napaka(f + ": " + (r.stderr.split("\n").find(l => /Error/.test(l)) || "sintaksa"));
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (/^\s*debugger\b/m.test(src)) napaka(f + ": ostal je 'debugger'");
  if (f.startsWith("portal") && /console\.log\(/.test(src)) opozori(f + ": console.log v portalu");
}
for (const f of ["app/index.html", "baza-admin/index.html", "portal/index.html"]) {
  const s = fs.readFileSync(path.join(ROOT, f), "utf8"); let i = 0;
  for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) { i++; try { new Function(m[1]); } catch (e) { napaka(f + " (skripta " + i + "): " + e.message); } }
}
for (const d of ["baza", "posodobitve"]) for (const f of fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith(".json") && !f.startsWith("_"))) {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, d, f), "utf8")); } catch (e) { napaka(d + "/" + f + ": neveljaven JSON (" + e.message + ")"); }
}
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
if (Object.keys(pkg.dependencies || {}).length) opozori("package.json ima odvisnosti; strežnik naj ostane brez njih");
console.log(`\nPregledanih datotek: ${datoteke.length + 3}, napak: ${napake}, opozoril: ${opozorila}`);
process.exit(napake ? 1 : 0);
