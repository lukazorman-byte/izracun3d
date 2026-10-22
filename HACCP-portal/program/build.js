// Sestavi samostojno datoteko dist/haccp-aplikacija.html (aplikacija + vgrajena kopija baze).
// Zagon: node build.js
const fs = require("fs"), path = require("path");
const dir = __dirname, db = {};
for (const f of fs.readdirSync(path.join(dir, "baza")).filter(f => f.endsWith(".json") && !f.startsWith("_")))
  db[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, "baza", f), "utf8"));
let html = fs.readFileSync(path.join(dir, "app", "index.html"), "utf8");
const data = JSON.stringify(db).replace(/</g, "\\u003c");
html = html.replace("<script>", `<script>window.__BAZA__=${data};</script>\n<script>`);
html = html.replace(/<a href="\/baza\/"[^>]*>Uredi bazo<\/a>/, "");
fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
fs.writeFileSync(path.join(dir, "dist", "haccp-aplikacija.html"), html);
console.log("Ustvarjeno: dist/haccp-aplikacija.html (" + Math.round(html.length / 1024) + " kB)");
