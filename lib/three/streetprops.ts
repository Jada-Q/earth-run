// Street props — the furniture that makes a checkpoint feel like a street
// from the reference: vending machine, traffic mirror, guardrail, utility
// pole, cones, a bin. Every primitive type is ONE InstancedMesh across all
// cities (~12 draw calls for the whole planet's street furniture).
//
// Muted orange (#c97a4a) is allowed here sparingly — the reference scene
// itself uses it for the mirror ring and cones; gold stays CTA-only.

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshToonMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector3,
} from "three";
import { makeGradientMap } from "./clouds";
import type { Landmarks } from "./landmarks";

const MINT = "#9fd4cc";
const PAPER = "#e9e5d8";
const TEAL = "#2e5d66";
const DARK = "#3a4d48";
const ORANGE = "#c97a4a";
const POLE = "#8a7d62";

/** Order matches landmarks.anchors; the road leaves city i toward i+1. */
const NEXT: Record<string, number> = {
  tokyo: 1, la: 2, chicago: 3, nyc: 4, london: 5, paris: 6,
  rome: 7, istanbul: 8, dubai: 9, delhi: 10, shanghai: 0,
};

interface PartDef {
  geo: BoxGeometry | CylinderGeometry | ConeGeometry | TorusGeometry;
  color: string;
  /** Local placement within the prop (y up, x along road). */
  offsets: Array<{
    x: number; y: number; z: number;
    rx?: number; ry?: number; rz?: number;
  }>;
  /** Prop-level placement: along-road (t) and lateral (l) offsets. */
  at: Array<{ t: number; l: number }>;
}

export interface StreetProps {
  group: Group;
  dispose(): void;
}

export function buildStreetProps(landmarks: Landmarks): StreetProps {
  const group = new Group();
  const disposables: Array<{ dispose(): void }> = [];
  const matOf = (() => {
    const cache = new Map<string, MeshToonMaterial>();
    return (hex: string) => {
      let m = cache.get(hex);
      if (!m) {
        m = new MeshToonMaterial({ color: hex, gradientMap: makeGradientMap(3, 0.8) });
        cache.set(hex, m);
        disposables.push(m, { dispose: () => m!.gradientMap?.dispose() });
      }
      return m;
    };
  })();

  // ------------------------------------------------------------ part kit --
  const PARTS: PartDef[] = [
    // Vending machine: mint body, dark face inset, three shelf strips.
    { geo: new BoxGeometry(0.0085, 0.014, 0.007), color: MINT,
      offsets: [{ x: 0, y: 0.007, z: 0 }], at: [{ t: 0.012, l: 0.013 }] },
    { geo: new BoxGeometry(0.001, 0.011, 0.0052), color: DARK,
      offsets: [{ x: -0.0042, y: 0.0075, z: 0 }], at: [{ t: 0.012, l: 0.013 }] },
    { geo: new BoxGeometry(0.0014, 0.0014, 0.0048), color: PAPER,
      offsets: [
        { x: -0.0045, y: 0.0102, z: 0 },
        { x: -0.0045, y: 0.0078, z: 0 },
        { x: -0.0045, y: 0.0054, z: 0 },
      ], at: [{ t: 0.012, l: 0.013 }] },
    // Traffic mirror: pole, orange ring, pale disc.
    { geo: new CylinderGeometry(0.0007, 0.0009, 0.018, 6), color: POLE,
      offsets: [{ x: 0, y: 0.009, z: 0 }], at: [{ t: -0.014, l: -0.012 }] },
    { geo: new TorusGeometry(0.0036, 0.0008, 8, 20), color: ORANGE,
      offsets: [{ x: 0, y: 0.019, z: 0, ry: Math.PI / 2, rx: 0.2 }],
      at: [{ t: -0.014, l: -0.012 }] },
    { geo: new CylinderGeometry(0.003, 0.003, 0.0008, 16), color: "#cfe0dd",
      offsets: [{ x: 0, y: 0.019, z: 0, rz: Math.PI / 2, rx: 0.2 }],
      at: [{ t: -0.014, l: -0.012 }] },
    // Guardrail: three posts + two rails running along the road.
    { geo: new BoxGeometry(0.0012, 0.006, 0.0012), color: PAPER,
      offsets: [
        { x: -0.012, y: 0.003, z: 0 },
        { x: 0, y: 0.003, z: 0 },
        { x: 0.012, y: 0.003, z: 0 },
      ], at: [{ t: 0, l: 0.0095 }, { t: 0, l: -0.0095 }] },
    { geo: new BoxGeometry(0.03, 0.0014, 0.0016), color: PAPER,
      offsets: [{ x: 0, y: 0.0052, z: 0 }, { x: 0, y: 0.0036, z: 0 }],
      at: [{ t: 0, l: 0.0095 }, { t: 0, l: -0.0095 }] },
    // Cones: orange cone + white band.
    { geo: new ConeGeometry(0.0016, 0.0042, 8), color: ORANGE,
      offsets: [{ x: 0, y: 0.0021, z: 0 }],
      at: [{ t: 0.0205, l: -0.0075 }, { t: -0.024, l: 0.008 }] },
    { geo: new CylinderGeometry(0.001, 0.0012, 0.0009, 8), color: PAPER,
      offsets: [{ x: 0, y: 0.0021, z: 0 }],
      at: [{ t: 0.0205, l: -0.0075 }, { t: -0.024, l: 0.008 }] },
    // Utility pole with crossarm.
    { geo: new CylinderGeometry(0.0011, 0.0014, 0.042, 6), color: POLE,
      offsets: [{ x: 0, y: 0.021, z: 0 }], at: [{ t: -0.006, l: 0.017 }] },
    { geo: new BoxGeometry(0.0008, 0.0012, 0.012), color: POLE,
      offsets: [{ x: 0, y: 0.037, z: 0 }], at: [{ t: -0.006, l: 0.017 }] },
    // Bin beside the vending machine.
    { geo: new CylinderGeometry(0.0022, 0.0019, 0.0045, 10), color: TEAL,
      offsets: [{ x: 0, y: 0.0023, z: 0.006 }], at: [{ t: 0.012, l: 0.013 }] },
  ];

  const anchors = landmarks.anchors;
  const tmp = new Object3D();
  const holderQ = new Quaternion();
  const m4 = new Matrix4();
  const basis = new Matrix4();
  const pos = new Vector3();
  const t = new Vector3();
  const l = new Vector3();

  for (const part of PARTS) {
    disposables.push(part.geo);
    const count = anchors.length * part.offsets.length * part.at.length;
    const mesh = new InstancedMesh(part.geo, matOf(part.color), count);
    let i = 0;
    for (const a of anchors) {
      // Road tangent at this city: toward the next checkpoint.
      const next = anchors[NEXT[a.key]];
      t.copy(next.dir).addScaledVector(a.dir, -a.dir.dot(next.dir)).normalize();
      l.copy(t).cross(a.dir); // lateral, right of travel
      for (const at of part.at) {
        // Prop anchor on the surface.
        pos.copy(a.dir).addScaledVector(t, at.t).addScaledVector(l, at.l).normalize();
        // Frame: x = road tangent, y = up.
        const up = pos.clone();
        const fwd = t.clone().addScaledVector(up, -up.dot(t)).normalize();
        const right = fwd.clone().cross(up);
        basis.makeBasis(fwd, up, right);
        holderQ.setFromRotationMatrix(basis);
        for (const o of part.offsets) {
          tmp.position.set(o.x, o.y, o.z);
          tmp.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
          tmp.updateMatrix();
          m4.compose(pos, holderQ, new Vector3(1, 1, 1)).multiply(tmp.matrix);
          mesh.setMatrixAt(i++, m4);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
