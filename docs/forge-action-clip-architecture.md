# Forge Action Clip Architecture

Meshy action GLBs are donor pose clips. Village owns physics and root movement.

## Current Rule

- Forge uses Meshy from the same `rig_task_id` to generate per-build action GLBs.
- Each build must store its own donor clips. Do not share jump or run-jump clips across different character builds.
- Village loads one visible rigged Meshy character.
- Village strips root motion and scale tracks from donor action clips.
- Village controls gameplay movement: jump height, forward distance, takeoff, landing, and timing.

## Labels

In Forge, action GLBs should be described as pose clips:

- Jump Pose Clip
- Run-Jump Pose Clip
- High Kick Pose Clip
- Roundhouse Kick Pose Clip

They are still GLB files and still required. The wording is meant to make clear that they are body-pose donors, not the source of gameplay movement.
