import { fitPhysicalDimension, DOG_HEIGHT_M, meters } from "./world-scale";
import { buildNaturalDog } from "./natural-dog";
import { beveledBox } from "./beveled-box";
// The runner's dog — trots a step behind and to the side, ears up, tail
// wagging, hops when you jump terrain. Same big-head grammar as everything
// else.

import {
  BackSide,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Vector3,
} from "three";
import { WORLD_STYLE } from "./palette";
import { makeGradientMap } from "./clouds";
import { groundHeightAt } from "./elevation";
import { loadLandMask, type LandMask } from "./ships";
import { vec3ToLatLng } from "./geo";


const FOLLOW_BACK = meters(1.1); // radians behind the runner
const FOLLOW_SIDE = meters(0.7); // and off to the right
const SMOOTH = 4.5;

export interface Companion {
  group: Group;
  update(
    dt: number,
    nowMs: number,
    playerUp: Vector3,
    playerFwd: Vector3,
    colliders?: ReadonlyArray<{ dir: Vector3; minDot: number }>,
    lead?: Vector3,
    mood?: "sniff" | "lookBack",
  ): void;
  setScarf(enabled: boolean): void;
  dispose(): void;
}

export function buildCompanion(): Companion {
  const group = new Group();
  let mask: LandMask | null = null;
  void loadLandMask().then((m) => {
    mask = m;
  });
  const mats: MeshToonMaterial[] = [];
  const matOf = (hex: string) => {
    const m = new MeshToonMaterial({
      color: hex,
      gradientMap: makeGradientMap(3, 0.82),
    });
    mats.push(m);
    return m;
  };
  const inkSolid = new MeshBasicMaterial({ color: WORLD_STYLE.ink });
  const inkHull = new MeshBasicMaterial({ color: WORLD_STYLE.ink, side: BackSide });

  const geos: BufferGeometry[] = [];
  const addBox = (
    parent: Group,
    mat: MeshToonMaterial | MeshBasicMaterial,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    hull = true,
  ) => {
    const geo = beveledBox(w, h, d);
    geos.push(geo);
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    if (hull) {
      const hm = new Mesh(geo, inkHull);
      hm.position.set(x, y, z);
      hm.scale.setScalar(1.035);
      parent.add(hm);
    }
  };

  const dog = buildNaturalDog();
  const { body, legs, tail } = dog;
  group.add(body);
  fitPhysicalDimension(body,"y",DOG_HEIGHT_M);

  // The dog's own little boat for sea crossings.
  const boat = new Group();
  addBox(boat, matOf("#f2efe6"), 1.0, 0.28, 0.6, 0, -0.12, 0);
  addBox(boat, matOf("#2e5d66"), 0.22, 0.1, 0.45, -0.3, 0.06, 0);
  boat.visible = false;
  group.add(boat);

  boat.scale.setScalar(meters(1.8));

  const dir = new Vector3(1, 0, 0); // current position on the sphere
  const tangent = new Vector3();
  const target = new Vector3();
  const fwdT = new Vector3();
  const side = new Vector3();
  const right = new Vector3();
  const m4 = new Matrix4();
  let initialized = false;
  let moving = 0;

  return {
    group,
    update(dt, nowMs, playerUp, playerFwd, colliders, lead, mood) {
      side.copy(playerFwd).cross(playerUp); // right of the runner
      target
        .copy(playerUp)
        .addScaledVector(playerFwd, -FOLLOW_BACK)
        .addScaledVector(side, FOLLOW_SIDE)
        .normalize();
      if (lead) target.copy(playerUp).addScaledVector(lead, meters(2.2)).normalize();
      if (!initialized) {
        dir.copy(target);
        initialized = true;
      }
      const before = dir.dot(target);
      const k = 1 - Math.exp(-dt * SMOOTH);
      dir.lerp(target, k).normalize();
      moving = moving * 0.9 + (1 - Math.min(1, before)) * 4000000 * 0.1;

      // The dog can't walk through buildings either: clamp onto the
      // keep-out boundary (exact placement: cos/sin recompose).
      if (colliders) {
        for (const c of colliders) {
          const d = dir.dot(c.dir);
          if (d > c.minDot) {
            const minTheta = Math.acos(Math.min(1, c.minDot));
            tangent.copy(dir).addScaledVector(c.dir, -d);
            if (tangent.lengthSq() < 1e-10) continue;
            tangent.normalize();
            dir
              .copy(c.dir)
              .multiplyScalar(Math.cos(minTheta))
              .addScaledVector(tangent, Math.sin(minTheta));
          }
        }
      }

      // Face the runner's heading, stand on the terrain, trot-bounce.
      fwdT.copy(playerFwd).addScaledVector(dir, -dir.dot(playerFwd)).normalize();
      right.copy(fwdT).cross(dir);
      m4.makeBasis(fwdT, dir, right);
      group.quaternion.setFromRotationMatrix(m4);
      const bounce = Math.abs(Math.sin(nowMs * 0.016)) * Math.min(meters(.05), moving);
      group.position
        .copy(dir)
        .multiplyScalar(1 + groundHeightAt(dir) + bounce);
      const stride = Math.sin(nowMs * 0.016) * Math.min(0.65, moving * 250);
      legs.forEach((leg, i) => {
        const swing = boat.visible ? 0 : stride * (i === 0 || i === 3 ? 1 : -1);
        leg.rotation.z = swing;
        dog.knees[i].rotation.z = Math.max(0,-swing) * .7;
      });
      dog.head.rotation.z = mood === "sniff" ? -.45 + Math.sin(nowMs * .009) * .08 : 0;
      dog.head.rotation.y = mood === "lookBack" ? 1.25 : 0;
      tail.rotation.x = Math.sin(nowMs * 0.014) * 0.6;
      // Over water the dog gets its own little boat (waterline test, same
      // tight threshold as the player's).
      if (mask) {
        const ll = vec3ToLatLng(dir);
        const u = (ll.lng + 180) / 360;
        const v = 1 - (ll.lat + 90) / 180;
        const px = Math.min(mask.w - 1, Math.max(0, Math.round(u * mask.w)));
        const py = Math.min(mask.h - 1, Math.max(0, Math.round(v * mask.h)));
        const sea = mask.data[(py * mask.w + px) * 4] < 126;
        boat.visible = sea;
        boat.rotation.x = sea ? Math.sin(nowMs * 0.0032) * 0.07 : 0;
        body.position.y = sea ? meters(.12) : 0;
      }
    },
    setScarf(enabled) { dog.bandana.visible = enabled; },
    dispose() {
      dog.dispose();
      for (const g of geos) g.dispose();
      for (const m of mats) {
        m.gradientMap?.dispose();
        m.dispose();
      }
      inkSolid.dispose();
      inkHull.dispose();
    },
  };
}
