// QR kodirnik: v node izdela matrike; če je na voljo python3 + opencv, jih tudi dekodira.
const fs = require("fs"), vm = require("vm"), path = require("path"), cp = require("child_process"), os = require("os");
const src = fs.readFileSync(path.join(__dirname, "..", "portal", "m-qr.js"), "utf8");
const ctx = { TextEncoder }; vm.createContext(ctx); vm.runInContext(src.slice(0, src.indexOf("const vrstaVnosa")) + "\nthis.QR=QR;", ctx);
const mk = n => ("http://192.168.1.20:3000/#/vnos/" + "AbCdEfGhIjKl_-123456789xyzČšž".repeat(10)).slice(0, n);
const out = []; for (const n of [5, 20, 41, 60, 100, 140, 190, 230]) for (const e of ["L", "M"]) out.push({ t: mk(n), e, m: ctx.QR.encode(mk(n), e).map(r => r.map(c => c ? 1 : 0)) });
console.log("ok: izdelanih QR matrik: " + out.length);
const tmp = path.join(os.tmpdir(), "qr-test.json"); fs.writeFileSync(tmp, JSON.stringify(out));
const py = `import json,sys\ntry:\n import cv2,numpy as np\nexcept Exception:\n print("SKIP"); sys.exit(0)\nd=json.load(open(sys.argv[1]));dets=[cv2.QRCodeDetector(),cv2.QRCodeDetectorAruco()];bad=0\nfor o in d:\n m=np.array(o['m'],dtype=np.uint8);n=len(m);q=4;good=False\n for s in (6,10,14):\n  img=np.full(((n+2*q)*s,(n+2*q)*s),255,np.uint8)\n  for y in range(n):\n   for x in range(n):\n    if m[y][x]: img[(y+q)*s:(y+q+1)*s,(x+q)*s:(x+q+1)*s]=0\n  for dt in dets:\n   v,_,_=dt.detectAndDecode(img);good=good or v==o['t']\n bad+=not good\nprint("BAD",bad)`;
const r = cp.spawnSync("python3", ["-c", py, tmp], { encoding: "utf8" });
if (/SKIP/.test(r.stdout || "") || r.error) console.log("ok: dekodiranje preskočeno (ni python3/opencv)"); else if (/BAD 0/.test(r.stdout)) console.log("ok: vseh " + out.length + " kod se pravilno dekodira"); else { console.log("NAPAKA: QR dekodiranje: " + r.stdout + r.stderr); process.exit(1); }
console.log("VSE OK");
