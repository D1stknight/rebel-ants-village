// The Colony Stage's events (control.js keeps them, stage.js runs each one): what an event is, what pages may see of it.
// An event = {id, title, place: {village, room|null, label}, starts, ends (ms), hosts: [{sub, u, n}], show|null, showAt (ms,
// 0 = not playing), ended (ms, 0 = not ended early), made}. It is live from its start until its end, unless ended early.
// A show = {title, len (s), audio (a file in our store or /assets/...)|null, cues: [{t (s), say?, clip?, sfx?}]}: with no
// audio the pages give the performer a babbling voice for each line (captions on screen), with audio they play it.
// Nov 2: repeat ('' | 'daily' | 'weekly'): once an event is over (its end, or ended early) it moves on to its next time
// when it is next read (roll); auto: its show starts by itself a minute after the doors open (AUTO_LEAD), unless stopped
// for this time (autoOff) or started by hand (showAt).
import { VILLAGES } from './villages.js';

export const EVENT_ID = /^[A-Za-z0-9_-]{10}$/, EVENT_ROOM = /^[a-z]+:event:[A-Za-z0-9_-]{10}$/;
const SUB = /^[ug]:[A-Za-z0-9_-]{4,64}$/, UID = /^[A-Za-z0-9_-]{16}$/, ROOMID = /^[A-Za-z0-9_-]{1,64}$/, CLIP = /^[a-z0-9_]{1,24}$/;
const AUDIO = /^(https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/|\/assets\/)[A-Za-z0-9_\-./%]{1,240}\.(mp3|m4a|ogg|webm|wav)$/;
export const SFX = ['rimshot', 'applause', 'laugh', 'drumroll', 'cheer'];
export const MAX_HOURS = 12, MAX_HOSTS = 6;
const label = s => String(s ?? '').replace(/\s+/g, ' ').trim();

export const REPEATS = { daily: 86400000, weekly: 7 * 86400000 }, AUTO_LEAD = 60000;
export const isLive = (ev, now = Date.now()) => !!ev && !ev.ended && ev.starts <= now && now < ev.ends;
// when the show starts: by hand (showAt), else by itself for an auto event not stopped this time; 0 = not playing
export const showStart = ev => (ev && ev.show ? ev.showAt || (ev.auto && !ev.autoOff ? ev.starts + AUTO_LEAD : 0) : 0);
export const showOf = ev => { const at = showStart(ev); return at ? { ...ev.show, startAt: at } : null; };
// a repeating event that is over moves on to its next time on its schedule (anchor = the time it was set for, len = how
// long it runs): the first one after the time just over that hasn't ended yet (a "Go live now" ahead of time never takes
// the scheduled one's place). true when it moved.
export function roll(ev, now = Date.now()) {
  const step = REPEATS[ev?.repeat]; if (!step || !(ev.ended || now >= ev.ends)) return false;
  const anchor = +ev.anchor > 0 ? +ev.anchor : ev.starts, len = +ev.len > 0 && +ev.len < step ? +ev.len : Math.min(ev.ends - ev.starts, step - 60000);
  let k = Math.max(0, Math.floor((Math.max(now, ev.starts) - anchor) / step) - 1), s = anchor + k * step, guard = 0;
  while ((s + len <= now || s <= ev.starts) && guard++ < 100000) s = anchor + ++k * step;
  ev.starts = s; ev.ends = s + len; ev.ended = 0; ev.showAt = 0; ev.autoOff = 0;
  return true;
}
// what an event's pages see (never the hosts' account ids)
export function pubEvent(ev, now = Date.now()) {
  if (!ev) return null;
  const s = ev.show;
  return { id: ev.id, title: ev.title, place: ev.place, starts: ev.starts, ends: ev.ends, live: isLive(ev, now), over: !!ev.ended || now >= ev.ends,
    hosts: (ev.hosts || []).map(h => ({ u: h.u, n: h.n })), show: s ? { title: s.title, len: s.len, audio: s.audio || null, ...(s.parts ? { parts: s.parts } : {}), cues: s.cues || [] } : null,
    repeat: ev.repeat || null, auto: !!ev.auto, tix: !!ev.tix };
}
// the lobby's and the pages' list: what, where, when, who hosts it, whether a show is on
// (showing: on now, or starting within the 3 s every page gets to start it together)
export const briefEvent = (ev, now = Date.now()) => { const at = showStart(ev); return { id: ev.id, title: ev.title, place: ev.place, starts: ev.starts, ends: ev.ends, live: isLive(ev, now), hosts: (ev.hosts || []).map(h => h.n), show: ev.show ? ev.show.title : null, showing: !!(at && at <= now + 3500 && at + ev.show.len * 1000 > now), repeat: ev.repeat || null, tix: !!ev.tix }; };

export function normShow(s) {
  if (!s || typeof s !== 'object') return null;
  const len = Math.min(3600, Math.max(5, Math.round(+s.len || 0) || 60));
  const audio = typeof s.audio === 'string' && AUDIO.test(s.audio) ? s.audio : null;
  // a long show's audio in pieces (Nov 4: a 15-minute set is more than one file; pages decode only the piece playing and
  // the next): each its file, where it starts in the show and how long it is, in order, not overlapping
  let parts = (Array.isArray(s.parts) ? s.parts : []).slice(0, 60).map(p => p && typeof p.audio === 'string' && AUDIO.test(p.audio)
    ? { audio: p.audio, at: Math.max(0, Math.round((+p.at || 0) * 100) / 100), len: Math.max(.5, Math.min(900, Math.round((+p.len || 0) * 100) / 100)) } : null);
  parts = parts.every(Boolean) && parts.length > 1 && parts.every((p, i) => !i || p.at >= parts[i - 1].at + parts[i - 1].len - .05) ? parts : null;
  const cues = (Array.isArray(s.cues) ? s.cues : []).slice(0, 400).map(c => {
    if (!c || typeof c !== 'object' || !(+c.t <= len) && c.t != null) return null; // (a line past the show's end: dropped)
    const t = Math.max(0, Math.round((+c.t || 0) * 10) / 10), o = { t };
    const say = label(c.say).slice(0, 200); if (say) o.say = say;
    if (typeof c.clip === 'string' && CLIP.test(c.clip)) o.clip = c.clip;
    if (SFX.includes(c.sfx)) o.sfx = c.sfx;
    return o.say || o.clip || o.sfx ? o : null;
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  return { title: label(s.title).slice(0, 80) || 'The show', len, audio: parts ? parts[0].audio : audio, ...(parts ? { parts } : {}), cues, script: typeof s.script === 'string' ? s.script.slice(0, 20000) : '' }; // (script: the Admin Hub's text, for editing)
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
  const repeat = 'repeat' in a ? (REPEATS[a.repeat] ? a.repeat : '') : old?.repeat || '', auto = 'auto' in a ? !!a.auto : !!old?.auto;
  const tix = 'tix' in a ? !!a.tix : !!old?.tix; // (Nov 4: a ticket to get in: only holders, signed into their ticket by the site, and the hosts)
  return { ev: { id: old?.id || null, title, place, starts, ends, hosts, show, showAt: show ? old?.showAt || 0 : 0, ended: old?.ended || 0, made: old?.made || now,
    repeat, auto, autoOff: old?.autoOff || 0, anchor: starts, len: ends - starts, tix } };
}
export const newEventId = () => { const b = crypto.getRandomValues(new Uint8Array(8)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 10); };
