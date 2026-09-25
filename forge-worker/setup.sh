#!/usr/bin/env bash
# Forge Rigger worker image: builds everything a rig job needs, then the API snapshots the sandbox.
# usage (as root, in a vercel/sandbox/ubuntu sandbox): setup.sh <github_raw_base> <pack.json>
#   github_raw_base = https://raw.githubusercontent.com/<owner>/<repo>/<commit>
#   pack.json       = {"mixamo/jab.npz": "<blob url>", ...} (mocap sources; kept off GitHub)
set -eo pipefail
RAW="$1"; PACK_JSON="$2"; FW=/vercel/sandbox/fw
mkdir -p "$FW"; cd "$FW"
echo "== system libs"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates libx11-6 libxrender1 libxfixes3 libxi6 libxkbcommon0 libxext6 libsm6 libice6 libgl1 libglx0 >/dev/null
echo "== python 3.13 + bpy"
if ! command -v uv >/dev/null; then curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh >/dev/null; fi
uv venv -q --python 3.13 "$FW/venv"
uv pip install -q --python "$FW/venv/bin/python" bpy==5.2.0 numpy scipy pillow
echo "== worker code"
curl -fsSL "$RAW/forge-worker/manifest.json" -o manifest.json
"$FW/venv/bin/python" - "$RAW" <<'PY'
import json, os, sys, urllib.request
raw = sys.argv[1]
for rel in json.load(open('manifest.json'))['files']:
    os.makedirs(os.path.dirname(rel) or '.', exist_ok=True)
    urllib.request.urlretrieve(f'{raw}/forge-worker/{rel}', rel)
os.makedirs('clips', exist_ok=True)
for c in ('idle', 'walk', 'run', 'jumping', 'flip_kick'):
    urllib.request.urlretrieve(f'{raw}/assets/character/ant_{c}_c.glb', f'clips/ant_{c}_c.glb')
PY
chmod +x job.sh
echo "== mocap pack"
"$FW/venv/bin/python" - "$PACK_JSON" <<'PY'
import json, os, sys, urllib.request
for rel, url in json.load(open(sys.argv[1])).items():
    p = os.path.join('pack', rel); os.makedirs(os.path.dirname(p), exist_ok=True); urllib.request.urlretrieve(url, p)
print('pack files', len(json.load(open(sys.argv[1]))))
PY
echo "== self test"
"$FW/venv/bin/python" -c "import bpy, scipy, numpy, PIL; print('bpy', bpy.app.version_string)"
"$FW/venv/bin/python" - <<'PY'
import json, os
need = sorted(set(c['file'] for c in json.load(open('anim/clips.json'))))
miss = [f for f in need if not os.path.exists(os.path.join('pack', f))]
assert not miss, f'missing mocap files: {miss}'
print('clips ok', len(need))
PY
echo ready > "$FW/READY"
