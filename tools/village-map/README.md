# Village aerial walk map

Used to spread chests and collectibles over everything the player can reach (Miguel, Oct 5).

1. `python3 -m http.server 8765` in the repo root (one browser at a time against it).
2. `TZID=Pacific/Kiritimati node mapgen.mjs <village> <half-size m>` (daylight at ~UTC 21h; pick a timezone where it is day)
   -> `maps/<village>.json` (3 m grid: walk, reach from the spawn, ground h, items) + `maps/<village>-aerial.png` (orthographic, +z up).
   Needs playwright + babylonjs, babylonjs-loaders, babylonjs-materials, draco3dgltf in `NM` (node_modules dir).
   Uses `window._walkProbe` (village.html): blocked / step / ground / refresh.
3. `node overlay.mjs <village> <tag>` -> `maps/<village>-<tag>.png` (chests by tier, collectibles, spots, secrets, gate).
4. `spread.mjs` `spread({ map, layout, count, extraAnchors, maxH, maxR, minAnchor, clear })`: farthest-point picks on open,
   reachable ground away from buildings, trees, spots, doors and NPCs. Write positions with the gen-script y conversion
   (saved y = live y - (max(new, flatNew) - max(old, flatOld))).
Hub half-size 330, Ronin 120.
