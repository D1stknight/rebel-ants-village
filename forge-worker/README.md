# Forge Rigger worker

Runs the Forge Rigger (Blender `bpy` 5.2, Python 3.13) inside a Vercel Sandbox so a Forge build becomes a playable village Rebel without manual steps.

- `setup.sh` builds the worker once (system libs, Python 3.13 venv with bpy/numpy/scipy/pillow, this code, master ant clips, the mocap pack). The API snapshots that sandbox; every rig job starts from the snapshot.
- `job.sh <glb_url> <name> <job_dir>` runs the full pipeline: normalize → landmarks → skeleton → weights → bind + fixarm → handfix → clothbones → master clips → CMU/Mixamo moves (`anim/clips.json`) → fixarm → footfix → export (decimate 0.35, 1536/512 textures) → `qa_job.py`.
- Mocap sources (`pack/`) are not in this repo. The admin route uploads them to Blob and passes their URLs to `setup.sh`.
- After changing anything here, push, then rebuild the worker from the Forge admin (it pins the commit).

API: `/api/forge-rig-worker` (admin: pack upload, setup, status), `/api/forge-rig-start`, `/api/forge-rig-status`.
