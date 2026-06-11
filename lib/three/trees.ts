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
const CITY_TREES = 10; // per city, scattered around the outskirts
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
  dispose(): void;
}

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

  void (async () => {
    const [mask] = await Promise.all([loadLandMask(), ensureElevationLoaded()]);
    const tmp = new Object3D();
    const zero = new Matrix4().makeScale(0, 0, 0);
    const pos = new Vector3();
    let i = 0;

    const place = (lat: number, lng: number) => {
      const latR = (lat * Math.PI) / 180;
      const lngR = (lng * Math.PI) / 180;
      pos.set(
        Math.cos(latR) * Math.cos(lngR),
        Math.sin(latR),
        -Math.cos(latR) * Math.sin(lngR),
      );
      const ground = 1 + groundHeightAt(pos);
      const s = BASE * (0.7 + rng() * 0.8);
      const conifer = rng() > 0.45;
      tmp.position.copy(pos).multiplyScalar(ground);
      tmp.lookAt(pos.x * 2 * ground, pos.y * 2 * ground, pos.z * 2 * ground);
      tmp.rotateX(Math.PI / 2);
      tmp.rotateY(rng() * Math.PI * 2);
      tmp.scale.setScalar(s);

      // trunk
      tmp.position.copy(pos).multiplyScalar(ground + s * 0.5);
      tmp.updateMatrix();
      trunks.setMatrixAt(i, tmp.matrix);
      if (conifer) {
        tmp.position.copy(pos).multiplyScalar(ground + s * 1.3);
        tmp.updateMatrix();
        cones1.setMatrixAt(i, tmp.matrix);
        tmp.position.copy(pos).multiplyScalar(ground + s * 2.0);
        tmp.updateMatrix();
        cones2.setMatrixAt(i, tmp.matrix);
        blobs1.setMatrixAt(i, zero);
        blobs2.setMatrixAt(i, zero);
      } else {
        tmp.position.copy(pos).multiplyScalar(ground + s * 1.4);
        tmp.updateMatrix();
        blobs1.setMatrixAt(i, tmp.matrix);
        tmp.position.copy(pos).multiplyScalar(ground + s * 1.9);
        tmp.updateMatrix();
        blobs2.setMatrixAt(i, tmp.matrix);
        cones1.setMatrixAt(i, zero);
        cones2.setMatrixAt(i, zero);
      }
      i++;
    };

    // Wild forests via rejection sampling on the vegetation mask.
    let attempts = 0;
    let placedWild = 0;
    while (placedWild < WILD_TREES && attempts < WILD_TREES * 30) {
      attempts++;
      const lat = -55 + rng() * 125; // -55..70
      const lng = -180 + rng() * 360;
      if (!mask || !isVegetated(mask, lat, lng)) continue;
      place(lat, lng);
      placedWild++;
    }

    // City outskirts — a welcoming grove around every checkpoint.
    for (const a of landmarks.anchors) {
      const lat = (Math.asin(a.dir.y) * 180) / Math.PI;
      const lng = (Math.atan2(-a.dir.z, a.dir.x) * 180) / Math.PI;
      for (let k = 0; k < CITY_TREES; k++) {
        const ang = rng() * Math.PI * 2;
        const r = 2.2 + rng() * 2.4; // degrees from the city
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
