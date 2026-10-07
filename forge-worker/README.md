# Forge Rigger worker

Runs the Forge Rigger (Blender `bpy` 5.2, Python 3.13) inside a Vercel Sandbox so a Forge build becomes a playable village Rebel without manual steps.

- `setup.sh` builds the worker once (system libs, Python 3.13 venv with bpy/numpy/scipy/pillow, this code, master ant clips, the mocap pack). The API snapshots that sandbox; every rig job starts from the snapshot.
- `job.sh <glb_url> <name> <job_dir>` runs the full pipeline: normalize → landmarks → skeleton → weights → bind + fixarm → handfix → clothbones → master clips → CMU/Mixamo moves (`anim/clips.json`) → fixarm → footfix → export (decimate 0.35, 1536/512 textures) → `qa_job.py`.
- Mocap sources (`pack/`) are not in this repo. The admin route uploads them to Blob and passes their URLs to `setup.sh`.
- After changing anything here, push, then rebuild the worker from the Forge admin (it pins the commit).

API: `/api/forge-rig-worker` (admin: pack upload, setup, status), `/api/forge-rig-start`, `/api/forge-rig-status`.

## NPC villagers (`npcjob.sh`, Oct 7)
- The village faction villagers go through the same pipeline as the Rebels, run locally (bpy 5.2 in a Python 3.13 venv: `uv venv --python 3.13 venv && uv pip install --python venv/bin/python bpy==5.2.0 numpy scipy pillow`).
- Source: a static GLB of the NPC (tools/npc-forge/stripskin.mjs bakes any rigged GLB — Mixamo save, Meshy rig — into its bind pose, no skin, no Draco: pip bpy cannot decode Draco).
- Moves: `anim/clips_npc.json` = Miguel's Mixamo NPC pack (talking, waving, wave_short, bow, pointing, pick_up, nod_yes, shake_no, clapping, rallying, yelling, look_around, idle_looking) as `.npz` in `pack/mixamo/` (tools/npc-forge/mx2json.mjs + json2npz.py; mocap stays off GitHub).
- NPC-only additions, Rebels unchanged: `FORGE_NO_SPINE_ALIGN` (retarget.py / retarget_bvh.py keep the spine as modelled; stylised NPCs have chest bones off vertical), `FORGE_GLOVE_RGB` / `FORGE_CUFF_RGB` (handswap colour override), hand poses for the gesture clip names (open / talk / point), 41-bone Mixamo sources align the hand on the index finger.
- Then tools/npc-forge/slim2.mjs: drops jump / flip_kick, drops tracks that never leave the rest pose, resamples, Draco, scales the root to the NPC's old height (HEIGHT=...).
