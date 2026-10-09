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
# v2.13 NPC villagers (FORGE_NPC=1, the admin NPC Forge): the NPC clip set (master idle / walk / run + Mixamo gestures,
# anim/clips_npc.json) instead of the fight and weapon moves. Gestures keep their own head motion (headfix levels the
# head for fight moves: it cut nods to a tenth and flipped the head in pick_up's deep bend); a long-armed villager
# reaching down keeps its fingertips on the floor (handfloor); 1024 base textures (a village shows several NPCs).
# v2.14: NPCs get the Rebels' full jump (take-off, flight, landing); the master jump alone ends in the air. Moves marked
# "headfix" get the head levelling like a Rebel's.
NPC="${FORGE_NPC:-}"; MOVES="$FW/anim/clips.json"
if [ -n "$NPC" ]; then
  MOVES="$FW/anim/clips_npc.json"
  # v2.19: the acrobatic master moves stay unlevelled as on a Rebel (levelling turned the head round mid flip_kick)
  export FORGE_HEAD_SKIP="${FORGE_HEAD_SKIP-cartwheel,backflip,front_flip,flip_kick,spin_flip_kick,knockdown,get_up,$("$PY" -c 'import json, sys; print(",".join(c["name"] for c in json.load(open(sys.argv[1])) if not c.get("headfix")))' "$MOVES")}"
fi
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
                 run "$R/headsize.py" -- "$O/weighted.blend" "$O/weighted.blend"   # v2.9 heads at #262's size
step hands;      run "$R/handfix.py" -- "$O/weighted.blend" "$O/weighted_hf.blend"
# TRELLIS sources: open cloth sheets + floating shells (tassels, rope ends) move rigidly (v1.8, opt-in)
if [ "${FORGE_SKIRTFIX:-0}" = "1" ]; then run "$R/skirtfix.py" -- "$O/weighted_hf.blend" "$O/weighted_hf.blend"; fi
step cloth;      run "$R/clothbones.py" -- "$O/weighted_hf.blend" "$O/weighted_cb.blend"
step animate;    run "$R/retarget.py" -- "$O/weighted_cb.blend" "$O/anim6.blend"
step moves;      if [ -n "$NPC" ]; then for f in $(grep -o '"file": *"[^"]*"' "$MOVES" | sed 's/.*"\([^"]*\)"$/\1/'); do
                   [ -f "$FORGE_PACK/$f" ] || { echo "NPC gesture pack missing: $f (upload it in the NPC Forge, then rebuild the worker)" >> "$JOB/log"; false; }; done; fi
                 run "$FW/anim/retarget_bvh.py" -- "$O/anim6.blend" "$O/anim6_ma.blend" "$MOVES"
# v2.11 weapon moves (sword / twin blades / bow, Mixamo): retargeted like the other moves, cleaned up with them, shipped
# in their own moves.glb (the rig.glb keeps its 24 clips)
if [ -z "$NPC" ]; then
export FORGE_WEAPON_CLIPS="$FW/anim/clips_weapons.json"
step weapons;    run "$FW/anim/retarget_bvh.py" -- "$O/anim6_ma.blend" "$O/anim6_ma.blend" "$FORGE_WEAPON_CLIPS"
fi
step cleanup;    run "$R/fixarm.py" -- "$O/anim6_ma.blend" "$O/anim6_fix.blend"
                 run "$R/footfix.py" -- "$O/anim6_fix.blend" "$O/anim6_ff0.blend"
                 run "$R/padfix.py" -- "$O/anim6_ff0.blend" "$O/anim6_ff1.blend"
                 run "$R/smoothfix.py" -- "$O/anim6_ff1.blend" "$O/anim6_ff2.blend"
                 run "$R/layerfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff2.blend"
                 run "$R/headfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff.blend"   # v1.8 head carriage; v2.19 NPCs: yaw from the twist (no turn-round in the jump)
                 run "$R/armpitfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v1.9c no shards under the arms
                 run "$R/armorfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # re-assert after the cloth cleanups
                 run "$R/seamfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v1.9d cut fingertips fused to the thigh
                 run "$R/handswap.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"  # v2.0 standard 5-finger hands + hand poses; v2.18 NPCs: centred, one size, FORGE_HAND_FIT
                 run "$R/shoulderfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"  # v2.0 sleeves ride the arm
                 run "$R/antennafix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"  # v2.1 jointed antennae with follow-through
if [ -n "$NPC" ]; then run "$R/npcarms.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v2.16 NPC arms: no elbow flick, pointing line, wave rebuilt on the villager's own arm (flat shoulder pad, palm forward), claps meet
                       run "$R/handfloor.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v2.13 NPC hands on the floor
                       run "$R/npcstance.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"; fi  # v2.14 NPCs stand tall, head up in the run
step export;     FORGE_NAME="$NAME" FORGE_DECIMATE="${FORGE_DECIMATE:-0.35}" FORGE_TEX_BASE=$([ -n "$NPC" ] && echo 1024 || echo 2048) FORGE_TEX_OTHER=512 run "$R/export.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb"
# v2.12 head cloth: skully-wrap flaps / bandana tails get spring chains (cloth_flap_*), on the finished GLB. Optional.
step headcloth;  run "$R/headcloth.py" "$JOB/rig.glb" "$JOB/rig.glb" --report "$JOB/headcloth.json" || echo "headcloth failed (non-fatal)" >> "$JOB/log"
if [ -z "$NPC" ]; then
step movespack;  run "$R/exp_moves.py" -- "$O/anim6_ff.blend" "$FORGE_WEAPON_CLIPS" "$JOB/moves.glb"
fi
step qa;         run "$FW/qa_job.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb" "$JOB/qa.json" "$JOB/log"
step thumb;      "$PY" "$FW/thumb.py" -- "$JOB/rig.glb" "$JOB/thumb.jpg" 640 >> "$JOB/log" 2>&1 || echo "thumb failed (non-fatal)" >> "$JOB/log"
SECS=$(( $(date +%s) - T0 ))
"$PY" - "$JOB" "$SECS" <<'PY'
import json, os, sys
job, secs = sys.argv[1], int(sys.argv[2])
qa = json.load(open(os.path.join(job, 'qa.json')))
mv = os.path.join(job, 'moves.glb')
json.dump({'ok': True, 'seconds': secs, 'bytes': os.path.getsize(os.path.join(job, 'rig.glb')), 'thumb': os.path.exists(os.path.join(job, 'thumb.jpg')), 'moves': os.path.getsize(mv) if os.path.exists(mv) else 0, 'qa': qa}, open(os.path.join(job, 'result.json'), 'w'))
PY
echo done > "$JOB/progress"
