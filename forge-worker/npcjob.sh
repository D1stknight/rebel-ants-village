#!/usr/bin/env bash
# NPC villager job: the Forge Rigger pipeline (job.sh) run locally on a static NPC model, with the NPC gesture pack
# (anim/clips_npc.json, Mixamo .npz made by tools/npc-forge) as the moves instead of the fight / weapon moves.
# usage: [FORGE_PY=python3.13-with-bpy] [FORGE_GLOVE_RGB=r,g,b FORGE_CUFF_RGB=r,g,b] [START=step] npcjob.sh static.glb name job_dir
# NPC switches: FORGE_NO_SPINE_ALIGN=1 (default here) keeps the spine as modelled; glove colours override the texture probe.
set -eEo pipefail
FW="$(cd "$(dirname "$0")" && pwd)"; SRC="$1"; NAME="${2:-npc}"; JOB="$3"
PY="${FORGE_PY:-$FW/venv/bin/python}"
export FORGE_OUT="$JOB/out" FORGE_CLIPS="${FORGE_CLIPS:-$FW/../assets/character}" FORGE_PACK="${FORGE_PACK:-$FW/pack}" FORGE_PROXY_MINCOMP="${FORGE_PROXY_MINCOMP:-0.02}"
export FORGE_NO_SPINE_ALIGN="${FORGE_NO_SPINE_ALIGN-1}"
export FORGE_KEEP_TEAR="${FORGE_KEEP_TEAR-1}" FORGE_KEEP_BRIDGE="${FORGE_KEEP_BRIDGE-1}"
R="$FW/rigger"; O="$FORGE_OUT"; mkdir -p "$O"; : > "$JOB/log"; T0=$(date +%s)
step(){ echo "$1" > "$JOB/progress"; echo "== $1 ($(( $(date +%s) - T0 ))s)" >> "$JOB/log"; }
run(){ "$PY" "$@" >> "$JOB/log" 2>&1; }
trap 'echo "failed at $(cat $JOB/progress)" >> "$JOB/log"; echo failed > "$JOB/progress"' ERR
cp "$SRC" "$JOB/src.glb" 2>/dev/null || true
SKIP=1; [ -z "${START:-}" ] && SKIP=0
step(){ [ "$1" = "${START:-}" ] && SKIP=0; echo "$1" > "$JOB/progress"; echo "== $1 ($(( $(date +%s) - T0 ))s)" >> "$JOB/log"; }
run(){ [ "$SKIP" = 1 ] && return 0; "$PY" "$@" >> "$JOB/log" 2>&1; }
step normalize;  run "$R/normalize.py" -- "$JOB/src.glb" "$O/norm"
step landmarks;  run "$R/detect.py"
step skeleton;   run "$R/buildrig.py"
step weights;    run "$R/weights2.py"; run "$R/dumpbones.py" -- "$O/rigged.blend" "$O/bones.json"; run "$R/mkw.py"
step bind;       run "$R/applyw.py" -- "$O/rigged.blend" "$O/proxyW_g.npz" "$O/weighted.blend"
                 run "$R/fixarm.py" -- "$O/weighted.blend" "$O/weighted.blend"
                 run "$R/armorfix.py" -- "$O/weighted.blend" "$O/weighted.blend"
                 run "$R/headsize.py" -- "$O/weighted.blend" "$O/weighted.blend"
step hands;      run "$R/handfix.py" -- "$O/weighted.blend" "$O/weighted_hf.blend"
if [ "${FORGE_SKIRTFIX:-0}" = "1" ]; then run "$R/skirtfix.py" -- "$O/weighted_hf.blend" "$O/weighted_hf.blend"; fi
step cloth;      run "$R/clothbones.py" -- "$O/weighted_hf.blend" "$O/weighted_cb.blend"
step animate;    run "$R/retarget.py" -- "$O/weighted_cb.blend" "$O/anim6.blend"
step moves;      run "$FW/anim/retarget_bvh.py" -- "$O/anim6.blend" "$O/anim6_ma.blend" "$FW/anim/clips_npc.json"
step cleanup;    run "$R/fixarm.py" -- "$O/anim6_ma.blend" "$O/anim6_fix.blend"
                 run "$R/footfix.py" -- "$O/anim6_fix.blend" "$O/anim6_ff0.blend"
                 run "$R/padfix.py" -- "$O/anim6_ff0.blend" "$O/anim6_ff1.blend"
                 run "$R/smoothfix.py" -- "$O/anim6_ff1.blend" "$O/anim6_ff2.blend"
                 run "$R/layerfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff2.blend"
                 run "$R/headfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff.blend"
                 run "$R/armpitfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"
                 run "$R/armorfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"
                 run "$R/seamfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"
                 run "$R/handswap.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"
                 run "$R/shoulderfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"
                 run "$R/antennafix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"
step export;     FORGE_NAME="$NAME" FORGE_DECIMATE="${FORGE_DECIMATE:-0.35}" FORGE_TEX_BASE="${FORGE_TEX_BASE:-1024}" FORGE_TEX_OTHER=512 run "$R/export.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb"
step headcloth;  run "$R/headcloth.py" "$JOB/rig.glb" "$JOB/rig.glb" --report "$JOB/headcloth.json" || echo "headcloth failed (non-fatal)" >> "$JOB/log"
echo "done $(( $(date +%s) - T0 ))s" >> "$JOB/log"; echo done > "$JOB/progress"
