# Forge Open Source Rigging Research

## Current Problem

Rebel Ants Character Forge needs a reliable path from generated character concepts to playable Village characters. The current master playable rig works, but custom generated Forge characters are not yet safe to use directly as animated playable rigs.

The main blocker is that Meshy/source GLBs can arrive as a single welded static mesh with one material and no semantic separation for headgear, armor, limbs, clothing, or accessories. That makes source-sliced attachments unreliable: the extracted geometry is technically valid, but the result does not behave like a clean wearable part.

## What Worked

- The master playable rig remains the most stable path for Village gameplay.
- Applying generated character color/material looks onto the master playable rig is a practical V1.
- Zone material transfer gives us a controlled way to make the playable rig resemble the Forge concept while keeping the known skeleton, weights, animations, and movement.
- Forge can preview generated playable GLBs and load attachment GLBs onto `mixamorig_Head`.
- The source-sliced attachment pipeline proved we can extract triangles and preserve texture data, which is useful research groundwork.

## What Failed

- Primitive head-wrap prototypes did not produce useful visuals.
- Source-sliced attachment extraction from `rebel_469_static_source_a_pose_v1.glb` was unreliable because the Meshy source is one welded mesh.
- The source GLB does not include separate named nodes, meshes, primitives, or materials for headwear, mask, armor, weapons, or other clean attachment parts.
- Spatial slicing can extract geometry, but it does not know what the geometry represents, so the output is not dependable as a reusable attachment.
- Continuing custom extraction without segmentation or rigging research is likely to waste time.

## Tools To Investigate

- RigAnything
- Articulate AnyMesh
- Anymate
- AccuRIG 2
- Mesh2Motion

## Recommendation

Keep the master playable rig plus zone material transfer as Forge V1.

Pause custom source-sliced attachment work until we research open-source rigging, mesh segmentation, and animation transfer tools. The next useful milestone is finding a dependable way to segment generated source meshes into meaningful regions or generate stable playable rigs without breaking Village movement.
