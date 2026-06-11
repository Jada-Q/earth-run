// Sphere-walking player controller. The planet is an analytic unit sphere,
// so no physics engine and no BVH: the player's pose is one quaternion
// (local +Y = radial up, local +X = facing), and walking is rotating that
// frame about its own axes — turning about local Y, advancing about local
// -Z (= up × forward). Jumping is a 1-D parabola on the radial axis.

import { Group, Matrix4, Quaternion, Vector3 } from "three";
import { latLngToVec3 } from "./geo";
import { buildRunner, type Runner, type RunnerPose } from "./runner";
import { ensureElevationLoaded, groundHeightAt } from "./elevation";

const RUN_SPEED = 0.22; // rad/s ≈ 28s per lap — arcade pace, not a blur
const BACK_SPEED = 0.09;
const TURN_SPEED = 2.6; // rad/s
const JUMP_VELOCITY = 0.32; // world units/s, radial
const GRAVITY = 1.1;
const RUN_CYCLE_FREQ = 14; // limb swings per surface-radian, ~cartoon cadence

export interface PlayerInputFrame {
  /** -1..1 — forward positive. */
  forward: number;
  /** -1..1 — positive turns left. */
  turn: number;
  /** True exactly once per jump press. */
  jump: boolean;
}

export interface Player {
  group: Group;
  /** Unit "up" — feet position on the sphere (read-only use). */
  readonly up: Vector3;
  /** World facing direction (read-only use). */
  readonly forward: Vector3;
  update(dt: number, input: PlayerInputFrame): void;
  dispose(): void;
}

export function buildPlayer(spawnLat: number, spawnLng: number): Player {
  const group = new Group();
  const runner: Runner = buildRunner();
  group.add(runner.group);
  ensureElevationLoaded();

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
  let runPhase = 0;
  let pose: RunnerPose = "idle";

  const axis = new Vector3();
  const step = new Quaternion();
  const fwd = new Vector3();

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
    update(dt: number, input: PlayerInputFrame) {
      // Turn about local up.
      if (input.turn !== 0) {
        axis.set(0, 1, 0).applyQuaternion(q);
        step.setFromAxisAngle(axis, input.turn * TURN_SPEED * dt);
        q.premultiply(step);
      }
      // Advance along the great circle (rotate about local -Z = up×forward).
      const speed =
        input.forward > 0
          ? input.forward * RUN_SPEED
          : input.forward * BACK_SPEED;
      if (speed !== 0) {
        axis.set(0, 0, -1).applyQuaternion(q);
        step.setFromAxisAngle(axis, speed * dt);
        q.premultiply(step);
        runPhase += Math.abs(speed) * dt * RUN_CYCLE_FREQ;
      }
      // Jump.
      if (input.jump && jumpH === 0) jumpV = JUMP_VELOCITY;
      if (jumpV !== 0 || jumpH > 0) {
        jumpH += jumpV * dt;
        jumpV -= GRAVITY * dt;
        if (jumpH <= 0) {
          jumpH = 0;
          jumpV = 0;
        }
      }

      pose =
        jumpH > 0 ? "jump" : Math.abs(input.forward) > 0.05 ? "run" : "idle";
      runner.setPose(pose, pose === "idle" ? performance.now() * 0.01 : runPhase);
      apply();
    },
    dispose() {
      runner.dispose();
    },
  };
}
