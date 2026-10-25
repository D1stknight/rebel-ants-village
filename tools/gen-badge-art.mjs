#!/usr/bin/env node
// Badge pictures for RAAP (Oct 25): every badge in village.html drawn by assets/badge-art.js (the same art the journal
// shows) at 512 px with its name ribbon, written to assets/badges/medals/<badgeId>.webp, plus badges.json there (name,
// category, rarity, what it asks, the picture's path). Run it after adding or changing badges or the art.
// WebP by default (~40 KB a badge; 512 px PNGs are ~300 KB each), --format png for PNGs.
//
// node tools/gen-badge-art.mjs [--out assets/badges/medals] [--size 512] [--format webp|png] [--only id,id]
// (a folder of their own: the admin badge builder uploads and deletes its own pictures in assets/badges/)
//   PLAYWRIGHT_DIR = a folder whose node_modules (or itself) holds playwright, when it isn't installed beside the repo
// The badge list is read from village.html (the block from PROGRESSION_BADGE_CATEGORIES to getVillageQuestIds), the
// emblems from assets/brand/factions/, the Cinzel Decorative font from Google Fonts (the village's own font).
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(ROOT, arg('out', 'assets/badges/medals')), SIZE = +arg('size', 512), FORMAT = arg('format', 'webp') === 'png' ? 'png' : 'webp';
const only = arg('only', '') ? new Set(arg('only').split(',')) : null;
const pw = process.env.PLAYWRIGHT_DIR ? createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_DIR), 'x.js'))('playwright') : await import('playwright');

const html = fs.readFileSync(path.join(ROOT, 'village.html'), 'utf8');
const a = html.indexOf('const PROGRESSION_BADGE_CATEGORIES'), b = html.indexOf('// Quests that count toward a village crest');
if (a < 0 || b < a) throw new Error('badge definitions not found in village.html');
const defs = html.slice(a, b) + '\nwindow.BADGES = DEFAULT_BADGE_DEFINITIONS; window.CATS = PROGRESSION_BADGE_CATEGORIES;\n';

// the font, fetched once (a browser user agent gets woff2)
const fonts = {};
try {
  const css = await (await fetch('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&display=swap', { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } })).text();
  for (const w of ['700', '900']) {
    const m = css.match(new RegExp(`/\\* latin \\*/\\s*@font-face \\{[^}]*font-weight: ${w};[^}]*src: url\\(([^)]+)\\)`));
    if (m) fonts[w] = Buffer.from(await (await fetch(m[1])).arrayBuffer());
  }
} catch (e) { console.warn('font not fetched (a serif stands in):', e.message); }

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
${Object.keys(fonts).map((w) => `@font-face{font-family:'Cinzel Decorative';font-weight:${w};src:url(/__font/${w}.woff2) format('woff2')}`).join('\n')}
</style></head><body><script src="/assets/badge-art.js"></script><script src="/__defs.js"></script><script>
window.renderAll = async (size, only, format) => {
  const em = {};
  await Promise.all(['ronin','samurai','shogun','bushi','buke','ashigaru','kenshi','yamabushi','sohei','wokou','warrior'].map((f) => new Promise((res) => { const i = new Image(); i.onload = res; i.onerror = res; i.src = '/assets/brand/factions/' + f + '.png'; em[f] = i; })));
  try { await document.fonts.load("700 20px 'Cinzel Decorative'"); await document.fonts.load("900 20px 'Cinzel Decorative'"); } catch (e) {}
  const out = [];
  for (const badge of window.BADGES) {
    if (only && !only.includes(badge.badgeId)) continue;
    const c = document.createElement('canvas'); c.width = c.height = size;
    BadgeArtKit.draw(c.getContext('2d'), badge, size, { label: true, assets: { emblems: em } });
    out.push({ badge: { badgeId: badge.badgeId, name: badge.name, category: badge.category, categoryLabel: window.CATS[badge.category] || badge.category, rarity: badge.rarity, description: badge.description, requirement: badge.requirementText, hidden: !!badge.hidden }, data: c.toDataURL('image/' + format, .92) });
  }
  return out;
};
</script></body></html>`;

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  if (u === '/__defs.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(defs); }
  const fm = u.match(/^\/__font\/(\d+)\.woff2$/);
  if (fm && fonts[fm[1]]) { res.writeHead(200, { 'content-type': 'font/woff2' }); return res.end(fonts[fm[1]]); }
  const f = path.join(ROOT, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const list = await page.evaluate(([s, o, f]) => window.renderAll(s, o, f), [SIZE, only ? [...only] : null, FORMAT]);
  fs.mkdirSync(OUT, { recursive: true });
  const rel = path.relative(ROOT, OUT).split(path.sep).join('/');
  for (const { badge, data } of list) fs.writeFileSync(path.join(OUT, `${badge.badgeId}.${FORMAT}`), Buffer.from(data.split(',')[1], 'base64'));
  if (!only) {
    const manifest = { generated: 'tools/gen-badge-art.mjs', size: SIZE, badges: list.map(({ badge }) => ({ ...badge, image: `${rel}/${badge.badgeId}.${FORMAT}` })) };
    fs.writeFileSync(path.join(OUT, 'badges.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log(`${list.length} badges -> ${rel}/ (${SIZE} px)${Object.keys(fonts).length ? '' : ' without the Cinzel Decorative font'}`);
} finally { await browser.close(); server.close(); }
