// Rebel Ants wallet sign-in (Phase 2), shared by the lobby and the Forge.
// The player signs a short message (free, no transaction). The server checks it and remembers the wallet for 7 days
// in an HttpOnly cookie, so the lobby, the Forge and the village all know who is playing.
(function () {
  const J = (r) => r.json().catch(() => ({}));
  async function session() {
    try { const j = await J(await fetch('/api/wallet-auth?action=session', { cache: 'no-store', credentials: 'same-origin' })); return j.address || null; } catch (e) { return null; }
  }
  function hexUtf8(s) { return '0x' + Array.from(new TextEncoder().encode(s)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
  // provider: an EIP-1193 wallet (MetaMask, Coinbase, Rabby, WalletConnect...); address: the connected account
  async function signIn(provider, address) {
    if (!provider || !/^0x[0-9a-fA-F]{40}$/.test(String(address || ''))) throw new Error('Connect a wallet first');
    const n = await J(await fetch('/api/wallet-auth?action=nonce', { cache: 'no-store' }));
    if (!n.nonce) throw new Error(n.error || 'Could not start sign-in');
    const host = location.host;
    const message = `${host} wants you to sign in with your Ethereum account:\n${address}\n\n` +
      `Sign in to Rebel Ants. This proves you hold this wallet. It is free and sends no transaction.\n\n` +
      `URI: ${location.origin}\nVersion: 1\nChain ID: 1\nNonce: ${n.nonce}\nIssued At: ${new Date().toISOString()}`;
    let signature;
    try { signature = await provider.request({ method: 'personal_sign', params: [hexUtf8(message), address] }); }
    catch (e) { const er = new Error(e?.code === 4001 ? 'Signature was cancelled' : (e?.message || 'Signature failed')); er.cancelled = e?.code === 4001; throw er; }
    const r = await fetch('/api/wallet-auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', message, signature }) });
    const j = await J(r);
    if (!r.ok || !j.address) throw new Error(j.error || 'Sign-in failed');
    return j.address;
  }
  async function signOut() { try { await fetch('/api/wallet-auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{"action":"logout"}' }); } catch (e) {} }
  // connect the browser wallet (no WalletConnect here) and sign in; returns the address
  async function connectAndSignIn() {
    const p = window.ethereum;
    if (!p) throw Object.assign(new Error('No browser wallet found. Connect your wallet in the lobby.'), { noWallet: true });
    const accts = await p.request({ method: 'eth_requestAccounts' });
    if (!accts || !accts[0]) throw new Error('No account returned from the wallet');
    return signIn(p, accts[0]);
  }
  window.RebelWallet = { session, signIn, signOut, connectAndSignIn };
})();
