// wobble-geo.ts — hand-drawn trembling line effect.
//
// Clones a BufferGeometry and displaces each vertex by ±0.5% of its
// distance from the origin in a random direction.  The result is a
// micro-jitter that reads as ink-brush hand-drawn at close distance
// and collapses to a clean silhouette from far away.
//
// USAGE:
//   import { wobbleGeo } from "./wobble-geo";
//   const jitterGeo = wobbleGeo(originalGeo);   // clone + jitter
//   disposables.push(jitterGeo);
//   const mesh = new Mesh(jitterGeo, mat);
//
// InstancedMesh: pass the shared geometry through wobbleGeo once —
// every instance shares the same wobble (acceptable; the jitter reads
// as "ink line character", not as individual variance).
//
// Strength: 0.5% of the position vector length, floored at 0.3% of the
// mesh bounding radius so flat-face surfaces still wobble.

import { BufferGeometry, Float32BufferAttribute } from "three";

/** LCG deterministic pseudo-random — seeded so wobble is stable across
 *  frames (geometry is created once at scene build, not every frame). */
function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Clone `src` and displace each vertex by ±amplitude in a random direction.
 * @param src       Source geometry (not mutated).
 * @param amplitude Relative displacement magnitude (default 0.005 = 0.5%).
 * @param seed      RNG seed for determinism (default 31337).
 */
export function wobbleGeo(
  src: BufferGeometry,
  amplitude = 0.005,
  seed = 31337,
): BufferGeometry {
  const dst = src.clone();
  const pos = dst.getAttribute("position");
  if (!pos) return dst;

  const arr = new Float32Array(pos.array as Float32Array);
  const rng = makeLCG(seed);

  // Estimate a reference length from the bounding sphere so even tiny
  // flat geometries get a noticeable (but not exaggerated) wobble.
  dst.computeBoundingSphere();
  const refR = (dst.boundingSphere?.radius ?? 0.01) * 0.3;

  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i];
    const y = arr[i + 1];
    const z = arr[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z);
    const disp = Math.max(len * amplitude, refR * amplitude);

    // Random unit vector in 3-D (rejection method).
    let dx = 0, dy = 0, dz = 0, dl = 0;
    for (let t = 0; t < 8; t++) {
      dx = rng() * 2 - 1;
      dy = rng() * 2 - 1;
      dz = rng() * 2 - 1;
      dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dl > 0.001 && dl <= 1) break;
    }
    if (dl < 1e-5) { dx = 1; dy = 0; dz = 0; dl = 1; }
    arr[i]     = x + (dx / dl) * disp;
    arr[i + 1] = y + (dy / dl) * disp;
    arr[i + 2] = z + (dz / dl) * disp;
  }

  dst.setAttribute("position", new Float32BufferAttribute(arr, 3));
  dst.computeVertexNormals();
  return dst;
}
