#!/usr/bin/env bash
# Forge Rigger job: static Meshy GLB -> 65-bone mixamorig_ rig + cloth springs + 24 clips -> village GLB.
# usage: job.sh <source_glb_url> [name] [job_dir]
# Writes <job_dir>/progress (current step), <job_dir>/log, <job_dir>/rig.glb and <job_dir>/result.json.
set -eEo pipefail   # -E: the ERR trap also fires inside run() so a failed step is reported
FW="$(cd "$(dirname "$0")" && pwd)"
SRC_URL="$1"; NAME="${2:-rebel}"; JOB="${3:-/vercel/sandbox/job}"
PY="${FORGE_PY:-$FW/venv/bin/python}"
export FORGE_OUT="$JOB/out" FORGE_CLIPS="$FW/clips" FORGE_PACK="$FW/pack" FORGE_PROXY_MINCOMP="${FORGE_PROXY_MINCOMP:-0.02}"
# v1.6: keep bridge/tear faces (fixarm reweights them) so robes have no see-through cracks
export FORGE_KEEP_TEAR="${FORGE_KEEP_TEAR-1}" FORGE_KEEP_BRIDGE="${FORGE_KEEP_BRIDGE-1}"   # set to empty to cut them (TRELLIS)
R="$FW/rigger"; O="$FORGE_OUT"
mkdir -p "$O"; : > "$JOB/log"
T0=$(date +%s)
step(){ echo "$1" > "$JOB/progress"; echo "== $1 ($(( $(date +%s) - T0 ))s)" >> "$JOB/log"; }
run(){ "$PY" "$@" >> "$JOB/log" 2>&1; }
fail(){ echo "failed" > "$JOB/progress"; printf '{"ok":false,"step":"%s","seconds":%s}\n' "$1" "$(( $(date +%s) - T0 ))" > "$JOB/result.json"; exit 1; }
trap 'fail "$(cat "$JOB/progress" 2>/dev/null)"' ERR

step download;   curl -fsSL --retry 3 "$SRC_URL" -o "$JOB/src.glb"
# v1.9: part-built characters. SRC is the body alone; a separately generated armour set (FORGE_ARMOR_URL, pieces fitted
# with per-piece 2D anchors from FORGE_ANCHORS_URL) is put on before the head
if [ -n "${FORGE_ARMOR_URL:-}" ]; then
step armor;      curl -fsSL --retry 3 "$FORGE_ARMOR_URL" -o "$JOB/armor.glb"
                 curl -fsSL --retry 3 "$FORGE_ANCHORS_URL" -o "$JOB/anchors.json"
                 run "$R/armorfit.py" -- "$JOB/src.glb" "$JOB/armor.glb" "$JOB/anchors.json" "$JOB/src_armor.glb"
                 mv "$JOB/src_armor.glb" "$JOB/src.glb"
fi
# v1.9: optional separately generated head (image-to-3D of the head crop) replaces the body's head before rigging
if [ -n "${FORGE_HEAD_URL:-}" ]; then
step head;       curl -fsSL --retry 3 "$FORGE_HEAD_URL" -o "$JOB/head.glb"
                 run "$R/attachhead.py" -- "$JOB/src.glb" "$JOB/head.glb" "$JOB/src_head.glb"
                 mv "$JOB/src_head.glb" "$JOB/src.glb"
fi
step normalize;  run "$R/normalize.py" -- "$JOB/src.glb" "$O/norm"
step landmarks;  run "$R/detect.py"
step skeleton;   run "$R/buildrig.py"
step weights;    run "$R/weights2.py"
                 run "$R/dumpbones.py" -- "$O/rigged.blend" "$O/bones.json"
                 run "$R/mkw.py"
step bind;       run "$R/applyw.py" -- "$O/rigged.blend" "$O/proxyW_g.npz" "$O/weighted.blend"
                 run "$R/fixarm.py" -- "$O/weighted.blend" "$O/weighted.blend"
                 run "$R/armorfix.py" -- "$O/weighted.blend" "$O/weighted.blend"   # v1.9 part-built armour rides its bone
step hands;      run "$R/handfix.py" -- "$O/weighted.blend" "$O/weighted_hf.blend"
# TRELLIS sources: open cloth sheets + floating shells (tassels, rope ends) move rigidly (v1.8, opt-in)
if [ "${FORGE_SKIRTFIX:-0}" = "1" ]; then run "$R/skirtfix.py" -- "$O/weighted_hf.blend" "$O/weighted_hf.blend"; fi
step cloth;      run "$R/clothbones.py" -- "$O/weighted_hf.blend" "$O/weighted_cb.blend"
step animate;    run "$R/retarget.py" -- "$O/weighted_cb.blend" "$O/anim6.blend"
step moves;      run "$FW/anim/retarget_bvh.py" -- "$O/anim6.blend" "$O/anim6_ma.blend" "$FW/anim/clips.json"
step cleanup;    run "$R/fixarm.py" -- "$O/anim6_ma.blend" "$O/anim6_fix.blend"
                 run "$R/footfix.py" -- "$O/anim6_fix.blend" "$O/anim6_ff0.blend"
                 run "$R/padfix.py" -- "$O/anim6_ff0.blend" "$O/anim6_ff1.blend"
                 run "$R/smoothfix.py" -- "$O/anim6_ff1.blend" "$O/anim6_ff2.blend"
                 run "$R/layerfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff2.blend"
                 run "$R/headfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff.blend"
                 run "$R/armpitfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v1.9c no shards under the arms
                 run "$R/armorfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # re-assert after the cloth cleanups
step export;     FORGE_NAME="$NAME" FORGE_DECIMATE="${FORGE_DECIMATE:-0.35}" FORGE_TEX_BASE=2048 FORGE_TEX_OTHER=512 run "$R/export.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb"
step qa;         run "$FW/qa_job.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb" "$JOB/qa.json" "$JOB/log"
step thumb;      "$PY" "$FW/thumb.py" -- "$JOB/rig.glb" "$JOB/thumb.jpg" 640 >> "$JOB/log" 2>&1 || echo "thumb failed (non-fatal)" >> "$JOB/log"
SECS=$(( $(date +%s) - T0 ))
"$PY" - "$JOB" "$SECS" <<'PY'
import json, os, sys
job, secs = sys.argv[1], int(sys.argv[2])
qa = json.load(open(os.path.join(job, 'qa.json')))
json.dump({'ok': True, 'seconds': secs, 'bytes': os.path.getsize(os.path.join(job, 'rig.glb')), 'thumb': os.path.exists(os.path.join(job, 'thumb.jpg')), 'qa': qa}, open(os.path.join(job, 'result.json'), 'w'))
PY
echo done > "$JOB/progress"
