// City residents — chibi people strolling small loops around each city,
// plus a cat or dog trotting a tighter, faster loop. Pure box assemblies
// in the cool palette; animation is a waddle-bob, tails wag.

import {
  BackSide,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Matrix4,
  Vector3,
} from "three";
import { INK } from "./palette";
import { makeGradientMap } from "./clouds";
import type { Landmarks } from "./landmarks";

const SHIRTS = ["#2e5d66", "#3e7d58", "#9fbfa8", "#efe7cf"];
const PEOPLE_PER_CITY = 2;

interface Walker {
  group: Group;
  /** Tangent-circle params around the city anchor. */
  anchorIdx: number;
  radius: number;
  speed: number; // rad/s around the loop (sign = direction)
  angle: number;
  bobFreq: number;
  tail: Group | null;
}

export interface Npcs {
  group: Group;
  update(nowMs: number, dt: number): void;
  dispose(): void;
}

export function buildNpcs(landmarks: Landmarks): Npcs {
  const root = new Group();
  const disposables: Array<{ dispose(): void }> = [];

  const inkMat = new MeshBasicMaterial({ color: INK, side: BackSide });
  disposables.push(inkMat);
  const matOf = (() => {
    const cache = new Map<string, MeshToonMaterial>();
    return (hex: string) => {
      let m = cache.get(hex);
      if (!m) {
        m = new MeshToonMaterial({
          color: hex,
          gradientMap: makeGradientMap(3, 0.78),
        });
        cache.set(hex, m);
        disposables.push(m, { dispose: () => m!.gradientMap?.dispose() });
      }
      return m;
    };
  })();

  const prim = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    hex: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const geo = new BoxGeometry(w, h, d);
    disposables.push(geo);
    const m = new Mesh(geo, matOf(hex));
    m.position.set(x, y, z);
    parent.add(m);
    const hull = new Mesh(geo, inkMat);
    hull.position.set(x, y, z);
    hull.scale.setScalar(1.16);
    parent.add(hull);
  };

  let seed = 24601;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Chibi person: legs, body, head. Faces +X, origin at soles. ~60% runner.
  const buildPerson = (shirt: string): Group => {
    const g = new Group();
    prim(g, 0.06, 0.2, 0.06, "#e9e5d8", 0, 0.1, -0.05);
    prim(g, 0.06, 0.2, 0.06, "#e9e5d8", 0, 0.1, 0.05);
    prim(g, 0.17, 0.2, 0.15, shirt, 0, 0.3, 0);
    prim(g, 0.14, 0.13, 0.13, "#e8d5b5", 0, 0.47, 0);
    g.scale.setScalar(0.028);
    return g;
  };

  // Critter: long body, head forward, tail behind (wags). Cat small &
  // tail-up, dog bigger & tail-back.
  const buildCritter = (kind: "cat" | "dog"): { g: Group; tail: Group } => {
    const g = new Group();
    const hex = kind === "cat" ? "#3a4d48" : "#c9b896";
    const s = kind === "cat" ? 0.75 : 1;
    prim(g, 0.3 * s, 0.12 * s, 0.12 * s, hex, 0, 0.1 * s, 0);
    prim(g, 0.12 * s, 0.11 * s, 0.11 * s, hex, 0.2 * s, 0.15 * s, 0);
    // ears
    prim(g, 0.03 * s, 0.05 * s, 0.03 * s, hex, 0.22 * s, 0.23 * s, 0.03 * s);
    prim(g, 0.03 * s, 0.05 * s, 0.03 * s, hex, 0.22 * s, 0.23 * s, -0.03 * s);
    const tail = new Group();
    tail.position.set(-0.16 * s, 0.13 * s, 0);
    prim(tail, 0.035 * s, 0.14 * s, 0.035 * s, hex, 0, 0.06 * s, 0);
    if (kind === "dog") tail.rotation.z = 0.9; // wagging back, not up
    g.add(tail);
    g.scale.setScalar(0.028);
    return { g, tail };
  };

  const walkers: Walker[] = [];
  landmarks.anchors.forEach((a, idx) => {
    for (let p = 0; p < PEOPLE_PER_CITY; p++) {
      const g = buildPerson(SHIRTS[Math.floor(rng() * SHIRTS.length)]);
      root.add(g);
      walkers.push({
        group: g,
        anchorIdx: idx,
        radius: 0.018 + rng() * 0.02,
        speed: (rng() > 0.5 ? 1 : -1) * (0.12 + rng() * 0.15),
        angle: rng() * Math.PI * 2,
        bobFreq: 9 + rng() * 4,
        tail: null,
      });
    }
    const kind = rng() > 0.5 ? "cat" : "dog";
    const { g, tail } = buildCritter(kind);
    root.add(g);
    walkers.push({
      group: g,
      anchorIdx: idx,
      radius: 0.012 + rng() * 0.012,
      speed: (rng() > 0.5 ? 1 : -1) * (0.3 + rng() * 0.25),
      angle: rng() * Math.PI * 2,
      bobFreq: 16,
      tail,
    });
  });

  const pos = new Vector3();
  const fwd = new Vector3();
  const right = new Vector3();
  const m4 = new Matrix4();

  return {
    group: root,
    update(nowMs: number, dt: number) {
      for (const w of walkers) {
        const a = landmarks.anchors[w.anchorIdx];
        w.angle += w.speed * dt;
        const c = Math.cos(w.angle) * w.radius;
        const s = Math.sin(w.angle) * w.radius;
        pos
          .copy(a.dir)
          .addScaledVector(a.east, c)
          .addScaledVector(a.north, s)
          .normalize();
        // Tangent of the loop (direction of travel).
        fwd
          .copy(a.east)
          .multiplyScalar(-Math.sin(w.angle))
          .addScaledVector(a.north, Math.cos(w.angle))
          .multiplyScalar(Math.sign(w.speed))
          .addScaledVector(pos, 0); // (already tangent enough at this radius)
        fwd.addScaledVector(pos, -pos.dot(fwd)).normalize();
        right.copy(fwd).cross(pos);
        m4.makeBasis(fwd, pos, right);
        w.group.quaternion.setFromRotationMatrix(m4);
        const bob = Math.abs(Math.sin(nowMs * 0.001 * w.bobFreq)) * 0.0012;
        w.group.position.copy(pos).multiplyScalar(1 + bob);
        if (w.tail) w.tail.rotation.x = Math.sin(nowMs * 0.012) * 0.5;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
