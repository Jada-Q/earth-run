// Input — keyboard (WASD/arrows + space) and a touch joystick on the left
// half of the screen. The React HUD's jump button calls pressJump().

import type { PlayerInputFrame } from "./player";

const JOY_RADIUS_PX = 56;

export interface GameInput {
  /** Read the current frame's input (consumes the jump edge). */
  read(): PlayerInputFrame;
  pressJump(): void;
  /** Live joystick state for the HUD (null when not touching). */
  joystick(): { originX: number; originY: number; dx: number; dy: number } | null;
  detach(): void;
}

export function attachInput(target: HTMLElement): GameInput {
  const keys = new Set<string>();
  let jumpQueued = false;
  let joyId: number | null = null;
  let joyOrigin = { x: 0, y: 0 };
  let joyDelta = { x: 0, y: 0 };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === " ") {
      jumpQueued = true;
      e.preventDefault();
      return;
    }
    keys.add(k);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };

  const onTouchStart = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (joyId === null && t.clientX < window.innerWidth * 0.6) {
        joyId = t.identifier;
        joyOrigin = { x: t.clientX, y: t.clientY };
        joyDelta = { x: 0, y: 0 };
        e.preventDefault();
      }
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        joyDelta = {
          x: Math.max(-1, Math.min(1, (t.clientX - joyOrigin.x) / JOY_RADIUS_PX)),
          y: Math.max(-1, Math.min(1, (t.clientY - joyOrigin.y) / JOY_RADIUS_PX)),
        };
        e.preventDefault();
      }
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId) {
        joyId = null;
        joyDelta = { x: 0, y: 0 };
      }
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  target.addEventListener("touchstart", onTouchStart, { passive: false });
  target.addEventListener("touchmove", onTouchMove, { passive: false });
  target.addEventListener("touchend", onTouchEnd);
  target.addEventListener("touchcancel", onTouchEnd);

  return {
    read(): PlayerInputFrame {
      let forward = 0;
      let turn = 0;
      if (keys.has("w") || keys.has("arrowup")) forward += 1;
      if (keys.has("s") || keys.has("arrowdown")) forward -= 1;
      if (keys.has("a") || keys.has("arrowleft")) turn += 1;
      if (keys.has("d") || keys.has("arrowright")) turn -= 1;
      if (joyId !== null) {
        forward += -joyDelta.y; // drag up = run forward
        turn += -joyDelta.x; // drag left = turn left
      }
      const jump = jumpQueued;
      jumpQueued = false;
      return {
        forward: Math.max(-1, Math.min(1, forward)),
        turn: Math.max(-1, Math.min(1, turn)),
        jump,
      };
    },
    pressJump() {
      jumpQueued = true;
    },
    joystick() {
      if (joyId === null) return null;
      return {
        originX: joyOrigin.x,
        originY: joyOrigin.y,
        dx: joyDelta.x * JOY_RADIUS_PX,
        dy: joyDelta.y * JOY_RADIUS_PX,
      };
    },
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
    },
  };
}
