// The runner — chunky big-head proportions (head ≈ half the body height,
// stub limbs, bold simple face), flat toon colors, thin ink hulls. Our own
// design in the reference sheet's style language. Procedurally animated:
// swinging stubs for the run cycle, a breathe for idle, tuck for jumps.
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
import { wobbleGeo } from "./wobble-geo";
import { makeGradientMap } from "./clouds";

export type RunnerPose = "idle" | "run" | "jump" | "chop";

const SCALE = 0.034; // pedestrian-sized — same league as the residents
const HULL = 1.06;

/** Outfit color scheme — picked on the title screen. */
export interface Outfit {
  jacket: string;
  crest: string;
}

export const OUTFITS: Array<Outfit & { label: string }> = [
  { label: "Courier", jacket: "#2e5d66", crest: "#d2693e" },
  { label: "Forest", jacket: "#3e7d58", crest: "#efe7cf" },
  { label: "Rose", jacket: "#c4798c", crest: "#3a4d48" },
  { label: "Ink", jacket: "#3a4d48", crest: "#d9b25e" },
];

export interface Runner {
  group: Group;
  /** Drive the animation. `phase` advances with distance for run cycle. */
  setPose(pose: RunnerPose, phase: number): void;
  dispose(): void;
}

export function buildRunner(outfit: Outfit = OUTFITS[0]): Runner {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const mats: MeshToonMaterial[] = [];
  const matOf = (hex: string) => {
    const m = new MeshToonMaterial({
      color: hex,
      gradientMap: makeGradientMap(3, 0.82),
    });
    mats.push(m);
    return m;
  };
  const teal = matOf(outfit.jacket);
  const paper = matOf("#f2efe6");
  const skin = matOf("#eecfa4");
  const sage = matOf("#9fbfa8");
  const crest = matOf(outfit.crest);
  const white = new MeshBasicMaterial({ color: "#fbfaf5" });
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
      const wGeo = wobbleGeo(geo);
      geos.push(wGeo as BoxGeometry);
      const hm = new Mesh(wGeo, inkHull);
      hm.position.set(x, y, z);
      hm.scale.setScalar(HULL);
      parent.add(hm);
    }
    return m;
  };

  // ---- squat body + messenger bag ---------------------------------------
  addBox(body, teal, 0.42, 0.3, 0.3, 0, 0.3, 0); // torso
  addBox(body, paper, 0.43, 0.09, 0.31, 0, 0.19, 0); // hem stripe
  addBox(body, sage, 0.05, 0.24, 0.31, 0.0, 0.34, 0); // bag strap
  addBox(body, sage, 0.18, 0.2, 0.1, -0.24, 0.32, 0); // bag on the back

  // ---- BIG head ----------------------------------------------------------
  addBox(body, skin, 0.46, 0.42, 0.44, 0, 0.68, 0);
  // little mouth (eyes tried and retired by request — clean face)
  addBox(body, inkSolid, 0.016, 0.03, 0.08, 0.245, 0.54, 0, false);
  // mohawk crest front-to-back + cap band
  addBox(body, crest, 0.34, 0.12, 0.1, -0.02, 0.94, 0);
  addBox(body, teal, 0.48, 0.07, 0.46, 0, 0.875, 0); // cap band
  addBox(body, teal, 0.14, 0.035, 0.34, 0.27, 0.86, 0); // brim

  // ---- stub limbs (pivots at shoulder/hip) -------------------------------
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
      -upper.len - tip.h / 2 + 0.012,
      0,
    );
    body.add(pivot);
    return pivot;
  };

  const armL = makeLimb(
    0, 0.42, -0.26,
    { mat: teal, len: 0.16, thick: 0.1 },
    { mat: skin, w: 0.1, h: 0.09, d: 0.1 },
  );
  const armR = makeLimb(
    0, 0.42, 0.26,
    { mat: teal, len: 0.16, thick: 0.1 },
    { mat: skin, w: 0.1, h: 0.09, d: 0.1 },
  );
  const legL = makeLimb(
    0, 0.16, -0.1,
    { mat: skin, len: 0.08, thick: 0.11 },
    { mat: crest, w: 0.2, h: 0.08, d: 0.14, fwd: 0.045 }, // chunky shoes
  );
  const legR = makeLimb(
    0, 0.16, 0.1,
    { mat: skin, len: 0.08, thick: 0.11 },
    { mat: crest, w: 0.2, h: 0.08, d: 0.14, fwd: 0.045 },
  );

  root.scale.setScalar(SCALE);

  return {
    group: root,
    setPose(pose: RunnerPose, phase: number) {
      if (pose === "run") {
        const s = Math.sin(phase);
        legL.rotation.z = s * 1.1;
        legR.rotation.z = -s * 1.1;
        armL.rotation.z = -s * 0.9;
        armR.rotation.z = s * 0.9;
        // Big-head bounce sells the chunky run.
        body.position.y = Math.abs(Math.cos(phase)) * 0.07;
        body.rotation.z = -0.12;
      } else if (pose === "chop") {
        // Both arms swing down hard, body dips into the blow.
        const sw = Math.sin(Math.min(phase, 1) * Math.PI);
        armL.rotation.z = -2.2 + sw * 1.6;
        armR.rotation.z = -2.2 + sw * 1.6;
        legL.rotation.z = 0.15;
        legR.rotation.z = -0.15;
        body.position.y = -sw * 0.04;
        body.rotation.z = -0.22 * sw;
      } else if (pose === "jump") {
        legL.rotation.z = 0.7;
        legR.rotation.z = -0.5;
        armL.rotation.z = -1.6;
        armR.rotation.z = -1.6;
        body.position.y = 0;
        body.rotation.z = -0.05;
      } else {
        const breathe = Math.sin(phase * 0.15);
        legL.rotation.z = 0;
        legR.rotation.z = 0;
        armL.rotation.z = breathe * 0.08;
        armR.rotation.z = -breathe * 0.08;
        body.position.y = Math.max(0, breathe) * 0.012;
        body.rotation.z = 0;
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) {
        m.gradientMap?.dispose();
        m.dispose();
      }
      white.dispose();
      inkSolid.dispose();
      inkHull.dispose();
    },
  };
}
