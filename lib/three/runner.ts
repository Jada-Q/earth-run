// The runner — a toon courier built from boxes with thin ink hulls,
// procedurally animated (no skeleton): swinging limbs for the run cycle, a
// gentle breathe for idle, tucked legs mid-jump.
//
// Local frame: +X = facing/travel direction, +Y = up (radial), origin at
// the soles of the feet.

import {
  BackSide,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
} from "three";
import { INK } from "./palette";
import { makeGradientMap } from "./clouds";

export type RunnerPose = "idle" | "run" | "jump";

const SCALE = 0.042;
const HULL = 1.07; // thin ink edge — thick hulls read as chunky up close

export interface Runner {
  group: Group;
  /** Drive the animation. `phase` advances with distance for run cycle. */
  setPose(pose: RunnerPose, phase: number): void;
  dispose(): void;
}

export function buildRunner(): Runner {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const mats: MeshToonMaterial[] = [];
  const matOf = (hex: string) => {
    const m = new MeshToonMaterial({
      color: hex,
      gradientMap: makeGradientMap(3, 0.8),
    });
    mats.push(m);
    return m;
  };
  const paper = matOf("#f2efe6");
  const teal = matOf("#2e5d66");
  const skin = matOf("#e8d5b5");
  const sage = matOf("#9fbfa8");
  const inkSolid = new MeshBasicMaterial({ color: INK });
  const inkHull = new MeshBasicMaterial({ color: INK, side: BackSide });

  const geos: BoxGeometry[] = [];
  const addBox = (
    parent: Group,
    mat: MeshToonMaterial | MeshBasicMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
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
      hm.scale.setScalar(HULL);
      parent.add(hm);
    }
    return m;
  };

  // ---- torso, bag, head -----------------------------------------------
  addBox(body, teal, 0.34, 0.34, 0.2, 0, 0.6, 0); // jacket
  addBox(body, paper, 0.35, 0.1, 0.21, 0, 0.46, 0); // hem stripe
  addBox(body, sage, 0.16, 0.2, 0.08, -0.16, 0.62, 0); // messenger bag (back)
  addBox(body, sage, 0.04, 0.26, 0.21, 0.02, 0.7, 0); // bag strap across
  addBox(body, skin, 0.22, 0.2, 0.2, 0, 0.88, 0); // head
  // eyes — tiny ink squares on the face (+X side)
  addBox(body, inkSolid, 0.012, 0.035, 0.03, 0.112, 0.9, -0.05, false);
  addBox(body, inkSolid, 0.012, 0.035, 0.03, 0.112, 0.9, 0.05, false);
  // cap + brim
  addBox(body, teal, 0.24, 0.07, 0.22, 0, 1.0, 0);
  addBox(body, teal, 0.12, 0.03, 0.18, 0.16, 0.985, 0);

  // ---- limbs (pivots at shoulder/hip so they swing) ---------------------
  const makeLimb = (
    px: number,
    py: number,
    pz: number,
    upper: { mat: MeshToonMaterial; len: number; thick: number },
    tip: { mat: MeshToonMaterial; w: number; h: number; d: number; fwd?: number },
  ) => {
    const pivot = new Group();
    pivot.position.set(px, py, pz);
    addBox(pivot, upper.mat, upper.thick, upper.len, upper.thick, 0, -upper.len / 2, 0);
    addBox(
      pivot,
      tip.mat,
      tip.w,
      tip.h,
      tip.d,
      tip.fwd ?? 0,
      -upper.len - tip.h / 2 + 0.01,
      0,
    );
    body.add(pivot);
    return pivot;
  };

  const armL = makeLimb(
    0, 0.72, -0.22,
    { mat: teal, len: 0.24, thick: 0.085 },
    { mat: skin, w: 0.08, h: 0.08, d: 0.08 },
  );
  const armR = makeLimb(
    0, 0.72, 0.22,
    { mat: teal, len: 0.24, thick: 0.085 },
    { mat: skin, w: 0.08, h: 0.08, d: 0.08 },
  );
  const legL = makeLimb(
    0, 0.42, -0.08,
    { mat: paper, len: 0.32, thick: 0.11 },
    { mat: teal, w: 0.17, h: 0.07, d: 0.12, fwd: 0.035 }, // shoe, toe forward
  );
  const legR = makeLimb(
    0, 0.42, 0.08,
    { mat: paper, len: 0.32, thick: 0.11 },
    { mat: teal, w: 0.17, h: 0.07, d: 0.12, fwd: 0.035 },
  );

  root.scale.setScalar(SCALE);

  return {
    group: root,
    setPose(pose: RunnerPose, phase: number) {
      if (pose === "run") {
        const s = Math.sin(phase);
        legL.rotation.z = s * 0.95;
        legR.rotation.z = -s * 0.95;
        armL.rotation.z = -s * 0.8;
        armR.rotation.z = s * 0.8;
        body.position.y = Math.abs(Math.cos(phase)) * 0.05;
        body.rotation.z = -0.14; // forward lean
      } else if (pose === "jump") {
        legL.rotation.z = 0.55;
        legR.rotation.z = -0.4;
        armL.rotation.z = -1.5;
        armR.rotation.z = -1.5;
        body.position.y = 0;
        body.rotation.z = -0.06;
      } else {
        const breathe = Math.sin(phase * 0.15) * 0.05;
        legL.rotation.z = 0;
        legR.rotation.z = 0;
        armL.rotation.z = breathe;
        armR.rotation.z = -breathe;
        body.position.y = 0;
        body.rotation.z = 0;
      }
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
