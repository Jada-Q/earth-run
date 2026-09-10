import { fitPhysicalDimension } from "./world-scale";
import { buildRunner, type Runner } from "./runner";
import { buildNaturalDog } from "./natural-dog";
import { organicKit } from "./organic-model";
// City residents — chibi people strolling small loops around each city,
// plus a cat or dog trotting a tighter, faster loop. Simplified smooth
// anatomy shares the traveler style while keeping resident geometry small.

import {
  Group,
  Matrix4,
  Vector3,
} from "three";
import { WORLD_STYLE } from "./palette";
import { groundHeightAt } from "./elevation";
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
  limbs: Group[];
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

  let seed = 24601;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const residents = new Map<Group, Runner>();
  const buildPerson = (shirt: string): { g: Group; limbs: Group[] } => {
    const person=buildRunner({jacket:shirt,crest:WORLD_STYLE.bark}, "resident");
    // Background residents use the same physical height as the player.
    disposables.push(person);
    residents.set(person.group,person);
    return {g:person.group,limbs:[]};
  };
  const buildCritter = (kind: "cat" | "dog"): { g: Group; tail: Group } => {
    if(kind==="dog") {
      const dog=buildNaturalDog("resident");disposables.push(dog);fitPhysicalDimension(dog.body,"y",.75);
      return {g:dog.body,tail:dog.tail};
    }
    const g=new Group(),kit=organicKit("resident");disposables.push(kit);
    const coat="#70756b";
    kit.oval(g,coat,0,.22,0,.22,.10,.085);
    kit.oval(g,coat,.20,.32,0,.09,.095,.075);
    for(const z of [-.055,.055]) {
      kit.oval(g,coat,.185,.415,z,.023,.060,.020);
      kit.oval(g,"#d3bf81",.275,.335,z*.7,.010,.012,.007,false);
    }
    for(const x of [-.15,.14])for(const z of [-.055,.055])kit.oval(g,coat,x,.11,z,.026,.105,.025);
    kit.oval(g,WORLD_STYLE.paper,.277,.29,0,.032,.023,.039);
    const tail=new Group();tail.position.set(-.18,.25,0);g.add(tail);
    kit.curve(tail,coat,[[0,0,0],[-.08,.09,0],[-.08,.24,0],[-.04,.27,0]],.023);
    fitPhysicalDimension(g,"y",.45);return {g,tail};
  };

  const walkers: Walker[] = [];
  landmarks.anchors.forEach((a, idx) => {
    for (let p = 0; p < PEOPLE_PER_CITY; p++) {
      const { g, limbs } = buildPerson(SHIRTS[Math.floor(rng() * SHIRTS.length)]);
      root.add(g);
      walkers.push({
        group: g,
        anchorIdx: idx,
        // Inside the cottage ring (0.028+) so strolls never clip houses.
        radius: 0.012 + rng() * 0.012,
        speed: (rng() > 0.5 ? 1 : -1) * (0.12 + rng() * 0.15),
        angle: rng() * Math.PI * 2,
        bobFreq: 9 + rng() * 4,
        tail: null,
        limbs,
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
      limbs: [],
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
        const bob = Math.abs(Math.sin(nowMs * 0.001 * w.bobFreq)) * 0.000006;
        w.group.position.copy(pos).multiplyScalar(1 + groundHeightAt(pos) + bob);
        residents.get(w.group)?.setPose("run", nowMs*.001*w.bobFreq);
        w.limbs.forEach((limb, i) => {
          limb.rotation.z = Math.sin(nowMs * 0.001 * w.bobFreq) * 0.45 * (i === 0 || i === 3 ? 1 : -1);
        });
        if (w.tail) w.tail.rotation.x = Math.sin(nowMs * 0.012) * 0.5;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
