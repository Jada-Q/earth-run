// Forests — toon trees scattered where the vegetation mask says forests
// are (Amazon, Congo, boreal belt…), plus a denser ring around each city.
// Two species: conifer (stacked cones) and broadleaf (blob canopy). All
// instanced: 5 draw calls for every tree on the planet. Trees sit on the
// displaced terrain (placement waits for the land + elevation maps).

import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshToonMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { makeGradientMap } from "./clouds";
import { loadLandMask, type LandMask } from "./ships";
import { ensureElevationLoaded, groundHeightAt } from "./elevation";
import type { Landmarks } from "./landmarks";

const WILD_TREES = 560;
// Few and FAR from the landmark — famous monuments sit in plazas, not
// forests. The grove is scenery on the way in, not crowding the tower.
const CITY_TREES = 4;
const BASE = 0.016; // trunk-height unit; total tree ≈ 2x this

function isVegetated(mask: LandMask, lat: number, lng: number): boolean {
  const u = (lng + 180) / 360;
  const v = 1 - (lat + 90) / 180;
  const px = Math.min(mask.w - 1, Math.max(0, Math.round(u * mask.w)));
  const py = Math.min(mask.h - 1, Math.max(0, Math.round(v * mask.h)));
  const i = (py * mask.w + px) * 4;
  return mask.data[i] > 140 && mask.data[i + 1] > 127; // solidly inland + veg
}

export interface Trees {
  group: Group;
  /** Chop the nearest standing tree within reach. True if one fell. */
  tryChop(up: Vector3): boolean;
  /** Advance falling-tree animations. */
  update(nowMs: number): void;
  dispose(): void;
}

interface TreeRec {
  dir: Vector3;
  s: number;
  conifer: boolean;
  alive: boolean;
}

const CHOP_REACH_COS = Math.cos(0.014); // ~0.8° — melee range
const FALL_MS = 500;

export function buildTrees(landmarks: Landmarks): Trees {
  const group = new Group();

  const trunkGeo = new CylinderGeometry(0.18, 0.26, 1, 5);
  const coneGeo1 = new ConeGeometry(0.85, 1.3, 7);
  const coneGeo2 = new ConeGeometry(0.6, 1.0, 7);
  const blobGeo1 = new SphereGeometry(0.75, 8, 6);
  const blobGeo2 = new SphereGeometry(0.5, 8, 6);

  const trunkMat = new MeshToonMaterial({
    color: "#8a6f54",
    gradientMap: makeGradientMap(3, 0.8),
  });
  const conifMat = new MeshToonMaterial({
    color: "#35704f",
    gradientMap: makeGradientMap(3, 0.8),
  });
  const broadMat = new MeshToonMaterial({
    color: "#5d9468",
    gradientMap: makeGradientMap(3, 0.8),
  });

  const TOTAL = WILD_TREES + CITY_TREES * landmarks.anchors.length;
  // Worst case every tree is one species; count both meshes at TOTAL and
  // park the unused instances at zero scale.
  const trunks = new InstancedMesh(trunkGeo, trunkMat, TOTAL);
  const cones1 = new InstancedMesh(coneGeo1, conifMat, TOTAL);
  const cones2 = new InstancedMesh(coneGeo2, conifMat, TOTAL);
  const blobs1 = new InstancedMesh(blobGeo1, broadMat, TOTAL);
  const blobs2 = new InstancedMesh(blobGeo2, broadMat, TOTAL);
  for (const m of [trunks, cones1, cones2, blobs1, blobs2]) {
    m.frustumCulled = false;
    group.add(m);
  }

  let seed = 4242424;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const recs: TreeRec[] = [];
  const falls: Array<{ idx: number; start: number }> = [];
  const tmp = new Object3D();
  const zero = new Matrix4().makeScale(0, 0, 0);
  const pos = new Vector3();

  /** Write one tree's matrices at squash factor k (1 = standing, 0 = gone). */
  const writeTree = (i: number, rec: TreeRec, k: number) => {
    const ground = 1 + groundHeightAt(rec.dir);
    const s = rec.s * k;
    if (k <= 0.02) {
      // Stump: a short trunk slug, canopy gone.
      tmp.position.copy(rec.dir).multiplyScalar(ground + rec.s * 0.1);
      tmp.lookAt(rec.dir.x * 2, rec.dir.y * 2, rec.dir.z * 2);
      tmp.rotateX(Math.PI / 2);
      tmp.scale.set(rec.s, rec.s * 0.2, rec.s);
      tmp.updateMatrix();
      trunks.setMatrixAt(i, tmp.matrix);
      for (const m of [cones1, cones2, blobs1, blobs2]) m.setMatrixAt(i, zero);
      return;
    }
    const at = (radial: number, mesh: InstancedMesh) => {
      tmp.position.copy(rec.dir).multiplyScalar(ground + radial);
      tmp.lookAt(
        rec.dir.x * 2 * ground, rec.dir.y * 2 * ground, rec.dir.z * 2 * ground,
      );
      tmp.rotateX(Math.PI / 2);
      tmp.scale.setScalar(s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    };
    at(s * 0.5, trunks);
    if (rec.conifer) {
      at(s * 1.3, cones1);
      at(s * 2.0, cones2);
      blobs1.setMatrixAt(i, zero);
      blobs2.setMatrixAt(i, zero);
    } else {
      at(s * 1.4, blobs1);
      at(s * 1.9, blobs2);
      cones1.setMatrixAt(i, zero);
      cones2.setMatrixAt(i, zero);
    }
  };

  void (async () => {
    const [mask] = await Promise.all([loadLandMask(), ensureElevationLoaded()]);
    let i = 0;

    const place = (lat: number, lng: number) => {
      const latR = (lat * Math.PI) / 180;
      const lngR = (lng * Math.PI) / 180;
      pos.set(
        Math.cos(latR) * Math.cos(lngR),
        Math.sin(latR),
        -Math.cos(latR) * Math.sin(lngR),
      );
      const rec: TreeRec = {
        dir: pos.clone(),
        s: BASE * (0.7 + rng() * 0.8),
        conifer: rng() > 0.45,
        alive: true,
      };
      recs.push(rec);
      writeTree(i, rec, 1);
      i++;
    };

    // Wild forests via rejection sampling on the vegetation mask. Cities
    // get a 1.5° exclusion zone — monuments sit in plazas, not woods.
    const nearCity = (lat: number, lng: number): boolean => {
      for (const a of landmarks.anchors) {
        const clat = (Math.asin(a.dir.y) * 180) / Math.PI;
        const clng = (Math.atan2(-a.dir.z, a.dir.x) * 180) / Math.PI;
        let dLng = Math.abs(lng - clng);
        if (dLng > 180) dLng = 360 - dLng;
        const d = Math.hypot(lat - clat, dLng * Math.cos((clat * Math.PI) / 180));
        if (d < 1.5) return true;
      }
      return false;
    };
    let attempts = 0;
    let placedWild = 0;
    while (placedWild < WILD_TREES && attempts < WILD_TREES * 30) {
      attempts++;
      const lat = -55 + rng() * 125; // -55..70
      const lng = -180 + rng() * 360;
      if (!mask || !isVegetated(mask, lat, lng)) continue;
      if (nearCity(lat, lng)) continue;
      place(lat, lng);
      placedWild++;
    }

    // City outskirts — a welcoming grove around every checkpoint.
    for (const a of landmarks.anchors) {
      const lat = (Math.asin(a.dir.y) * 180) / Math.PI;
      const lng = (Math.atan2(-a.dir.z, a.dir.x) * 180) / Math.PI;
      for (let k = 0; k < CITY_TREES; k++) {
        const ang = rng() * Math.PI * 2;
        const r = 4.5 + rng() * 2.5; // well outside the plaza
        place(lat + Math.sin(ang) * r, lng + (Math.cos(ang) * r) / Math.max(0.3, Math.cos((lat * Math.PI) / 180)));
      }
    }

    // Park the rest.
    for (; i < TOTAL; i++) {
      for (const m of [trunks, cones1, cones2, blobs1, blobs2]) {
        m.setMatrixAt(i, zero);
      }
    }
    for (const m of [trunks, cones1, cones2, blobs1, blobs2]) {
      m.instanceMatrix.needsUpdate = true;
    }
  })();

  return {
    group,
    tryChop(up: Vector3): boolean {
      for (let k = 0; k < recs.length; k++) {
        const rec = recs[k];
        if (rec.alive && rec.dir.dot(up) > CHOP_REACH_COS) {
          rec.alive = false;
          falls.push({ idx: k, start: performance.now() });
          return true;
        }
      }
      return false;
    },
    update(nowMs: number) {
      if (!falls.length) return;
      for (let k = falls.length - 1; k >= 0; k--) {
        const f = falls[k];
        const t = (nowMs - f.start) / FALL_MS;
        writeTree(f.idx, recs[f.idx], Math.max(0, 1 - t));
        if (t >= 1) falls.splice(k, 1);
      }
      for (const m of [trunks, cones1, cones2, blobs1, blobs2]) {
        m.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      trunkGeo.dispose();
      coneGeo1.dispose();
      coneGeo2.dispose();
      blobGeo1.dispose();
      blobGeo2.dispose();
      for (const m of [trunkMat, conifMat, broadMat]) {
        m.gradientMap?.dispose();
        m.dispose();
      }
    },
  };
}
