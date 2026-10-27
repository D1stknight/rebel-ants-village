// The chat's text rules (see index.js): what a message may hold, and the filter every message goes through on the room
// server before anyone sees it. Swear words and slurs are starred out (obscenity's English list, which also reads
// leetspeak, look-alike letters, stretched letters and spaced-out letters, plus the admins' own words); links are taken
// out unless the admins allow them (Rebel Ants' own sites always stay): fake mint and wallet links are the usual scam.
import { RegExpMatcher, TextCensor, englishDataset, englishRecommendedTransformers, parseRawPattern, asteriskCensorStrategy, keepStartCensorStrategy } from 'obscenity';

export const MAX_CHARS = 280;
const built = englishDataset.build();
// telling someone to hurt themselves, and a slur the list lacks ('|' = the edge of a word)
const EXTRA = ['|kys|', '|kill yourself', '|kill urself', '|kill your self', '|neck yourself', '|spic|', '|spics|'];
const matcher = new RegExpMatcher({
  blacklistedTerms: [...built.blacklistedTerms, ...EXTRA.map((p, k) => ({ id: 100000 + k, pattern: parseRawPattern(p) }))],
  whitelistedTerms: [...built.whitelistedTerms, 'shiitake', 'dick grayson', 'moby dick', 'penistone'],
  ...englishRecommendedTransformers
});
const censor = new TextCensor().setStrategy(keepStartCensorStrategy(asteriskCensorStrategy()));
const stars = w => { const c = [...w]; return c[0] + '*'.repeat(Math.max(1, c.length - 1)); };

// what is left of a message once invisible and control characters are gone: one line, single spaces
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\ufffb]/g;
export function cleanText(v) {
  let s = typeof v === 'string' ? v.slice(0, 2000) : '';
  s = s.normalize('NFKC').replace(INVISIBLE, ' ');
  s = s.replace(/(\p{M}{2})\p{M}+/gu, '$1'); // stacked accents (the "zalgo" look): two at most on a letter
  return s.replace(/\s+/g, ' ').trim();
}
export const charCount = s => [...s].length;

// links: whole addresses, and bare names with a usual ending (discord.gg/abc, free-mint.xyz)
const TLD = 'com|net|org|io|xyz|gg|app|me|co|ly|link|site|online|club|live|art|ai|dev|fun|top|pro|shop|store|info|biz|us|uk|ca|de|ru|cn|tk|ml|ga|cf|gq|eth|nft|sol|lol|vip|win|bet|cc|tv|to|sh|is|so|in|au|nl|fr|es|it|pl|ch|se|jp|kr|vn|ph|sg|nz|ie|claims?|gift|money|network|finance|exchange|wallet|zone|space|tech|world|today|click|page|icu|cyou|rest|bond';
const LINK = new RegExp(String.raw`(?:https?:\/\/|www\.)[^\s]+|(?<![\p{L}\p{N}@.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:${TLD})(?![\p{L}\p{N}-])(?::\d{1,5})?(?:[\/?#][^\s]*)?`, 'giu');
const OURS = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:rebelants\.io|rebeluniverse\.io)(?:[:\/?#]|$)/i;
// spaced-out letters ("f u c k", "s.h.i.t"): the run read as one word
const SPACED = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}][ ._*~-]){2,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu;

function ownWords(list) {
  const words = (Array.isArray(list) ? list : []).map(w => cleanText(String(w)).toLowerCase()).filter(w => w.length >= 2 && w.length <= 40);
  if (!words.length) return null;
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
}
let ownCache = { key: '', re: null };

// cfg: { filter (on unless false), links (allowed when true), words (the admins' own) } -> { text, hits }
export function filterText(text, cfg = {}) {
  let s = text, hits = 0;
  if (!cfg.links) s = s.replace(LINK, m => (OURS.test(m) ? m : (hits++, '[link]')));
  if (cfg.filter !== false) {
    s = s.replace(SPACED, run => { const w = run.replace(/[ ._*~-]/g, ''); return matcher.hasMatch(w) ? (hits++, stars(w)) : run; });
    const found = matcher.getAllMatches(s, true);
    if (found.length) { hits += found.length; s = censor.applyTo(s, found); }
  }
  const key = JSON.stringify(cfg.words || []);
  if (ownCache.key !== key) ownCache = { key, re: ownWords(cfg.words) };
  if (ownCache.re) s = s.replace(ownCache.re, w => (hits++, stars(w)));
  return { text: s, hits };
}
