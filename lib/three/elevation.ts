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
let loading = false;

export function ensureElevationLoaded(): void {
  if (loading || map) return;
  loading = true;
  void (async () => {
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

/** Terrain height (world units above the unit sphere) at a surface
 *  direction. Bilinear-free nearest sample — at game scale one texel is
 *  ~10km, plenty smooth under a runner. */
export function groundHeightAt(up: Vector3): number {
  if (!map) return 0;
  const lat = (Math.asin(Math.max(-1, Math.min(1, up.y))) * 180) / Math.PI;
  const lng = (Math.atan2(-up.z, up.x) * 180) / Math.PI;
  const u = (lng + 180) / 360;
  const v = (90 - lat) / 180;
  const px = Math.min(map.w - 1, Math.max(0, Math.round(u * map.w)));
  const py = Math.min(map.h - 1, Math.max(0, Math.round(v * map.h)));
  return (map.data[(py * map.w + px) * 4] / 255) * TERRAIN_SCALE;
}
