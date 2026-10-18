// The Grand Relay (Oct 16, from the Hub): one run through all fifteen villages, gate to gate, in the gate menu's order.
// At its spot: the rules, the order and your best time, then Start (the button, Space or Enter) and run: the village
// keeps the clock across the page loads (window.GrandRelay, village.html) and each gate takes you straight on. At the
// last gate this same game shows the total (def.finishTime): gold, silver and bronze times, the fastest and slowest legs.
// def: { medals: [gold, silver, bronze] s, finishTime?, legs?: [s per village] }
(function () {
  const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; };
  const G = {
    title: 'The Grand Relay',
    start(ctx) {
      const H = ctx.HUD, def = ctx.def, R = window.GrandRelay, med = def.medals || R?.MEDALS || [195, 225, 270], names = R?.names?.() || [];
      H.title(def.title || 'The Grand Relay');
      // the finish: the total on the result card
      if (def.finishTime != null) {
        // Play again on this card has nothing to replay (a new relay starts at its spot in the Hub): it closes the card
        if (def._shown) { setTimeout(() => ctx.quit(), 0); return { update() {} }; }
        def._shown = true;
        const t = +def.finishTime, medal = t <= med[0] ? 'Gold' : t <= med[1] ? 'Silver' : t <= med[2] ? 'Bronze' : null;
        const legs = (def.legs || []).map((x, i) => [names[i] || 'a village', +x]), by = legs.slice().sort((a, b) => a[1] - b[1]), fast = by[0], slow = by[by.length - 1];
        H.score(fmt(t)); H.msg(medal ? `${medal}!` : 'All fifteen!', 1600, fmt(t)); ctx.sound('gamewin');
        let timer = setTimeout(() => { timer = null; ctx.finish({ time: t, finished: true, passed: !!medal, kicker: medal ? `${medal} medal` : 'All fifteen villages',
          extra: `${fmt(t)} through all ${legs.length || 15} villages.${fast ? ` Fastest leg: ${fast[0]}, ${fast[1].toFixed(1)} s; slowest: ${slow[0]}, ${slow[1].toFixed(1)} s.` : ''} Gold ${fmt(med[0])} · silver ${fmt(med[1])} · bronze ${fmt(med[2])}.` }); }, 500);
        return { update() {}, _test: { t, medal }, dispose() { if (timer) clearTimeout(timer); } };
      }
      // the start: the rules, the order, your best; Start hands the run to the village
      const low = ctx.record?.().low, hud = document.getElementById('gameHud'), card = document.createElement('div');
      card.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,92vw);max-height:80vh;overflow:auto;background:rgba(14,12,20,.95);border:1px solid rgba(232,190,90,.75);border-radius:14px;padding:16px 18px;pointer-events:auto;font:15px/1.45 Georgia,serif;color:#f1e9d6;text-align:center';
      card.innerHTML = `<div style="font:700 13px/1.2 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#e8be5a;margin-bottom:8px">The Grand Relay</div>
        <div style="margin-bottom:10px">Run through all fifteen villages, gate to gate. In each one the clock runs from the moment you arrive until you reach its gate; the gate takes you straight on to the next. Loading is not timed.</div>
        <div style="font-size:13px;color:#cdbf9f;margin-bottom:10px">${names.map((n, i) => `<b style="color:#e8be5a">${i + 1}</b> ${n}`).join(' · ')}</div>
        <div style="font-size:13px;margin-bottom:12px">Gold ${fmt(med[0])} · silver ${fmt(med[1])} · bronze ${fmt(med[2])}${low ? ` · your best <b style="color:#ffe9a0">${fmt(low)}</b>` : ''}</div>
        <button type="button" style="padding:9px 22px;border-radius:10px;border:1px solid #e8be5a;background:rgba(232,190,90,.2);color:#fff;font:700 16px Georgia,serif;cursor:pointer">Start</button>
        <div style="font-size:12px;color:#9a8f78;margin-top:8px">Hold <kbd>R</kbd> to run. Esc twice to leave.</div>`;
      let gone = false;
      const go = () => { if (gone || !R) return; gone = true; card.remove(); R.begin(); ctx.sound('whoosh'); ctx.quit(); };
      card.querySelector('button').onclick = (e) => { e.stopPropagation(); go(); };
      hud.appendChild(card);
      H.hint('<kbd>Space</kbd> or <kbd>Enter</kbd> to start the relay');
      return {
        update() {},
        key(e, down) { if (down && !e.repeat && (e.key === ' ' || e.key === 'Enter')) go(); },
        _test: { go },
        dispose() { card.remove(); }
      };
    }
  };
  window.RebelGames.register('relay', G);
})();
