const fs = require("fs");
const path = require("path");

// Minimal 16x16 32bpp ICO: header (6) + entry (16) + BMP (40 + 16*16*4)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry[0] = 16;
entry[1] = 16;
entry[2] = 0;
entry[3] = 0;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
const bmpSize = 40 + 16 * 16 * 4;
entry.writeUInt32LE(bmpSize, 8);
entry.writeUInt32LE(22, 12);

const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(16, 4);
dib.writeInt32LE(32, 8);
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);
dib.writeUInt32LE(0, 16);
dib.writeUInt32LE(0, 20);
dib.writeInt32LE(16, 24);
dib.writeInt32LE(16, 28);

const pixels = Buffer.alloc(16 * 16 * 4);
for (let i = 0; i < 16 * 16 * 4; i += 4) {
  pixels[i] = 0x4a;
  pixels[i + 1] = 0x4a;
  pixels[i + 2] = 0x4a;
  pixels[i + 3] = 0xff;
}

const publicDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "favicon.ico"), Buffer.concat([header, entry, dib, pixels]));
console.log("Created public/favicon.ico");
