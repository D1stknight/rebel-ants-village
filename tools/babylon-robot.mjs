#!/usr/bin/env node
// The Babylon robot (Oct 22). .github/workflows/babylon-check.yml runs it every Tuesday (Babylon publishes on Thursdays: five days
// later its quick fixes are out too):
//   node tools/babylon-robot.mjs plan [version]   the version in use (assets/vendor/babylon/current.json) against the newest on npm
//                                                 (or the one asked for); writes test, reason, pinned, latest, major to $GITHUB_OUTPUT.
//                                                 A version the robot already tested in the last 13 days (its report on branch
//                                                 babylon-update) is not tested again, unless FORCE=yes (a run started by hand)
//   node tools/babylon-robot.mjs report <now> <new>  compares two smoke runs (tools/babylon-smoke.mjs: the Babylon in use, then the
//                                                 newer one) and writes the verdict to assets/vendor/babylon/robot-report.json;
//   node tools/babylon-robot.mjs report <parts>   the same over the robot's parts (<parts>/<part>/now and .../new, one per GitHub job)
// Verdicts: pass = the newer Babylon did everything the one in use did (no new errors, every Rebel there, the same scene pieces,
// the rig check's moves the same); review = it works but something is different (scene pieces, Babylon warnings, a move);
// fail = new errors, a page that no longer starts, a missing Rebel or file. The robot never touches dev or main: it pushes the
// branch babylon-update (dev + the newer Babylon + this report) and the Admin Hub's Babylon card puts it on dev on Miguel's press.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const VENDOR = path.join(ROOT, 'assets/vendor/babylon');
const [cmd, a1, a2] = process.argv.slice(2);
const semver = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
const output = (pairs) => {
  const text = Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, text);
  process.stdout.write(text);
};
const summary = (md) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n'); console.log(md); };

if (cmd === 'plan') {
  const pinned = JSON.parse(fs.readFileSync(path.join(VENDOR, 'current.json'), 'utf8')).version;
  const r = await fetch('https://registry.npmjs.org/babylonjs', { headers: { accept: 'application/vnd.npm.install-v1+json' } });
  if (!r.ok) throw new Error('npm answered ' + r.status);
  const reg = await r.json();
  const want = String(a1 || '').trim();
  if (want && !reg.versions?.[want]) throw new Error(`babylonjs ${want} is not on npm`);
  const latest = want || reg['dist-tags'].latest;
  let last = null;
  try { last = JSON.parse(execFileSync('git', ['show', 'origin/babylon-update:assets/vendor/babylon/robot-report.json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) {}
  let test = newer(latest, pinned) || !!(want && want !== pinned), reason = test ? 'newer' : 'current';
  if (test && process.env.FORCE !== 'yes' && last?.version === latest && Date.now() - Date.parse(last.at) < 13 * 86400e3) { test = false; reason = 'tested'; }
  output({ pinned, latest, test: test ? 'yes' : 'no', reason, major: semver(latest)[0] > semver(pinned)[0] ? 'yes' : 'no', deprecated: reg.versions?.[latest]?.deprecated ? 'yes' : 'no' });
  summary(test ? `Babylon ${latest} is out (the site runs ${pinned}): testing it.` : reason === 'tested' ? `Babylon ${latest} was tested on ${last.at.slice(0, 10)} (${last.verdict}): not again yet.` : `The site runs ${pinned}, the newest Babylon: nothing to test.`);
} else if (cmd === 'report') {
  // one smoke run per folder, or the robot's parts (<parts>/<part>/now, .../new) put together
  const load = (dirs) => { const runs = dirs.filter((d) => fs.existsSync(path.join(d, 'smoke.json'))).map((d) => JSON.parse(fs.readFileSync(path.join(d, 'smoke.json'), 'utf8')));
    return runs.length ? { ...runs[0], pages: Object.assign({}, ...runs.map((r) => r.pages)) } : { babylon: null, pages: {} }; };
  const parts = a2 ? null : fs.readdirSync(a1).map((d) => path.join(a1, d)).filter((d) => fs.statSync(d).isDirectory());
  const now = a2 ? load([a1]) : load(parts.map((d) => path.join(d, 'now'))), nu = a2 ? load([a2]) : load(parts.map((d) => path.join(d, 'new')));
  if (!nu.babylon) nu.babylon = JSON.parse(fs.readFileSync(path.join(VENDOR, 'current.json'), 'utf8')).version;
  // every page the smoke test has: a part that died must not read as a pass
  const expected = ['hub', ...fs.readdirSync(path.join(ROOT, 'assets/world-layouts')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort(), 'forge', 'npcforge', 'terrainlab', 'rig'];
  const RANK = { pass: 0, review: 1, fail: 2 };
  const pages = {};
  const fresh = (a, b) => (b || []).filter((x) => !(a || []).includes(x));
  for (const id of expected) {
    const A = now.pages[id], B = nu.pages[id], notes = [];
    let v = 'pass';
    const mark = (level, note) => { notes.push(note); if (RANK[level] > RANK[v]) v = level; };
    if (!A || !B) { pages[id] = { verdict: 'fail', notes: [`not tested on ${!A ? 'the Babylon in use' : 'the newer Babylon'} (its part of the robot stopped)`] }; continue; }
    if (A.ok && !B.ok) mark('fail', B.failed ? `does not start: ${B.failed}` : B.kind === 'village' && !(B.player > 0) ? 'the Rebel did not appear' : 'does not start');
    for (const e of fresh(A.errors, B.errors)) mark('fail', 'new error: ' + e);
    for (const e of fresh(A.bjs, B.bjs)) mark('fail', 'new Babylon error: ' + e);
    for (const f of fresh(A.missing, B.missing)) mark('fail', 'asks for a file that is not there: ' + f);
    for (const s of fresh(A.babylonSites, B.babylonSites)) mark('review', "wants a file from Babylon's own site (blocked in the test): " + s);
    for (const w of fresh(A.warnings, B.warnings)) mark('review', 'new Babylon warning: ' + w);
    for (const e of fresh(A.console, B.console)) mark('review', 'new console error: ' + e);
    if ((B.notReady || 0) > (A.notReady || 0) + 2) mark('review', `${B.notReady} pieces on screen not ready to draw (was ${A.notReady || 0})`);
    const near = (x, y, abs, rel) => x == null || y == null || Math.abs(x - y) <= Math.max(abs, rel * Math.max(x, y));
    if (!near(A.meshes, B.meshes, 5, .02)) mark('review', `scene pieces ${A.meshes} -> ${B.meshes}`);
    if (!near(A.active, B.active, 10, .05)) mark('review', `pieces drawn ${A.active} -> ${B.active}`);
    if (A.kind === 'village' && A.player > 0 && B.player > 0 && A.player !== B.player) mark('review', `Rebel meshes ${A.player} -> ${B.player}`);
    if (A.rigCheck?.files && B.rigCheck?.files) {
      for (const fa of A.rigCheck.files) {
        const fb = B.rigCheck.files.find((f) => f.file === fa.file);
        if (!fb) { mark('fail', `${fa.file}: not loaded`); continue; }
        if (fa.bones !== fb.bones || fa.meshes !== fb.meshes) mark('fail', `${fa.file}: ${fa.bones} bones / ${fa.meshes} meshes -> ${fb.bones} / ${fb.meshes}`);
        for (const ga of fa.groups) {
          const gb = fb.groups.find((g) => g.name === ga.name);
          if (!gb) { mark('fail', `${fa.file}: the move ${ga.name} is gone`); continue; }
          if (Math.abs(ga.from - gb.from) > .01 || Math.abs(ga.to - gb.to) > .01) mark('review', `${fa.file} ${ga.name}: frames ${ga.from}-${ga.to} -> ${gb.from}-${gb.to}`);
          let d = 0; for (let i = 0; i < Math.min(ga.pose.length, gb.pose.length); i++) d = Math.max(d, Math.abs(ga.pose[i] - gb.pose[i]));
          if (ga.pose.length !== gb.pose.length || d > 50) mark('review', `${fa.file} ${ga.name}: the pose moved up to ${(d / 10).toFixed(1)} mm`);
        }
      }
    }
    pages[id] = { verdict: v, notes: notes.slice(0, 12), now: { ok: A.ok, ms: A.ms, meshes: A.meshes, player: A.player }, new: { ok: B.ok, ms: B.ms, meshes: B.meshes, player: B.player } };
  }
  const list = Object.values(pages), worst = list.reduce((w, p) => (RANK[p.verdict] > RANK[w] ? p.verdict : w), 'pass');
  const counts = { pages: list.length, pass: list.filter((p) => p.verdict === 'pass').length, review: list.filter((p) => p.verdict === 'review').length, fail: list.filter((p) => p.verdict === 'fail').length };
  const server = process.env.GITHUB_SERVER_URL, repo = process.env.GITHUB_REPOSITORY, runId = process.env.GITHUB_RUN_ID;
  const report = { version: nu.babylon, from: now.babylon, verdict: worst, at: new Date().toISOString(), counts, base: process.env.GITHUB_SHA || null,
    run: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null,
    major: semver(nu.babylon)[0] > semver(now.babylon)[0], pages };
  fs.writeFileSync(path.join(VENDOR, 'robot-report.json'), JSON.stringify(report, null, 2) + '\n');
  output({ verdict: worst, version: nu.babylon });
  const icon = { pass: '✅', review: '🟡', fail: '❌' };
  summary(`## Babylon ${nu.babylon} vs ${now.babylon}: ${icon[worst]} ${worst}\n\n| page | verdict | notes |\n|---|---|---|\n` +
    Object.entries(pages).map(([id, p]) => `| ${id} | ${icon[p.verdict]} ${p.verdict} | ${p.notes.join('<br>').replace(/\|/g, '/') || 'same'} |`).join('\n'));
} else {
  console.error('Usage: node tools/babylon-robot.mjs plan [version] | report <smoke dir now> <smoke dir new> | report <parts dir>');
  process.exit(1);
}
