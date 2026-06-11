// Geography layer — the educational heart of the game. Crossing a country,
// a famous mountain range or an ocean announces its name. Regions are
// angular circles along (and around) the race route; when several overlap
// the most specific (smallest) wins, so "The Alps" beats "Italy".
//
// Coordinates are approximate region centers — this is a classroom globe,
// not a border dataset.

import { Vector3 } from "three";
import { latLngToVec3 } from "./geo";

export type GeoKind = "country" | "range" | "ocean" | "desert" | "plateau";

interface GeoRegionDef {
  name: string;
  kind: GeoKind;
  lat: number;
  lng: number;
  radiusDeg: number;
}

const DEFS: GeoRegionDef[] = [
  // Countries along the route
  { name: "Japan · 日本", kind: "country", lat: 36.5, lng: 138, radiusDeg: 4.5 },
  { name: "United States · 美国", kind: "country", lat: 39, lng: -98, radiusDeg: 13 },
  { name: "United Kingdom · 英国", kind: "country", lat: 53, lng: -1.8, radiusDeg: 3.2 },
  { name: "France · 法国", kind: "country", lat: 46.8, lng: 2.4, radiusDeg: 3.6 },
  { name: "Italy · 意大利", kind: "country", lat: 42.8, lng: 12.8, radiusDeg: 3.4 },
  { name: "Turkey · 土耳其", kind: "country", lat: 39.3, lng: 33, radiusDeg: 4.5 },
  { name: "United Arab Emirates · 阿联酋", kind: "country", lat: 24.2, lng: 54.5, radiusDeg: 2.6 },
  { name: "India · 印度", kind: "country", lat: 22.5, lng: 79, radiusDeg: 8.5 },
  { name: "China · 中国", kind: "country", lat: 33, lng: 106, radiusDeg: 10 },
  // Famous ranges / terrain (smaller radius → wins over the country)
  { name: "The Rocky Mountains · 落基山脉", kind: "range", lat: 42, lng: -109, radiusDeg: 5 },
  { name: "The Alps · 阿尔卑斯山脉", kind: "range", lat: 46.2, lng: 9.8, radiusDeg: 2.6 },
  { name: "The Himalayas · 喜马拉雅山脉", kind: "range", lat: 28.8, lng: 85, radiusDeg: 3.8 },
  { name: "Tibetan Plateau · 青藏高原", kind: "plateau", lat: 33.5, lng: 90, radiusDeg: 6 },
  { name: "Arabian Desert · 阿拉伯沙漠", kind: "desert", lat: 23.5, lng: 46, radiusDeg: 6.5 },
  { name: "The Andes · 安第斯山脉", kind: "range", lat: -20, lng: -68, radiusDeg: 8 },
  // Oceans (huge, lose to everything else)
  { name: "Pacific Ocean · 太平洋", kind: "ocean", lat: 25, lng: -165, radiusDeg: 32 },
  { name: "Atlantic Ocean · 大西洋", kind: "ocean", lat: 45, lng: -38, radiusDeg: 14 },
];

interface GeoRegion extends GeoRegionDef {
  dir: Vector3;
  minDot: number;
}

const REGIONS: GeoRegion[] = DEFS.map((d) => ({
  ...d,
  dir: latLngToVec3(d.lat, d.lng, new Vector3()),
  minDot: Math.cos((d.radiusDeg * Math.PI) / 180),
}));

/** Most specific region containing the player, or null in open terrain. */
export function regionAt(up: Vector3): { name: string; kind: GeoKind } | null {
  let best: GeoRegion | null = null;
  for (const r of REGIONS) {
    if (up.dot(r.dir) > r.minDot) {
      if (!best || r.radiusDeg < best.radiusDeg) best = r;
    }
  }
  return best ? { name: best.name, kind: best.kind } : null;
}
