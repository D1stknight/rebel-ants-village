// Voice (multiplayer step 5): push to talk through Cloudflare Realtime SFU. The rooms (nearby voices) and the groups
// (the group's voices, any village) each run one of these for their sockets. Only this server ever talks to the SFU
// (the app secret stays here): a page sends its offers and answers through its room or group socket, and the room or
// group decides whom it may hear (nearby: the same place and within VOICE_R; a group: its members). Each page has, per
// room / group, a producer session (its microphone, one track 'v', published once and kept: the page turns it on and
// off itself, silent in between) and a consumer session (the voices it hears), as Cloudflare's own video-room example.
//   page -> room/group {t:'vp', sdp, mid}        publish my microphone (my producer session's offer; its answer back)
//                      {t:'vs', want:[keys]}     hear these speakers (all of them; others are closed): a fresh offer back
//                      {t:'va', sdp}             my consumer's answer to that offer
//                      {t:'vx'}                  stop publishing (my voice off)
//   room/group -> page {t:'vp', sdp} | {t:'vp', no:why}         the producer's answer, or why not (guest, muted, off, busy, sfu)
//                      {t:'vs', subs:[{key, mid}], sdp?}         what I hear now (mids of my consumer), an offer to answer
//                      {t:'vo', key, on}                         a speaker published / stopped (others decide to listen)
// Keys: a room's peer ids, a group's member codes (u). Sessions and subscriptions are kept in the object's own storage
// (table voice), so they survive hibernation; the sockets' rate limits count these messages like any other.
export const VOICE_R = 40, VOICE_MAX = 12, TRACK = 'v';
const SDP_MAX = 12000;

export class Sfu {
  constructor(env) {
    this.app = env.REALTIME_APP_ID || ''; this.token = env.REALTIME_APP_SECRET || '';
    this.base = String(env.REALTIME_API || 'https://rtc.live.cloudflare.com/v1').replace(/\/$/, '') + '/apps/' + encodeURIComponent(this.app);
  }
  get on() { return !!(this.app && this.token); }
  async call(path, method, body) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
    let r;
    try { r = await fetch(this.base + path, { method, body: body ? JSON.stringify(body) : undefined, headers: { authorization: 'Bearer ' + this.token, 'content-type': 'application/json' }, signal: ctl.signal }); }
    catch (e) { throw Object.assign(new Error('sfu unreachable'), { code: 'sfu' }); }
    finally { clearTimeout(t); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.errorCode) throw Object.assign(new Error('sfu ' + r.status + ' ' + (d.errorCode || '')), { code: 'sfu', status: r.status });
    return d;
  }
  async session() { const d = await this.call('/sessions/new', 'POST'); if (!d.sessionId) throw Object.assign(new Error('no session'), { code: 'sfu' }); return d.sessionId; }
  tracks(s, body) { return this.call(`/sessions/${encodeURIComponent(s)}/tracks/new`, 'POST', body); }
  renegotiate(s, sdp) { return this.call(`/sessions/${encodeURIComponent(s)}/renegotiate`, 'PUT', { sessionDescription: { type: 'answer', sdp } }); }
  close(s, mids) { return mids.length ? this.call(`/sessions/${encodeURIComponent(s)}/tracks/close`, 'PUT', { force: true, tracks: mids.map(mid => ({ mid })) }) : Promise.resolve({}); }
}

// one voice side (a room copy's or a group's): host = { sql, send(ws, obj), all(obj, exceptWs), may(p, 'talk' | 'hear') ->
//   null | why not (guest, muted, off), canHear(listener, speakerKey) -> bool, keyOf(p) -> key, keyOut(key) -> as the pages
//   know it }
export class Voice {
  constructor(env, host) {
    this.sfu = new Sfu(env); this.h = host; this.q = new Map(); // (one queue of SFU calls per socket key: never two at once)
    this.schema();
  }
  schema() { this.h.sql.exec('CREATE TABLE IF NOT EXISTS voice (k TEXT PRIMARY KEY, prod TEXT, cons TEXT, mid TEXT, pub INTEGER DEFAULT 0, subs TEXT)'); }
  get on() { return this.sfu.on; }
  row(k) { const r = this.h.sql.exec('SELECT * FROM voice WHERE k = ?', String(k)).toArray()[0]; if (!r) return null; let subs = {}; try { subs = JSON.parse(r.subs || '{}') || {}; } catch (e) {} return { ...r, subs }; }
  save(k, v) { this.h.sql.exec('INSERT INTO voice (k, prod, cons, mid, pub, subs) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET prod = excluded.prod, cons = excluded.cons, mid = excluded.mid, pub = excluded.pub, subs = excluded.subs', String(k), v.prod || null, v.cons || null, v.mid || null, v.pub ? 1 : 0, JSON.stringify(v.subs || {})); }
  published() { return this.h.sql.exec('SELECT k FROM voice WHERE pub = 1').toArray().map(r => r.k); }
  isOn(k) { return !!this.row(k)?.pub; }
  // run fn after the socket's earlier SFU calls (each session must see one change at a time)
  queue(k, fn) { const prev = this.q.get(k) || Promise.resolve(); const next = prev.then(fn, fn).catch(() => {}); this.q.set(k, next); return next; }
  async message(ws, p, m) {
    const k = String(this.h.keyOf(p));
    if (m.t === 'vp') return this.queue(k, () => this.publish(ws, p, k, m));
    if (m.t === 'vs') return this.queue(k, () => this.listen(ws, p, k, m));
    if (m.t === 'va') return this.queue(k, () => this.answer(ws, p, k, m));
    if (m.t === 'vx') return this.queue(k, () => this.stop(k));
  }
  async publish(ws, p, k, m) {
    const no = why => this.h.send(ws, { t: 'vp', no: why });
    if (!this.sfu.on) return no('off');
    const why = this.h.may(p, 'talk'); if (why) return no(why);
    if (typeof m.sdp !== 'string' || m.sdp.length > SDP_MAX || typeof m.mid !== 'string' || m.mid.length > 8) return no('bad');
    const v = this.row(k) || { subs: {} };
    try {
      if (v.pub && v.prod && v.mid) await this.sfu.close(v.prod, [v.mid]).catch(() => {}); // (a page publishing again: the old track goes)
      v.prod = await this.sfu.session(); // (a new producer session for each offer: a page's new connection)
      const d = await this.sfu.tracks(v.prod, { sessionDescription: { type: 'offer', sdp: m.sdp }, tracks: [{ location: 'local', mid: m.mid, trackName: TRACK }] });
      const t = (d.tracks || [])[0];
      if (!d.sessionDescription?.sdp || !t || t.errorCode) return no('sfu');
      v.mid = t.mid || m.mid; v.pub = 1; this.save(k, v);
      this.h.send(ws, { t: 'vp', sdp: d.sessionDescription.sdp });
      this.h.all({ t: 'vo', key: this.h.keyOut(k), on: true }, ws);
    } catch (e) { no('sfu'); }
  }
  // the speakers this page wants to hear (all of them): the ones it may hear are kept or added, the rest closed
  async listen(ws, p, k, m) {
    const no = this.sfu.on ? this.h.may(p, 'hear') : 'off';
    if (no) { await this.unsub(k, () => true); return this.h.send(ws, { t: 'vs', subs: [], no }); }
    const want = (Array.isArray(m.want) ? m.want : []).slice(0, 40).map(String).filter(x => x !== k);
    const ok = [];
    for (const w of want) { if (ok.length >= VOICE_MAX) break; const s = this.row(w); if (s?.pub && s.prod && this.h.canHear(p, w)) ok.push([w, s.prod]); }
    const v = this.row(k) || { subs: {} };
    const keep = new Map(ok.map(([w, prod]) => [w, prod]));
    const drop = Object.entries(v.subs).filter(([w, s]) => keep.get(w) !== s.prod);
    try {
      if (drop.length && v.cons) await this.sfu.close(v.cons, drop.map(([, s]) => s.mid)).catch(() => {});
      for (const [w] of drop) delete v.subs[w];
      const add = ok.filter(([w]) => !v.subs[w]);
      let sdp = null;
      if (add.length) {
        if (!v.cons) v.cons = await this.sfu.session();
        const d = await this.sfu.tracks(v.cons, { tracks: add.map(([, prod]) => ({ location: 'remote', sessionId: prod, trackName: TRACK })) });
        const got = d.tracks || [];
        add.forEach(([w, prod], i) => { const t = got.find(x => x.sessionId === prod) || got[i]; if (t && t.mid && !t.errorCode) v.subs[w] = { mid: t.mid, prod }; });
        if (d.requiresImmediateRenegotiation && d.sessionDescription?.sdp) sdp = d.sessionDescription.sdp;
      }
      this.save(k, v);
      this.h.send(ws, { t: 'vs', subs: Object.entries(v.subs).map(([w, s]) => ({ key: this.h.keyOut(w), mid: s.mid })), ...(sdp ? { sdp } : {}) });
    } catch (e) { this.save(k, v); this.h.send(ws, { t: 'vs', subs: Object.entries(v.subs).map(([w, s]) => ({ key: this.h.keyOut(w), mid: s.mid })), no: 'sfu' }); }
  }
  async answer(ws, p, k, m) {
    const v = this.row(k); if (!v?.cons || typeof m.sdp !== 'string' || m.sdp.length > SDP_MAX) return;
    try { await this.sfu.renegotiate(v.cons, m.sdp); }
    catch (e) { await this.unsub(k, () => true).catch(() => {}); this.h.send(ws, { t: 'vs', subs: [], no: 'sfu', push: 1 }); } // (the room and the page agree: none of them, try again later)
  }
  // voice off for this key: its track closed, the others told (their pages stop hearing it at their next sync)
  async stop(k, gone) {
    const v = this.row(k); if (!v) return;
    if (v.pub && v.prod && v.mid) await this.sfu.close(v.prod, [v.mid]).catch(() => {});
    if (gone && v.cons) await this.sfu.close(v.cons, Object.values(v.subs).map(s => s.mid)).catch(() => {});
    const was = v.pub;
    if (gone) this.h.sql.exec('DELETE FROM voice WHERE k = ?', String(k)); else { v.pub = 0; v.mid = null; this.save(k, v); }
    if (was) this.h.all({ t: 'vo', key: this.h.keyOut(k), on: false });
  }
  // close this key's subscriptions that fail the test (no answer needed: closed tracks just stop)
  async unsub(k, bad) {
    const v = this.row(k); if (!v || !v.cons) return [];
    const drop = Object.entries(v.subs).filter(([w]) => bad(w));
    if (!drop.length) return [];
    await this.sfu.close(v.cons, drop.map(([, s]) => s.mid)).catch(() => {});
    for (const [w] of drop) delete v.subs[w];
    this.save(k, v);
    return drop.map(([w]) => w);
  }
  // the room decides who hears whom, also after they move: every listener's speakers checked again (a speaker who walked
  // out of range, a listener who did), the ones no longer allowed closed and the page told what it hears now
  recheck(sockOf) {
    for (const r of this.h.sql.exec("SELECT k FROM voice WHERE subs IS NOT NULL AND subs != '{}'").toArray()) {
      const k = r.k, ws = sockOf(k), p = ws && ws.p;
      this.queue(k, async () => {
        const gone = await this.unsub(k, w => !p || !this.isOn(w) || !this.h.canHear(p, w));
        if (gone.length && ws) { const v = this.row(k) || { subs: {} }; this.h.send(ws.ws, { t: 'vs', subs: Object.entries(v.subs).map(([w, s]) => ({ key: this.h.keyOut(w), mid: s.mid })), push: 1 }); }
      });
    }
  }
  // a socket gone (left, kicked) or muted: its voice goes
  drop(k) { return this.queue(String(k), () => this.stop(String(k), true)); }
  mute(k) { return this.queue(String(k), () => this.stop(String(k), false)); }
  // every published voice off (voice switched off by the admins)
  muteAll() { for (const k of this.published()) this.mute(k); }
}
