// The Colony Stage's events (control.js keeps them, stage.js runs each one): what an event is, what pages may see of it.
// An event = {id, title, place: {village, room|null, label}, starts, ends (ms), hosts: [{sub, u, n}], show|null, showAt (ms,
// 0 = not playing), ended (ms, 0 = not ended early), made}. It is live from its start until its end, unless ended early.
// A show = {title, len (s), audio (a file in our store or /assets/...)|null, cues: [{t (s), say?, clip?, sfx?}]}: with no
// audio the pages give the performer a babbling voice for each line (captions on screen), with audio they play it.
import { VILLAGES } from './villages.js';

export const EVENT_ID = /^[A-Za-z0-9_-]{10}$/, EVENT_ROOM = /^[a-z]+:event:[A-Za-z0-9_-]{10}$/;
const SUB = /^[ug]:[A-Za-z0-9_-]{4,64}$/, UID = /^[A-Za-z0-9_-]{16}$/, ROOMID = /^[A-Za-z0-9_-]{1,64}$/, CLIP = /^[a-z0-9_]{1,24}$/;
const AUDIO = /^(https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/|\/assets\/)[A-Za-z0-9_\-./%]{1,240}\.(mp3|m4a|ogg|webm|wav)$/;
export const SFX = ['rimshot', 'applause', 'laugh', 'drumroll', 'cheer'];
export const MAX_HOURS = 12, MAX_HOSTS = 6;
const label = s => String(s ?? '').replace(/\s+/g, ' ').trim();

export const isLive = (ev, now = Date.now()) => !!ev && !ev.ended && ev.starts <= now && now < ev.ends;
export const showOf = ev => (ev && ev.show && ev.showAt ? { ...ev.show, startAt: ev.showAt } : null);
// what an event's pages see (never the hosts' account ids)
export function pubEvent(ev, now = Date.now()) {
  if (!ev) return null;
  const s = ev.show;
  return { id: ev.id, title: ev.title, place: ev.place, starts: ev.starts, ends: ev.ends, live: isLive(ev, now), over: !!ev.ended || now >= ev.ends,
    hosts: (ev.hosts || []).map(h => ({ u: h.u, n: h.n })), show: s ? { title: s.title, len: s.len, audio: s.audio || null, cues: s.cues || [] } : null };
}
// the lobby's and the pages' list: what, where, when, who hosts it, whether a show is on
export const briefEvent = (ev, now = Date.now()) => ({ id: ev.id, title: ev.title, place: ev.place, starts: ev.starts, ends: ev.ends, live: isLive(ev, now), hosts: (ev.hosts || []).map(h => h.n), show: ev.show ? ev.show.title : null, showing: !!(ev.show && ev.showAt && ev.showAt + ev.show.len * 1000 > now) });

export function normShow(s) {
  if (!s || typeof s !== 'object') return null;
  const len = Math.min(3600, Math.max(5, Math.round(+s.len || 0) || 60));
  const audio = typeof s.audio === 'string' && AUDIO.test(s.audio) ? s.audio : null;
  const cues = (Array.isArray(s.cues) ? s.cues : []).slice(0, 400).map(c => {
    if (!c || typeof c !== 'object' || !(+c.t <= len) && c.t != null) return null; // (a line past the show's end: dropped)
    const t = Math.max(0, Math.round((+c.t || 0) * 10) / 10), o = { t };
    const say = label(c.say).slice(0, 200); if (say) o.say = say;
    if (typeof c.clip === 'string' && CLIP.test(c.clip)) o.clip = c.clip;
    if (SFX.includes(c.sfx)) o.sfx = c.sfx;
    return o.say || o.clip || o.sfx ? o : null;
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  return { title: label(s.title).slice(0, 80) || 'The show', len, audio, cues, script: typeof s.script === 'string' ? s.script.slice(0, 20000) : '' }; // (script: the Admin Hub's text, for editing)
}
// an event made or changed in the Admin Hub (args over the old one): checked, or { error }
export function normEvent(a, old, now = Date.now()) {
  a = a && typeof a === 'object' ? a : {};
  const title = label(a.title ?? old?.title).slice(0, 80);
  if (title.length < 3) return { error: 'Give it a title (3 letters or more).' };
  const p = a.place && typeof a.place === 'object' ? a.place : old?.place || {};
  if (!VILLAGES.has(p.village)) return { error: 'Which village is it in?' };
  const place = { village: p.village, room: typeof p.room === 'string' && ROOMID.test(p.room) ? p.room : null, label: label(p.label).slice(0, 60) || p.village };
  const starts = Math.round(+(a.starts ?? old?.starts)), ends = Math.round(+(a.ends ?? old?.ends));
  if (!(starts > now - 366 * 86400000 && starts < now + 366 * 86400000)) return { error: 'When does it start?' };
  if (!(ends > starts && ends - starts <= MAX_HOURS * 3600000)) return { error: `It must end after it starts (${MAX_HOURS} hours at most).` };
  const hosts = (Array.isArray(a.hosts) ? a.hosts : old?.hosts || []).filter(h => h && SUB.test(h.sub) && UID.test(h.u) && !/^g:/.test(h.sub))
    .slice(0, MAX_HOSTS).map(h => ({ sub: h.sub, u: h.u, n: label(h.n).slice(0, 40) || 'Host' }));
  const show = 'show' in a ? normShow(a.show) : old?.show || null;
  return { ev: { id: old?.id || null, title, place, starts, ends, hosts, show, showAt: show ? old?.showAt || 0 : 0, ended: old?.ended || 0, made: old?.made || now } };
}
export const newEventId = () => { const b = crypto.getRandomValues(new Uint8Array(8)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 10); };
