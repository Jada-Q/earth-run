// Race system — an eastbound lap around the world through city checkpoint
// gates, back to the start line in Tokyo. Gates must be taken in order; the
// active gate pulses and carries a tall beacon. Times in ms; best lap in
// localStorage.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  CylinderGeometry,
  TorusGeometry,
  Object3D,
  Vector3,
} from "three";
import { INK, ACCENT } from "./palette";
import { latLngToVec3 } from "./geo";

// Eastbound from Tokyo, back to Tokyo. Approximate metro coords —
// decorative checkpoints, not a geography lesson.
const ROUTE: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Los Angeles", lat: 34.1, lng: -118.2 },
  { name: "Chicago", lat: 41.9, lng: -87.6 },
  { name: "New York", lat: 40.7, lng: -74.0 },
  { name: "London", lat: 51.5, lng: -0.1 },
  { name: "Paris", lat: 48.9, lng: 2.3 },
  { name: "Rome", lat: 41.9, lng: 12.5 },
  { name: "Istanbul", lat: 41.0, lng: 28.9 },
  { name: "Dubai", lat: 25.2, lng: 55.3 },
  { name: "Delhi", lat: 28.6, lng: 77.2 },
  { name: "Shanghai", lat: 31.2, lng: 121.5 },
  { name: "Tokyo (finish)", lat: 35.7, lng: 139.7 },
];

/** Angular pass radius: ~5.5° feels generous without being sloppy. */
const PASS_COS = Math.cos((5.5 * Math.PI) / 180);
const BEST_KEY = "earth-run:best-ms";

export interface RaceHud {
  state: "ready" | "running" | "finished";
  elapsedMs: number;
  index: number;
  total: number;
  targetName: string;
  bestMs: number | null;
  newRecord: boolean;
}

export interface Race {
  group: Group;
  /** Direction-to-target projected on the player's tangent plane (unit),
   *  or null before start/after finish. */
  targetTangent(playerUp: Vector3, out: Vector3): Vector3 | null;
  start(nowMs: number): void;
  update(nowMs: number, playerUp: Vector3): void;
  hud(nowMs: number): RaceHud;
  restart(): void;
  dispose(): void;
}

export function buildRace(): Race {
  const group = new Group();

  const ringGeo = new TorusGeometry(0.032, 0.0045, 8, 32);
  const beaconGeo = new CylinderGeometry(0.006, 0.012, 0.16, 6, 1, true);
  const ringMatIdle = new MeshBasicMaterial({
    color: INK,
    transparent: true,
    opacity: 0.35,
  });
  const ringMatActive = new MeshBasicMaterial({ color: ACCENT });
  const beaconMatIdle = new MeshBasicMaterial({
    color: "#f1ead8",
    transparent: true,
    opacity: 0.18,
  });
  const beaconMatActive = new MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0.45,
  });

  const dirs: Vector3[] = [];
  const gates: Array<{ ring: Mesh; beacon: Mesh; holder: Group }> = [];
  const anchor = new Object3D();

  for (const cp of ROUTE) {
    const dir = latLngToVec3(cp.lat, cp.lng, new Vector3());
    dirs.push(dir);
    const holder = new Group();
    anchor.position.copy(dir);
    anchor.lookAt(dir.x * 2, dir.y * 2, dir.z * 2); // +Z = outward
    holder.position.copy(dir).multiplyScalar(1.001);
    holder.quaternion.copy(anchor.quaternion);
    const ring = new Mesh(ringGeo, ringMatIdle); // torus lies in XY = tangent
    ring.position.z = 0.012;
    const beacon = new Mesh(beaconGeo, beaconMatIdle);
    beacon.rotation.x = Math.PI / 2; // cylinder axis → outward
    beacon.position.z = 0.09;
    holder.add(ring, beacon);
    group.add(holder);
    gates.push({ ring, beacon, holder });
  }

  let state: RaceHud["state"] = "ready";
  let index = 0;
  let startMs = 0;
  let finishMs = 0;
  let newRecord = false;

  const styleGates = () => {
    gates.forEach((g, i) => {
      const active = state === "running" && i === index;
      g.ring.material = active ? ringMatActive : ringMatIdle;
      g.beacon.material = active ? beaconMatActive : beaconMatIdle;
      g.holder.visible = state !== "running" || i >= index;
    });
  };
  styleGates();

  const readBest = (): number | null => {
    try {
      const v = localStorage.getItem(BEST_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  };

  const tangent = new Vector3();

  return {
    group,
    targetTangent(playerUp: Vector3, out: Vector3): Vector3 | null {
      if (state !== "running") return null;
      const target = dirs[index];
      out
        .copy(target)
        .addScaledVector(playerUp, -playerUp.dot(target));
      if (out.lengthSq() < 1e-8) return null;
      return out.normalize();
    },
    start(nowMs: number) {
      if (state !== "ready") return;
      state = "running";
      startMs = nowMs;
      index = 0;
      styleGates();
    },
    update(nowMs: number, playerUp: Vector3) {
      // Active gate pulse.
      if (state === "running") {
        const g = gates[index];
        const pulse = 1 + 0.15 * Math.sin(nowMs * 0.006);
        g.ring.scale.setScalar(pulse);
        if (playerUp.dot(dirs[index]) > PASS_COS) {
          gates[index].ring.scale.setScalar(1);
          index++;
          if (index >= gates.length) {
            state = "finished";
            finishMs = nowMs - startMs;
            const best = readBest();
            newRecord = best === null || finishMs < best;
            if (newRecord) {
              try {
                localStorage.setItem(BEST_KEY, String(Math.round(finishMs)));
              } catch {
                // private mode etc. — record just isn't persisted
              }
            }
          }
          styleGates();
        }
      }
      void tangent;
    },
    hud(nowMs: number): RaceHud {
      return {
        state,
        elapsedMs:
          state === "running"
            ? nowMs - startMs
            : state === "finished"
              ? finishMs
              : 0,
        index,
        total: gates.length,
        targetName:
          state === "finished"
            ? ROUTE[ROUTE.length - 1].name
            : ROUTE[Math.min(index, ROUTE.length - 1)].name,
        bestMs: readBest(),
        newRecord: state === "finished" && newRecord,
      };
    },
    restart() {
      state = "ready";
      index = 0;
      newRecord = false;
      styleGates();
    },
    dispose() {
      ringGeo.dispose();
      beaconGeo.dispose();
      ringMatIdle.dispose();
      ringMatActive.dispose();
      beaconMatIdle.dispose();
      beaconMatActive.dispose();
    },
  };
}
