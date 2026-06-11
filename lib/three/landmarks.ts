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
const CITIES: Array<{ key: string; name: string; lat: number; lng: number }> = [
  { key: "tokyo", name: "Tokyo Tower · 东京塔", lat: 35.7, lng: 139.7 },
  { key: "la", name: "Hollywood Sign · 好莱坞标志", lat: 34.1, lng: -118.2 },
  { key: "chicago", name: "Willis Tower · 威利斯大厦", lat: 41.9, lng: -87.6 },
  { key: "nyc", name: "Statue of Liberty · 自由女神像", lat: 40.7, lng: -74.0 },
  { key: "london", name: "Big Ben · 大本钟", lat: 51.5, lng: -0.1 },
  { key: "paris", name: "Eiffel Tower · 埃菲尔铁塔", lat: 48.9, lng: 2.3 },
  { key: "rome", name: "Colosseum · 罗马斗兽场", lat: 41.9, lng: 12.5 },
  { key: "istanbul", name: "Hagia Sophia · 圣索菲亚大教堂", lat: 41.0, lng: 28.9 },
  { key: "dubai", name: "Burj Khalifa · 哈利法塔", lat: 25.2, lng: 55.3 },
  { key: "delhi", name: "India Gate · 印度门", lat: 28.6, lng: 77.2 },
  { key: "shanghai", name: "Oriental Pearl · 东方明珠", lat: 31.2, lng: 121.5 },
];

const PAPER = "#e9e5d8";
const TEAL = "#2e5d66";
const GREEN = "#3e7d58";
const CREAM = "#efe7cf";
const INK_DARK = "#3a4d48";
// Signature colors — landmark recognition is silhouette × COLOR. Muted so
// the gold CTA keeps its pull, but Tokyo Tower without its international
// orange is just a dark thing on legs.
const TOWER_ORANGE = "#d2693e";
const WHITE = "#f4f1e8";
const PEARL_ROSE = "#c4798c";
const FLAME_GOLD = "#d9b25e";
const SANDSTONE_RED = "#c08a6d"; // India Gate
const SOPHIA_ROSE = "#cfa18d"; // Hagia Sophia walls
const BURJ_SILVER = "#c4d0d2";
const WILLIS_BLACK = "#2b3a3d";
const BEN_LIMESTONE = "#d6c79e";

export interface Collider {
  dir: Vector3;
  /** cos of the angular keep-out radius — collide when up·dir > minDot. */
  minDot: number;
}

export interface Landmarks {
  group: Group;
  /** City anchor frames for the NPC module: position + tangent basis. */
  anchors: Array<{
    key: string;
    name: string;
    dir: Vector3;
    east: Vector3;
    north: Vector3;
  }>;
  /** Solid things the runner can't walk through (monuments + cottages). */
  colliders: Collider[];
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
    hull.scale.setScalar(1.07);
    parent.add(hull);
  };

  // ------------------------------------------------------- the landmarks --
  // Local frame: +Y up from the surface, origin at ground level. Each
  // builder leans on the structure that makes the real one recognizable:
  // Willis' bundled tubes, the Colosseum's diagonal break, the Pearl's
  // tripod, Eiffel's splayed legs, Liberty's crown + tablet.
  const builders: Record<string, (g: Group) => void> = {
    tokyo(g) {
      // Tokyo Tower: international orange with white bands — the color IS
      // the recognition. Splayed orange legs, tapering banded shaft, white
      // main deck at the waist, small upper deck, striped antenna.
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const leg = new Group();
        leg.position.set(sx * 0.015, 0, sz * 0.015);
        leg.rotation.z = sx * 0.34;
        leg.rotation.x = -sz * 0.34;
        prim(leg, new BoxGeometry(0.0065, 0.04, 0.0065), TOWER_ORANGE, 0, 0.019, 0);
        g.add(leg);
      }
      // Tapering shaft with alternating orange/white bands.
      const bands: Array<[number, number, string]> = [
        [0.021, 0.012, TOWER_ORANGE],
        [0.019, 0.004, WHITE],
        [0.017, 0.011, TOWER_ORANGE],
        [0.015, 0.004, WHITE],
        [0.013, 0.011, TOWER_ORANGE],
      ];
      let y = 0.036;
      for (const [w, h, c] of bands) {
        prim(g, new BoxGeometry(w, h, w), c, 0, y + h / 2, 0);
        y += h;
      }
      prim(g, new BoxGeometry(0.026, 0.007, 0.026), WHITE, 0, 0.0395, 0); // main deck
      prim(g, new BoxGeometry(0.0105, 0.01, 0.0105), TOWER_ORANGE, 0, y + 0.005, 0);
      prim(g, new BoxGeometry(0.014, 0.005, 0.014), WHITE, 0, y + 0.0125, 0); // top deck
      // Striped antenna.
      prim(g, new CylinderGeometry(0.002, 0.0024, 0.014, 6), TOWER_ORANGE, 0, y + 0.022, 0);
      prim(g, new CylinderGeometry(0.0016, 0.002, 0.012, 6), WHITE, 0, y + 0.035, 0);
      prim(g, new CylinderGeometry(0.0012, 0.0016, 0.01, 6), TOWER_ORANGE, 0, y + 0.046, 0);
    },
    la(g) {
      // Hollywood: letter-block sign on a green hill ridge + palms.
      prim(g, new BoxGeometry(0.085, 0.02, 0.05), GREEN, 0, 0.008, 0); // hill
      for (let i = 0; i < 9; i++) {
        const h = 0.011 + (i % 2) * 0.002;
        prim(g, new BoxGeometry(0.006, h, 0.0035), PAPER, -0.034 + i * 0.0085, 0.018 + h / 2, 0.012);
      }
      for (const [px, pz, ph] of [[-0.05, -0.018, 0.032], [0.05, -0.012, 0.027]] as const) {
        prim(g, new CylinderGeometry(0.0025, 0.0035, ph, 6), "#8a7d62", px, ph / 2 + 0.012, pz);
        prim(g, new SphereGeometry(0.0095, 10, 8), GREEN, px, ph + 0.016, pz);
        prim(g, new SphereGeometry(0.0075, 10, 8), GREEN, px + 0.006, ph + 0.013, pz);
      }
    },
    chicago(g) {
      // Willis Tower: nine bundled square tubes stepping down + antennae.
      const tube = 0.011;
      const heights = [
        [0.052, 0.072, 0.052],
        [0.072, 0.098, 0.072],
        [0.034, 0.072, 0.034],
      ];
      for (let ix = 0; ix < 3; ix++) {
        for (let iz = 0; iz < 3; iz++) {
          const h = heights[iz][ix];
          prim(
            g,
            new BoxGeometry(tube, h, tube),
            WILLIS_BLACK,
            (ix - 1) * tube,
            h / 2,
            (iz - 1) * tube,
          );
        }
      }
      prim(g, new CylinderGeometry(0.0016, 0.0016, 0.026, 4), PAPER, -0.006, 0.11, -0.004);
      prim(g, new CylinderGeometry(0.0016, 0.0016, 0.022, 4), PAPER, 0.006, 0.108, 0.004);
    },
    nyc(g) {
      // Liberty: two-tier pedestal, robed figure, crown spikes, torch up,
      // tablet in the left arm.
      prim(g, new BoxGeometry(0.034, 0.012, 0.034), PAPER, 0, 0.006, 0);
      prim(g, new BoxGeometry(0.024, 0.018, 0.024), PAPER, 0, 0.021, 0);
      prim(g, new BoxGeometry(0.017, 0.012, 0.017), GREEN, 0, 0.036, 0); // robe base
      prim(g, new BoxGeometry(0.013, 0.026, 0.011), GREEN, 0, 0.054, 0); // body
      prim(g, new BoxGeometry(0.0085, 0.0085, 0.0085), GREEN, 0, 0.072, 0); // head
      for (let i = -2; i <= 2; i++) {
        prim(g, new BoxGeometry(0.0016, 0.006, 0.0016), GREEN, i * 0.0024, 0.0795, 0);
      }
      prim(g, new BoxGeometry(0.004, 0.024, 0.004), GREEN, 0.0085, 0.078, -0.002); // torch arm
      prim(g, new SphereGeometry(0.0036, 8, 6), FLAME_GOLD, 0.0085, 0.0925, -0.002); // flame
      prim(g, new BoxGeometry(0.004, 0.012, 0.008), GREEN, -0.009, 0.058, 0.003); // tablet
    },
    london(g) {
      // Big Ben: slender shaft, proud cream clock stage on all faces,
      // belfry, pyramidal spire with finial.
      prim(g, new BoxGeometry(0.015, 0.06, 0.015), BEN_LIMESTONE, 0, 0.03, 0);
      prim(g, new BoxGeometry(0.019, 0.014, 0.019), CREAM, 0, 0.066, 0); // clock stage
      prim(g, new BoxGeometry(0.021, 0.008, 0.008), INK_DARK, 0, 0.066, 0); // face shadow x
      prim(g, new BoxGeometry(0.008, 0.008, 0.021), INK_DARK, 0, 0.066, 0); // face shadow z
      prim(g, new BoxGeometry(0.016, 0.01, 0.016), BEN_LIMESTONE, 0, 0.078, 0); // belfry
      prim(g, new ConeGeometry(0.011, 0.02, 4), TEAL, 0, 0.093, Math.PI / 4);
      prim(g, new CylinderGeometry(0.001, 0.001, 0.008, 4), CREAM, 0, 0.106, 0);
    },
    paris(g) {
      // Eiffel: four splayed legs joined by the first platform, arched
      // void hinted by a dark inset, two tapering stages, spire.
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const leg = new Group();
        leg.position.set(sx * 0.015, 0, sz * 0.015);
        leg.rotation.z = sx * 0.4;
        leg.rotation.x = -sz * 0.4;
        prim(leg, new BoxGeometry(0.008, 0.036, 0.008), INK_DARK, 0, 0.016, 0);
        g.add(leg);
      }
      prim(g, new BoxGeometry(0.05, 0.006, 0.05), INK_DARK, 0, 0.034, 0); // 1st platform
      prim(g, new BoxGeometry(0.022, 0.022, 0.022), INK_DARK, 0, 0.047, 0);
      prim(g, new BoxGeometry(0.026, 0.005, 0.026), INK_DARK, 0, 0.06, 0); // 2nd platform
      prim(g, new BoxGeometry(0.011, 0.028, 0.011), INK_DARK, 0, 0.076, 0);
      prim(g, new BoxGeometry(0.007, 0.018, 0.007), INK_DARK, 0, 0.098, 0);
      prim(g, new CylinderGeometry(0.0018, 0.0018, 0.022, 4), INK_DARK, 0, 0.116, 0);
    },
    rome(g) {
      // Colosseum: full lower drum + taller partial ring with the iconic
      // diagonal break, inner drum visible inside.
      prim(g, new CylinderGeometry(0.03, 0.031, 0.016, 24, 1, true), PAPER, 0, 0.008, 0);
      const upper = new CylinderGeometry(0.03, 0.03, 0.014, 24, 1, true, 0, Math.PI * 1.25);
      prim(g, upper, PAPER, 0, 0.023, 0);
      prim(g, new CylinderGeometry(0.022, 0.022, 0.012, 18, 1, true), "#cfc8b6", 0, 0.006, 0);
      g.scale.z = 0.82; // elliptical plan
    },
    istanbul(g) {
      // Hagia Sophia: broad base, half-dome shoulders on four sides, main
      // dome on a drum, four corner minarets with cone caps.
      prim(g, new BoxGeometry(0.042, 0.016, 0.042), SOPHIA_ROSE, 0, 0.008, 0);
      for (const [dx, dz] of [[0.017, 0], [-0.017, 0], [0, 0.017], [0, -0.017]] as const) {
        prim(g, new SphereGeometry(0.011, 12, 8), TEAL, dx, 0.018, dz);
      }
      prim(g, new CylinderGeometry(0.015, 0.016, 0.008, 14), SOPHIA_ROSE, 0, 0.02, 0); // drum
      prim(g, new SphereGeometry(0.0165, 16, 12), TEAL, 0, 0.028, 0); // main dome
      for (const [mx, mz] of [[0.026, 0.026], [0.026, -0.026], [-0.026, 0.026], [-0.026, -0.026]] as const) {
        prim(g, new CylinderGeometry(0.0022, 0.0022, 0.052, 6), PAPER, mx, 0.026, mz);
        prim(g, new ConeGeometry(0.0036, 0.011, 6), TEAL, mx, 0.057, mz);
      }
    },
    dubai(g) {
      // Burj Khalifa: Y-plan — three wings stepping back around a core
      // that telescopes to a needle.
      for (let k = 0; k < 3; k++) {
        const wing = new Group();
        wing.rotation.y = (k * 2 * Math.PI) / 3;
        prim(wing, new BoxGeometry(0.009, 0.038, 0.022), BURJ_SILVER, 0, 0.019, 0.011);
        prim(wing, new BoxGeometry(0.007, 0.06, 0.014), BURJ_SILVER, 0, 0.03, 0.006);
        g.add(wing);
      }
      prim(g, new BoxGeometry(0.011, 0.082, 0.011), BURJ_SILVER, 0, 0.041, 0);
      prim(g, new BoxGeometry(0.007, 0.022, 0.007), BURJ_SILVER, 0, 0.093, 0);
      prim(g, new CylinderGeometry(0.0016, 0.0016, 0.04, 6), BURJ_SILVER, 0, 0.122, 0);
    },
    delhi(g) {
      // India Gate: plinth, massive piers, dark arch void, attic with the
      // shallow dome bowl on top.
      prim(g, new BoxGeometry(0.052, 0.006, 0.024), SANDSTONE_RED, 0, 0.003, 0);
      prim(g, new BoxGeometry(0.014, 0.042, 0.018), SANDSTONE_RED, -0.017, 0.027, 0);
      prim(g, new BoxGeometry(0.014, 0.042, 0.018), SANDSTONE_RED, 0.017, 0.027, 0);
      prim(g, new BoxGeometry(0.02, 0.03, 0.012), INK_DARK, 0, 0.021, 0); // arch void
      prim(g, new BoxGeometry(0.048, 0.014, 0.02), SANDSTONE_RED, 0, 0.055, 0); // spandrel
      prim(g, new BoxGeometry(0.036, 0.008, 0.016), CREAM, 0, 0.066, 0); // attic
      prim(g, new CylinderGeometry(0.008, 0.01, 0.005, 12), PAPER, 0, 0.0725, 0); // bowl
    },
    shanghai(g) {
      // Oriental Pearl: tripod legs, big lower sphere, shaft, upper
      // sphere, small top bead + antenna.
      for (let k = 0; k < 3; k++) {
        const leg = new Group();
        leg.rotation.y = (k * 2 * Math.PI) / 3;
        const l = new Group();
        l.position.set(0.013, 0, 0);
        l.rotation.z = 0.5;
        prim(l, new CylinderGeometry(0.0022, 0.0028, 0.032, 6), PAPER, 0, 0.014, 0);
        leg.add(l);
        g.add(leg);
      }
      prim(g, new SphereGeometry(0.0145, 16, 12), PEARL_ROSE, 0, 0.032, 0); // lower sphere
      prim(g, new CylinderGeometry(0.0036, 0.0044, 0.038, 8), PAPER, 0, 0.052, 0);
      prim(g, new SphereGeometry(0.0095, 14, 10), PEARL_ROSE, 0, 0.073, 0); // upper sphere
      prim(g, new SphereGeometry(0.004, 10, 8), PEARL_ROSE, 0, 0.0865, 0); // top bead
      prim(g, new CylinderGeometry(0.0014, 0.0014, 0.022, 4), PAPER, 0, 0.1, 0);
    },
  };

  // ---------------------------------------------------------- placement --
  const anchors: Landmarks["anchors"] = [];
  const colliders: Collider[] = [];
  // Per-monument keep-out radius (rad) — matched to each footprint after
  // the 1.5x scale. All smaller than the 5.5° checkpoint pass radius, so
  // racing is unaffected.
  const FOOTPRINT: Record<string, number> = {
    tokyo: 0.024,
    la: 0.05,
    chicago: 0.018,
    nyc: 0.02,
    london: 0.013,
    paris: 0.025,
    rome: 0.038,
    istanbul: 0.027,
    dubai: 0.018,
    delhi: 0.028,
    shanghai: 0.022,
  };
  const HOUSE_R = Math.cos(0.016);
  const anchor = new Object3D();
  const pole = new Vector3(0, 1, 0);

  for (const c of CITIES) {
    const dir = latLngToVec3(c.lat, c.lng, new Vector3());
    const east = new Vector3().copy(pole).cross(dir).normalize();
    const north = new Vector3().copy(dir).cross(east).normalize();
    anchors.push({ key: c.key, name: c.name, dir, east, north });

    const holder = new Group();
    // Close to the gate (a far offset hides the base behind the horizon
    // bulge — tall landmarks looked like they levitated), and sunk a touch
    // below the surface so every leg/base is properly grounded.
    const p = new Vector3()
      .copy(dir)
      .addScaledVector(north, 0.022)
      .normalize();
    holder.position.copy(p).multiplyScalar(0.998);
    // Monumental scale: buildings should tower over the runner (0.05).
    holder.scale.setScalar(1.5);
    colliders.push({
      dir: p.clone(),
      minDot: Math.cos(FOOTPRINT[c.key] ?? 0.018),
    });
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
      // 2.2x: a cottage must at least match the runner (0.05) or the scale
      // story breaks. Body sits half-height above ground; roof on top.
      tmp.scale.setScalar(2.2);
      colliders.push({ dir: p.clone(), minDot: HOUSE_R });
      tmp.position.copy(p).addScaledVector(p, 0.013);
      tmp.updateMatrix();
      bodies.setMatrixAt(i, tmp.matrix);
      tmp.position.copy(p).addScaledVector(p, 0.037);
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
    colliders,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
