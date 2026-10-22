// Poišče Playwright (lokalno, globalno ali prek NODE_PATH) in Chromium.
const cp = require("child_process"), fs = require("fs");
let pw;
for (const f of [() => require("playwright"), () => require(cp.execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() + "/playwright")]) { try { pw = f(); break; } catch {} }
if (!pw) { console.log("PRESKOČENO: Playwright ni nameščen (npm i -g playwright)"); process.exit(77); }
const exe = process.env.PW_CHROMIUM || ["/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].find(p => fs.existsSync(p));
module.exports = { chromium: { launch: o => pw.chromium.launch(Object.assign({}, exe ? { executablePath: exe } : {}, o || {})) } };
