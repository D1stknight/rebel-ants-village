# NPC gesture pack for the Forge Rigger

NPCs are forged in the admin NPC Forge (npc-forge.html) like the Rebels; the rigger's NPC mode (forge-worker, FORGE_NPC=1)
retargets these Mixamo gestures onto every NPC. The pack is made once from Miguel's Mixamo downloads and uploaded from the
NPC Forge (Rig worker > Upload gesture files), then the worker is rebuilt. Mocap stays off GitHub.

Each Mixamo FBX (Without Skin) -> GLB with FBX2glTF, then
`node mx2json.mjs Talking.glb talking.json && python json2npz.py talking.json talking.npz`
(file names as in forge-worker/anim/clips_npc.json).

stripskin.mjs (rigged GLB -> static bind-pose GLB) and slim2.mjs (rig GLB -> resampled, Draco village file) are kept for
one-off conversions; slim2's keyframe tolerance is 2e-4 (3e-3 froze idles).
