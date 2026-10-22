// Zaganjalnik testov: za vsak test zažene čist strežnik v začasni mapi (HACCP_DATA), požene test in ga ustavi.
// Uporaba: npm test            (vsi)     |   node testi/run.js api ui-higiena   (izbrani)
const cp = require("child_process"), fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, ".."), files = fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort();
const want = process.argv.slice(2), sel = want.length ? files.filter(f => want.some(w => f.includes(w))) : files;
const wait = (port, n = 60) => new Promise((ok, no) => { const t = () => http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 500 }, r => { r.resume(); ok(); }).on("error", () => n-- > 0 ? setTimeout(t, 200) : no(new Error("strežnik se ni zagnal"))); t(); });
(async () => {
  let fail = 0, skip = 0, pass = 0; const rez = [];
  for (let i = 0; i < sel.length; i++) {
    const f = sel[i], port = 4100 + i, tmp = fs.mkdtempSync(path.join(os.tmpdir(), "haccp-test-"));
    const srv = cp.spawn(process.execPath, [path.join(ROOT, "server.js"), "--tiho"], { env: Object.assign({}, process.env, f.includes("testni") ? { HACCP_TEST: "1" } : {}, { HACCP_RASFF_URL: "http://127.0.0.1:4951/rasff", PORT: String(port), HACCP_DATA: tmp, HOST: "127.0.0.1" }), stdio: "ignore" });
    let code = 1, log = "";
    try {
      await wait(port);
      const r = cp.spawnSync(process.execPath, [path.join(__dirname, f)], { env: Object.assign({}, process.env, { BASE: "http://127.0.0.1:" + port, OUT: path.join(tmp, "izhod"), TMP: tmp }), encoding: "utf8", timeout: 300000 });
      code = r.status; log = (r.stdout || "") + (r.stderr || "");
    } catch (e) { log = String(e.message); }
    srv.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    const st = code === 0 ? "OK" : code === 77 ? "PRESKOČENO" : "NEUSPEH";
    console.log(st.padEnd(11) + f); if (code === 0) pass++; else if (code === 77) skip++; else { fail++; console.log(log.split("\n").filter(l => !/^ok:/.test(l)).join("\n")); }
  }
  console.log(`\nUspešnih: ${pass}, preskočenih: ${skip}, neuspešnih: ${fail}`); process.exit(fail ? 1 : 0);
})();
