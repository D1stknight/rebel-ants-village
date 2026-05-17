# RigAnything Test Plan For Rebel Ants Forge

## Goal

Test whether RigAnything can turn a Forge-generated static source GLB into a usable rigged character asset for Rebel Ants Forge.

Primary test asset:

```text
assets/forge/sources/rebel_469_static_source_a_pose_v1.glb
```

Desired output:

```text
rigged GLB or FBX with skeleton + skin weights
```

## Current Problem

Our custom rig builder can create bones, joints, weights, and GLB output, but the generated deformation has not been stable enough for Village gameplay. The Meshy/Forge static source is also one welded mesh with no semantic body/accessory separation, which makes manual extraction and procedural attachment work unreliable.

RigAnything is worth testing because it is designed to generate skeleton topology and skinning weights from arbitrary 3D assets without requiring a fixed humanoid template.

## RigAnything Setup Requirements

Repository:

```text
https://github.com/Isabella98Liu/RigAnything
```

Project page:

```text
https://www.liuisabella.com/RigAnything/
```

Paper:

```text
https://arxiv.org/abs/2502.09615
```

Known setup requirements from the repo:

- Python 3.11, recommended through Conda.
- PyTorch installed for the local CUDA/CPU environment.
- Project dependencies from `requirements.txt`.
- Blender Python support through the `bpy` PyPI package or a system Blender install.
- System GL libraries may be needed for `open3d`, `pymeshlab`, or `bpy`.
- Pretrained checkpoint downloaded from Hugging Face:

```text
hf download Isabellaliu/RigAnything --local-dir ckpt/
```

Important license note:

RigAnything currently uses an Adobe Research License for noncommercial research purposes. Treat this as a research-only experiment unless licensing is clarified for production/commercial use.

## Expected Input Formats

RigAnything accepts:

- `.glb`
- `.obj`

The repo README says `.glb` is supported directly. `.obj` is supported but may be converted to `.glb` internally without textures.

For Rebel Ants Forge, use `.glb` first so we preserve the source asset and avoid losing texture information during OBJ conversion.

## GLB Conversion Plan

First attempt should not convert the source:

```text
assets/forge/sources/rebel_469_static_source_a_pose_v1.glb
```

If RigAnything fails to read the GLB, try a Blender or glTF Transform normalization pass:

```bash
# Optional Blender normalization/export pass
blender --background --python scripts/normalize-for-riganything.py -- \
  assets/forge/sources/rebel_469_static_source_a_pose_v1.glb \
  /tmp/rebel_469_riganything_input.glb
```

Fallback conversion path:

```bash
# OBJ fallback only if GLB fails. Expect texture loss or extra material work.
blender --background --python scripts/export-glb-to-obj.py -- \
  assets/forge/sources/rebel_469_static_source_a_pose_v1.glb \
  /tmp/rebel_469_riganything_input.obj
```

Do not wire this into Forge until the output quality is proven manually.

## First Local Install/Test Commands

Run outside this repo, preferably in a scratch directory:

```bash
git clone https://github.com/Isabella98Liu/RigAnything.git
cd RigAnything

conda create -n riganything -y python=3.11
conda activate riganything

# Choose the PyTorch command that matches the machine.
# CUDA example from the RigAnything README:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126

pip install -r requirements.txt
hf download Isabellaliu/RigAnything --local-dir ckpt/
```

Copy or symlink the Rebel 469 source GLB:

```bash
mkdir -p data/rebel-ants
cp /path/to/rebel-ants-village/assets/forge/sources/rebel_469_static_source_a_pose_v1.glb \
  data/rebel-ants/rebel_469_static_source_a_pose_v1.glb
```

Run the first direct GLB test:

```bash
sh scripts/inference.sh data/rebel-ants/rebel_469_static_source_a_pose_v1.glb 1 8192
```

Expected output location:

```text
outputs/rebel_469_static_source_a_pose_v1/rebel_469_static_source_a_pose_v1_simplified_rig.glb
```

If simplification harms the ant shape, rerun without simplification:

```bash
sh scripts/inference.sh data/rebel-ants/rebel_469_static_source_a_pose_v1.glb 0 8192
```

Advanced direct command flow:

```bash
python inference_utils/mesh_simplify.py \
  --data_path data/rebel-ants/rebel_469_static_source_a_pose_v1.glb \
  --mesh_simplify 1 \
  --simplify_count 8192 \
  --output_path outputs/rebel_469_static_source_a_pose_v1

python inference.py \
  --config config.yaml \
  --load ckpt/riganything_ckpt.pt \
  -s inference true \
  -s inference_out_dir outputs/rebel_469_static_source_a_pose_v1 \
  --mesh_path outputs/rebel_469_static_source_a_pose_v1/rebel_469_static_source_a_pose_v1_simplified.glb

python inference_utils/vis_skel.py \
  --data_path outputs/rebel_469_static_source_a_pose_v1/rebel_469_static_source_a_pose_v1_simplified.npz \
  --save_path outputs/rebel_469_static_source_a_pose_v1 \
  --mesh_path outputs/rebel_469_static_source_a_pose_v1/rebel_469_static_source_a_pose_v1_simplified.glb
```

## Comparison Plan

Compare the RigAnything output against three existing baselines.

### Meshy Rig

Check:

- Does RigAnything produce cleaner skin weights than Meshy?
- Does skeleton hierarchy look more predictable?
- Can the rig load in Three.js and Babylon.js?
- Does the output preserve or damage the Rebel 469 visual look?

### Master Playable Rig

Check:

- Bone count and names.
- Whether output can be retargeted to master playable animations.
- Whether walk/run/jump/kick tests bind cleanly.
- Whether the rig can ever replace the master rig, or only inform future tooling.

### Failed Custom Rig Builder

Check:

- Vertex deformation quality.
- Whether inverse bind matrices are valid.
- Whether skin joint order and `JOINTS_0` alignment are sane.
- Whether generated weights are smoother than our body-zone/manual marker binding.
- Whether RigAnything output can teach us a better skeleton/weight generation strategy.

## Validation Checklist

Open the rigged GLB in Blender:

- Skeleton exists.
- Mesh has a skin/armature modifier.
- Vertex groups/weights exist.
- Pose bones deform the mesh without exploding.
- The ant body still resembles Rebel 469.

Open in Forge/Three.js:

- GLB loads.
- Skeleton/bones are discoverable.
- Skinned mesh exists.
- AnimationMixer can bind test animation tracks if retargeted.

Open or test in Village/Babylon only after Forge preview passes.

## Risks

- GPU: inference prefers CUDA and may require enough VRAM. CPU may be slow or unsupported in practice.
- Python dependencies: `bpy`, `open3d`, `pymeshlab`, and GL libraries can be fragile, especially on headless Linux.
- Output format: expected final output is rigged `.glb`; if only intermediate `.npz` works, we need an exporter/debug step.
- License: current Adobe Research License is noncommercial research only. Not safe for production until legal/licensing is resolved.
- Model availability: checkpoint is hosted on Hugging Face and may require network/auth or may change.
- Topology: Rebel 469 source is one welded Meshy mesh, so rig quality may be limited by geometry quality.
- Animation compatibility: RigAnything may produce arbitrary skeleton names/topology, not Mixamo/master playable compatible names.

## Recommendation

Run RigAnything as an offline research test only.

For Forge V1, keep:

- Master playable rig.
- Zone material transfer.
- Generated playable GLB preview.

Do not replace the master playable rig or restart source-sliced attachment work until RigAnything proves it can produce stable, animation-ready rigs from the Rebel 469 source GLB.
