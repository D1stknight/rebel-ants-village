#!/usr/bin/env bash
# Forge Rigger job: static Meshy GLB -> 65-bone mixamorig_ rig + cloth springs + 24 clips -> village GLB.
# usage: job.sh <source_glb_url> [name] [job_dir]
# Writes <job_dir>/progress (current step), <job_dir>/log, <job_dir>/rig.glb and <job_dir>/result.json.
set -eo pipefail
FW="$(cd "$(dirname "$0")" && pwd)"
SRC_URL="$1"; NAME="${2:-rebel}"; JOB="${3:-/vercel/sandbox/job}"
PY="${FORGE_PY:-$FW/venv/bin/python}"
export FORGE_OUT="$JOB/out" FORGE_CLIPS="$FW/clips" FORGE_PACK="$FW/pack" FORGE_PROXY_MINCOMP="${FORGE_PROXY_MINCOMP:-0.02}"
R="$FW/rigger"; O="$FORGE_OUT"
mkdir -p "$O"; : > "$JOB/log"
T0=$(date +%s)
step(){ echo "$1" > "$JOB/progress"; echo "== $1 ($(( $(date +%s) - T0 ))s)" >> "$JOB/log"; }
run(){ "$PY" "$@" >> "$JOB/log" 2>&1; }
fail(){ echo "failed" > "$JOB/progress"; printf '{"ok":false,"step":"%s","seconds":%s}\n' "$1" "$(( $(date +%s) - T0 ))" > "$JOB/result.json"; exit 1; }
trap 'fail "$(cat "$JOB/progress" 2>/dev/null)"' ERR

step download;   curl -fsSL --retry 3 "$SRC_URL" -o "$JOB/src.glb"
step normalize;  run "$R/normalize.py" -- "$JOB/src.glb" "$O/norm"
step landmarks;  run "$R/detect.py"
step skeleton;   run "$R/buildrig.py"
step weights;    run "$R/weights2.py"
                 run "$R/dumpbones.py" -- "$O/rigged.blend" "$O/bones.json"
                 run "$R/mkw.py"
step bind;       run "$R/applyw.py" -- "$O/rigged.blend" "$O/proxyW_g.npz" "$O/weighted.blend"
                 run "$R/fixarm.py" -- "$O/weighted.blend" "$O/weighted.blend"
step hands;      run "$R/handfix.py" -- "$O/weighted.blend" "$O/weighted_hf.blend"
step cloth;      run "$R/clothbones.py" -- "$O/weighted_hf.blend" "$O/weighted_cb.blend"
step animate;    run "$R/retarget.py" -- "$O/weighted_cb.blend" "$O/anim6.blend"
step moves;      run "$FW/anim/retarget_bvh.py" -- "$O/anim6.blend" "$O/anim6_ma.blend" "$FW/anim/clips.json"
step cleanup;    run "$R/fixarm.py" -- "$O/anim6_ma.blend" "$O/anim6_fix.blend"
                 run "$R/footfix.py" -- "$O/anim6_fix.blend" "$O/anim6_ff.blend"
step export;     FORGE_NAME="$NAME" FORGE_DECIMATE="${FORGE_DECIMATE:-0.35}" FORGE_TEX_BASE=1536 FORGE_TEX_OTHER=512 run "$R/export.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb"
step qa;         run "$FW/qa_job.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb" "$JOB/qa.json" "$JOB/log"
step thumb;      "$PY" "$FW/thumb.py" -- "$JOB/rig.glb" "$JOB/thumb.jpg" 384 >> "$JOB/log" 2>&1 || echo "thumb failed (non-fatal)" >> "$JOB/log"
SECS=$(( $(date +%s) - T0 ))
"$PY" - "$JOB" "$SECS" <<'PY'
import json, os, sys
job, secs = sys.argv[1], int(sys.argv[2])
qa = json.load(open(os.path.join(job, 'qa.json')))
json.dump({'ok': True, 'seconds': secs, 'bytes': os.path.getsize(os.path.join(job, 'rig.glb')), 'thumb': os.path.exists(os.path.join(job, 'thumb.jpg')), 'qa': qa}, open(os.path.join(job, 'result.json'), 'w'))
PY
echo done > "$JOB/progress"
