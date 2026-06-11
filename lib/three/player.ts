// Sphere-walking player controller. The planet is an analytic unit sphere,
// so no physics engine and no BVH: the player's pose is one quaternion
// (local +Y = radial up, local +X = facing), and walking is rotating that
// frame about its own axes — turning about local Y, advancing about local
// -Z (= up × forward). Jumping is a 1-D parabola on the radial axis.

import {
  BackSide,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Quaternion,
  Vector3,
} from "three";
import { latLngToVec3, vec3ToLatLng } from "./geo";
import { buildRunner, type Outfit, type Runner, type RunnerPose } from "./runner";
import { ensureElevationLoaded, groundHeightAt } from "./elevation";
import { loadLandMask, isSea, type LandMask } from "./ships";
import { INK } from "./palette";
import { makeGradientMap } from "./clouds";

const RUN_SPEED = 0.22; // rad/s ≈ 28s per lap — arcade pace, not a blur
const BACK_SPEED = 0.09;
const SEA_SPEED_MUL = 1.15; // the boat is a little faster than legs
const FLY_SPEED_MUL = 1.7; // wings beat legs
const TURN_SPEED = 2.6; // rad/s
const JUMP_VELOCITY = 0.32; // tap = a hop
const CLIMB_SPEED = 0.16; // hold = the plane climbs at this rate
const ALT_CAP = 0.075; // cruise ceiling above the terrain
const GLIDE_GRAVITY = 0.45; // released/out of fuel → gentle glide down
const FUEL_MAX = 3.5; // seconds of climb; refills on touchdown
const RUN_CYCLE_FREQ = 14; // limb swings per surface-radian, ~cartoon cadence

export interface PlayerInputFrame {
  /** -1..1 — forward positive. */
  forward: number;
  /** -1..1 — positive turns left. */
  turn: number;
  /** True exactly once per jump press. */
  jump: boolean;
  /** True while the jump control is held — sustains flight. */
  jumpHeld: boolean;
  /** True exactly once per chop press. */
  chop: boolean;
}

export interface Player {
  group: Group;
  /** Unit "up" — feet position on the sphere (read-only use). */
  readonly up: Vector3;
  /** World facing direction (read-only use). */
  readonly forward: Vector3;
  /** Play the chop animation (~0.4s). */
  chop(): void;
  /** Flight fuel 0..1 for the HUD. */
  fuelRatio(): number;
  /** True while airborne on the plane. */
  isFlying(): boolean;
  update(
    dt: number,
    input: PlayerInputFrame,
    colliders?: ReadonlyArray<{ dir: Vector3; minDot: number }>,
  ): void;
  dispose(): void;
}

/** Tiny vehicle builder shared by the boat and the plane. */
function vehicleParts() {
  const mats: MeshToonMaterial[] = [];
  const matOf = (hex: string) => {
    const m = new MeshToonMaterial({
      color: hex,
      gradientMap: makeGradientMap(3, 0.82),
    });
    mats.push(m);
    return m;
  };
  const inkHull = new MeshBasicMaterial({ color: INK, side: BackSide });
  const geos: BoxGeometry[] = [];
  const addBox = (
    parent: Group,
    mat: MeshToonMaterial,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
  ) => {
    const geo = new BoxGeometry(w, h, d);
    geos.push(geo);
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    const hull = new Mesh(geo, inkHull);
    hull.position.set(x, y, z);
    hull.scale.setScalar(1.07);
    parent.add(hull);
  };
  const dispose = () => {
    for (const g of geos) g.dispose();
    for (const m of mats) {
      m.gradientMap?.dispose();
      m.dispose();
    }
    inkHull.dispose();
  };
  return { matOf, addBox, dispose };
}

export function buildPlayer(
  spawnLat: number,
  spawnLng: number,
  outfit?: Outfit,
): Player {
  const group = new Group();
  const runner: Runner = buildRunner(outfit);
  group.add(runner.group);
  ensureElevationLoaded();

  let mask: LandMask | null = null;
  void loadLandMask().then((m) => {
    mask = m;
  });

  // Boat — appears when you run onto open water. +X = bow.
  const boatKit = vehicleParts();
  const boat = new Group();
  boatKit.addBox(boat, boatKit.matOf("#f2efe6"), 1.1, 0.3, 0.6, 0, 0.15, 0); // hull
  boatKit.addBox(boat, boatKit.matOf("#2e5d66"), 0.25, 0.22, 0.45, -0.35, 0.4, 0); // stern bench
  boatKit.addBox(boat, boatKit.matOf("#d2693e"), 0.3, 0.1, 0.1, 0.5, 0.34, 0); // bow trim
  boat.scale.setScalar(0.034);
  boat.visible = false;
  group.add(boat);

  // Plane — appears mid-jump. +X = nose.
  const planeKit = vehicleParts();
  const plane = new Group();
  planeKit.addBox(plane, planeKit.matOf("#f2efe6"), 1.2, 0.26, 0.3, 0, 0.1, 0); // fuselage
  planeKit.addBox(plane, planeKit.matOf("#d2693e"), 0.36, 0.07, 1.5, 0.08, 0.12, 0); // wing
  planeKit.addBox(plane, planeKit.matOf("#f2efe6"), 0.22, 0.06, 0.5, -0.52, 0.16, 0); // tail wing
  planeKit.addBox(plane, planeKit.matOf("#d2693e"), 0.18, 0.3, 0.07, -0.55, 0.28, 0); // fin
  plane.scale.setScalar(0.034);
  plane.visible = false;
  group.add(plane);

  // --- initial frame at the spawn point, facing east -----------------------
  const up = latLngToVec3(spawnLat, spawnLng, new Vector3());
  const pole = new Vector3(0, 1, 0);
  // East = d(position)/d(lng), normalized — see geo.ts mapping.
  const east = new Vector3()
    .copy(pole)
    .cross(up) // pole × up: at (1,0,0) this gives (0,0,-1) = east ✓
    .normalize();
  const q = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(east, up.clone(), east.clone().cross(up)),
  );

  let jumpH = 0;
  let jumpV = 0;
  let fuel = FUEL_MAX;
  let runPhase = 0;
  let pose: RunnerPose = "idle";
  let pitch = 0; // smoothed terrain pitch (positive = climbing)
  let chopStartMs = -Infinity;
  const CHOP_MS = 420;

  const axis = new Vector3();
  const step = new Quaternion();
  const fwd = new Vector3();
  const probe = new Vector3();
  const PROBE_ARC = 0.012; // sample terrain this far ahead/behind (radians)

  const apply = () => {
    up.set(0, 1, 0).applyQuaternion(q);
    fwd.set(1, 0, 0).applyQuaternion(q);
    // Stand on the displaced terrain (cities are baked flat, so this is 0
    // at spawn and rises smoothly in the mountains).
    group.position.copy(up).multiplyScalar(1 + groundHeightAt(up) + jumpH);
    group.quaternion.copy(q);
  };
  apply();

  return {
    group,
    up,
    forward: fwd,
    chop() {
      chopStartMs = performance.now();
    },
    fuelRatio() {
      return fuel / FUEL_MAX;
    },
    isFlying() {
      return jumpH > 0;
    },
    update(
      dt: number,
      input: PlayerInputFrame,
      colliders?: ReadonlyArray<{ dir: Vector3; minDot: number }>,
    ) {
      // Turn about local up.
      if (input.turn !== 0) {
        axis.set(0, 1, 0).applyQuaternion(q);
        step.setFromAxisAngle(axis, input.turn * TURN_SPEED * dt);
        q.premultiply(step);
      }
      // Sea check: on open water you sail; jumping puts you on wings.
      // NOT ships.isSea — that one keeps a wide offshore margin so NPC
      // boats never hug the coast. The player's boat must appear the
      // moment your feet are wet, so test right at the coastline (SDF
      // 0.5 ≈ 127).
      let atSea = false;
      if (mask) {
        const ll = vec3ToLatLng(up);
        const u = (ll.lng + 180) / 360;
        const v = 1 - (ll.lat + 90) / 180;
        const px = Math.min(mask.w - 1, Math.max(0, Math.round(u * mask.w)));
        const py = Math.min(mask.h - 1, Math.max(0, Math.round(v * mask.h)));
        atSea = mask.data[(py * mask.w + px) * 4] < 126;
      }

      // Terrain pitch under the runner: sample ground ahead vs behind.
      // Drives the climb/descend body lean AND the speed (slower uphill,
      // faster downhill) — the feel of actually working up a mountain.
      up.set(0, 1, 0).applyQuaternion(q);
      fwd.set(1, 0, 0).applyQuaternion(q);
      probe.copy(up).addScaledVector(fwd, PROBE_ARC).normalize();
      const hAhead = groundHeightAt(probe);
      probe.copy(up).addScaledVector(fwd, -PROBE_ARC).normalize();
      const hBehind = groundHeightAt(probe);
      const slope = (hAhead - hBehind) / (2 * PROBE_ARC);
      const targetPitch = Math.atan(slope);
      pitch += (targetPitch - pitch) * Math.min(1, dt * 10);

      // Advance along the great circle (rotate about local -Z = up×forward).
      const slopeFactor =
        jumpH > 0
          ? FLY_SPEED_MUL // airborne: terrain doesn't slow wings
          : atSea
            ? SEA_SPEED_MUL
            : Math.min(1.35, Math.max(0.55, 1 - slope * 2.0));
      const speed =
        (input.forward > 0
          ? input.forward * RUN_SPEED
          : input.forward * BACK_SPEED) * slopeFactor;
      if (speed !== 0) {
        axis.set(0, 0, -1).applyQuaternion(q);
        step.setFromAxisAngle(axis, speed * dt);
        q.premultiply(step);
        runPhase += Math.abs(speed) * dt * RUN_CYCLE_FREQ;
      }
      // Jump & flight. Tap = hop; HOLD = the plane climbs while fuel lasts
      // (3.5s, refills on touchdown); release or run dry = gentle glide.
      if (input.jump && jumpH === 0) jumpV = JUMP_VELOCITY;
      if (jumpV !== 0 || jumpH > 0) {
        const thrusting = input.jumpHeld && fuel > 0 && jumpH > 0;
        if (thrusting) {
          fuel = Math.max(0, fuel - dt);
          jumpV += (CLIMB_SPEED - jumpV) * Math.min(1, dt * 4);
          if (jumpH >= ALT_CAP) jumpV = Math.min(jumpV, 0);
        } else {
          jumpV -= GLIDE_GRAVITY * dt;
        }
        jumpH += jumpV * dt;
        if (jumpH <= 0) {
          jumpH = 0;
          jumpV = 0;
          fuel = FUEL_MAX;
        }
      }

      // Collision: solid obstacles push the runner back out along the
      // great circle (skip while airborne — you fly OVER buildings).
      // Sign note: rotating about (up × dir) by +δ moves up TOWARD dir
      // (Rodrigues: a×up ∝ dir − up·d). Ejecting outward therefore needs
      // δ = θ − minθ (negative). The first version had it inverted and
      // SUCKED the runner into building centers.
      if (colliders && jumpH === 0) {
        up.set(0, 1, 0).applyQuaternion(q);
        for (const c of colliders) {
          const d = up.dot(c.dir);
          if (d > c.minDot) {
            const theta = Math.acos(Math.min(1, d));
            const minTheta = Math.acos(Math.min(1, c.minDot));
            axis.copy(up).cross(c.dir);
            if (axis.lengthSq() < 1e-10) {
              // Dead center (e.g. landed on the exact spot) — kick out
              // along the facing direction instead of dividing by zero.
              fwd.set(1, 0, 0).applyQuaternion(q);
              axis.copy(fwd).cross(c.dir);
              if (axis.lengthSq() < 1e-10) continue;
            }
            axis.normalize();
            step.setFromAxisAngle(axis, theta - minTheta);
            q.premultiply(step);
            up.set(0, 1, 0).applyQuaternion(q);
          }
        }
      }

      const nowMs = performance.now();
      const chopping = nowMs - chopStartMs < CHOP_MS;
      const flying = jumpH > 0;
      const sailing = !flying && atSea;
      pose = chopping
        ? "chop"
        : flying
          ? "jump"
          : sailing
            ? "idle" // standing in the boat
            : Math.abs(input.forward) > 0.05
              ? "run"
              : "idle";
      runner.setPose(
        pose,
        pose === "chop"
          ? (nowMs - chopStartMs) / CHOP_MS
          : pose === "idle"
            ? nowMs * 0.01
            : runPhase,
      );

      // Vehicles: plane mid-air, boat on water, legs on land.
      plane.visible = flying;
      boat.visible = sailing;
      if (sailing) {
        boat.rotation.x = Math.sin(nowMs * 0.003) * 0.06; // gentle roll
        runner.group.position.y = 0.011; // standing on the deck
      } else if (flying) {
        runner.group.position.y = 0.006; // seated on the fuselage
        plane.rotation.z = Math.max(-0.4, Math.min(0.4, jumpV * 1.2)); // nose follows the arc
      } else {
        runner.group.position.y = 0;
      }

      // Lean the whole body into the slope (about local Z, nose up/down).
      runner.group.rotation.z = Math.max(-0.45, Math.min(0.45, pitch * 0.8));
      apply();
    },
    dispose() {
      runner.dispose();
      boatKit.dispose();
      planeKit.dispose();
    },
  };
}
