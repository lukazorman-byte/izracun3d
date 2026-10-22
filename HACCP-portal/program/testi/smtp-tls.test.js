// Pošiljanje e-pošte prek šifrirane povezave: SSL (465) in STARTTLS (587) z lažnim strežnikom in samopodpisanim potrdilom.
// Preveri tudi, da se potrdilo preverja (brez zaupanja povezava ne uspe) in da se šifrirano shranjeno geslo pravilno uporabi.
const cp = require("child_process"), path = require("path"), fs = require("fs"), os = require("os"), net = require("net"), tls = require("tls");
const ROOT = path.join(__dirname, ".."), T = fs.mkdtempSync(path.join(os.tmpdir(), "hgsmtp-"));
if (cp.spawnSync("openssl", ["version"]).status !== 0) { console.log("PRESKOČENO: ni openssl"); process.exit(77); }
cp.spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", T + "/k.pem", "-out", T + "/c.pem", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
const key = fs.readFileSync(T + "/k.pem"), cert = fs.readFileSync(T + "/c.pem");
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("NAPAKA:", m); } else console.log("ok:", m); };
const prejeto = [];
function protokol(sock, starttls, onUpgrade) { // minimalni SMTP: EHLO, (STARTTLS), AUTH LOGIN, MAIL, RCPT, DATA
  let buf = "", data = false, auth = 0, rec = { tls: sock instanceof tls.TLSSocket, user: "", pass: "", msg: "" };
  const w = s => sock.write(s + "\r\n");
  sock.on("data", d => { buf += d; let i; while ((i = buf.indexOf("\r\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2);
    if (data) { if (l === ".") { data = false; prejeto.push(rec); w("250 ok"); } else rec.msg += l + "\n"; continue; }
    if (/^EHLO/.test(l)) w(starttls && !rec.tls ? "250-mock\r\n250 STARTTLS" : "250-mock\r\n250 AUTH LOGIN");
    else if (l === "STARTTLS") { w("220 go"); sock.removeAllListeners("data"); const t = new tls.TLSSocket(sock, { isServer: true, key, cert }); protokol(t, false); return; }
    else if (l === "AUTH LOGIN") { auth = 1; w("334 VXNlcm5hbWU6"); }
    else if (auth === 1) { auth = 2; rec.user = Buffer.from(l, "base64").toString(); w("334 UGFzc3dvcmQ6"); }
    else if (auth === 2) { auth = 3; rec.pass = Buffer.from(l, "base64").toString(); w("235 ok"); }
    else if (/^MAIL|^RCPT/.test(l)) w("250 ok"); else if (l === "DATA") { data = true; w("354 go"); } else if (l === "QUIT") { w("221 bye"); sock.end(); } } });
}
const ssl = tls.createServer({ key, cert }, s => { s.write("220 mock\r\n"); protokol(s, false); }).listen(4465);
const st = net.createServer(s => { s.write("220 mock\r\n"); protokol(s, true); }).listen(4587);
let srv; const PORT = 4991, B = "http://127.0.0.1:" + PORT;
const start = env => new Promise((res, rej) => { srv = cp.spawn(process.execPath, [path.join(ROOT, "server.js"), "--tiho"], { env: Object.assign({}, process.env, { PORT: String(PORT), HACCP_DATA: T + "/d", HOST: "127.0.0.1" }, env), stdio: "ignore" }); const t0 = Date.now(); const poll = () => fetch(B + "/api/health").then(() => res(), () => Date.now() - t0 > 10000 ? rej(new Error("ni zagona")) : setTimeout(poll, 150)); poll(); });
const stop = () => new Promise(r => { srv.once("exit", r); srv.kill("SIGTERM"); });
const req = async (m, p, body, ck) => { const r = await fetch(B + p, { method: m, headers: Object.assign({ "Content-Type": "application/json", Origin: B }, ck ? { Cookie: ck } : {}), body: body === undefined ? undefined : JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch {} const sc = r.headers.get("set-cookie"); return { s: r.status, j, ck: sc ? sc.split(";")[0] : null }; };
(async () => {
  await start({ NODE_EXTRA_CA_CERTS: T + "/c.pem" });
  const ck = (await req("POST", "/api/auth/nastavi", { email: "a@t.si", geslo: "dolgogeslo123", ime: "A" })).ck;
  for (const [varnost, vrata] of [["ssl", 4465], ["starttls", 4587]]) {
    ok((await req("PUT", "/api/nastavitve", { streznik: "localhost", vrata, varnost, uporabnik: "posta@t.si", geslo: "Skrito-Geslo-" + varnost, od: "posta@t.si" }, ck)).s === 200, varnost + ": nastavitve");
    const r = await req("POST", "/api/obvestila/test", { komu: "prejemnik@t.si" }, ck);
    const m = prejeto[prejeto.length - 1];
    ok(r.s === 200 && m && m.tls && m.pass === "Skrito-Geslo-" + varnost && /Subject:/.test(m.msg), varnost + ": sporočilo poslano prek TLS, geslo pravilno (" + r.s + (r.j && r.j.napaka ? " " + r.j.napaka : "") + ")");
  }
  await stop(); const n = prejeto.length;
  await start({ NODE_EXTRA_CA_CERTS: "" }); // brez zaupanja v potrdilo
  const ck2 = (await req("POST", "/api/auth/prijava", { email: "a@t.si", geslo: "dolgogeslo123" })).ck;
  const r2 = await req("POST", "/api/obvestila/test", { komu: "prejemnik@t.si" }, ck2);
  ok(r2.s === 502 && prejeto.length === n, "nezaupanja vredno potrdilo je zavrnjeno (" + (r2.j && r2.j.napaka) + ")");
  await stop(); ssl.close(); st.close(); fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? "NEUSPEH" : "VSE OK"); process.exit(fails ? 1 : 0);
})().catch(e => { console.log("IZJEMA", e.message); try { srv.kill(); } catch {} process.exit(2); });
