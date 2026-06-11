// The runner — a blocky toon character built from boxes with ink hulls,
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

const SCALE = 0.045; // overall character height ≈ 0.045 world units

interface Limb {
  pivot: Group;
}

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

  const paper = new MeshToonMaterial({
    color: "#f2efe6",
    gradientMap: makeGradientMap(3, 0.78),
  });
  const teal = new MeshToonMaterial({
    color: "#2e5d66",
    gradientMap: makeGradientMap(3, 0.78),
  });
  const skin = new MeshToonMaterial({
    color: "#e8d5b5",
    gradientMap: makeGradientMap(3, 0.78),
  });
  const inkMat = new MeshBasicMaterial({ color: INK, side: BackSide });

  const geos: BoxGeometry[] = [];
  const addBox = (
    parent: Group,
    mat: MeshToonMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const geo = new BoxGeometry(w, h, d);
    geos.push(geo);
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    const hull = new Mesh(geo, inkMat);
    hull.position.set(x, y, z);
    hull.scale.setScalar(1.14);
    parent.add(hull);
    return m;
  };

  // Torso (teal shirt) + head + cap brim. Units: 1 ≈ full height pre-scale.
  addBox(body, teal, 0.34, 0.34, 0.22, 0, 0.62, 0);
  addBox(body, skin, 0.26, 0.24, 0.24, 0, 0.92, 0);
  addBox(body, teal, 0.3, 0.08, 0.3, 0, 1.06, 0); // cap
  addBox(body, teal, 0.12, 0.04, 0.16, 0.18, 1.03, 0); // brim (forward +X)

  // Limbs hang from pivots so they swing from shoulder/hip.
  const makeLimb = (
    mat: MeshToonMaterial,
    px: number,
    py: number,
    pz: number,
    len: number,
    thick: number,
  ): Limb => {
    const pivot = new Group();
    pivot.position.set(px, py, pz);
    addBox(pivot, mat, thick, len, thick, 0, -len / 2, 0);
    body.add(pivot);
    return { pivot };
  };

  const armL = makeLimb(skin, 0, 0.76, -0.24, 0.34, 0.1);
  const armR = makeLimb(skin, 0, 0.76, 0.24, 0.34, 0.1);
  const legL = makeLimb(paper, 0, 0.45, -0.09, 0.45, 0.13);
  const legR = makeLimb(paper, 0, 0.45, 0.09, 0.45, 0.13);

  root.scale.setScalar(SCALE);

  return {
    group: root,
    setPose(pose: RunnerPose, phase: number) {
      if (pose === "run") {
        const s = Math.sin(phase);
        // Limbs swing about Z (lateral axis) so they sweep along +X travel.
        legL.pivot.rotation.z = s * 0.9;
        legR.pivot.rotation.z = -s * 0.9;
        armL.pivot.rotation.z = -s * 0.7;
        armR.pivot.rotation.z = s * 0.7;
        body.position.y = Math.abs(Math.cos(phase)) * 0.06;
        body.rotation.z = -0.12; // forward lean (toward +X)
      } else if (pose === "jump") {
        legL.pivot.rotation.z = 0.5;
        legR.pivot.rotation.z = -0.35;
        armL.pivot.rotation.z = -1.4;
        armR.pivot.rotation.z = -1.4;
        body.position.y = 0;
        body.rotation.z = -0.05;
      } else {
        const breathe = Math.sin(phase * 0.15) * 0.05;
        legL.pivot.rotation.z = 0;
        legR.pivot.rotation.z = 0;
        armL.pivot.rotation.z = breathe;
        armR.pivot.rotation.z = -breathe;
        body.position.y = 0;
        body.rotation.z = 0;
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      paper.dispose();
      paper.gradientMap?.dispose();
      teal.dispose();
      teal.gradientMap?.dispose();
      skin.dispose();
      skin.gradientMap?.dispose();
      inkMat.dispose();
    },
  };
}
