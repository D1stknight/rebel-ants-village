# NPC villagers through the Forge Rigger

Same pipeline as the Rebels (forge-worker), so NPCs get the master idle / walk / run, the cleanup passes (feet, head
carriage, arms, shoulders, antennae) and a hand pose per clip. Needs Node with @gltf-transform/core, /extensions,
/functions and draco3dgltf, plus the bpy venv described in forge-worker/README.md.

1. Gesture pack (once): each Mixamo FBX (Without Skin) -> GLB with FBX2glTF, then
   `node mx2json.mjs Talking.glb talking.json && python json2npz.py talking.json forge-worker/pack/mixamo/talking.npz`
   (names as in forge-worker/anim/clips_npc.json).
2. Source: `node stripskin.mjs <npc rigged or static>.glb <npc>-static.glb`
3. Rig + animate: `FORGE_GLOVE_RGB=r,g,b FORGE_CUFF_RGB=r,g,b forge-worker/npcjob.sh <npc>-static.glb <npc>_villager job/<npc>`
4. Village file: `HEIGHT=<old model height> DROP=jump,flip_kick node slim2.mjs job/<npc>/rig.glb assets/npcs/<npc>-villager.glb 3e-3`

Check in profile and front (only the NPCs on a flat floor) before shipping: upright idle / talk, feet on the floor,
hands posed (index out on pointing, palms on clapping).
