import { BackSide, BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshToonMaterial } from "three";
import assets from "./assets/city-buildings.json";
import { makeGradientMap } from "./clouds";
import { INK } from "./palette";
import { wobbleGeo } from "./wobble-geo";

interface MeshData {
  name: string;
  color: string;
  positions: number[];
  normals: number[];
  indices: number[];
}
interface BuildingData { height: number; radius: number; parts: MeshData[] }
const buildings: Record<string, BuildingData> = assets;
type Disposable = { dispose(): void };

function geometryOf(part: MeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function outlineOf(geometry: BufferGeometry): BufferGeometry {
  const outline = wobbleGeo(geometry, 0.00015);
  const p = outline.getAttribute("position");
  const n = geometry.getAttribute("normal");
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * 0.0001,
      p.getY(i) + n.getY(i) * 0.0001, p.getZ(i) + n.getZ(i) * 0.0001);
  }
  p.needsUpdate = true;
  outline.computeBoundingSphere();
  return outline;
}

/** Local mesh bounds, before the existing landmark placement scale of 1.5. */
export function cityBuildingRadius(key: string): number | undefined {
  return buildings[key]?.radius;
}

/** Reference feature height rather than surrounding decorations. */
export function cityReferenceHeight(key:string):number|undefined {
  const data=buildings[key];if(!data)return undefined;
  if(key==='la') {
    const part=data.parts.find(p=>p.color==='#f4f1e8');
    if(part){const ys=part.positions.filter((_,i)=>i%3===1);return Math.max(...ys)-Math.min(...ys);}
  }
  if(key==='istanbul') {
    const part=data.parts.find(p=>p.color==='#365b60');let height=0;
    if(part)for(let i=0;i<part.positions.length;i+=3)if(Math.abs(part.positions[i])<.026&&Math.abs(part.positions[i+2])<.026)height=Math.max(height,part.positions[i+1]);
    return height||undefined;
  }
  return undefined;
}

export function buildCityBuilding(key: string): { group: Group; dispose(): void } | null {
  const data = buildings[key];
  if (!data) return null;
  const group = new Group();
  group.name = `Blender ${key}`;
  const disposables: Disposable[] = [];
  const gradientMap = makeGradientMap(3, 0.78);
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide });
  disposables.push(gradientMap, ink);
  for (const part of data.parts) {
    if(key==='la'&&part.color==='#897661')continue; // Decorative palms had no real-world scale reference.
    const geometry = geometryOf(part);
    if(key==='la'&&part.color==='#5e8764') {
      const indices:number[]=[];
      for(let i=0;i<part.indices.length;i+=3){const tri=part.indices.slice(i,i+3);if(tri.every(v=>part.positions[v*3+1]<.007))indices.push(...tri);}
      geometry.setIndex(indices);
      // Drop unused canopy vertices so bounds describe the remaining hillside.
      const used=geometry.toNonIndexed();geometry.copy(used);used.dispose();
    }
    const outline = outlineOf(geometry);
    const material = new MeshToonMaterial({ color: part.color, gradientMap });
    const mesh = new Mesh(geometry, material);
    mesh.name = part.name;
    group.add(mesh, new Mesh(outline, ink));
    disposables.push(geometry, outline, material);
  }
  return { group, dispose() { for (const resource of disposables) resource.dispose(); } };
}

/** Shared geometry per cottage style/material; independent of city count. */
export function buildCityHouses(capacity: number) {
  const group = new Group();
  group.name = "Blender instanced cottages";
  const disposables: Disposable[] = [];
  const gradientMap = makeGradientMap(3, 0.78);
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide });
  disposables.push(gradientMap, ink);
  const batches: InstancedMesh[][] = [];
  let radius = 0;
  for (let style = 0; style < 3; style++) {
    const data = buildings[`cottage-${style}`];
    radius = Math.max(radius, data.radius);
    const batch: InstancedMesh[] = [];
    for (const part of data.parts) {
      const geometry = geometryOf(part);
      const outline = outlineOf(geometry);
      const material = new MeshToonMaterial({ color: part.color, gradientMap });
      const solid = new InstancedMesh(geometry, material, capacity);
      const hull = new InstancedMesh(outline, ink, capacity);
      solid.count = hull.count = 0;
      batch.push(solid, hull);
      group.add(solid, hull);
      disposables.push(solid, hull, geometry, outline, material);
    }
    batches.push(batch);
  }
  return {
    group, radius,
    place(style: number, matrix: Matrix4) {
      for (const mesh of batches[style % batches.length]) {
        if (mesh.count >= capacity) continue;
        mesh.setMatrixAt(mesh.count++, matrix);
      }
    },
    finish() {
      for (const batch of batches) for (const mesh of batch) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    },
    dispose() { for (const resource of disposables) resource.dispose(); },
  };
}
