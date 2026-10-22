// Spremeni Windows .exe iz "konzolnega" v "okenski" program (brez črnega okna). Uporaba: node scripts/pe-gui.js vhod.exe izhod.exe
"use strict";
const fs = require("fs");
const [inp, out] = process.argv.slice(2);
if (!inp || !out) { console.error("Uporaba: node scripts/pe-gui.js vhod.exe izhod.exe"); process.exit(2); }
const b = fs.readFileSync(inp);
if (b.readUInt16LE(0) !== 0x5a4d) throw new Error("To ni .exe (manjka MZ).");
const pe = b.readUInt32LE(0x3c);
if (b.readUInt32LE(pe) !== 0x4550) throw new Error("Manjka PE glava.");
const opt = pe + 24, magic = b.readUInt16LE(opt);
if (magic !== 0x10b && magic !== 0x20b) throw new Error("Neznana PE različica.");
const off = opt + 68, before = b.readUInt16LE(off);
if (before !== 3 && before !== 2) throw new Error("Nepričakovan podsistem: " + before);
b.writeUInt16LE(2, off); // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI
fs.writeFileSync(out, b);
console.log("Podsistem " + before + " -> 2 (brez konzole): " + out);
