# Forge Rigger worker

Runs the Forge Rigger (Blender `bpy` 5.2, Python 3.13) inside a Vercel Sandbox so a Forge build becomes a playable village Rebel without manual steps.

- `setup.sh` builds the worker once (system libs, Python 3.13 venv with bpy/numpy/scipy/pillow, this code, master ant clips, the mocap pack). The API snapshots that sandbox; every rig job starts from the snapshot.
- `job.sh <glb_url> <name> <job_dir>` runs the full pipeline: normalize → landmarks → skeleton → weights → bind + fixarm → handfix → clothbones → master clips → CMU/Mixamo moves (`anim/clips.json`) → fixarm → footfix → export (decimate 0.35, 1536/512 textures) → `qa_job.py`.
- Mocap sources (`pack/`) are not in this repo. The admin route uploads them to Blob and passes their URLs to `setup.sh`.
- After changing anything here, push, then rebuild the worker from the Forge admin (it pins the commit).

API: `/api/forge-rig-worker` (admin: pack upload, setup, status), `/api/forge-rig-start`, `/api/forge-rig-status`.

## NPC villagers (NPC Forge, `FORGE_NPC=1`, Oct 7)
- The admin NPC Forge (npc-forge.html) forges an NPC like a Rebel: Miguel's four renders (front / back / left / right) -> Meshy multi-image-to-3D -> this rigger with `npc: true` on /api/forge-rig-start, which runs job.sh with `FORGE_NPC=1`.
- NPC mode: moves from `anim/clips_npc.json` (Miguel's Mixamo NPC pack: talking, talking2, waving, wave_short, bow, pointing, pick_up, nod_yes, shake_no, clapping, rallying, yelling, look_around, idle_looking; `.npz` in `pack/mixamo/`, uploaded from the NPC Forge, kept off GitHub) instead of the fight and weapon moves; no weapons / moves pack; headfix skips the gestures (it cut nods to a tenth and flipped the head in pick_up); `handfloor.py` keeps fingertips on the floor when a long-armed villager reaches down; 1024 base textures.
- QA (`qa_job.py`, NPC mode): stretch on the NPC clips plus torn pieces (edges stretched > 2.5x and longer than 15 % / 30 % of the height), glove vertices not driven by the hand (leftover parts), mesh lean vs rest in idle / talking / walk (6 / 6 / 9 deg), sinking into the floor (> 3 cm), head snaps (> 30 deg in one frame). The verdict and per-clip numbers show in the NPC Forge.
- The NPC gesture pack must be in the worker image (upload in the NPC Forge, then Rebuild worker); an NPC job without it stops at "moves" naming the missing file.
- The earlier local NPC route (npcjob.sh + low-poly generator sources) is retired: those sources broke under the rigger (fused props, elbows on the armour, crooked spines).
