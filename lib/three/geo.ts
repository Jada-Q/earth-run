// Spherical helpers shared by everything that lives on the planet surface.

import { Vector3 } from "three";

/** lat/lng → unit-sphere position matching SphereGeometry's texture mapping
 *  (see camera-rig.ts for the derivation). */
export function latLngToVec3(lat: number, lng: number, out: Vector3): Vector3 {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  return out.set(
    Math.cos(latR) * Math.cos(lngR),
    Math.sin(latR),
    -Math.cos(latR) * Math.sin(lngR),
  );
}

/** Inverse of latLngToVec3 for a (normalized) surface position. */
export function vec3ToLatLng(p: Vector3): { lat: number; lng: number } {
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, p.y))) * 180) / Math.PI,
    lng: (Math.atan2(-p.z, p.x) * 180) / Math.PI,
  };
}
