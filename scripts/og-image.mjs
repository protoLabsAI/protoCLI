#!/usr/bin/env node
// Generates the marketing OG/social-card image (1200×630) from the proto ASCII
// logo + tagline, on the brand-dark ground with the lavender→indigo gradient.
// Run: node scripts/og-image.mjs   (uses sharp from sites/marketing/node_modules)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(
  new URL("../sites/marketing/package.json", import.meta.url),
);
const sharp = require("sharp");

const W = 1200;
const H = 630;
const FONT = 30; // ascii art font-size
const LINE = 34; // line height
const CHARW = FONT * 0.6; // monospace advance width

const TAGLINE = "A multi-model AI agent for the terminal";

const art = readFileSync(
  new URL("../sites/marketing/src/proto-logo.txt", import.meta.url),
  "utf8",
)
  .replace(/\n+$/, "")
  .split("\n");

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const maxLen = Math.max(...art.map((l) => l.length));
const artW = maxLen * CHARW;
const x0 = Math.round((W - artW) / 2);
const artTop = 180;

const tspans = art
  .map(
    (l, i) =>
      `<tspan x="${x0}" dy="${i === 0 ? 0 : LINE}" xml:space="preserve">${esc(l)}</tspan>`,
  )
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9b87f2"/>
      <stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="62%">
      <stop offset="0" stop-color="#6366f1" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0a0c"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="none" stroke="#26262c" stroke-width="2"/>
  <text x="${x0}" y="${artTop}" text-anchor="start" font-family="ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace" font-size="${FONT}" font-weight="700" fill="url(#brand)">${tspans}</text>
  <text x="${W / 2}" y="${H - 150}" text-anchor="middle" font-family="Geist, -apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="42" font-weight="600" fill="#ededed">${esc(TAGLINE)}</text>
  <text x="${W / 2}" y="${H - 92}" text-anchor="middle" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" font-size="22" fill="#8a8a93">cli.protolabs.studio</text>
</svg>`;

const out = new URL(
  "../sites/marketing/public/og-protocli.png",
  import.meta.url,
);

await sharp(Buffer.from(svg)).png().toFile(out.pathname);
console.log(`wrote ${out.pathname} (${W}x${H})`);
