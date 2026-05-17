# Meshy Native Animation Expansion Plan

## Goal

Use Meshy-native animations for Forge characters instead of Mixamo animations.

Mixamo/Rebel Standard animation clips target a different skeleton. The current successful Meshy playable pipeline uses Meshy’s own 24-bone rig, so any new idle, jump, kick, or action animation should be generated against the same Meshy rig task instead of retargeted from Mixamo-style bones.

## Build Inspected

Successful current build:

`build_1778974543200`

Downloaded for local inspection only:

- Rigged GLB: `https://vg8yazzy1wnobiup.public.blob.vercel-storage.com/forge/3d-builds/battle_for_colony/469/build_1778974543200-rigged.glb`
- Walking GLB: `https://vg8yazzy1wnobiup.public.blob.vercel-storage.com/forge/3d-builds/battle_for_colony/469/build_1778974543200-walking.glb`
- Running GLB: `https://vg8yazzy1wnobiup.public.blob.vercel-storage.com/forge/3d-builds/battle_for_colony/469/build_1778974543200-running.glb`
- Existing failed idle test: `assets/forge-animations/idle_armature.glb`

## Skeleton Comparison

All successful Meshy build GLBs have:

- Nodes: `26`
- Meshes: `1`
- Skins: `1`
- Animations: `1`
- Skinned mesh node: `char1`
- Skin name: `Armature`
- Joint count: `24`
- Inverse bind accessor present: accessor `6`

Bone names for rigged, walking, and running are identical:

```txt
Hips
LeftUpLeg
LeftLeg
LeftFoot
LeftToeBase
RightUpLeg
RightLeg
RightFoot
RightToeBase
Spine02
Spine01
Spine
LeftShoulder
LeftArm
LeftForeArm
LeftHand
RightShoulder
RightArm
RightForeArm
RightHand
neck
Head
head_end
headfront
```

## Animation Target Comparison

Rigged GLB:

- Animation name: `Armature|clip0|baselayer`
- Channels: `72`
- Targets: all 24 bones
- Target paths: `translation`, `rotation`, `scale`

Walking GLB:

- Animation name: `Armature|walking_man|baselayer`
- Channels: `72`
- Targets: all 24 bones
- Target paths: `translation`, `rotation`, `scale`

Running GLB:

- Animation name: `Armature|running|baselayer`
- Channels: `72`
- Targets: all 24 bones
- Target paths: `translation`, `rotation`, `scale`

Conclusion: walking and running are full character GLBs, not animation-only GLBs. They include the same mesh, skin, skeleton, and bone names as the rigged GLB. This is why the current full-GLB visual swap path is the safest path in Village.

## Failed Idle Test

`assets/forge-animations/idle_armature.glb` has:

- Nodes: `25`
- Meshes: `0`
- Skins: `1`
- Animations: `1`
- Skin name: `Armature`
- Joint count: `24`
- Animation name: `Scene`
- Channels: `72`
- Same bone names and target paths as the successful Meshy build

However, its rest/local transforms do not match `build_1778974543200-rigged.glb`.

Examples:

- `Hips` translation differs by about `27.61`
- `RightUpLeg` translation differs by about `19.71`
- `Spine02` translation differs by about `14.71`
- `head_end` translation differs by about `14.16`

This explains why the idle armature test deforms the current character even though the bone names match. Bone names are necessary but not sufficient; the animation must be generated from the same Meshy rig task/rest pose.

## Current Meshy API Handling In Repo

Current route:

- `api/forge-3d-engine-meshy-rig-create.mjs`

It calls:

```txt
POST https://api.meshy.ai/openapi/v1/rigging
```

with:

```json
{
  "model_url": "...",
  "height_meters": 1.7
}
```

Current status route:

- `api/forge-3d-engine-meshy-rig-status.mjs`

It calls:

```txt
GET https://api.meshy.ai/openapi/v1/rigging/:id
```

The Meshy rigging response provides the rigged character and basic animations:

```txt
result.rigged_character_glb_url
result.basic_animations.walking_glb_url
result.basic_animations.walking_armature_glb_url
result.basic_animations.running_glb_url
result.basic_animations.running_armature_glb_url
```

Current storage routes:

- `api/forge-3d-store-walking-glb.mjs`
- `api/forge-3d-store-running-glb.mjs`
- `api/forge-3d-store-armature-animation-glb.mjs`

Currently supported armature storage keys are only:

```txt
walking_armature_glb_url
running_armature_glb_url
```

There is no repo route yet for Meshy’s separate Animation API.

## Meshy Animation API Findings

Meshy documents a separate Animation API:

- `POST /openapi/v1/animations`
- Required body fields: `rig_task_id`, `action_id`
- Response returns an animation task id.
- `GET /openapi/v1/animations/:id` returns the animation task result.

Docs:

- `https://docs.meshy.ai/en/api/animation`
- `https://docs.meshy.ai/en/api/animation-library`

The animation result includes:

```txt
result.animation_glb_url
result.animation_fbx_url
result.processed_armature_fbx_url
result.processed_animation_fps_fbx_url
```

The animation library has many `action_id` values. Relevant first candidates:

```txt
0   Idle
11  Idle_02
12  Idle_03
13  Jump_Run
44  Happy_jump_f
61  happy_jump_m
86  Basic_Jump
94  Flying_Fist_Kick
103 Simple_Kick
206 Spartan_Kick
207 Roundhouse_Kick
215 High_Kick
```

## Can We Create Idle / Jump / Kick With The Same Meshy Rig?

Yes, likely.

The correct source should be the successful rig task id:

```txt
build.rigging.taskId
```

For `build_1778974543200`, that task id is stored in the build record as the Meshy rig task id. The new animation request should use that same `rig_task_id`, not a static local armature file and not a Mixamo clip.

Expected result:

1. Meshy receives the same rig task id.
2. Meshy applies the requested `action_id` to that exact rig.
3. Output animation GLB should have the same 24 Meshy bones, same rest pose, and same mesh/skin compatibility as walking/running.
4. Village can use the same full-GLB visual swap path already working for walking/running.

## Smallest Safe Forge Plan

Add a new “Generate Missing Meshy Animations” flow in Forge, behind the existing 3D Build Status card.

### Phase 1: Probe One Idle Animation

Add route:

```txt
api/forge-3d-engine-meshy-animation-create.mjs
```

Request body:

```json
{
  "buildId": "build_1778974543200",
  "animationKey": "idle",
  "actionId": 0
}
```

Route behavior:

1. Load build record.
2. Read `build.rigging.taskId`.
3. POST to Meshy `openapi/v1/animations` with:

```json
{
  "rig_task_id": "build.rigging.taskId",
  "action_id": 0
}
```

4. Save returned animation task id under:

```txt
build.rigging.animationTasks.idle.taskId
```

### Phase 2: Poll Animation Task

Add route:

```txt
api/forge-3d-engine-meshy-animation-status.mjs
```

Route behavior:

1. Load build record.
2. Read `build.rigging.animationTasks[animationKey].taskId`.
3. GET Meshy `openapi/v1/animations/:id`.
4. When complete, store:

```txt
build.output.meshyAnimations.idle.animationGlbUrl
build.rigging.animationTasks.idle.response
```

### Phase 3: Store Result In Rebel Blob

Add or generalize a storage route for Meshy animation GLBs:

```txt
api/forge-3d-store-meshy-animation-glb.mjs
```

Blob path pattern:

```txt
forge/3d-builds/{collectionKey}/{tokenId}/{buildId}-{animationKey}.glb
```

Save to build record:

```txt
build.output.storedAnimations.idle.storedAnimationUrl
build.output.idleGlbUrl
```

### Phase 4: Village Integration

After idle is generated by Meshy for the same rig:

1. Add `idleGlbUrl` to `api/forge-active-character-save.mjs`.
2. Add `characterBundle.animations.idle.glbUrl`.
3. In Village, when not moving, prefer `idleGlbUrl` if present.
4. If no `idleGlbUrl`, keep current safe fallback: rigged/static GLB.

Do not re-enable `assets/forge-animations/idle_armature.glb` for current Meshy characters. It is a mismatched rest-pose test asset and should stay disabled.

## Recommended First Button

In Forge 3D Build Status, add an advanced/dev action:

```txt
Generate Meshy Idle Test
```

Only show it when:

```txt
build.rigging.taskId exists
build.output.idleGlbUrl does not exist
```

After this works, expand to:

```txt
Generate Missing Meshy Animations
```

with a small fixed map:

```txt
idle -> action_id 0
jump -> action_id 86
kick -> action_id 103
```

Keep this Meshy-native. Do not use Mixamo clips for this path.
