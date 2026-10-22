// Admin Hub "Babylon" card (Oct 22): the 3D engine version the site runs (assets/vendor/babylon/current.json), the newest on npm,
// and the weekly robot's test of the newest (.github/workflows/babylon-check.yml: it pushes branch babylon-update = dev + that
// Babylon + assets/vendor/babylon/robot-report.json; it never changes dev or main).
// GET  (admin) ?pinned=<version this page's site runs>
//   -> { ok, pinned, dev, latest, latestAt, newer [{ version, at }], major, deprecated, candidate (the robot's report), robot (its last run) }
// POST (admin) { action: 'apply', version, confirm } -> merges babylon-update into dev when the robot's report for that version
//        says pass (review needs confirm: true); the dev preview then runs it and production gets it with the next dev -> main
//      { action: 'run', version? } -> starts the robot now (workflow_dispatch)
import { isAdminRequest } from './_admin-auth.mjs';

const REPO = 'D1stknight/rebel-ants-village';
const BRANCH = 'babylon-update';
const WORKFLOW = 'babylon-check.yml';
const REPORT = 'assets/vendor/babylon/robot-report.json';
const CURRENT = 'assets/vendor/babylon/current.json';
const VERSION = /^\d+\.\d+\.\d+$/;

const semver = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

async function gh(path, opts = {}) {
  const token = process.env.GITHUB_TOKEN || '';
  const r = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'rebel-ants-village', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) }
  });
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  return { status: r.status, ok: r.ok, body };
}
async function ghJsonFile(path, ref) {
  const r = await gh(`/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`, { headers: { accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} reading ${path} on ${ref}`);
  return typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
}

let npmCache = null;
async function npmInfo() {
  if (npmCache && Date.now() - npmCache.at < 10 * 60 * 1000) return npmCache.data;
  const r = await fetch('https://registry.npmjs.org/babylonjs', { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('npm answered ' + r.status);
  const d = await r.json();
  const data = { latest: d['dist-tags']?.latest, time: d.time || {}, deprecated: Object.fromEntries(Object.entries(d.versions || {}).filter(([, v]) => v.deprecated).map(([k, v]) => [k, String(v.deprecated)])) };
  npmCache = { at: Date.now(), data };
  return data;
}

async function lastRobotRun() {
  const r = await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`);
  if (r.status === 404) return { missing: true };
  if (!r.ok) return { error: `GitHub ${r.status}` };
  const run = r.body?.workflow_runs?.[0];
  return run ? { status: run.status, conclusion: run.conclusion, at: run.run_started_at || run.created_at, url: run.html_url, event: run.event } : { never: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  try {
    if (req.method === 'GET') {
      const pinnedQ = String(req.query?.pinned || '');
      const [npm, devCurrent, candidate, robot] = await Promise.all([
        npmInfo(),
        ghJsonFile(CURRENT, 'dev').catch(() => null),
        ghJsonFile(REPORT, BRANCH).catch((e) => ({ error: e.message })),
        lastRobotRun().catch((e) => ({ error: e.message }))
      ]);
      const pinned = VERSION.test(pinnedQ) ? pinnedQ : devCurrent?.version || null;
      const newerList = Object.keys(npm.time).filter((v) => VERSION.test(v) && pinned && newer(v, pinned))
        .sort((a, b) => (newer(a, b) ? 1 : -1)).map((v) => ({ version: v, at: npm.time[v] }));
      return res.status(200).json({
        ok: true, pinned, pinnedAt: pinned ? npm.time[pinned] || null : null, dev: devCurrent?.version || null, devSince: devCurrent?.since || null,
        latest: npm.latest, latestAt: npm.time[npm.latest] || null, newer: newerList.slice(-40), newerCount: newerList.length,
        major: !!(pinned && semver(npm.latest)[0] > semver(pinned)[0]), deprecated: pinned ? npm.deprecated[pinned] || null : null,
        candidate: candidate && !candidate.error && candidate.version ? candidate : null, candidateError: candidate?.error || null, robot,
        releasesUrl: 'https://github.com/BabylonJS/Babylon.js/releases'
      });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (body.action === 'run') {
        const inputs = VERSION.test(String(body.version || '')) ? { version: String(body.version) } : {};
        for (const ref of ['main', 'dev']) {
          const r = await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref, inputs }) });
          if (r.status === 204) return res.status(200).json({ ok: true, started: true, ref });
          if (r.status === 403 || r.status === 401) return res.status(200).json({ ok: false, error: "The site's GitHub key may not start the robot. It still runs every Tuesday; or start it on GitHub: Actions > Babylon update check > Run workflow." });
        }
        return res.status(200).json({ ok: false, error: 'The robot is not on GitHub yet: it starts once this update is on main (the next dev -> main).' });
      }
      if (body.action === 'apply') {
        const version = String(body.version || '');
        if (!VERSION.test(version)) return res.status(400).json({ ok: false, error: 'Which version?' });
        const [report, devCurrent] = await Promise.all([ghJsonFile(REPORT, BRANCH), ghJsonFile(CURRENT, 'dev')]);
        if (!report || report.version !== version) return res.status(409).json({ ok: false, error: `The robot has no tested ${version} waiting. Press "Run the robot now" and try again when it has finished.` });
        if (report.verdict === 'fail') return res.status(409).json({ ok: false, error: `The robot found problems with ${version}: it stays off.` });
        if (report.verdict === 'review' && body.confirm !== true) return res.status(409).json({ ok: false, error: 'This one needs a look first (the card lists what is different).', needsConfirm: true });
        if (devCurrent?.version && !newer(version, devCurrent.version)) return res.status(409).json({ ok: false, error: `dev already runs ${devCurrent.version}.` });
        const r = await gh(`/repos/${REPO}/merges`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ base: 'dev', head: BRANCH, commit_message: `Babylon ${version} on dev (Admin Hub; robot: ${report.verdict}, tested ${String(report.at || '').slice(0, 10)})` })
        });
        if (r.status === 201) return res.status(200).json({ ok: true, merged: r.body?.sha || null });
        if (r.status === 204) return res.status(200).json({ ok: true, merged: null, note: 'dev already had it' });
        if (r.status === 409) return res.status(409).json({ ok: false, error: 'dev has changed the same lines since the robot tested it: press "Run the robot now" to test it again on today\'s dev.' });
        return res.status(502).json({ ok: false, error: `GitHub did not merge it (${r.status}): ${r.body?.message || ''}`.trim() });
      }
      return res.status(400).json({ ok: false, error: 'Unknown action' });
    }
    return res.status(405).json({ ok: false, error: 'GET or POST' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e.message || e).slice(0, 200) });
  }
}
