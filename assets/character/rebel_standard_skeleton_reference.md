# Rebel Standard Skeleton Reference

## Purpose

This document locks the direction for the Rebel Ants Forge character pipeline.

The main goal is not only to generate a 3D character. The goal is to make every Forge character become a clean playable Rebel character that can use the same high-quality animation system as the current main playable character.

## Current Quality Standard

The current main playable character is the quality target.

Current files:

- `/assets/character/ant_idle_c.glb`
- `/assets/character/ant_walk_c.glb`
- `/assets/character/ant_run_c.glb`
- `/assets/character/ant_jumping_c.glb`
- `/assets/character/ant_flip_kick_c.glb`

This character uses a Mixamo-style skeleton with 65 bones.

The current Forge/Meshy rig test uses a simpler Meshy skeleton with 24 bones. That rig proved the pipeline works, but it is prototype-only until the animation quality matches the main character.

## Rebel Standard Skeleton

The Rebel Standard Skeleton should be based on the main playable character skeleton.

Required skeleton traits:

- Mixamo-style naming using `mixamorig_` prefixes
- 65-bone structure
- Full spine / neck / head structure
- Full arm and leg structure
- Finger bones for both hands
- Toe bones for both feet
- Compatible with the existing animation library

Current main playable bone names:

```text
mixamorig_Hips
mixamorig_Spine
mixamorig_Spine1
mixamorig_Spine2
mixamorig_Neck
mixamorig_Head
mixamorig_HeadTop_End
mixamorig_LeftShoulder
mixamorig_LeftArm
mixamorig_LeftForeArm
mixamorig_LeftHand
mixamorig_LeftHandThumb1
mixamorig_LeftHandThumb2
mixamorig_LeftHandThumb3
mixamorig_LeftHandThumb4
mixamorig_LeftHandIndex1
mixamorig_LeftHandIndex2
mixamorig_LeftHandIndex3
mixamorig_LeftHandIndex4
mixamorig_LeftHandMiddle1
mixamorig_LeftHandMiddle2
mixamorig_LeftHandMiddle3
mixamorig_LeftHandMiddle4
mixamorig_LeftHandRing1
mixamorig_LeftHandRing2
mixamorig_LeftHandRing3
mixamorig_LeftHandRing4
mixamorig_LeftHandPinky1
mixamorig_LeftHandPinky2
mixamorig_LeftHandPinky3
mixamorig_LeftHandPinky4
mixamorig_RightShoulder
mixamorig_RightArm
mixamorig_RightForeArm
mixamorig_RightHand
mixamorig_RightHandThumb1
mixamorig_RightHandThumb2
mixamorig_RightHandThumb3
mixamorig_RightHandThumb4
mixamorig_RightHandIndex1
mixamorig_RightHandIndex2
mixamorig_RightHandIndex3
mixamorig_RightHandIndex4
mixamorig_RightHandMiddle1
mixamorig_RightHandMiddle2
mixamorig_RightHandMiddle3
mixamorig_RightHandMiddle4
mixamorig_RightHandRing1
mixamorig_RightHandRing2
mixamorig_RightHandRing3
mixamorig_RightHandRing4
mixamorig_RightHandPinky1
mixamorig_RightHandPinky2
mixamorig_RightHandPinky3
mixamorig_RightHandPinky4
mixamorig_LeftUpLeg
mixamorig_LeftLeg
mixamorig_LeftFoot
mixamorig_LeftToeBase
mixamorig_LeftToe_End
mixamorig_RightUpLeg
mixamorig_RightLeg
mixamorig_RightFoot
mixamorig_RightToeBase
mixamorig_RightToe_End
```

## Current Forge/Meshy Prototype Rig

The Forge/Meshy test rig currently uses 24 bones:

```text
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

This rig is useful for proof-of-concept testing because it can load, walk, run, and retarget simple armature animations. However, it is not the final release-quality rig because it lacks the full Mixamo-style bone structure, especially fingers and detailed hand motion.

## Locked Direction

The Forge character system should move toward this final pipeline:

```text
Forge/Meshy generated 3D model
→ clean model quality pass
→ rig to Rebel Standard Skeleton
→ apply Rebel/Mixamo-style animation library
→ load as playable Village character
```

## Main Focus Going Forward

The main focus is: how do we rig every Forge-generated 3D character with the full Rebel Standard Skeleton?

The questions to solve next:

1. Can we rig a Forge/Meshy output directly to the 65-bone Mixamo/Rebel Standard skeleton?
2. Can this be automated later without relying on manual Blender work?
3. Can we preserve the Meshy model texture and shape while fitting the better skeleton?
4. Can we create or adopt an in-house Rebel rigging step that produces Mixamo-compatible output?
5. Can we create a repeatable model-quality checklist before rigging so the character has clean hands, feet, limbs, and proportions?

## Model Quality Rules Before Rigging

A Forge model should not move to final rigging unless it passes these checks:

- Full-body character, not chest-up
- Clean A-pose or T-pose preferred
- Hands visible and separated
- Feet visible and separated
- No fused weapons
- Weapons should be separate accessories
- No cape fused to body unless intentionally separate
- Symmetrical limbs
- Clean readable ant silhouette
- Texture/colors preserved
- No melted fingers or blobbed feet
- Body proportions close to the current main playable character quality

## Current Status

Confirmed working:

- Forge character can generate a 3D GLB
- Static GLB can be stored in Rebel Blob
- Meshy rigged GLB can be stored in Rebel Blob
- Walking/running full animation GLBs can be stored and loaded
- Walking/running armature-only GLBs can retarget onto the Meshy 24-bone rig
- Village admin test can use Forge character as a player visual
- Preloaded switching can avoid blink

Confirmed limitation:

- The 24-bone Meshy rig does not match the animation quality of the current main playable 65-bone Mixamo-style rig

Next major technical focus:

- Build or discover a repeatable way to rig Forge/Meshy characters to the Rebel Standard Skeleton
