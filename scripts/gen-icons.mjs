import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Emblema do wonderblue: escudo fosco com traço ciano e a barra teal — o mesmo
// do favicon, em alta resolução. Fundo cheio (#05070d) para os ícones ficarem
// opacos (iOS/maskable não gostam de transparência).
const shield = (extra = "") => `
  <path d="M256 48 80 120v131.2C80 352 155.2 427.2 256 464c100.8-36.8 176-112 176-212.8V120z"
        fill="#0b1a26" stroke="#38bdf8" stroke-width="32" stroke-linejoin="round" ${extra}/>
  <path d="M256 168v176" stroke="#5eead4" stroke-width="35" stroke-linecap="round"/>`;

const base = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#05070d"/>${inner}</svg>`;

// normal: escudo cheio
const svgAny = base(shield());
// maskable: escudo recuado para caber na zona segura (círculo de 80%)
const svgMask = base(`<g transform="translate(256,256) scale(0.8) translate(-256,-256)">${shield()}</g>`);

async function png(svg, size, out) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}

await png(svgAny, 192, "public/icon-192.png");
await png(svgAny, 512, "public/icon-512.png");
await png(svgMask, 512, "public/icon-maskable-512.png");
await png(svgAny, 180, "public/apple-touch-icon.png");
