// City landmarks — one iconic voxel structure per checkpoint city,
// recognition by silhouette (the palette stays cool/neutral: paper, teal,
// vegetation green, ink, cream). Each is a handful of primitives with ink
// hulls, ~1.5-2.5x runner height. Generic houses around every city are
// instanced: four draw calls for ALL houses on the planet.

import {
  BackSide,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { INK } from "./palette";
import { makeGradientMap } from "./clouds";
import { latLngToVec3 } from "./geo";

// Same coords as the race route (plus the start city itself).
const CITIES: Array<{ key: string; lat: number; lng: number }> = [
  { key: "tokyo", lat: 35.7, lng: 139.7 },
  { key: "la", lat: 34.1, lng: -118.2 },
  { key: "chicago", lat: 41.9, lng: -87.6 },
  { key: "nyc", lat: 40.7, lng: -74.0 },
  { key: "london", lat: 51.5, lng: -0.1 },
  { key: "paris", lat: 48.9, lng: 2.3 },
  { key: "rome", lat: 41.9, lng: 12.5 },
  { key: "istanbul", lat: 41.0, lng: 28.9 },
  { key: "dubai", lat: 25.2, lng: 55.3 },
  { key: "delhi", lat: 28.6, lng: 77.2 },
  { key: "shanghai", lat: 31.2, lng: 121.5 },
];

const PAPER = "#e9e5d8";
const TEAL = "#2e5d66";
const GREEN = "#3e7d58";
const CREAM = "#efe7cf";

export interface Landmarks {
  group: Group;
  /** City anchor frames for the NPC module: position + tangent basis. */
  anchors: Array<{ key: string; dir: Vector3; east: Vector3; north: Vector3 }>;
  dispose(): void;
}

export function buildLandmarks(): Landmarks {
  const group = new Group();
  const disposables: Array<{ dispose(): void }> = [];

  const mats = new Map<string, MeshToonMaterial>();
  const matOf = (hex: string) => {
    let m = mats.get(hex);
    if (!m) {
      m = new MeshToonMaterial({ color: hex, gradientMap: makeGradientMap(3, 0.78) });
      mats.set(hex, m);
      disposables.push(m, { dispose: () => m!.gradientMap?.dispose() });
    }
    return m;
  };
  const inkMat = new MeshBasicMaterial({ color: INK, side: BackSide });
  disposables.push(inkMat);

  /** Add a primitive + its ink hull to a parent. Geometry is shared-free
   *  (one per call) but tracked for dispose. */
  const prim = (
    parent: Group,
    geo: BoxGeometry | CylinderGeometry | ConeGeometry | SphereGeometry,
    hex: string,
    x: number,
    y: number,
    z: number,
    ry = 0,
  ) => {
    disposables.push(geo);
    const m = new Mesh(geo, matOf(hex));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    const hull = new Mesh(geo, inkMat);
    hull.position.set(x, y, z);
    hull.rotation.y = ry;
    hull.scale.setScalar(1.12);
    parent.add(hull);
  };

  // ------------------------------------------------------- the landmarks --
  // Local frame: +Y up from the surface, origin at ground level.
  const builders: Record<string, (g: Group) => void> = {
    tokyo(g) {
      // Tokyo Tower: tapering three-stage lattice silhouette + antenna.
      prim(g, new BoxGeometry(0.05, 0.035, 0.05), TEAL, 0, 0.018, 0);
      prim(g, new BoxGeometry(0.032, 0.035, 0.032), TEAL, 0, 0.052, 0);
      prim(g, new BoxGeometry(0.018, 0.03, 0.018), TEAL, 0, 0.084, 0);
      prim(g, new CylinderGeometry(0.0028, 0.0028, 0.03, 4), PAPER, 0, 0.112, 0);
    },
    la(g) {
      // Hollywood-ish hill sign + two palms.
      prim(g, new BoxGeometry(0.07, 0.018, 0.012), PAPER, 0, 0.026, 0);
      prim(g, new CylinderGeometry(0.003, 0.004, 0.034, 5), TEAL, -0.045, 0.017, 0.012);
      prim(g, new SphereGeometry(0.012, 6, 5), GREEN, -0.045, 0.04, 0.012);
      prim(g, new CylinderGeometry(0.003, 0.004, 0.028, 5), TEAL, 0.046, 0.014, -0.01);
      prim(g, new SphereGeometry(0.01, 6, 5), GREEN, 0.046, 0.033, -0.01);
    },
    chicago(g) {
      // Willis Tower: stepped dark prism + twin antennae.
      prim(g, new BoxGeometry(0.034, 0.06, 0.028), TEAL, 0, 0.03, 0);
      prim(g, new BoxGeometry(0.022, 0.03, 0.02), TEAL, 0, 0.075, 0);
      prim(g, new CylinderGeometry(0.002, 0.002, 0.024, 4), PAPER, -0.006, 0.1, 0);
      prim(g, new CylinderGeometry(0.002, 0.002, 0.02, 4), PAPER, 0.007, 0.098, 0);
    },
    nyc(g) {
      // Statue of Liberty: pedestal, green figure, raised torch arm.
      prim(g, new BoxGeometry(0.026, 0.024, 0.026), PAPER, 0, 0.012, 0);
      prim(g, new BoxGeometry(0.016, 0.034, 0.012), GREEN, 0, 0.04, 0);
      prim(g, new BoxGeometry(0.011, 0.011, 0.011), GREEN, 0, 0.062, 0);
      prim(g, new BoxGeometry(0.005, 0.028, 0.005), GREEN, 0.011, 0.068, 0);
      prim(g, new SphereGeometry(0.0045, 5, 4), CREAM, 0.011, 0.084, 0);
    },
    london(g) {
      // Big Ben: clock tower + pointed cap.
      prim(g, new BoxGeometry(0.018, 0.066, 0.018), PAPER, 0, 0.033, 0);
      prim(g, new BoxGeometry(0.022, 0.016, 0.022), CREAM, 0, 0.072, 0);
      prim(g, new ConeGeometry(0.014, 0.024, 4), TEAL, 0, 0.092, Math.PI / 4);
    },
    paris(g) {
      // Eiffel: three tapering stages + spire, ink-dark.
      prim(g, new BoxGeometry(0.046, 0.026, 0.046), "#3a4d48", 0, 0.013, 0);
      prim(g, new BoxGeometry(0.028, 0.028, 0.028), "#3a4d48", 0, 0.04, 0);
      prim(g, new BoxGeometry(0.014, 0.026, 0.014), "#3a4d48", 0, 0.066, 0);
      prim(g, new CylinderGeometry(0.0024, 0.0024, 0.026, 4), "#3a4d48", 0, 0.092, 0);
    },
    rome(g) {
      // Colosseum: open-ended elliptical drum.
      const drum = new CylinderGeometry(0.03, 0.032, 0.024, 12, 1, true);
      prim(g, drum, PAPER, 0, 0.012, 0);
      g.scale.z = 0.8; // slightly elliptical
    },
    istanbul(g) {
      // Hagia Sophia: dome + two minarets.
      prim(g, new BoxGeometry(0.04, 0.018, 0.04), PAPER, 0, 0.009, 0);
      prim(g, new SphereGeometry(0.02, 8, 6), TEAL, 0, 0.026, 0);
      prim(g, new CylinderGeometry(0.0025, 0.0025, 0.05, 5), PAPER, -0.03, 0.025, 0.02);
      prim(g, new CylinderGeometry(0.0025, 0.0025, 0.05, 5), PAPER, 0.03, 0.025, -0.02);
      prim(g, new ConeGeometry(0.004, 0.01, 5), TEAL, -0.03, 0.055, 0.02);
      prim(g, new ConeGeometry(0.004, 0.01, 5), TEAL, 0.03, 0.055, -0.02);
    },
    dubai(g) {
      // Burj Khalifa: very tall telescoping spire.
      prim(g, new BoxGeometry(0.026, 0.034, 0.026), CREAM, 0, 0.017, 0);
      prim(g, new BoxGeometry(0.018, 0.034, 0.018), CREAM, 0, 0.05, 0);
      prim(g, new BoxGeometry(0.011, 0.03, 0.011), CREAM, 0, 0.082, 0);
      prim(g, new CylinderGeometry(0.0022, 0.0022, 0.036, 4), CREAM, 0, 0.114, 0);
    },
    delhi(g) {
      // India Gate: two pillars + arch slab.
      prim(g, new BoxGeometry(0.012, 0.046, 0.014), PAPER, -0.016, 0.023, 0);
      prim(g, new BoxGeometry(0.012, 0.046, 0.014), PAPER, 0.016, 0.023, 0);
      prim(g, new BoxGeometry(0.05, 0.016, 0.016), PAPER, 0, 0.054, 0);
      prim(g, new BoxGeometry(0.02, 0.01, 0.012), CREAM, 0, 0.067, 0);
    },
    shanghai(g) {
      // Oriental Pearl: column with two spheres.
      prim(g, new CylinderGeometry(0.004, 0.006, 0.08, 6), PAPER, 0, 0.04, 0);
      prim(g, new SphereGeometry(0.013, 8, 6), TEAL, 0, 0.028, 0);
      prim(g, new SphereGeometry(0.009, 8, 6), TEAL, 0, 0.066, 0);
      prim(g, new CylinderGeometry(0.0018, 0.0018, 0.02, 4), PAPER, 0, 0.088, 0);
    },
  };

  // ---------------------------------------------------------- placement --
  const anchors: Landmarks["anchors"] = [];
  const anchor = new Object3D();
  const pole = new Vector3(0, 1, 0);

  for (const c of CITIES) {
    const dir = latLngToVec3(c.lat, c.lng, new Vector3());
    const east = new Vector3().copy(pole).cross(dir).normalize();
    const north = new Vector3().copy(dir).cross(east).normalize();
    anchors.push({ key: c.key, dir, east, north });

    const holder = new Group();
    // Offset the landmark a touch north of the gate so it frames it.
    const p = new Vector3()
      .copy(dir)
      .addScaledVector(north, 0.045)
      .normalize();
    holder.position.copy(p);
    anchor.position.copy(p);
    anchor.lookAt(p.x * 2, p.y * 2, p.z * 2);
    holder.quaternion.copy(anchor.quaternion);
    holder.rotateX(Math.PI / 2); // local +Y becomes the outward normal
    builders[c.key](holder);
    group.add(holder);
  }

  // Instanced generic houses: a loose ring of cottages around every city.
  const bodyGeo = new BoxGeometry(0.016, 0.012, 0.013);
  const roofGeo = new ConeGeometry(0.012, 0.01, 4);
  const bodyMat = matOf(PAPER);
  const roofMat = matOf(TEAL);
  disposables.push(bodyGeo, roofGeo);
  const HOUSES_PER_CITY = 4;
  const total = CITIES.length * HOUSES_PER_CITY;
  const bodies = new InstancedMesh(bodyGeo, bodyMat, total);
  const roofs = new InstancedMesh(roofGeo, roofMat, total);

  let seed = 987654;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const tmp = new Object3D();
  const m4 = new Matrix4();
  let i = 0;
  for (const a of anchors) {
    for (let h = 0; h < HOUSES_PER_CITY; h++) {
      const ang = rng() * Math.PI * 2;
      const rad = 0.028 + rng() * 0.03;
      const p = new Vector3()
        .copy(a.dir)
        .addScaledVector(a.east, Math.cos(ang) * rad)
        .addScaledVector(a.north, Math.sin(ang) * rad)
        .normalize();
      tmp.position.copy(p);
      tmp.lookAt(p.x * 2, p.y * 2, p.z * 2);
      tmp.rotateX(Math.PI / 2);
      tmp.rotateY(rng() * Math.PI);
      // Body sits half-height above ground; roof on top. Tiny cottages skip
      // ink hulls — the landmark hulls carry the style at this scale.
      tmp.position.copy(p).addScaledVector(p, 0.006);
      tmp.updateMatrix();
      bodies.setMatrixAt(i, tmp.matrix);
      tmp.position.copy(p).addScaledVector(p, 0.017);
      tmp.updateMatrix();
      roofs.setMatrixAt(i, tmp.matrix);
      i++;
    }
  }
  void m4;
  bodies.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  group.add(bodies, roofs);

  return {
    group,
    anchors,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
