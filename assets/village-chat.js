// Universe multiplayer, step 3 (text chat): the chat window, the bubbles over heads, and each player's tools (Whisper,
// Mute, Block, Report) and settings. The messages go through the room (assets/village-multiplayer.js -> realtime/): the
// room decides who may write (signed-in players; guests read), the limits (280 characters, one every 2 s or the admins'
// slow mode) and the word filter, and keeps the last 200. Mute and Block are this device's own (by the player's account
// code, so they hold in every village and visit); Report goes to the admins. Groups (village-groups.js): the Group channel,
// Invite to your group / Go to them / Take off the group in the name menu, and the group's members in 👥.
// window.VillageChat.start(host) from village.html, host = { scene, mp: window.VillageMP, canChat(), signedIn(), signIn(),
//   playerNode(), toast(msg) }; the room's news comes in through VillageChat.room(kind, data) (village-multiplayer.js).
// Desktop: Enter opens the line (Enter sends, Esc closes); phones: the chat button at the top right.
(function () {
  'use strict';
  const MAX = 280, KEEP = 200, SHOW_MS = 20000, BUBBLE_R = 45;
  const SETTINGS_KEY = 'rebelAntsMpSettings:v1', BLOCK_KEY = 'rebelAntsMpBlocked:v1', MUTE_KEY = 'rebelAntsMpMuted:v1';
  const CH_LABEL = { n: 'Nearby', v: 'Village', w: 'Whisper', g: 'Group', e: 'Event' };
  const GR = () => window.VillageGroup;
  const voiceHere = () => !!(window.VillageMP?.voice?.on || window.VillageGroup?.voice?.open?.() || window.VillageStage?.voice?.open?.()); // (the rooms, the group or the event have voice on: its controls show)
  const SG = () => window.VillageStage;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { ...d, ...v } : { ...d }; } catch (e) { return { ...d }; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const settings = load(SETTINGS_KEY, { players: true, names: true, bubbles: true, chat: true });
  const blocked = load(BLOCK_KEY, {}), muted = load(MUTE_KEY, {});
  let H = null, B = null, el = {}, started = false, live = false, me = { id: 0, u: '' }, cfg = { chat: true, slow: 2 }, mutedUntil = 0, banned = 0, kicked = false;
  let channel = 'n', whisperTo = null, lastSent = 0, open = false, unread = 0, hinted = false, seq = 0, histShown = false, panelMode = null, groupHist = null;
  const bubbles = new Map();

  const css = `
#vcChat{position:fixed;left:28px;bottom:70px;width:390px;max-width:calc(100vw - 56px);z-index:15;display:none;font:13px/1.38 -apple-system,'Segoe UI',Arial,sans-serif;color:#eef1f8;pointer-events:none}
#vcChat.on{display:block}
#vcLog{max-height:172px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;padding:6px 8px;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 26px);mask-image:linear-gradient(to bottom,transparent 0,#000 26px)}
#vcChat.open #vcLog{max-height:34vh;overflow-y:auto;justify-content:flex-start;background:rgba(5,10,28,.78);border:1px solid rgba(94,207,202,.28);border-bottom:0;-webkit-mask-image:none;mask-image:none;pointer-events:auto;backdrop-filter:blur(8px)}
.vl{text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.7);word-wrap:break-word;overflow-wrap:anywhere}
#vcChat.open .vl{text-shadow:none}
#vcChat:not(.open) .vl.old{display:none}
.vl .vt{font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:1.2px;text-transform:uppercase;margin-right:5px;opacity:.85;color:#cfd6e6}
.vl.ch-v .vt{color:#5ecfca}.vl.ch-w .vt,.vl.ch-w .vx{color:#f4a6dc}.vl.ch-g .vt{color:#7be38a}.vl.ch-g .vx{color:#d9f9de}.vl.ch-e .vt{color:#ffcf5a}.vl.ch-e .vx{color:#fff1cc}.vl .host{color:#ffcf5a;font-size:10px;margin-right:4px}.vl.sys{color:#e8c56a}.vl.sys .vt{color:#e8c56a}.vl.earlier{opacity:.72}
.vl .vn{font-weight:700;cursor:pointer;pointer-events:auto;margin-right:4px}.vl .vn:hover{text-decoration:underline}
.vl .vn.k-discord{color:#a9bbff}.vl .vn.k-name{color:#ffd36a}.vl .vn.k-guest{color:#d6d1e2}.vl .vn.me{cursor:default;text-decoration:none}
#vcBar{display:none;pointer-events:auto;background:rgba(5,10,28,.92);border:1px solid rgba(94,207,202,.4);padding:7px 8px 8px;backdrop-filter:blur(10px)}
#vcChat.open #vcBar{display:block}
.vc-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.vc-chip,.vc-ico{font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:1.4px;text-transform:uppercase;border:1px solid rgba(94,207,202,.4);background:transparent;color:#9fdcd8;padding:6px 9px;cursor:pointer;min-height:26px}
.vc-chip.on{background:rgba(94,207,202,.2);color:#e9fffd;border-color:#5ecfca}
.vc-chip.w.on{background:rgba(244,166,220,.18);border-color:#f4a6dc;color:#ffe3f5}
.vc-chip.g{border-color:rgba(123,227,138,.45);color:#a8ecb2}.vc-chip.g.on{background:rgba(123,227,138,.18);border-color:#7be38a;color:#e6ffe9}
.vc-chip.e{border-color:rgba(255,207,90,.5);color:#ffe29a}.vc-chip.e.on{background:rgba(255,207,90,.2);border-color:#ffcf5a;color:#fff6dd}
.vc-ico{margin-left:auto;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;letter-spacing:0;text-transform:none;padding:4px 8px}
.vc-ico+.vc-ico{margin-left:0}
#vcIn{flex:1;min-width:0;margin-top:7px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18);color:#fff;padding:8px 9px;font:14px -apple-system,'Segoe UI',Arial,sans-serif;outline:none}
#vcIn:focus{border-color:#5ecfca}
#vcCount{margin-top:7px;font-size:10px;color:#8b93a8;min-width:44px;text-align:right}
#vcNote{display:none;margin-top:7px;font-size:12px;color:#e8c56a}
#vcNote.on{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#vcNote button{font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:1.4px;background:rgba(232,197,106,.16);border:1px solid rgba(232,197,106,.6);color:#ffe9b0;padding:7px 10px;cursor:pointer}
#vcBtn{position:fixed;left:336px;bottom:22px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(94,207,202,.7);background:rgba(10,13,22,.85);color:#bff3ef;z-index:16;display:none;padding:0;cursor:pointer}
#vcBtn svg{width:22px;height:22px;display:block;margin:auto}
#vcBtn i{position:absolute;right:2px;top:2px;min-width:16px;height:16px;border-radius:8px;background:#e05a6b;color:#fff;font:700 10px/16px Arial,sans-serif;font-style:normal;display:none}
#vcBtn.unread i{display:block}
#vcBtn.on{display:block}
body:has(#wb:not(.on)) #vcBtn{display:none!important}
html.vt-touch #vcBtn{left:auto;bottom:auto;right:max(12px,env(safe-area-inset-right,0px));top:calc(max(12px,env(safe-area-inset-top,0px)) + 2px)}
html.vt-touch body:has(#wb:not(.on)) #vcBtn.on{display:block!important}
html.vt-touch #vcChat{left:auto;right:max(12px,env(safe-area-inset-right,0px));bottom:auto;top:calc(max(12px,env(safe-area-inset-top,0px)) + 54px);width:min(64vw,320px)}
html.vt-touch #vcChat #vcLog{max-height:118px}
html.vt-touch #vcChat.open{left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));width:auto;max-width:none}
html.vt-touch #vcChat.open #vcLog{max-height:38vh}
html.vt-touch #vcIn{font-size:16px}
html.vt-touch .vc-chip,html.vt-touch .vc-ico{min-height:34px;padding:9px 11px}
#vcMenu,#vcPanel{position:fixed;z-index:70;display:none;background:rgba(5,10,28,.97);border:1px solid rgba(94,207,202,.5);color:#eef1f8;font:13px -apple-system,'Segoe UI',Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);backdrop-filter:blur(12px)}
#vcMenu.on,#vcPanel.on{display:block}
#vcMenu{min-width:170px;padding:6px 0;z-index:71}
#vcMenu .mh{padding:6px 12px 8px;border-bottom:1px solid rgba(255,255,255,.1);font-weight:700}
#vcMenu .mh small{display:block;font-weight:400;color:#8b93a8;font-size:11px;margin-top:2px}
#vcMenu button,#vcPanel button.row{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;padding:9px 12px;cursor:pointer}
#vcMenu button:hover,#vcPanel button.row:hover{background:rgba(94,207,202,.14)}
#vcMenu button.bad{color:#ff9aa8}
#vcPanel{left:28px;bottom:70px;width:330px;max-width:calc(100vw - 32px);max-height:60vh;overflow-y:auto;padding:10px 0}
#vcPanel h4{margin:0;padding:4px 14px 8px;font:700 10px/1.2 'Cinzel Decorative',serif;letter-spacing:2px;color:#e8c56a;display:flex;justify-content:space-between;align-items:center}
#vcPanel h4 button{background:none;border:0;color:#8b93a8;font-size:16px;cursor:pointer;padding:0 4px}
#vcPanel .sub{padding:0 14px 8px;color:#8b93a8;font-size:12px}
#vcPanel button.row small{color:#8b93a8;margin-left:6px}
#vcPanel label{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;cursor:pointer}
#vcPanel label input{width:18px;height:18px;accent-color:#5ecfca}
#vcPanel label.range input{width:150px;height:auto;flex:0 0 150px;margin-left:12px}
#vcPanel .sep{height:1px;background:rgba(255,255,255,.1);margin:8px 0}
#vcPanel .grow{display:flex;align-items:center;gap:6px;padding:0 10px 0 0}
#vcPanel .grow button.row{flex:1;min-width:0}
#vcPanel .grow .go,#vcPanel .leave{font:700 9px/1 'Cinzel Decorative',serif;letter-spacing:1.3px;background:rgba(123,227,138,.14);border:1px solid rgba(123,227,138,.6);color:#dfffe4;padding:7px 9px;cursor:pointer;min-height:28px}
#vcPanel .leave{display:block;margin:6px 14px 2px;background:transparent;border-color:rgba(255,154,168,.55);color:#ffb3bf}
#vcPanel .lead{color:#e8c56a;margin-left:4px}
html.vt-touch #vcPanel .grow .go,html.vt-touch #vcPanel .leave{min-height:36px}
html.vt-touch #vcPanel{left:12px;right:12px;width:auto;bottom:auto;top:calc(max(12px,env(safe-area-inset-top,0px)) + 54px)}
body.in-game #vcChat,body.in-game #vcBtn,body.in-game #vcPanel,body.in-game #vcMenu{display:none!important}
`;
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v10H9l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/></svg>';

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const box = document.createElement('div'); box.id = 'vcChat';
    box.innerHTML = '<div id="vcLog" aria-live="polite"></div><div id="vcBar"><div class="vc-row" id="vcChips"></div>'
      + '<div class="vc-row"><input id="vcIn" maxlength="' + MAX + '" autocomplete="off" spellcheck="true" enterkeyhint="send"><span id="vcCount"></span></div><div id="vcNote"></div></div>';
    document.body.appendChild(box);
    const b = document.createElement('button'); b.id = 'vcBtn'; b.type = 'button'; b.title = 'Chat'; b.innerHTML = ICON + '<i></i>'; document.body.appendChild(b);
    const m = document.createElement('div'); m.id = 'vcMenu'; document.body.appendChild(m);
    const p = document.createElement('div'); p.id = 'vcPanel'; document.body.appendChild(p);
    el = { box, log: box.querySelector('#vcLog'), bar: box.querySelector('#vcBar'), chips: box.querySelector('#vcChips'), input: box.querySelector('#vcIn'), count: box.querySelector('#vcCount'), note: box.querySelector('#vcNote'), btn: b, menu: m, panel: p };
    b.onclick = e => { e.stopPropagation(); open ? close() : openChat(); };
    el.input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); const sent = sendLine(); if (sent && !window.VillageTouch?.on) close(); }
      else if (e.key === 'Escape') { e.preventDefault(); el.input.value = ''; paintCount(); close(); } // (Esc cancels the line)
    });
    el.input.addEventListener('keyup', e => e.stopPropagation());
    el.input.addEventListener('input', paintCount);
    el.log.addEventListener('click', e => { const n = e.target.closest('.vn'); if (n && !n.classList.contains('me')) { e.stopPropagation(); openMenu({ id: +n.dataset.id || 0, u: n.dataset.u || '', n: n.dataset.n || n.textContent, k: n.dataset.k, i: +n.dataset.i || 0, gi: +n.dataset.gi || 0, ei: +n.dataset.ei || 0 }, e); } });
    // Enter opens the line (when the game is not using the keys); a click elsewhere closes it, the menus too.
    // On the window, before anything else hears the key (village.html's own key handler on the document came first):
    // Esc with the chat, a name menu or a panel open only closes the chat, never leaves walking.
    window.addEventListener('keydown', e => {
      const t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(checkbox|radio|button|range)$/i.test(t.type || '')));
      if (typing) return; // (the chat line handles its own keys; other fields are someone else's)
      if (e.key === 'Escape' && (open || el.menu.classList.contains('on') || el.panel.classList.contains('on'))) { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (e.key !== 'Enter' || e.repeat || !live || open || !H.canChat()) return;
      e.preventDefault(); e.stopImmediatePropagation(); openChat();
    }, true);
    document.addEventListener('pointerdown', e => {
      if (el.menu.classList.contains('on') && !el.menu.contains(e.target)) closeMenu();
      if (el.panel.classList.contains('on') && !el.panel.contains(e.target) && !e.target.closest?.('.vc-ico')) el.panel.classList.remove('on');
      if (open && !el.box.contains(e.target) && e.target !== el.btn && !el.btn.contains(e.target) && !el.menu.contains(e.target) && !el.panel.contains(e.target)) close();
    }, true);
    setInterval(tickLines, 1000);
  }

  // ---- the window ----
  function openChat() {
    if (!live) return;
    open = true; el.box.classList.add('open'); el.box.style.visibility = ''; document.body.classList.add('vc-open'); unread = 0; paintBtn();
    paintBar(); el.log.scrollTop = el.log.scrollHeight;
    if (canWrite() && !window.VillageTouch?.on) el.input.focus(); // (phones: the keyboard comes when the line is tapped)
  }
  function close() {
    open = false; el.box.classList.remove('open'); document.body.classList.remove('vc-open'); el.box.style.visibility = settings.chat === false ? 'hidden' : '';
    try { el.input.blur(); } catch (e) {}
    closeMenu(); el.panel.classList.remove('on');
  }
  const canWrite = () => H.signedIn() && cfg.chat && !(mutedUntil > Date.now()) && !banned && !kicked;
  const timeOf = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateOf = ms => (ms > Date.now() + 300 * 86400000 ? 'further notice' : new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
  function paintBar() {
    if (!el.chips) return;
    const peerHere = whisperTo && H.mp.chat.peer(whisperTo.id);
    el.chips.innerHTML = '';
    const chip = (ch, label) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'vc-chip' + (ch === 'w' || ch === 'g' || ch === 'e' ? ' ' + ch : '') + (channel === ch ? ' on' : ''); b.textContent = label; b.onclick = e => { e.stopPropagation(); if (ch === 'w' && channel === 'w') { whisperTo = null; channel = 'n'; } else channel = ch; paintBar(); el.input.focus(); }; el.chips.appendChild(b); };
    const inGroup = !!GR()?.inGroup(); if (channel === 'g' && !inGroup) channel = 'n';
    const atEvent = !!SG()?.in(); if (channel === 'e' && !atEvent) channel = 'n';
    chip('n', 'Nearby'); chip('v', 'Village');
    if (inGroup) chip('g', 'Group');
    if (atEvent) chip('e', 'Event');
    if (whisperTo) chip('w', (channel === 'w' ? '✕ ' : '') + 'To ' + whisperTo.n + (peerHere ? '' : ' (left)'));
    const ppl = document.createElement('button'); ppl.type = 'button'; ppl.className = 'vc-ico'; ppl.title = 'Players here'; ppl.textContent = '👥 ' + H.mp.chat.peers().length; ppl.onclick = e => { e.stopPropagation(); showPeople(); };
    const gear = document.createElement('button'); gear.type = 'button'; gear.className = 'vc-ico'; gear.title = 'Chat settings'; gear.textContent = '⚙'; gear.onclick = e => { e.stopPropagation(); showSettings(); };
    el.chips.append(ppl, gear);
    const write = canWrite();
    el.input.disabled = !write; el.input.style.display = write ? '' : 'none'; el.count.style.display = write ? '' : 'none';
    el.input.placeholder = channel === 'w' && whisperTo ? 'Whisper to ' + whisperTo.n + '…' : channel === 'v' ? 'Say something to the village…' : channel === 'g' ? 'Say something to your group…' : channel === 'e' ? 'Say something to everyone at the event…' : 'Say something nearby…';
    el.note.innerHTML = ''; el.note.classList.toggle('on', !write);
    if (!write) {
      const t = document.createElement('span');
      if (banned) t.textContent = 'An admin has banned you from the rooms until ' + dateOf(banned) + '.';
      else if (kicked) t.textContent = 'An admin removed you from the room. Reload to come back.';
      else if (!H.signedIn()) { t.textContent = 'Sign in to chat (Discord, or a name and PIN). You can read along meanwhile.'; const s = document.createElement('button'); s.type = 'button'; s.textContent = 'Sign in'; s.onclick = e => { e.stopPropagation(); close(); H.signIn(); }; el.note.append(t, s); return; }
      else if (!cfg.chat) t.textContent = 'Chat is switched off right now.';
      else t.textContent = 'An admin muted you until ' + timeOf(mutedUntil) + '.';
      el.note.appendChild(t);
    }
    paintCount();
  }
  function paintCount() { const n = [...el.input.value].length; el.count.textContent = n ? n + '/' + MAX : ''; el.count.style.color = n > MAX - 20 ? '#ffb37a' : ''; }
  function paintBtn() { el.btn.classList.toggle('unread', unread > 0); const i = el.btn.querySelector('i'); if (i) i.textContent = unread > 9 ? '9+' : String(unread || ''); }
  function tickLines() {
    const now = Date.now();
    for (const l of el.log?.children || []) if (!l.classList.contains('old') && now - (+l.dataset.at || 0) > SHOW_MS) l.classList.add('old');
    if (open && mutedUntil && mutedUntil <= now) { mutedUntil = 0; paintBar(); }
  }

  // a line in the log: everything from other people goes in by textContent (never as markup)
  function addLine(m, o = {}) {
    if (!el.log) return;
    const row = document.createElement('div');
    row.className = 'vl ch-' + (m.ch || 'sys') + (o.sys ? ' sys' : '') + (o.earlier ? ' earlier old' : '');
    row.dataset.at = String(o.earlier ? 0 : Date.now());
    if (m.i) row.dataset.i = String(m.i);
    if (m.gi) row.dataset.gi = String(m.gi); // (a group message: its own numbering)
    if (m.ei) row.dataset.ei = String(m.ei); // (an event's message: the hall's numbering)
    if (m.u) row.dataset.u = m.u;
    row.title = m.at ? timeOf(m.at) : '';
    const tag = document.createElement('span'); tag.className = 'vt';
    if (o.sys) { tag.textContent = 'Universe'; row.append(tag, document.createTextNode(m.x)); }
    else {
      const mine = m.id === me.id || (m.u && m.u === me.u);
      tag.textContent = m.ch === 'w' ? (mine ? 'To ' + (m.tn || '') : 'From') : CH_LABEL[m.ch] || '';
      const name = document.createElement('b'); name.className = 'vn k-' + (m.k || 'guest') + (mine ? ' me' : '');
      name.textContent = mine && m.ch !== 'w' ? (m.n || 'You') : m.ch === 'w' && mine ? '' : (m.n || 'Rebel');
      name.dataset.id = String(m.id || 0); name.dataset.u = m.u || ''; name.dataset.k = m.k || ''; name.dataset.n = m.n || ''; if (m.i) name.dataset.i = String(m.i); if (m.gi) name.dataset.gi = String(m.gi); if (m.ei) name.dataset.ei = String(m.ei);
      const text = document.createElement('span'); text.className = 'vx'; text.textContent = m.x;
      row.append(tag); if (m.h) { const hb = document.createElement('span'); hb.className = 'host'; hb.textContent = '★ HOST'; row.append(hb); } if (name.textContent) row.append(name); row.append(text);
    }
    const stick = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 30;
    el.log.appendChild(row);
    while (el.log.children.length > KEEP) el.log.firstChild.remove();
    if (!open || stick) el.log.scrollTop = el.log.scrollHeight;
  }
  const sys = x => addLine({ x }, { sys: true });

  function sendLine() {
    let x = el.input.value.trim();
    if (!x) return false;
    if (!canWrite()) { paintBar(); return false; }
    let ch = channel, to = channel === 'w' && whisperTo ? whisperTo.id : 0;
    // /w name words · /v words · /n words · /g words · /e words
    const cmd = /^\/(w|v|n|g|e)\s+(.*)$/i.exec(x);
    if (cmd) {
      const c = cmd[1].toLowerCase();
      if (c === 'w') {
        const rest = cmd[2], lower = rest.toLowerCase();
        const who = H.mp.chat.peers().filter(p => lower.startsWith(p.n.toLowerCase() + ' ')).sort((a, b) => b.n.length - a.n.length)[0];
        if (!who) { sys('Whisper to whom? Pick a name in the chat or in 👥.'); return false; }
        ch = 'w'; to = who.id; x = rest.slice(who.n.length + 1).trim(); whisperTo = { id: who.id, u: who.u, n: who.n };
      } else { ch = c; x = cmd[2].trim(); }
      if (!x) return false;
    }
    if (ch === 'w' && !H.mp.chat.peer(to)) { sys((whisperTo?.n || 'They') + " isn't in this village any more."); return false; }
    const gap = (cfg.slow || 2) * 1000, wait = lastSent + gap - Date.now();
    if (wait > 0) { sys('Slow down: ' + Math.ceil(wait / 1000) + ' s.'); return false; }
    if ([...x].length > MAX) { sys(MAX + ' characters at most.'); return false; }
    if (ch === 'g') {
      if (!GR()?.inGroup()) { sys("You're not in a group. Tap a player's name, then Invite to your group."); return false; }
      if (!GR().say(x)) { sys('Not connected to your group yet.'); return false; }
    } else if (ch === 'e') {
      if (!SG()?.in()) { sys("You're not at an event right now."); return false; }
      if (!SG().say(x)) { sys('Not connected to the event yet.'); return false; }
    } else if (!H.mp.chat.send(ch, x, to)) { sys('Not connected to the room yet.'); return false; }
    lastSent = Date.now(); el.input.value = ''; paintCount();
    return true;
  }

  // ---- the name menu: Whisper, Mute, Block, Report ----
  function openMenu(t, ev) {
    closeMenu();
    const m = el.menu, here = t.id ? H.mp.chat.peer(t.id) : (t.u ? H.mp.chat.peers().find(p => p.u === t.u) : null);
    if (here) { t.id = here.id; t.u = here.u; t.n = here.n; t.k = here.k; }
    m.innerHTML = '';
    const head = document.createElement('div'); head.className = 'mh'; head.textContent = t.n || 'Rebel';
    const gm = t.u ? GR()?.member(t.u) : null;
    const sm = document.createElement('small'); sm.textContent = here ? (here.label || (here.k === 'guest' ? 'Visitor' : '')) + (here.d != null ? ' · ' + Math.round(here.d) + ' m' : '') : gm ? 'in your group · ' + GR().whereOf(gm) : 'not in this village now';
    head.appendChild(sm); m.appendChild(head);
    const item = (label, fn, bad) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (bad) b.className = 'bad'; b.onclick = e => { e.stopPropagation(); fn(); }; m.appendChild(b); };
    if (here && H.signedIn()) item('Whisper', () => { whisperTo = { id: here.id, u: here.u, n: here.n }; channel = 'w'; closeMenu(); openChat(); paintBar(); });
    const gr = GR(), member = !!(t.u && gr?.isMember(t.u)), st = gr?.state;
    if (member) {
      item('Go to them', () => { closeMenu(); close(); gr.goTo(t.u); });
      if (st && st.lead === st.you && t.u !== st.you) item('Take off the group', () => { gr.kick(t.u); closeMenu(); }, true);
    } else if (gr && here && H.signedIn() && here.k !== 'guest') item('Invite to your group', () => { closeMenu(); gr.invite(here); });
    if (t.u) {
      item(muted[t.u] ? 'Unmute' : 'Mute (hide their messages)', () => { if (muted[t.u]) delete muted[t.u]; else muted[t.u] = { n: t.n, at: Date.now() }; save(MUTE_KEY, muted); refreshHidden(); closeMenu(); sys(muted[t.u] ? t.n + ' is muted for you.' : t.n + ' is unmuted.'); });
      const VV = window.VillageVoice;
      if (VV && voiceHere() && t.k !== 'guest') item(VV.isMuted(t.u) ? 'Unmute their voice' : 'Mute their voice', () => { const on = !VV.isMuted(t.u); VV.mute(t.u, t.n, on); closeMenu(); sys(on ? t.n + "'s voice is muted for you." : t.n + "'s voice is back on."); });
      item(blocked[t.u] ? 'Unblock' : 'Block (hide them)', () => { if (blocked[t.u]) delete blocked[t.u]; else blocked[t.u] = { n: t.n, at: Date.now() }; save(BLOCK_KEY, blocked); refreshHidden(); closeMenu(); sys(blocked[t.u] ? t.n + ' is blocked: you no longer see them or their messages.' : t.n + ' is unblocked.'); }, !blocked[t.u]);
    }
    if (here || t.i || t.gi || t.ei) item('Report…', () => {
      m.innerHTML = ''; const h2 = document.createElement('div'); h2.className = 'mh'; h2.textContent = 'Report ' + (t.n || 'Rebel'); const s2 = document.createElement('small'); s2.textContent = t.i || t.gi || t.ei ? 'for this message' : 'the player'; h2.appendChild(s2); m.appendChild(h2);
      for (const [why, label] of [['spam', 'Spam'], ['abuse', 'Abuse or hate'], ['scam', 'Scam or fake links'], ['other', 'Something else']]) item(label, () => { (t.ei ? SG()?.report(t.ei, why) : t.gi ? GR()?.report(t.gi, why) : H.mp.chat.report(t.i ? { i: t.i, why } : { id: t.id, why })) ? sys('Sending your report…') : sys(t.ei ? 'Not connected to the event.' : t.gi ? 'Not connected to your group.' : 'Not connected to the room.'); closeMenu(); });
    }, true);
    const r = ev && ev.clientX != null ? { x: ev.clientX, y: ev.clientY } : { x: 40, y: innerHeight / 2 };
    m.classList.add('on');
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.x)) + 'px';
    m.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.y - h - 6 < 8 ? r.y + 12 : r.y - h - 6)) + 'px';
  }
  function closeMenu() { el.menu?.classList.remove('on'); }

  // ---- the people here, the settings ----
  function panelHead(title, mode) { panelMode = mode || null; el.panel.innerHTML = ''; const h = document.createElement('h4'); h.textContent = title; const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.onclick = e => { e.stopPropagation(); el.panel.classList.remove('on'); }; h.appendChild(x); el.panel.appendChild(h); }
  function showPeople() {
    panelHead('Players here', 'people');
    groupRows();
    const list = H.mp.chat.peers().sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));
    const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = list.length ? 'Tap a name to whisper, mute, block or report.' : 'Nobody else is in this village copy right now.'; el.panel.appendChild(sub);
    for (const p of list) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'row';
      const n = document.createElement('b'); n.className = 'vn k-' + p.k; n.textContent = p.n; n.style.cursor = 'pointer';
      const s = document.createElement('small'); s.textContent = [p.label || (p.k === 'guest' ? 'Visitor' : ''), p.d != null ? Math.round(p.d) + ' m' : 'in another place', blocked[p.u] ? 'blocked' : muted[p.u] ? 'muted' : ''].filter(Boolean).join(' · ');
      b.append(n, s); b.onclick = e => { e.stopPropagation(); openMenu({ id: p.id, u: p.u, n: p.n, k: p.k }, e); };
      el.panel.appendChild(b);
    }
    el.panel.classList.add('on');
  }
  // the group at the top of 👥: each member, where they are, Go; the leader's star; Leave the group
  function groupRows() {
    const gr = GR(); if (!gr) return;
    const st = gr.state;
    if (!st.id) {
      if (H.signedIn()) { const t = document.createElement('div'); t.className = 'sub'; t.textContent = 'Tap a name to invite that player to a group (up to ' + (st.max || 8) + '): you see where each other are in any village and chat together.'; el.panel.appendChild(t); el.panel.appendChild(Object.assign(document.createElement('div'), { className: 'sep' })); }
      return;
    }
    const others = st.members.filter(x => x.u !== st.you);
    const h = document.createElement('div'); h.className = 'sub'; h.textContent = 'Your group · ' + st.members.length + '/' + st.max + (st.lead === st.you ? ' · you lead it' : ''); el.panel.appendChild(h);
    if (!others.length) { const t = document.createElement('div'); t.className = 'sub'; t.textContent = 'Only you so far: tap a name below to invite someone.'; el.panel.appendChild(t); }
    for (const x of others) {
      const g = document.createElement('div'); g.className = 'grow';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'row';
      const n = document.createElement('b'); n.className = 'vn k-' + (x.k || 'name'); n.textContent = x.n;
      const star = document.createElement('span'); star.className = 'lead'; star.textContent = x.lead ? '★' : '';
      const sm = document.createElement('small'); sm.textContent = gr.whereOf(x) + (blocked[x.u] ? ' · blocked' : muted[x.u] ? ' · muted' : '');
      b.append(n, star, sm); b.onclick = e => { e.stopPropagation(); openMenu({ u: x.u, n: x.n, k: x.k }, e); };
      g.appendChild(b);
      if (gr.placeOf ? gr.placeOf(x) : x.on && x.v) { const go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.textContent = st.goal?.u === x.u ? '✓ Going' : 'Go'; go.onclick = e => { e.stopPropagation(); el.panel.classList.remove('on'); close(); gr.goTo(x.u); }; g.appendChild(go); }
      el.panel.appendChild(g);
    }
    const lv = document.createElement('button'); lv.type = 'button'; lv.className = 'leave'; lv.textContent = 'Leave the group'; lv.onclick = e => { e.stopPropagation(); gr.leave(); showPeople(); };
    el.panel.appendChild(lv);
    el.panel.appendChild(Object.assign(document.createElement('div'), { className: 'sep' }));
  }
  function showSettings() {
    panelHead('Chat settings', 'settings');
    const tog = (key, label) => { const l = document.createElement('label'); const s = document.createElement('span'); s.textContent = label; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = settings[key] !== false; c.onchange = () => { settings[key] = c.checked; save(SETTINGS_KEY, settings); refreshHidden(); }; l.append(s, c); el.panel.appendChild(l); };
    tog('players', 'Show other players'); tog('names', 'Name tags'); tog('bubbles', 'Chat bubbles over heads'); tog('chat', 'Chat on the screen');
    const VV = window.VillageVoice;
    if (VV && voiceHere()) { // voice (when it is on here): hear the others, how loud (village-voice.js keeps these)
      const l = document.createElement('label'); const s = document.createElement('span'); s.textContent = 'Hear voices'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = VV.settings.hear !== false; c.onchange = () => VV.set('hear', c.checked); l.append(s, c); el.panel.appendChild(l);
      const lv = document.createElement('label'); lv.className = 'range'; const sv = document.createElement('span'); const pct = () => { sv.textContent = 'Voice volume · ' + Math.round(+r.value * 100) + '%'; }; const r = document.createElement('input'); r.type = 'range'; r.min = '0'; r.max = '1.5'; r.step = '0.05'; r.value = String(VV.settings.volume ?? 1); pct(); r.oninput = () => { VV.set('volume', +r.value); pct(); }; lv.append(sv, r); el.panel.appendChild(lv);
      const how = document.createElement('div'); how.className = 'sub'; how.textContent = H.signedIn() ? 'Hold X (the Talk button on phones) to talk: the players near you hear you, or your group with Group picked.' : 'Sign in to talk and hear voices.'; el.panel.appendChild(how);
    }
    const lists = [['Blocked', blocked, BLOCK_KEY], ['Muted', muted, MUTE_KEY]];
    for (const [title, map, key] of lists) {
      const ks = Object.keys(map); if (!ks.length) continue;
      el.panel.appendChild(Object.assign(document.createElement('div'), { className: 'sep' }));
      const h = document.createElement('div'); h.className = 'sub'; h.textContent = title + ' (tap to undo)'; el.panel.appendChild(h);
      for (const u of ks) { const b = document.createElement('button'); b.type = 'button'; b.className = 'row'; b.textContent = map[u].n || 'Rebel'; b.onclick = e => { e.stopPropagation(); delete map[u]; save(key, map); refreshHidden(); showSettings(); }; el.panel.appendChild(b); }
    }
    const vm = window.VillageVoice?.muted?.() || {};
    if (Object.keys(vm).length) {
      el.panel.appendChild(Object.assign(document.createElement('div'), { className: 'sep' }));
      const h = document.createElement('div'); h.className = 'sub'; h.textContent = 'Voices muted (tap to undo)'; el.panel.appendChild(h);
      for (const u of Object.keys(vm)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'row'; b.textContent = vm[u].n || 'Rebel'; b.onclick = e => { e.stopPropagation(); window.VillageVoice.mute(u, vm[u].n, false); showSettings(); }; el.panel.appendChild(b); }
    }
    el.panel.classList.add('on');
  }
  // settings and blocks apply at once: the log, the bubbles, the characters (village-multiplayer.js asks hidePeer / namesOn)
  function refreshHidden() {
    el.box.style.visibility = settings.chat === false && !open ? 'hidden' : '';
    for (const l of el.log.children) { const u = l.dataset.u; l.style.display = u && (blocked[u] || muted[u]) ? 'none' : ''; }
    for (const [k, b] of bubbles) if (b.u && (blocked[b.u] || muted[b.u])) dropBubble(k);
  }

  // ---- bubbles over heads ----
  function wrap(c, text, w, maxRows) {
    const words = text.split(' '), rows = []; let cur = '';
    const fit = s => { while (c.measureText(s).width > w && s.length > 1) s = s.slice(0, -1); return s; };
    for (let word of words) {
      if (c.measureText(word).width > w) { if (cur) { rows.push(cur); cur = ''; } while (c.measureText(word).width > w) { const part = fit(word); rows.push(part); word = word.slice(part.length); } }
      const t = cur ? cur + ' ' + word : word;
      if (c.measureText(t).width > w) { rows.push(cur); cur = word; } else cur = t;
    }
    if (cur) rows.push(cur);
    if (rows.length > maxRows) { rows.length = maxRows; let last = rows[maxRows - 1]; while (c.measureText(last + '…').width > w && last.length) last = last.slice(0, -1); rows[maxRows - 1] = last + '…'; }
    return rows;
  }
  function dropBubble(key) { const b = bubbles.get(key); if (!b) return; bubbles.delete(key); try { b.mesh.dispose(); b.mat.dispose(); b.tex.dispose(); } catch (e) {} }
  function bubble(key, m) {
    if (!B || !H.scene || settings.bubbles === false) return;
    dropBubble(key);
    const W = 512, Hh = 256, pad = 22, lineH = 40, tail = 22;
    const tex = new B.DynamicTexture('vcBubbleTex_' + (++seq), { width: W, height: Hh }, H.scene, true), c = tex.getContext();
    c.font = '600 32px Arial, sans-serif';
    const rows = wrap(c, m.x, W - pad * 2 - 8, 3), wMax = Math.max(...rows.map(r => c.measureText(r).width));
    const bw = Math.min(W - 6, wMax + pad * 2), bh = rows.length * lineH + pad * 1.4, x0 = (W - bw) / 2, y0 = Hh - tail - bh;
    c.clearRect(0, 0, W, Hh);
    c.fillStyle = 'rgba(250,248,242,.95)'; c.strokeStyle = m.ch === 'v' ? 'rgba(52,170,165,.95)' : m.ch === 'g' ? 'rgba(70,176,92,.95)' : 'rgba(40,46,64,.55)'; c.lineWidth = 5;
    c.beginPath(); const r = 22;
    c.moveTo(x0 + r, y0); c.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, r); c.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, r);
    c.lineTo(W / 2 + 14, y0 + bh); c.lineTo(W / 2, Hh - 3); c.lineTo(W / 2 - 14, y0 + bh);
    c.arcTo(x0, y0 + bh, x0, y0, r); c.arcTo(x0, y0, x0 + bw, y0, r); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#141824'; c.textAlign = 'center'; c.textBaseline = 'middle';
    rows.forEach((row, k) => c.fillText(row, W / 2, y0 + pad * .7 + lineH * (k + .5)));
    tex.hasAlpha = true; tex.update();
    const mat = new B.StandardMaterial('vcBubbleMat_' + seq, H.scene);
    mat.diffuseTexture = tex; mat.emissiveTexture = tex; mat.useAlphaFromDiffuseTexture = true; mat.disableLighting = true; mat.backFaceCulling = false; mat.specularColor = B.Color3.Black();
    const mesh = B.MeshBuilder.CreatePlane('vcBubble_' + seq, { width: 2.8, height: 1.4 }, H.scene);
    mesh.material = mat; mesh.billboardMode = B.Mesh.BILLBOARDMODE_ALL; mesh.isPickable = false; mesh.applyFog = false;
    mesh.metadata = { camSkip: true, mpPeer: true }; mesh.setEnabled(false);
    const now = performance.now();
    bubbles.set(key, { mesh, mat, tex, u: m.u || '', i: m.gi ? 'g' + m.gi : m.ei ? 'e' + m.ei : m.i || 0, born: now, until: now + (window._vcBubbleMs || Math.min(10000, 4200 + [...m.x].length * 70)) }); // (_vcBubbleMs: tests on slow frames)
  }
  function tickBubbles() {
    if (!bubbles.size) return;
    const now = performance.now(), cam = H.scene.activeCamera?.globalPosition;
    for (const [key, b] of bubbles) {
      if (now > b.until) { dropBubble(key); continue; }
      let pos = null, k = 1;
      if (key === 'me') {
        const n = H.playerNode?.(); if (n && n.isEnabled()) { pos = n.getAbsolutePosition().add(new B.Vector3(0, 3.95, 0)); const dc = cam ? B.Vector3.Distance(cam, pos) : 9; k = dc < 9 ? Math.max(.12, dc / 10) : Math.min(2.4, Math.max(.9, dc / 14)); } // (a camera pulled in by a wall or a room: the same size on screen)
      } else {
        const p = H.mp.chat.peer(+key);
        if (p && p.holder.isEnabled() && p.d != null && p.d < BUBBLE_R) {
          const tag = p.tag && p.tag.isEnabled() ? p.tag : null;
          k = tag ? tag.scaling.y * p.holder.scaling.y : 1; // (the name tag's size on screen: the bubble keeps to it)
          pos = tag ? tag.getAbsolutePosition().add(new B.Vector3(0, .4 * k, 0)) : p.holder.getAbsolutePosition().add(new B.Vector3(0, 3.9, 0));
        }
      }
      if (!pos) { b.mesh.setEnabled(false); continue; }
      b.mesh.setEnabled(true); b.mesh.scaling.setAll(k);
      b.mesh.position.copyFrom(pos); b.mesh.position.y += .68 * k; // (the tail's tip at the bottom edge of the picture)
      b.mat.alpha = Math.min(1, (now - b.born) / 160) * Math.min(1, (b.until - now) / 450);
    }
  }

  // ---- the room's news (village-multiplayer.js) ----
  const SAYS = {
    off: () => 'Chat is switched off right now.', same: () => 'You just said that.', long: d => (d.max || MAX) + ' characters at most.',
    nopos: () => 'Walk into the village first to talk nearby, or pick Village.', gone: () => "They aren't in this village any more.",
    'report-slow': () => 'One report every 15 seconds, please.', 'report-none': () => "That can't be reported.",
    slow: d => 'Slow down: ' + Math.max(1, Math.ceil((d.wait || 1000) / 1000)) + ' s.', guest: () => 'Sign in to chat (Discord, or a name and PIN).',
    muted: d => 'An admin muted you until ' + timeOf(d.until) + '.'
  };
  function room(kind, d) {
    if (!started) return;
    if (kind === 'hello') {
      // a room server without the chat (step 2's: its hello has no settings) gets no chat window, nothing typed goes nowhere
      if (!d.cfg) { live = false; if (open) close(); el.box.classList.remove('on'); el.btn.classList.remove('on'); return; }
      live = true; me = { id: d.you, u: d.u || '' }; cfg = { chat: d.cfg?.chat !== false, slow: d.cfg?.slow || 2 }; mutedUntil = d.mute || 0; kicked = false; banned = 0;
      el.box.classList.add('on'); el.btn.classList.add('on');
      if (!histShown) { histShown = true; for (const m of d.hist || []) if (!(m.u && (blocked[m.u] || muted[m.u]))) addLine(m, { earlier: true }); }
      if (!hinted) { hinted = true; sys(window.VillageTouch?.on ? (H.signedIn() ? 'Tap 💬 to chat with the players here.' : 'Tap 💬 to read the chat. Sign in to write.') : (H.signedIn() ? 'Press Enter to chat with the players here.' : 'Press Enter to read the chat. Sign in to write.')); }
      refreshHidden(); if (open) paintBar();
      return;
    }
    if (kind === 'closed') { live = false; for (const k of [...bubbles.keys()]) if (k !== 'me') dropBubble(k); if (open) paintBar(); return; }
    if (kind === 'leave') { dropBubble(String(d)); if (open) paintBar(); return; }
    if (kind === 'join') { if (open) paintBar(); return; }
    const m = d;
    if (m.t === 'c' && m.m) {
      const msg = m.m, mine = msg.id === me.id;
      if (msg.u && !mine && (blocked[msg.u] || muted[msg.u])) return;
      addLine(msg);
      if (!mine && !open) { unread++; paintBtn(); }
      if (msg.ch !== 'w') bubble(mine ? 'me' : String(msg.id), msg);
      return;
    }
    if (m.t === 'cx') { const f = SAYS[m.why]; if (m.why === 'muted') { mutedUntil = m.until || 0; paintBar(); } if (f) sys(f(m)); return; }
    if (m.t === 'rpok') { sys('Thanks. An admin will look at your report.'); return; }
    if (m.t === 'cd') { el.log.querySelectorAll('.vl[data-i="' + (+m.i) + '"]').forEach(l => l.remove()); for (const [k, b] of [...bubbles]) if (b.i === +m.i) dropBubble(k); return; }
    if (m.t === 'cc') { el.log.querySelectorAll('.vl:not(.sys)').forEach(l => l.remove()); for (const k of [...bubbles.keys()]) dropBubble(k); sys('An admin cleared the chat.'); return; }
    if (m.t === 'cfg') { const was = cfg; cfg = { chat: m.chat !== false, slow: m.slow || 2 }; if (was.chat !== cfg.chat) sys(cfg.chat ? 'Chat is back on.' : 'An admin switched the chat off.'); else if (was.slow !== cfg.slow) sys(cfg.slow > 2 ? 'Slow mode: one message every ' + cfg.slow + ' s.' : 'Slow mode is off.'); if (open) paintBar(); return; }
    if (m.t === 'cm') { mutedUntil = m.until || 0; sys(mutedUntil > Date.now() ? 'An admin muted you until ' + timeOf(mutedUntil) + '.' : 'You can chat again.'); if (open) paintBar(); return; }
    if (m.t === 'kick') {
      if (m.why === 'banned') { banned = m.until || 1; sys('An admin has banned you from the rooms until ' + dateOf(banned) + '.'); }
      else { kicked = true; sys('An admin removed you from the room. Reload to come back.'); }
      live = false; if (open) paintBar();
    }
  }

  // ---- the group's news (village-groups.js) ----
  const GSAYS = {
    member: d => d.n + ' is in your group already.', full: () => 'Your group is full (' + (GR()?.state.max || 8) + ').', slow: () => 'One invite every 2 seconds.',
    who: () => "You can't invite them.", offline: () => 'Not connected to your group yet.'
  };
  function groupEvent(kind, d) {
    if (!started) return;
    d = d || {};
    const repaint = () => { paintBar(); if (panelMode === 'people' && el.panel.classList.contains('on')) showPeople(); }; // (the bar too while the chat is shut: it shows as it is when opened)
    if (kind === 'msg') {
      const mine = !!(d.u && d.u === (me.u || GR()?.state.you));
      if (d.u && !mine && (blocked[d.u] || muted[d.u])) return;
      const peer = d.u ? H.mp.chat.peers().find(p => p.u === d.u) : null, m = { ch: 'g', gi: d.i, id: peer ? peer.id : 0, u: d.u, n: d.n, k: d.k, x: d.x, at: d.at };
      addLine(m);
      if (!mine && !open) { unread++; paintBtn(); }
      if (mine) bubble('me', m); else if (peer) bubble(String(peer.id), m);
      return;
    }
    if (kind === 'hello') {
      if (groupHist !== d.g) { // (the group's last messages, once per group on this page)
        groupHist = d.g;
        for (const m of d.hist || []) if (!(m.u && (blocked[m.u] || muted[m.u]))) addLine({ ch: 'g', gi: m.i, u: m.u, n: m.n, k: m.k, x: m.x, at: m.at }, { earlier: true });
        if (d.first) sys('You are in a group (' + (d.members?.length || 1) + '/' + (d.max || 8) + '): pick Group to talk to it, 👥 shows where everyone is.');
      }
      repaint(); return;
    }
    if (kind === 'join') { sys(d.n + ' joined your group.'); repaint(); return; }
    if (kind === 'leave') { sys(d.why === 'kick' ? d.n + ' was taken off the group.' : d.why === 'away' ? d.n + ' was away too long and left the group.' : d.n + ' left the group.'); repaint(); return; }
    if (kind === 'lead') { sys(d.me ? 'You lead the group now.' : d.n + ' leads the group now.'); repaint(); return; }
    if (kind === 'gone') {
      const say = { left: 'You left the group.', kick: 'The group leader took you off the group.', away: 'You were away too long and left the group.', ended: 'The group ended.', gone: 'That group is gone.' }[d.why];
      if (say) sys(say);
      if (channel === 'g') channel = 'n';
      groupHist = null; repaint(); return;
    }
    if (kind === 'making') { sys('Making a group to invite ' + d.n + '…'); return; }
    if (kind === 'failed') { sys("Couldn't make a group right now (an account makes 30 a day at most)."); return; }
    if (kind === 'invited') { sys(d.sent ? 'Invited ' + d.n + ': they get a card to join.' : d.n + " isn't in this village copy any more."); return; }
    if (kind === 'invite-no') { const f = GSAYS[d.why]; sys(f ? f(d) : "Couldn't invite " + d.n + '.'); return; }
    if (kind === 'join-no') { sys("Couldn't join " + d.n + "'s group: the invite may have run out (10 minutes), or the group is full."); return; }
    if (kind === 'refused') { const f = SAYS[d.why]; if (f) sys(f(d)); return; }
    if (kind === 'deleted') { el.log.querySelectorAll('.vl[data-gi="' + (+d.i) + '"]').forEach(l => l.remove()); for (const [k, b] of [...bubbles]) if (b.i === 'g' + (+d.i)) dropBubble(k); return; }
    if (kind === 'cleared') { el.log.querySelectorAll('.vl.ch-g').forEach(l => l.remove()); for (const [k, b] of [...bubbles]) if (String(b.i).startsWith('g')) dropBubble(k); sys('An admin cleared the group chat.'); return; }
    if (kind === 'reported') { sys('Thanks. An admin will look at your report.'); return; }
    if (kind === 'found') { sys('You found ' + d.n + '.'); return; }
    if (kind === 'copy') { sys('Moving to ' + d.n + "'s copy of this village…"); return; }
    if (kind === 'online' || kind === 'goto') { repaint(); return; }
  }

  // ---- an event's hall (village-stage.js): its chat as the Event channel ----
  let stageHist = null;
  function stageEvent(kind, d) {
    if (!started) return;
    d = d || {};
    if (kind === 'msg') {
      const mine = !!(d.u && d.u === SG()?.state?.you);
      if (d.u && !mine && (blocked[d.u] || muted[d.u])) return;
      const peer = d.u ? H.mp.chat.peers().find(p => p.u === d.u) : null, m = { ch: 'e', ei: d.i, id: peer ? peer.id : 0, u: d.u, n: d.n, k: d.k, x: d.x, at: d.at, h: d.h };
      addLine(m);
      if (!mine && !open) { unread++; paintBtn(); }
      if (mine) bubble('me', m); else if (peer) bubble(String(peer.id), m);
      return;
    }
    if (kind === 'hello') {
      if (stageHist !== d.ev?.id) {
        stageHist = d.ev?.id;
        for (const m of d.hist || []) if (!(m.u && (blocked[m.u] || muted[m.u]))) addLine({ ch: 'e', ei: m.i, u: m.u, n: m.n, k: m.k, x: m.x, at: m.at, h: m.h }, { earlier: true });
        sys("You're at " + (d.ev?.title || 'the event') + (H.signedIn() ? ': pick Event to talk to everyone here.' : '. Sign in to chat and raise your hand.'));
      }
      paintBar(); return;
    }
    if (kind === 'scx') { const f = SAYS[d.why]; if (f) sys(f(d)); return; }
    if (kind === 'scd') { el.log.querySelectorAll('.vl[data-ei="' + (+d.i) + '"]').forEach(l => l.remove()); for (const [k, b] of [...bubbles]) if (b.i === 'e' + (+d.i)) dropBubble(k); return; }
    if (kind === 'scc') { el.log.querySelectorAll('.vl.ch-e').forEach(l => l.remove()); for (const [k, b] of [...bubbles]) if (String(b.i).startsWith('e')) dropBubble(k); sys('An admin cleared the event chat.'); return; }
    if (kind === 'rpok') { sys('Thanks. An admin will look at your report.'); return; }
    if (kind === 'left') { if (channel === 'e') channel = 'n'; stageHist = null; paintBar(); return; }
  }

  function start(host) {
    if (started || !host) return;
    H = host; B = window.BABYLON; started = true;
    build();
    H.scene.onBeforeRenderObservable.add(() => { try { tickBubbles(); } catch (e) {} });
  }
  window.VillageChat = {
    start, room, group: groupEvent, stage: stageEvent, isBlocked: u => !!(u && blocked[u]),
    hidePeer: p => settings.players === false || !!(p.u && blocked[p.u]),
    namesOn: () => settings.names !== false,
    get state() { return { live, open, me, cfg, mutedUntil, banned, kicked, channel, whisperTo, lines: el.log ? el.log.children.length : 0, bubbles: [...bubbles.keys()], settings, blocked: Object.keys(blocked), muted: Object.keys(muted) }; },
    open: openChat, close, send: (x, ch, to) => { if (ch) channel = ch; if (to) whisperTo = to; el.input.value = x; return sendLine(); }
  };
})();
