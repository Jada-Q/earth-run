// CPU copy of the elevation map (the same texture the planet shader
// displaces with) so the player can stand ON the terrain instead of
// clipping through mountains. Until the texture loads, ground height is 0
// — the spawn city is baked flat, so nothing pops.

import { Vector3 } from "three";
import { TERRAIN_SCALE } from "./planet";

interface ElevMap {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

let map: ElevMap | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureElevationLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const res = await fetch("/textures/elevation.png");
        const bmp = await createImageBitmap(await res.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(bmp, 0, 0);
        const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
        map = { data: img.data, w: bmp.width, h: bmp.height };
      } catch {
        // No elevation → flat ground. Degrades gracefully.
      }
    })();
  }
  return loadPromise;
}

/** Terrain height (world units above the unit sphere) at a surface
 *  direction. Bilinear-interpolated — nearest sampling gave the runner a
 *  staircase ride across texel boundaries. */
export function groundHeightAt(up: Vector3): number {
  if (!map) return 0;
  const lat = (Math.asin(Math.max(-1, Math.min(1, up.y))) * 180) / Math.PI;
  const lng = (Math.atan2(-up.z, up.x) * 180) / Math.PI;
  const fx = ((lng + 180) / 360) * map.w - 0.5;
  const fy = ((90 - lat) / 180) * map.h - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (x: number, y: number) => {
    const cx = ((x % map!.w) + map!.w) % map!.w; // lng wraps
    const cy = Math.min(map!.h - 1, Math.max(0, y));
    return map!.data[(cy * map!.w + cx) * 4];
  };
  const h =
    at(x0, y0) * (1 - tx) * (1 - ty) +
    at(x0 + 1, y0) * tx * (1 - ty) +
    at(x0, y0 + 1) * (1 - tx) * ty +
    at(x0 + 1, y0 + 1) * tx * ty;
  return (h / 255) * TERRAIN_SCALE;
}
