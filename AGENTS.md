# AGENTS.md — earth-run

Toon-style racing game on a real-terrain globe. three.js + Next.js 16 + TypeScript strict. pnpm.

## Do NOT touch (intentional design, not bugs)

- `lib/three/player.ts` quaternion posture math and the Rodrigues push-out logic — hand-derived, verified. Do not "simplify".
- The duplicated meshes with `MeshBasicMaterial({ side: BackSide })` scaled ~1.035 are **ink outline hulls** (inverted-hull outline technique). They are intentional, not accidental duplicates.
- `wobbleGeo()` vertex jitter is an intentional hand-drawn-line effect, not numerical noise.
- Day/night light following local clock, and the CSS backdrop in `app/components/ToonBackdrop.tsx`.
- Do not upgrade or add dependencies. three.js only, no loaders beyond what's already imported, no physics libs.

## Conventions

- Files kebab-case, named exports, no `any`, no `console.log` in shipped code.
- Every scene module returns a dispose function and pushes geometries/materials to a disposables list (see `lib/three/landmarks.ts` for the pattern).
- Build gate: `pnpm build` must pass. There is no test suite; do not add one unless asked.

## Scope discipline

- Make additive changes only. If a change would require editing more than the files named in the task, stop and leave a PR comment instead of expanding scope.
- Never remove the 3D-landmark code path: 2D cards are an opt-in per-landmark overlay with mandatory fallback to the existing 3D group when a texture is missing or fails to load.
