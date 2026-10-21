/**
 * Genera las ilustraciones SVG del catálogo (public/assets/jy).
 * Son imágenes vectoriales ligeras que funcionan como placeholder elegante
 * hasta que la mamá suba las fotos reales desde el portal.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/assets/jy');

mkdirSync(OUT_DIR, { recursive: true });

const BRAND = ['#d946ef', '#8b5cf6'];
const GOLD = '#fbbf24';

function soapSvg({ bg1, bg2, label, emoji, accent }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <rect width="600" height="600" fill="url(#glow)"/>
  <circle cx="300" cy="270" r="150" fill="url(#bar)"/>
  <g transform="translate(300 250)">
    <rect x="-118" y="-118" width="236" height="236" rx="56" fill="#ffffff" opacity="0.92"/>
    <rect x="-118" y="-118" width="236" height="236" rx="56" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="6"/>
    <text x="0" y="-6" font-size="104" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </g>
  <rect x="120" y="418" width="360" height="4" rx="2" fill="#ffffff" opacity="0.5"/>
  <text x="300" y="472" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="300" y="512" font-family="Helvetica, Arial, sans-serif" font-size="20" letter-spacing="4" fill="#ffffff" fill-opacity="0.72" text-anchor="middle">JY VELAS Y JABONES</text>
</svg>
`;
}

function candleSvg({ bg1, bg2, label, emoji, accent }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="#fff7d6"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <rect width="600" height="600" fill="url(#glow)"/>
  <g transform="translate(300 300)">
    <path d="M0 -210 C 34 -170, 44 -134, 44 -104 C 44 -70, 24 -46, 0 -46 C -24 -46, -44 -70, -44 -104 C -44 -134, -34 -170, 0 -210 Z" fill="url(#flame)"/>
    <path d="M0 -166 C 18 -142, 24 -122, 24 -104 C 24 -86, 13 -72, 0 -72 C -13 -72, -24 -86, -24 -104 C -24 -122, -18 -142, 0 -166 Z" fill="#fff8e2"/>
    <rect x="-8" y="-48" width="16" height="40" rx="6" fill="#f3e8d5"/>
    <rect x="-86" y="-10" width="172" height="196" rx="26" fill="url(#wax)"/>
    <rect x="-86" y="-10" width="172" height="196" rx="26" fill="none" stroke="${accent}" stroke-opacity="0.4" stroke-width="6"/>
    <text x="0" y="86" font-size="72" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </g>
  <text x="300" y="500" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="300" y="538" font-family="Helvetica, Arial, sans-serif" font-size="20" letter-spacing="4" fill="#ffffff" fill-opacity="0.72" text-anchor="middle">JY VELAS Y JABONES</text>
</svg>
`;
}

function setSvg({ bg1, bg2, label }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <linearGradient id="box" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#f3e8ff" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD}"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="280" r="168" fill="#ffffff" opacity="0.14"/>
  <g transform="translate(300 270)">
    <rect x="-170" y="-96" width="340" height="220" rx="20" fill="url(#box)"/>
    <rect x="-170" y="-96" width="340" height="52" rx="20" fill="#ffffff" opacity="0.6"/>
    <rect x="-26" y="-96" width="52" height="220" fill="url(#ribbon)" opacity="0.9"/>
    <path d="M0 -96 C -60 -150, -130 -140, -126 -100 C -122 -66, -46 -84, 0 -96 Z" fill="url(#ribbon)"/>
    <path d="M0 -96 C 60 -150, 130 -140, 126 -100 C 122 -66, 46 -84, 0 -96 Z" fill="url(#ribbon)"/>
    <text x="88" y="34" font-size="82" text-anchor="middle" dominant-baseline="middle">🎁</text>
  </g>
  <text x="300" y="470" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="300" y="510" font-family="Helvetica, Arial, sans-serif" font-size="20" letter-spacing="4" fill="#ffffff" fill-opacity="0.72" text-anchor="middle">JY VELAS Y JABONES</text>
</svg>
`;
}

const products = [
  ['jabon-rosa-amarilla', soapSvg({ bg1: '#f59e0b', bg2: '#ec4899', label: 'Rosa Amarilla', emoji: '🌹', accent: '#fbbf24' })],
  ['jabon-rosa-blanca', soapSvg({ bg1: '#f472b6', bg2: '#a78bfa', label: 'Rosa Blanca', emoji: '🌸', accent: '#fbcfe8' })],
  ['jabon-huella', soapSvg({ bg1: '#38bdf8', bg2: '#818cf8', label: 'Huella', emoji: '🐾', accent: '#38bdf8' })],
  ['vela-rosa-decorativa', candleSvg({ bg1: '#ec4899', bg2: '#8b5cf6', label: 'Vela Rosa', emoji: '🌷', accent: '#fbcfe8' })],
  ['jabon-uvas', soapSvg({ bg1: '#7c3aed', bg2: '#4c1d95', label: 'Uvas', emoji: '🍇', accent: '#c4b5fd' })],
  ['jabon-fresa-azul', soapSvg({ bg1: '#2563eb', bg2: '#db2777', label: 'Fresa Azul', emoji: '🍓', accent: '#93c5fd' })],
  ['vela-girasol', candleSvg({ bg1: '#f59e0b', bg2: '#ea580c', label: 'Vela Girasol', emoji: '🌻', accent: '#fde68a' })],
  ['jabon-masaje', soapSvg({ bg1: '#0d9488', bg2: '#065f46', label: 'Masaje', emoji: '💆', accent: '#5eead4' })],
  ['jabon-verde', soapSvg({ bg1: '#16a34a', bg2: '#166534', label: 'Verde', emoji: '🌿', accent: '#86efac' })],
  ['set-premium', setSvg({ bg1: '#d946ef', bg2: '#7c3aed', label: 'Set Premium' })],
  ['jabon-azul-marino', soapSvg({ bg1: '#1e40af', bg2: '#0c1a4a', label: 'Azul Marino', emoji: '🌊', accent: '#93c5fd' })],
  ['jabon-ambar', soapSvg({ bg1: '#b45309', bg2: '#78350f', label: 'Ámbar', emoji: '🍯', accent: '#fcd34d' })]
];

for (const [name, svg] of products) {
  writeFileSync(resolve(OUT_DIR, `${name}.svg`), svg, 'utf8');
}

// --- Piezas de marca -------------------------------------------------------
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="JY Velas y Jabones">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d946ef"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="48" fill="url(#lg)"/>
  <text x="100" y="96" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700" fill="#ffffff" text-anchor="middle">JY</text>
  <text x="100" y="136" font-family="Helvetica, Arial, sans-serif" font-size="19" letter-spacing="3" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">VELAS</text>
  <text x="100" y="162" font-family="Helvetica, Arial, sans-serif" font-size="19" letter-spacing="3" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">Y JABONES</text>
</svg>
`;
writeFileSync(resolve(OUT_DIR, 'logo.svg'), logo, 'utf8');

const hero1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="Colección artesanal JY">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a0f3d"/>
      <stop offset="55%" stop-color="#d946ef"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <radialGradient id="g" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#g)"/>
  <g transform="translate(400 330)">
    <rect x="-90" y="-150" width="180" height="300" rx="44" fill="#ffffff" opacity="0.93"/>
    <text x="0" y="10" font-size="110" text-anchor="middle" dominant-baseline="middle">🕯️</text>
    <rect x="-190" y="-40" width="150" height="150" rx="38" fill="#ffffff" opacity="0.8"/>
    <text x="-115" y="38" font-size="76" text-anchor="middle" dominant-baseline="middle">🧼</text>
    <rect x="40" y="10" width="150" height="150" rx="38" fill="#ffffff" opacity="0.85"/>
    <text x="115" y="88" font-size="76" text-anchor="middle" dominant-baseline="middle">🌹</text>
  </g>
  <text x="400" y="640" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle">JY Velas y Jabones</text>
  <text x="400" y="686" font-family="Helvetica, Arial, sans-serif" font-size="24" letter-spacing="6" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">HECHO A MANO EN NEIVA</text>
</svg>
`;
writeFileSync(resolve(OUT_DIR, 'hero-1.svg'), hero1, 'utf8');

const hero2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="Vela artesanal">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="280" r="170" fill="#ffffff" opacity="0.18"/>
  <g transform="translate(300 290)">
    <path d="M0 -190 C 30 -154, 40 -122, 40 -94 C 40 -64, 22 -42, 0 -42 C -22 -42, -40 -64, -40 -94 C -40 -122, -30 -154, 0 -190 Z" fill="#fff7d6"/>
    <rect x="-7" y="-44" width="14" height="36" rx="5" fill="#f3e8d5"/>
    <rect x="-78" y="-10" width="156" height="180" rx="24" fill="#ffffff" opacity="0.93"/>
    <text x="0" y="78" font-size="66" text-anchor="middle" dominant-baseline="middle">🌻</text>
  </g>
  <text x="300" y="510" font-family="Georgia, 'Times New Roman', serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle">Velas Artesanales</text>
</svg>
`;
writeFileSync(resolve(OUT_DIR, 'hero-2.svg'), hero2, 'utf8');

const coleccion = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img" aria-label="Colección artesanal">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0a1a"/>
      <stop offset="100%" stop-color="#3b1d5e"/>
    </linearGradient>
    <radialGradient id="g" cx="30%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#d946ef" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#d946ef" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="url(#g)"/>
  <g transform="translate(400 300)">
    <circle cx="-170" cy="10" r="86" fill="#ffffff" opacity="0.85"/>
    <text x="-170" y="16" font-size="70" text-anchor="middle" dominant-baseline="middle">🧼</text>
    <circle cx="0" cy="-40" r="96" fill="#ffffff" opacity="0.92"/>
    <text x="0" y="-34" font-size="78" text-anchor="middle" dominant-baseline="middle">🕯️</text>
    <circle cx="170" cy="10" r="86" fill="#ffffff" opacity="0.85"/>
    <text x="170" y="16" font-size="70" text-anchor="middle" dominant-baseline="middle">🌹</text>
  </g>
  <text x="400" y="520" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">Nuestra Colección</text>
</svg>
`;
writeFileSync(resolve(OUT_DIR, 'coleccion-artesanal.svg'), coleccion, 'utf8');

console.log(`Generadas ${products.length + 4} imágenes SVG en ${OUT_DIR}`);
