// Golden tickets (Nov 2): the card a player opens from an event (the lobby's LIVE NOW / NEXT EVENT, Universe's stage bar):
// the front row for ticket holders, the free raffle (until the doors open) and the tickets sold for Rebel Points
// (api/golden-ticket.mjs decides everything: this only shows it and asks).
//   GoldenTicket.state(eventId)               -> Promise<golden | null> (kept 20 s)
//   GoldenTicket.open({ event, title, signIn, onChange })   a card over the page; Esc / ✕ / outside closes it
(() => {
  if (window.GoldenTicket) return;
  const cache = new Map(), esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function state(id, fresh) {
    const c = cache.get(id);
    if (!fresh && c && Date.now() - c.at < 20000) return c.g;
    try { const r = await fetch('/api/golden-ticket?event=' + encodeURIComponent(id), { cache: 'no-store', credentials: 'same-origin' }); const d = await r.json(); const g = d.ok ? d.golden : null; cache.set(id, { g, at: Date.now() }); return g; }
    catch (e) { return c?.g ?? null; }
  }
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `#gtWrap{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(4,4,10,.62);backdrop-filter:blur(3px);padding:16px}
#gtCard{position:relative;width:min(400px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;padding:20px 18px 16px;color:#f8efd8;font:500 14px/1.45 system-ui,sans-serif;
background:radial-gradient(120% 90% at 50% 0%,rgba(255,214,120,.22),rgba(0,0,0,0) 60%),linear-gradient(180deg,#1c140a,#0b0905);border:1px solid rgba(255,214,120,.65);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 22px 60px rgba(0,0,0,.6),0 0 40px rgba(255,190,80,.18)}
#gtCard .k{font:700 10px/1 'Cinzel Decorative',Georgia,serif;letter-spacing:3px;color:#ffd77a;text-transform:uppercase}
#gtCard h3{margin:8px 0 2px;font:800 21px/1.2 'Cinzel Decorative',Georgia,serif;color:#fff1c8;text-wrap:balance}
#gtCard .ev{color:#cdbb92;font-size:12.5px}
#gtCard .tk{margin:14px 0 12px;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;padding:12px;border-radius:12px;background:linear-gradient(135deg,#f6d77d,#b9862b);color:#2a1a04}
#gtCard .tk b{font:900 26px/1 'Cinzel Decorative',Georgia,serif}
#gtCard .tk span{font:700 12.5px/1.35 system-ui,sans-serif}
#gtCard .row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid rgba(255,214,120,.16)}
#gtCard .row .l{color:#e6d4a8}#gtCard .row .r{color:#fff3d0;font-weight:700;text-align:right}
#gtCard .mine{margin:10px 0 2px;padding:10px 12px;border-radius:10px;background:rgba(120,230,160,.12);border:1px solid rgba(120,230,160,.45);color:#c9f7d8;font-weight:700}
#gtCard .mine.lost{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.18);color:#d8cfbd}
#gtCard .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#gtCard button{flex:1 1 auto;min-height:42px;border-radius:999px;padding:0 16px;font:800 12px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(255,214,120,.75);background:rgba(255,214,120,.14);color:#fff1c8}
#gtCard button.p{background:linear-gradient(180deg,#ffd877,#d39b2f);color:#2a1a04;border-color:#ffe1a0}
#gtCard button:disabled{opacity:.45;cursor:default}
#gtCard .x{position:absolute;right:10px;top:10px;flex:none;width:34px;min-height:34px;padding:0;border-radius:50%;font-size:15px}
#gtCard .msg{margin-top:10px;font-size:12.5px;color:#ffcf8a;min-height:1em}
#gtCard .fine{margin-top:10px;color:#a89a7d;font-size:11.5px}`;
    document.head.appendChild(s);
  }
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const when = (ms) => new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function close() { document.getElementById('gtWrap')?.remove(); document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }
  async function open({ event, title, signIn, onChange }) {
    style(); close();
    const wrap = document.createElement('div'); wrap.id = 'gtWrap';
    wrap.innerHTML = '<div id="gtCard" role="dialog" aria-modal="true" aria-label="Golden ticket"><div class="k">Golden ticket</div><h3>Loading…</h3></div>';
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    document.body.appendChild(wrap); document.addEventListener('keydown', onKey, true);
    let g = await state(event, true), busy = false, msg = '';
    const paint = () => {
      const card = document.getElementById('gtCard'); if (!card) return;
      if (!g) { card.innerHTML = `<button class="x" aria-label="Close">✕</button><div class="k">Golden ticket</div><h3>${esc(title || 'This event')}</h3><p class="ev">No golden tickets for this one.</p>`; card.querySelector('.x').onclick = close; return; }
      const now = Date.now(), seats = (g.buy || 0) + (g.raffle || 0);
      const mineTx = { bought: '✦ You hold a golden ticket: a front-row seat is yours.', won: '✦ You won a golden ticket in the raffle: a front-row seat is yours.', entered: 'You are in the raffle. Winners are drawn as the doors open.', lost: 'The raffle is drawn: not this time.', paying: 'Your ticket is being paid… press Buy again if it does not finish.' }[g.mine] || '';
      card.innerHTML = `<button class="x" aria-label="Close">✕</button><div class="k">Golden ticket</div><h3>${esc(title || 'Colony Stage')}</h3>
<div class="ev">${now < g.starts ? 'Doors open ' + esc(when(g.starts)) : 'On now'}</div>
<div class="tk"><b>✦</b><span>The front row: ${seats} golden seat${seats === 1 ? '' : 's'} at the Comedy Club, only for ticket holders.</span></div>
${g.raffle ? `<div class="row"><span class="l">Free raffle${g.raffleOpen ? ' (until the doors open)' : ''}</span><span class="r">${g.drawn ? `${g.winners} drawn of ${g.entries}` : `${g.raffle} to win · ${g.entries} in`}</span></div>` : ''}
${g.buy ? `<div class="row"><span class="l">Tickets</span><span class="r">${fmt(g.price)} Rebel Points · ${g.left} of ${g.buy} left</span></div>` : ''}
${mineTx ? `<div class="mine${g.mine === 'lost' ? ' lost' : ''}">${esc(mineTx)}</div>` : ''}
<div class="acts"></div><div class="msg">${esc(msg)}</div>
<div class="fine">One ticket per player and time. Points paid for a ticket are paid back if the event is called off.</div>`;
      card.querySelector('.x').onclick = close;
      const acts = card.querySelector('.acts'), add = (label, fn, p, off) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (p) b.className = 'p'; b.disabled = !!off || busy; b.onclick = fn; acts.appendChild(b); };
      const holds = g.mine === 'bought' || g.mine === 'won';
      if (!g.signedIn) add('Sign in for a ticket', () => { close(); setTimeout(() => signIn?.(), 0); }, true); // (after this click: menus that close on a click elsewhere)
      else if (!holds) {
        if (g.raffleOpen && g.mine !== 'entered') add('Enter the raffle (free)', () => act('enter'), !g.buyOpen || !g.left);
        if (g.buyOpen && (g.left > 0 || g.mine === 'paying')) add(`Buy one · ${fmt(g.price)} pts`, () => act('buy'), true);
        if (!acts.children.length) add(g.buyOpen && !g.left ? 'Sold out' : 'Closed', () => {}, false, true);
      }
    };
    async function act(action) {
      busy = true; msg = action === 'buy' ? 'Paying with Rebel Points…' : 'Entering…'; paint();
      try {
        const r = await fetch('/api/golden-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ event, action }) });
        const d = await r.json().catch(() => ({}));
        if (d.golden) g = d.golden;
        msg = d.ok ? (action === 'buy' ? 'Done: the front row is yours.' : 'You are in the raffle.') : d.code === 'sign_in' ? 'Sign in first.' : (d.error || 'That did not work');
        cache.set(event, { g, at: Date.now() });
        if (d.ok) onChange?.(g);
      } catch (e) { msg = 'No answer: try again (you are never charged twice).'; }
      busy = false; paint();
    }
    paint();
  }
  window.GoldenTicket = { state, open, close };
})();
