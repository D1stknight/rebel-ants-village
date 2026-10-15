import fs from 'fs';
import { createRequire } from 'module'; const sharp = createRequire(import.meta.url)(process.env.SHARP || 'sharp');
import { overlay } from './spread.mjs';
const V = process.argv[2] || 'hub', tag = process.argv[3] || 'before';
const map = JSON.parse(fs.readFileSync(`${new URL('.', import.meta.url).pathname}maps/${V}.json`, 'utf8'));
await overlay(sharp, `${new URL('.', import.meta.url).pathname}maps/${V}-aerial.png`, map, map.items, `${new URL('.', import.meta.url).pathname}maps/${V}-${tag}.png`, `${V} — ${tag}`);
console.log('ok');
