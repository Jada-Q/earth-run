// The runner's dog — trots a step behind and to the side, ears up, tail
// wagging, hops when you jump terrain. Same big-head grammar as everything
// else.

import {
  BackSide,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Vector3,
} from "three";
import { INK } from "./palette";
import { makeGradientMap } from "./clouds";
import { groundHeightAt } from "./elevation";

const SCALE = 0.022;
const FOLLOW_BACK = 0.012; // radians behind the runner
const FOLLOW_SIDE = 0.007; // and off to the right
const SMOOTH = 4.5;

export interface Companion {
  group: Group;
  update(dt: number, nowMs: number, playerUp: Vector3, playerFwd: Vector3): void;
  dispose(): void;
}

export function buildCompanion(): Companion {
  const group = new Group();
  const mats: MeshToonMaterial[] = [];
  const matOf = (hex: string) => {
    const m = new MeshToonMaterial({
      color: hex,
      gradientMap: makeGradientMap(3, 0.82),
    });
    mats.push(m);
    return m;
  };
  const coat = matOf("#c9b896");
  const dark = matOf("#8a7d62");
  const inkSolid = new MeshBasicMaterial({ color: INK });
  const inkHull = new MeshBasicMaterial({ color: INK, side: BackSide });

  const geos: BoxGeometry[] = [];
  const addBox = (
    parent: Group,
    mat: MeshToonMaterial | MeshBasicMaterial,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    hull = true,
  ) => {
    const geo = new BoxGeometry(w, h, d);
    geos.push(geo);
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    if (hull) {
      const hm = new Mesh(geo, inkHull);
      hm.position.set(x, y, z);
      hm.scale.setScalar(1.08);
      parent.add(hm);
    }
  };

  const body = new Group();
  group.add(body);
  addBox(body, coat, 0.5, 0.26, 0.26, 0, 0.25, 0); // torso
  addBox(body, coat, 0.3, 0.28, 0.28, 0.32, 0.4, 0); // big head
  addBox(body, dark, 0.08, 0.14, 0.07, 0.38, 0.58, -0.09); // ear
  addBox(body, dark, 0.08, 0.14, 0.07, 0.38, 0.58, 0.09); // ear
  addBox(body, dark, 0.07, 0.06, 0.1, 0.49, 0.36, 0, false); // snout
  addBox(body, inkSolid, 0.012, 0.04, 0.03, 0.475, 0.45, -0.07, false); // eye
  addBox(body, inkSolid, 0.012, 0.04, 0.03, 0.475, 0.45, 0.07, false); // eye
  // legs (static stubs — the trot is a body bounce)
  for (const [lx, lz] of [[0.18, -0.09], [0.18, 0.09], [-0.18, -0.09], [-0.18, 0.09]] as const) {
    addBox(body, dark, 0.09, 0.13, 0.09, lx, 0.065, lz);
  }
  const tail = new Group();
  tail.position.set(-0.27, 0.34, 0);
  addBox(tail, dark, 0.07, 0.2, 0.07, 0, 0.09, 0);
  tail.rotation.z = -0.6;
  body.add(tail);

  group.scale.setScalar(SCALE);

  const dir = new Vector3(1, 0, 0); // current position on the sphere
  const target = new Vector3();
  const fwdT = new Vector3();
  const side = new Vector3();
  const right = new Vector3();
  const m4 = new Matrix4();
  let initialized = false;
  let moving = 0;

  return {
    group,
    update(dt, nowMs, playerUp, playerFwd) {
      side.copy(playerFwd).cross(playerUp); // right of the runner
      target
        .copy(playerUp)
        .addScaledVector(playerFwd, -FOLLOW_BACK)
        .addScaledVector(side, FOLLOW_SIDE)
        .normalize();
      if (!initialized) {
        dir.copy(target);
        initialized = true;
      }
      const before = dir.dot(target);
      const k = 1 - Math.exp(-dt * SMOOTH);
      dir.lerp(target, k).normalize();
      moving = moving * 0.9 + (1 - Math.min(1, before)) * 4000 * 0.1;

      // Face the runner's heading, stand on the terrain, trot-bounce.
      fwdT.copy(playerFwd).addScaledVector(dir, -dir.dot(playerFwd)).normalize();
      right.copy(fwdT).cross(dir);
      m4.makeBasis(fwdT, dir, right);
      group.quaternion.setFromRotationMatrix(m4);
      const bounce = Math.abs(Math.sin(nowMs * 0.016)) * Math.min(0.0012, moving);
      group.position
        .copy(dir)
        .multiplyScalar(1 + groundHeightAt(dir) + bounce);
      tail.rotation.x = Math.sin(nowMs * 0.014) * 0.6;
    },
    dispose() {
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
