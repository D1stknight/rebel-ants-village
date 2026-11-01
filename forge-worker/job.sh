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
# v2.23 NPC species (FORGE_NPC_SPECIES, set by the NPC Forge for its Chumpz and Saints collections only): apes and humans
# get their wrist from the hand length (landmarks); Rebel villagers (unset) are rigged exactly as before.
# v2.25 they wear the Rebel gloves too (Miguel: their own sculpted hands came out too big and could not move); the
# glove takes the sculpted hand's colour and a set share of the height (handswap)
# v2.28 bare arms (Chumpz in shorts): normalize keeps the vertex colours, landmarks moves the wrist up to where the arm's
# colour turns into the sculpted hand's (the hand-length wrist left the palm on the arm beside the glove)
# v2.29 NPCs dance at the parties: the games pack's four dances (dance_wave / tut / house / gangnam) are NPC clips too,
# when the worker has their files (optional moves in anim/clips_npc.json)
# v2.36 Chumpz / Saints players (FORGE_FRIEND=ape|human, the Rebel Forge for those collections' holders): the NPC body
# handling of their species (wrist, sleeves, gloves, head yaw, cuff bones: FORGE_NPC_BODY for the rigger scripts) with
# the Rebels' clip set, weapon moves and games pack. FORGE_NPC (the NPC clip set) stays off.
FRIEND=""
if [ -z "$NPC" ] && [ -n "${FORGE_FRIEND:-}" ]; then FRIEND="$FORGE_FRIEND"; export FORGE_NPC_BODY=1 FORGE_NPC_SPECIES="$FRIEND"; fi
# v2.37 Saints players only (Miguel: "standing straight", leaning back in calm / walk, shoulders and head in the moves): the
# spine keeps its sculpted curve (retarget / retarget_bvh: the Rebel master's and the Mixamo actor's turns are added to
# the Saint's own rest instead of copying their spine angles, which tipped a forward-leaning human chest 22 deg back),
# the head carriage counts the chest's lean from its sculpted rest, and the neck takes half of the head's turn about
# its own axis (headfix: the fight stance turned the head 44 deg at the jaw). Rebels and NPCs unchanged (Chumpz: v2.39).
if [ -n "$FRIEND" ]; then export FORGE_NO_SPINE_ALIGN=1 FORGE_HEAD_CHEST_REST=1 FORGE_NECK_TWIST_SHARE="${FORGE_NECK_TWIST_SHARE:-0.5}"; fi
# v2.38 Saints players only (Miguel: "still looks hunch back a little" in the fight stance): the fight moves' guard
# leans from the waist with a straighter upper back (humanspine, before headfix). The upper arm / shoulder "blocky" in
# the fight moves: the sleeve takes the arm's turn over half the upper arm instead of its first third, and the shoulder
# weights are smoothed far enough to matter on a human mesh (shoulderfix).
# v2.39 Chumpz players too (Miguel on Chumpz #1270: "his stand is not straight", the head turned in the fight stance,
# shoulders and arms "like the saints"): the same spine, head, neck and shoulder handling as the Saints; on its sculpt
# the idle went from leaning 2.6 deg back (chest pulled back, belly out, neck jutting) to 6.4 forward (its sculpted
# 6.8), the fight stance's head turn from 43 deg at the jaw to 21 neck + 24 head. Rebels and NPCs unchanged.
if [ -n "$FRIEND" ]; then export FORGE_SLEEVE_RAMP="${FORGE_SLEEVE_RAMP:--0.08,0.55}" FORGE_SHOULDER_SMOOTH="${FORGE_SHOULDER_SMOOTH:-30}" FORGE_SHOULDER_CAP_SMOOTH="${FORGE_SHOULDER_CAP_SMOOTH:-120}"; fi
SPECIES="${FORGE_NPC_SPECIES:-}"
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
# v2.40 #001 (FORGE_JOINTS, set only for the admin's #001 rig): its own skeleton's 29 joints instead of the silhouette
# landmarks, which put its right shoulder 9-10 cm back toward the quiver (the arm then tore the side open). Checked
# first: the same 29 joints landmarks gives, three finite numbers each, inside the 1.8 m body, arms on opposite sides.
# Unset (every other job): landmarks exactly as before.
if [ -n "${FORGE_JOINTS:-}" ]; then
step landmarks;  "$PY" - "$O/joints.json" >> "$JOB/log" 2>&1 <<'PY'
import json, math, os, sys
J = json.loads(os.environ['FORGE_JOINTS'])
S = ('Shoulder', 'Arm', 'ForeArm', 'Hand', '_handC', '_tip', 'UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End')
want = {'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End'} | {s + k for s in ('Left', 'Right') for k in S}
if not isinstance(J, dict) or set(J) != want: sys.exit(f'FORGE_JOINTS: need exactly the joints {sorted(want)}')
for k, v in J.items():
    if not (isinstance(v, list) and len(v) == 3 and all(isinstance(c, (int, float)) and math.isfinite(c) for c in v)): sys.exit(f'FORGE_JOINTS {k}: not three numbers')
    if abs(v[0]) > 1.5 or abs(v[1]) > 1.0 or not -0.1 <= v[2] <= 2.0: sys.exit(f'FORGE_JOINTS {k}: outside the 1.8 m body')
if J['LeftArm'][0] * J['RightArm'][0] >= 0: sys.exit('FORGE_JOINTS: the arms are on the same side')
json.dump({k: list(map(float, v)) for k, v in J.items()}, open(sys.argv[1], 'w'), indent=0)
print('joints', len(J), '(FORGE_JOINTS)')
PY
else
step landmarks;  run "$R/detect.py"
fi
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
step moves;      if [ -n "$NPC" ]; then
                   # v2.29 the four party dances (optional: the games pack's files): a worker image without them rigs without them
                   "$PY" - "$MOVES" "$FORGE_PACK" "$O/moves_npc.json" >> "$JOB/log" 2>&1 <<'PY'
import json, os, sys
moves, pack, out = sys.argv[1:4]; keep = []
for c in json.load(open(moves)):
    if os.path.exists(os.path.join(pack, c['file'])): keep.append(c)
    elif c.get('optional'): print('NPC move skipped (not in the worker):', c['file'])
    else: print('NPC gesture pack missing:', c['file'], '(upload it in the NPC Forge, then rebuild the worker)'); sys.exit(1)
json.dump(keep, open(out, 'w'), indent=1)
PY
                   MOVES="$O/moves_npc.json"; fi
                 run "$FW/anim/retarget_bvh.py" -- "$O/anim6.blend" "$O/anim6_ma.blend" "$MOVES"
# v2.11 weapon moves (sword / twin blades / bow, Mixamo): retargeted like the other moves, cleaned up with them, shipped
# in their own moves.glb (the rig.glb keeps its 24 clips)
if [ -z "$NPC" ]; then
export FORGE_WEAPON_CLIPS="$FW/anim/clips_weapons.json"
step weapons;    run "$FW/anim/retarget_bvh.py" -- "$O/anim6_ma.blend" "$O/anim6_ma.blend" "$FORGE_WEAPON_CLIPS"
fi
# v2.24 games pack (Miguel's Mixamo moves for the village games: fishing, digging, planting, throws, the axe, cheering,
# pushing, four dances): retargeted and cleaned up with the other moves, shipped in their own games.glb (rig.glb and
# moves.glb are unchanged). They keep their own head motion (headfix would level the look down at a shovel). A worker
# built before the pack was uploaded makes no games.glb and everything else as before.
# v2.30 Miguel's second set (rope pull, hammer, unarmed + shield blocks, jump shot, dribble, bowling throw, swim): a file
# the image lacks leaves out only its own moves (logged "games pack missing: <file>"); the pack lists what it holds
# (result.json gamesClips), so the NPC Forge can tell an older pack from a current one.
GAMES=""
if [ -z "$NPC" ]; then
  export FORGE_GAME_CLIPS="$O/clips_games.json"
  "$PY" - "$FW/anim/clips_games.json" "$FORGE_PACK" "$FORGE_GAME_CLIPS" >> "$JOB/log" 2>&1 <<'PY'
import json, os, sys
src, pack, out = sys.argv[1:4]; cl = json.load(open(src)); have = [c for c in cl if os.path.isfile(os.path.join(pack, c['file']))]
for f in sorted(set(c['file'] for c in cl) - set(c['file'] for c in have)):
    print(f'games pack missing: {f} (upload it in the Rig worker box, then rebuild the worker); its moves are left out')
json.dump(have, open(out, 'w'), indent=1)
PY
  # v2.42 #001's own moves (FORGE_ANTHONY, set by the API only for battle_for_colony token 1: Ant-Thony roams Universe
  # and talks in his apps): the stand-up set, sitting idle and talking, a wave, a stair climb, after the shared moves in
  # his games pack. Every other Rebel's list is unchanged. A file the image lacks leaves out its move.
  if [ -n "${FORGE_ANTHONY:-}" ]; then
  "$PY" - "$FW/anim/clips_anthony.json" "$FORGE_PACK" "$FORGE_GAME_CLIPS" >> "$JOB/log" 2>&1 <<'PY'
import json, os, sys
src, pack, out = sys.argv[1:4]; cl = json.load(open(src)); have = [c for c in cl if os.path.isfile(os.path.join(pack, c['file']))]
for f in sorted(set(c['file'] for c in cl) - set(c['file'] for c in have)):
    print(f'anthony moves missing: {f} (upload it in the Rig worker box, then rebuild the worker); its moves are left out')
games = json.load(open(out)); names = {c['name'] for c in games}
json.dump(games + [c for c in have if c['name'] not in names], open(out, 'w'), indent=1)
PY
  fi
  if [ "$("$PY" -c 'import json, sys; print(len(json.load(open(sys.argv[1]))))' "$FORGE_GAME_CLIPS")" -gt 0 ]; then GAMES=1; fi
  if [ -n "$GAMES" ]; then
    export FORGE_HEAD_SKIP="${FORGE_HEAD_SKIP-cartwheel,backflip,front_flip,flip_kick,spin_flip_kick,knockdown,get_up},$("$PY" -c 'import json, sys; print(",".join(c["name"] for c in json.load(open(sys.argv[1]))))' "$FORGE_GAME_CLIPS")"
step games;      run "$FW/anim/retarget_bvh.py" -- "$O/anim6_ma.blend" "$O/anim6_ma.blend" "$FORGE_GAME_CLIPS"
  fi
fi
step cleanup;    run "$R/fixarm.py" -- "$O/anim6_ma.blend" "$O/anim6_fix.blend"
                 run "$R/footfix.py" -- "$O/anim6_fix.blend" "$O/anim6_ff0.blend"
                 run "$R/padfix.py" -- "$O/anim6_ff0.blend" "$O/anim6_ff1.blend"
                 run "$R/smoothfix.py" -- "$O/anim6_ff1.blend" "$O/anim6_ff2.blend"
                 run "$R/layerfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff2.blend"
if [ -n "$FRIEND" ]; then run "$R/humanspine.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff2.blend"; fi   # v2.38 Saints players (v2.39 Chumpz too): the guard leans from the waist
                 run "$R/headfix.py" -- "$O/anim6_ff2.blend" "$O/anim6_ff.blend"   # v1.8 head carriage; v2.19 NPCs: yaw from the twist (no turn-round in the jump)
                 run "$R/armpitfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v1.9c no shards under the arms
                 run "$R/armorfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # re-assert after the cloth cleanups
                 run "$R/seamfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v1.9d cut fingertips fused to the thigh
if [ -n "$SPECIES" ]; then run "$R/handkeep.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"; fi   # v2.23 loose nails / fingertips ride the hand (v2.25: so the glove swap takes them off with it)
                 run "$R/handswap.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"  # v2.0 standard 5-finger hands + hand poses; v2.18 NPCs: centred, one size, FORGE_HAND_FIT (v2.20 + cuff size / length)
                 run "$R/shoulderfix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"  # v2.0 sleeves ride the arm
                 run "$R/antennafix.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"  # v2.1 jointed antennae with follow-through
if [ -n "$NPC" ]; then run "$R/npcarms.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v2.16 NPC arms: no elbow flick, pointing line, wave rebuilt on the villager's own arm (flat shoulder pad, palm forward), claps meet
                       run "$R/handfloor.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v2.13 NPC hands on the floor
                       run "$R/npcstance.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v2.14 NPCs stand tall, head up in the run
                       run "$R/cufftwist.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"   # v2.21 NPC cuffs follow the hand's twist only (after every hand step)
elif [ -n "$FRIEND" ]; then run "$R/cufftwist.py" -- "$O/anim6_ff.blend" "$O/anim6_ff.blend"; fi  # v2.36 friend players' cuff bones too (after shoulderfix / antennafix)
step export;     FORGE_NAME="$NAME" FORGE_DECIMATE="${FORGE_DECIMATE:-0.35}" FORGE_TEX_BASE=$([ -n "$NPC" ] && echo 1024 || echo 2048) FORGE_TEX_OTHER=512 run "$R/export.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb"
# v2.12 head cloth: skully-wrap flaps / bandana tails get spring chains (cloth_flap_*), on the finished GLB. Optional.
# v2.39 not for Chumpz players: an ape's ears are thin sheets off the side of the head, so they came out as two flaps
# swinging on springs (Chumpz #1270: 569 + 437 ear vertices fully on cloth_flap chains; Miguel: "his ears are flappy").
if [ "$FRIEND" != ape ]; then
step headcloth;  run "$R/headcloth.py" "$JOB/rig.glb" "$JOB/rig.glb" --report "$JOB/headcloth.json" || echo "headcloth failed (non-fatal)" >> "$JOB/log"
fi
# v2.41 #001's jaw (FORGE_JAW, set only for #001's rig when an admin asks for it): a mixamorig_Jaw joint under Head; the
# cloth over its mouth opens when something turns it (a voice app). Nothing keys it, so every move looks as before.
if [ -n "${FORGE_JAW:-}" ]; then
step jaw;        run "$R/jaw.py" "$JOB/rig.glb" "$JOB/rig.glb" --report "$JOB/jaw.json"
fi
if [ -z "$NPC" ]; then
step movespack;  run "$R/exp_moves.py" -- "$O/anim6_ff.blend" "$FORGE_WEAPON_CLIPS" "$JOB/moves.glb"
fi
if [ -n "$GAMES" ]; then
step gamespack;  run "$R/exp_moves.py" -- "$O/anim6_ff.blend" "$FORGE_GAME_CLIPS" "$JOB/games.glb"
fi
step qa;         run "$FW/qa_job.py" -- "$O/anim6_ff.blend" "$JOB/rig.glb" "$JOB/qa.json" "$JOB/log"
step thumb;      "$PY" "$FW/thumb.py" -- "$JOB/rig.glb" "$JOB/thumb.jpg" 640 >> "$JOB/log" 2>&1 || echo "thumb failed (non-fatal)" >> "$JOB/log"
SECS=$(( $(date +%s) - T0 ))
"$PY" - "$JOB" "$SECS" <<'PY'
import json, os, sys
job, secs = sys.argv[1], int(sys.argv[2])
qa = json.load(open(os.path.join(job, 'qa.json')))
mv, gm = os.path.join(job, 'moves.glb'), os.path.join(job, 'games.glb')
gc = os.environ.get('FORGE_GAME_CLIPS', '')   # v2.30 the moves this games pack holds
gnames = [c['name'] for c in json.load(open(gc))] if os.path.exists(gm) and gc and os.path.exists(gc) else []
json.dump({'ok': True, 'seconds': secs, 'bytes': os.path.getsize(os.path.join(job, 'rig.glb')), 'thumb': os.path.exists(os.path.join(job, 'thumb.jpg')), 'moves': os.path.getsize(mv) if os.path.exists(mv) else 0, 'games': os.path.getsize(gm) if os.path.exists(gm) else 0, 'gamesClips': gnames, 'qa': qa}, open(os.path.join(job, 'result.json'), 'w'))
PY
echo done > "$JOB/progress"
