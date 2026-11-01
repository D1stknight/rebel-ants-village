// Universe multiplayer, groups: up to 8 signed-in players who see where the others are in any village (dots on the
// minimap, "Go to them") and talk in a group chat (the chat window's Group channel, village-chat.js). The group lives
// on the room server (realtime/src/group.js: one Durable Object per group); this page holds a second socket to it while
// in a group and remembers the group (localStorage rebelAntsGroup:v1), so the next village's page goes straight back in.
// Invites: the inviter's page notes the invite with the group, then hands it over through the room ({t:'gi'}); the other
// page shows a card (Join / No thanks) and opens the group, which lets in only its members and the players invited lately.
// window.VillageGroup.start(host) from village.html, host = { village, villageName(id), player() -> { x, z, interior } |
//   null, signedIn(), ticket() -> Promise<{ ticket, url } | null>, travel(villageId), doorOf(interiorId) -> { x, z } | null,
//   mp: window.VillageMP, isBlocked(u), toast(msg) }; what happens goes to the listeners (VillageGroup.on): the chat
//   window writes it down.
(function () {
  'use strict';
  const KEY = 'rebelAntsGroup:v1', GOTO_KEY = 'rebelAntsGroupGoTo:v1', PROTOCOL = 'rebel-universe.v1', GOTO_MS = 5 * 60000;
  let H = null, ws = null, connecting = false, retry = 0, retryAt = 0, fails = 0, lastGp = 0, lastGpKey = '', stopped = null;
  let card = null, cardTimer = 0, pending = null, goal = null;
  const G = { id: null, you: null, lead: null, max: 8, members: new Map(), cfg: { chat: true, slow: 2 }, mute: 0, hist: [] };
  const relay = new Map(); // u -> the room peer an invite is handed to, once the group has noted it
  const listeners = new Set();
  const emit = (kind, d) => { for (const f of listeners) try { f(kind, d); } catch (e) {} };
  const log = (...a) => { if (window._mpDebug) console.log('[group]', ...a); };
  const store = () => { try { if (G.id) localStorage.setItem(KEY, JSON.stringify({ id: G.id, at: Date.now() })); else localStorage.removeItem(KEY); } catch (e) {} };
  const stored = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && /^[A-Za-z0-9_-]{12}$/.test(v.id) ? v.id : null; } catch (e) { return null; } };
  const nameOf = u => G.members.get(u)?.n || 'A Rebel';

  // ---- the socket ----
  // opens the group (an id, or 'new'); resolves true once the group's hello came in
  async function connect(id) {
    if (ws || connecting || stopped || !H || !H.signedIn()) return false;
    connecting = true;
    try {
      const t = await H.ticket().catch(() => null);
      if (!t || !t.ticket || !t.url) { backoff(); return false; }
      if (ws || stopped) return false;
      let s;
      try { s = new WebSocket(t.url + '/v1/group?id=' + encodeURIComponent(id), [PROTOCOL, 't.' + t.ticket]); } catch (e) { backoff(); return false; }
      ws = s;
      return await new Promise(done => {
        let hello = false, settled = false;
        const end = v => { if (!settled) { settled = true; done(v); } };
        s.onmessage = e => {
          if (ws !== s) return;
          let m; try { m = JSON.parse(e.data); } catch (err) { return; }
          if (m.t === 'ghi') hello = true;
          try { onMessage(m); } catch (err) { log('bad message', err); }
          if (hello) end(true);
        };
        s.onclose = e => {
          if (ws === s) { ws = null; voiceReset(); }
          log('closed', e.code, e.reason, hello);
          end(false);
          if (e.code === 4001) { stopped = 'dup'; return; } // (the group opened in another tab: that one has it)
          if (e.code === 4003) { stopped = stopped || 'kick'; return; } // (an admin sent this page away)
          if (e.code === 4004) { if (G.id) { const why = e.reason || 'ended'; reset(); emit('gone', { why }); } return; }
          if (!hello) {
            // turned away at the door (no such group, not invited, full, too many made: the browser can't tell which)
            if (id === 'new') { pending = null; emit('failed', {}); backoff(); return; }
            if (++fails >= 3) { if (G.id || stored() === id) { reset(); emit('gone', { why: 'gone' }); } return; }
            backoff(); return;
          }
          backoff(); emit('offline', {});
        };
        s.onerror = () => {};
      });
    } finally { connecting = false; }
  }
  function backoff() { retry = Math.min(retry + 1, 6); retryAt = performance.now() + Math.min(30000, 1000 * 2 ** retry) * (.75 + Math.random() * .5); }
  const send = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
  function reset() { G.id = null; G.you = null; G.lead = null; G.members.clear(); G.hist = []; relay.clear(); store(); setGoal(null); voiceReset(); }
  function close(why) { const s = ws; ws = null; try { s?.close(1000, why || 'bye'); } catch (e) {} voiceReset(); }
  function voice(m) { try { window.VillageVoice?.group?.(m); } catch (e) { log('voice', e); } }
  function voiceReset() { try { window.VillageVoice?.reset?.('group'); } catch (e) {} } // (the group socket went: its voice sessions too)

  function onMessage(m) {
    if (m.t === 'ghi') {
      const first = G.id !== m.g;
      G.id = m.g; G.you = m.you; G.lead = m.lead; G.max = m.max || 8; G.cfg = m.cfg || G.cfg; G.mute = m.mute || 0; G.hist = m.hist || [];
      voice({ t: 'vcfg', on: !!G.cfg?.voice });
      G.members.clear(); for (const x of m.members || []) G.members.set(x.u, x);
      try { if (first) window.badgeStat?.('groups'); window.badgeStat?.('groupMax', G.members.size, 'max'); } catch (e) {} // (the badges)
      retry = 0; fails = 0; store(); lastGpKey = ''; lastGp = 0;
      emit('hello', { first, ...m });
      if (pending) { const p = pending; pending = null; invite(p); }
      return;
    }
    if (m.t === 'gj') { G.members.set(m.m.u, m.m); try { window.badgeStat?.('groupMax', G.members.size, 'max'); } catch (e) {} emit('join', m.m); return; }
    if (m.t === 'gx') {
      const was = G.members.get(m.u); G.members.delete(m.u);
      if (m.u === G.you) { reset(); emit('gone', { why: m.why }); return; }
      if (goal && goal.u === m.u) setGoal(null);
      emit('leave', { ...m, n: was?.n || 'A Rebel' }); return;
    }
    if (m.t === 'gon') { const x = G.members.get(m.u); if (x && x.on !== !!m.on) { x.on = !!m.on; emit('online', { u: m.u, on: x.on, n: x.n }); } return; }
    if (m.t === 'gp') { const x = G.members.get(m.u); if (x) { x.v = m.v; x.c = m.c || null; x.i = m.i || null; x.p = m.p; x.on = true; } return; }
    if (m.t === 'glead') { G.lead = m.u; for (const x of G.members.values()) x.lead = x.u === m.u; emit('lead', { u: m.u, n: nameOf(m.u), me: m.u === G.you }); return; }
    if (m.t === 'gc') { emit('msg', m.m); return; }
    if (m.t === 'gcx') { if (m.why === 'muted') G.mute = m.until || 0; emit('refused', m); return; }
    if (m.t === 'gi') { // the group noted an invite: now the room hands it over
      const r = relay.get(m.u); relay.delete(m.u);
      if (m.ok && r) { const sent = H.mp?.chat?.groupInvite?.(r.id, G.id); emit('invited', { n: r.n, sent: !!sent }); }
      else if (!m.ok) emit('invite-no', { n: r?.n || 'them', why: m.why });
      return;
    }
    if (m.t === 'gcd' || m.t === 'gcc') { emit(m.t === 'gcd' ? 'deleted' : 'cleared', m); return; }
    if (m.t === 'gcm') { G.mute = m.until || 0; return; } // (after the voice is told above)
    if (m.t === 'gcfg') { G.cfg = { chat: m.chat !== false, slow: m.slow || 2, voice: !!m.voice }; voice({ t: 'vcfg', on: !!m.voice }); return; }
    if (m.t === 'gcm') voice({ t: 'vmute', until: m.until });
    if (m.t === 'vo') { const x = G.members.get(m.key); if (x) x.vo = !!m.on; return voice(m); } // (a member's voice on / off)
    if (m.t === 'vp' || m.t === 'vs') return voice(m);
    if (m.t === 'kick') { stopped = m.why === 'banned' ? 'banned' : 'kick'; return; }
    if (m.t === 'rpok') { emit('reported', {}); return; }
  }

  // ---- what the page does ----
  // invite a player of this room copy (a peer: id, u, n, k); a group is made first when there is none
  function invite(p) {
    if (!p || !p.u || p.k === 'guest' || !H.signedIn()) return false;
    if (stopped) { H.toast?.('Groups are off on this page.'); return false; }
    if (G.members.has(p.u)) { emit('invite-no', { n: p.n, why: 'member' }); return false; }
    if (G.members.size >= G.max) { emit('invite-no', { n: p.n, why: 'full' }); return false; }
    if (!G.id) {
      if (pending || connecting) return false;
      pending = { id: p.id, u: p.u, n: p.n, k: p.k }; emit('making', { n: p.n });
      connect(stored() || 'new');
      return true;
    }
    relay.set(p.u, { id: p.id, n: p.n });
    if (!send({ t: 'gi', u: p.u, n: p.n })) { relay.delete(p.u); emit('invite-no', { n: p.n, why: 'offline' }); return false; }
    return true;
  }
  // an invite handed over by the room: the card (not from someone this player blocked; not for the group they are in)
  function onRoomInvite(m) {
    if (!H || !m || !/^[A-Za-z0-9_-]{12}$/.test(m.g || '') || !m.from || !H.signedIn() || stopped) return;
    if (H.isBlocked?.(m.from.u) || G.id === m.g) return;
    showCard(m);
  }
  function showCard(m) {
    hideCard();
    card = document.createElement('div'); card.id = 'vgInvite'; card.setAttribute('role', 'dialog');
    const t = document.createElement('div'); t.className = 'vgi-t'; t.textContent = 'Group invite';
    const b = document.createElement('div'); b.className = 'vgi-b';
    const name = document.createElement('b'); name.textContent = m.from.n || 'A Rebel';
    b.append(name, document.createTextNode(G.id ? ' invites you to their group. Joining leaves yours.' : ' invites you to their group: see where they are in any village and chat together.'));
    const row = document.createElement('div'); row.className = 'vgi-r';
    const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = 'Join';
    const no = document.createElement('button'); no.type = 'button'; no.className = 'no'; no.textContent = 'No thanks';
    yes.onclick = e => { e.stopPropagation(); hideCard(); join(m.g, m.from.n); };
    no.onclick = e => { e.stopPropagation(); hideCard(); };
    for (const x of [yes, no]) x.addEventListener('pointerdown', e => e.stopPropagation());
    row.append(yes, no); card.append(t, b, row); document.body.appendChild(card);
    cardTimer = setTimeout(hideCard, 60000);
  }
  function hideCard() { clearTimeout(cardTimer); if (card) { card.remove(); card = null; } }
  async function join(id, who) {
    if (G.id === id) return true;
    if (G.id) leave(true);
    fails = 0; retryAt = 0;
    const ok = await connect(id);
    if (!ok && !G.id) emit('join-no', { n: who || 'their' });
    return ok;
  }
  function leave(quiet) {
    if (!G.id) return;
    send({ t: 'gl' }); close('left'); reset();
    if (!quiet) emit('gone', { why: 'left', me: true });
  }
  const kick = u => !!G.id && G.lead === G.you && u !== G.you && send({ t: 'gk', u });
  const say = x => !!G.id && send({ t: 'gc', x: String(x || '') });
  const report = (i, why) => !!G.id && send({ t: 'rp', i: +i, why: why || 'other' });

  // ---- where everyone is ----
  function setGoal(g) { goal = g; try { if (g) localStorage.setItem(GOTO_KEY, JSON.stringify(g)); else localStorage.removeItem(GOTO_KEY); } catch (e) {} emit('goto', g); }
  // a member in this room copy (the room shows them): where they are comes from the room at once, before their page says
  function peerOf(x) { return x && x.u ? H.mp?.chat?.peers?.().find(p => p.u === x.u && p.s) || null : null; }
  // where a member is as best known: { v, c, i } from the room copy first, else what their page sent; null = not known
  function placeOf(x) {
    const p = peerOf(x);
    if (p) return { v: H.village, c: H.mp?.state?.room?.copy || null, i: p.s[5] || null, peer: p };
    return x && x.on && x.v ? { v: x.v, c: x.c || null, i: x.i || null } : null;
  }
  // a member's spot in this village and the same place as me: their Rebel here (the same room copy), else what they sent
  function spotOf(x, me) {
    const pl = placeOf(x);
    if (!pl || !me || pl.v !== H.village || (pl.i || null) !== (me.interior || null)) return null;
    if (pl.peer && pl.peer.pos) return { x: pl.peer.pos.x, z: pl.peer.pos.z, here: true };
    return x.p && x.v === H.village ? { x: x.p[0], z: x.p[1] } : null;
  }
  // where a member is, in words (the group panel)
  function whereOf(x) {
    if (!x) return '';
    const pl = placeOf(x);
    if (!pl) return x.on ? 'online' : 'offline';
    const me = H.player?.();
    if (pl.v !== H.village) return 'in ' + (H.villageName?.(pl.v) || pl.v);
    if ((pl.i || null) !== (me?.interior || null)) return pl.i ? 'inside a room here' : 'outside, here';
    const s = spotOf(x, me); return s && me ? Math.round(Math.hypot(s.x - me.x, s.z - me.z)) + ' m away' : 'here';
  }
  // the minimap's dots: the members in this village and place (the one being gone to marked)
  function dots() {
    if (!G.id) return null;
    const me = H.player?.(), out = [];
    for (const x of G.members.values()) {
      if (x.u === G.you) continue;
      const s = spotOf(x, me); if (s) out.push({ x: s.x, z: s.z, n: x.n, goal: !!(goal && goal.u === x.u) });
    }
    if (goal?.door) { const d = doorTarget(); if (d) out.push({ x: d.x, z: d.z, n: nameOf(goal.u), goal: true, door: true }); }
    return out;
  }
  // a member inside a room here: their dot goes to that room's door
  function doorTarget() {
    const pl = placeOf(goal && G.members.get(goal.u)); if (!pl || !pl.i || pl.v !== H.village) return null;
    return H.doorOf?.(pl.i) || null;
  }
  function goTo(u) {
    const x = G.members.get(u); if (!x || u === G.you) return false;
    const pl = placeOf(x);
    if (!pl) { H.toast?.(x.n + " isn't playing right now."); return false; }
    try { window.badgeStat?.('goto'); } catch (e) {} // (the badges)
    const me = H.player?.(), room = H.mp?.state?.room;
    if (pl.v !== H.village) { setGoal({ u, until: Date.now() + GOTO_MS }); H.toast?.('Off to ' + (H.villageName?.(pl.v) || pl.v) + ' to find ' + x.n + '…'); H.travel?.(pl.v); return true; }
    if (pl.c && room && room.copy !== pl.c && H.mp?.joinCopy?.(pl.c)) emit('copy', { n: x.n, c: pl.c }); // (another copy of this village: theirs)
    if ((pl.i || null) !== (me?.interior || null)) {
      if (pl.i && !me?.interior) { setGoal({ u, until: Date.now() + GOTO_MS, door: true }); H.toast?.(x.n + ' is inside a room: the green mark on the map is its door.'); return true; }
      H.toast?.(me?.interior ? 'Leave this room first: ' + x.n + (pl.i ? ' is in another room.' : ' is outside.') : x.n + ' is outside.'); return false;
    }
    setGoal({ u, until: Date.now() + GOTO_MS }); H.toast?.('Follow the green mark on the map to ' + x.n + '.');
    return true;
  }

  // ---- every half second (a timer: cheap) ----
  function tick() {
    if (!H) return;
    const now = performance.now();
    if (!ws && !connecting && !stopped && now >= retryAt && H.signedIn()) { const id = G.id || stored(); if (id) { retryAt = now + 3000; connect(id); } }
    if (goal) {
      if (Date.now() > goal.until || (!G.id && !stored())) setGoal(null);
      else if (G.id) {
        const x = G.members.get(goal.u), me = H.player?.();
        if (!x) setGoal(null);
        else if (goal.door && placeOf(x)?.i && me?.interior === placeOf(x).i) setGoal({ ...goal, door: false }); // (through the door: now them)
        else {
          const s = spotOf(x, me);
          if (s && me && Math.hypot(s.x - me.x, s.z - me.z) < 6) { emit('found', { n: x.n }); setGoal(null); }
          else if (x.c && x.v === H.village && !goal.copied) { const room = H.mp?.state?.room; if (room && room.copy !== x.c && H.mp?.joinCopy?.(x.c)) { goal.copied = true; emit('copy', { n: x.n, c: x.c }); } } // (arrived after a travel)
        }
      }
    }
    if (!ws || ws.readyState !== 1 || !G.id) return;
    const me = H.player?.(); if (!me) return;
    const c = H.mp?.state?.room?.copy || null;
    const key = H.village + '|' + c + '|' + (me.interior || '') + '|' + Math.round(me.x) + '|' + Math.round(me.z);
    if (key !== lastGpKey && now - lastGp > 1000) { lastGp = now; lastGpKey = key; send({ t: 'gp', v: H.village, c, i: me.interior || null, p: [Math.round(me.x * 10) / 10, Math.round(me.z * 10) / 10] }); }
  }
  // the room sent this page away (another tab, an admin): the group socket goes too, for this visit
  function stop(why) { if (!why || stopped) return; stopped = why; hideCard(); close(why); }
  // signed out, or another account: the group was the other account's
  function account() { hideCard(); pending = null; if (G.id || stored()) { close('account'); reset(); emit('gone', { why: 'account' }); } stopped = null; fails = 0; retryAt = 0; }

  const css = `
#vgInvite{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:72;width:min(340px,calc(100vw - 32px));background:rgba(5,10,28,.96);border:1px solid rgba(123,227,138,.7);box-shadow:0 10px 30px rgba(0,0,0,.5);color:#eef1f8;font:13px/1.4 -apple-system,'Segoe UI',Arial,sans-serif;padding:12px 14px;backdrop-filter:blur(10px)}
#vgInvite .vgi-t{font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:2px;color:#7be38a;text-transform:uppercase;margin-bottom:6px}
#vgInvite .vgi-b b{color:#b9f5c2}
#vgInvite .vgi-r{display:flex;gap:8px;margin-top:10px}
#vgInvite button{flex:1;font:700 10px/1 'Cinzel Decorative',serif;letter-spacing:1.4px;background:rgba(123,227,138,.16);border:1px solid rgba(123,227,138,.7);color:#dfffe4;padding:10px;cursor:pointer;min-height:36px}
#vgInvite button.no{background:transparent;border-color:rgba(255,255,255,.25);color:#cfd6e6}
html.vt-touch #vgInvite{top:calc(max(12px,env(safe-area-inset-top,0px)) + 112px)}
body.in-game #vgInvite{display:none}`;
  function start(host) {
    if (H || !host) return;
    H = host;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    try { const g = JSON.parse(localStorage.getItem(GOTO_KEY) || 'null'); if (g && g.u && g.until > Date.now()) goal = g; } catch (e) {}
    setInterval(tick, 500);
    log('start', stored());
  }
  window.VillageGroup = {
    start, tick, invite, onRoomInvite, join, leave, kick, say, report, dots, goTo, whereOf, placeOf: x => (H ? placeOf(x) : null), stop, account,
    on: f => { listeners.add(f); return () => listeners.delete(f); },
    inGroup: () => !!G.id, isMember: u => G.members.has(u), member: u => G.members.get(u) || null, members: () => [...G.members.values()],
    voice: { send: o => send(o), open: () => !!ws && ws.readyState === 1 && !!G.id && G.cfg?.voice === true, you: () => G.you },
    get state() { return { id: G.id, you: G.you, lead: G.lead, max: G.max, open: !!ws && ws.readyState === 1, members: [...G.members.values()], goal, cfg: G.cfg, mute: G.mute, stopped, stored: stored() }; }
  };
})();
