import { BackSide, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshToonMaterial } from "three";
import data from "./assets/tokyo-tower.json";
import { makeGradientMap } from "./clouds";
import { INK } from "./palette";
import { wobbleGeo } from "./wobble-geo";

/** Blender-authored mesh, baked to local +Y-up coordinates; origin at the feet. */
export function buildTokyoTower(): { group: Group; dispose(): void } {
  const group = new Group();
  const disposables: Array<{ dispose(): void }> = [];
  const gradientMap = makeGradientMap(3, 0.78);
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide });
  disposables.push(gradientMap, ink);
  for (const part of data) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(part.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(part.normals, 3));
    geometry.setIndex(part.indices);
    geometry.computeBoundingSphere();
    const material = new MeshToonMaterial({ color: part.color, gradientMap });
    const mesh = new Mesh(geometry, material);
    mesh.name = part.name;
    group.add(mesh);
    // A fixed normal offset keeps fine lattice openings clear. Scaling the
    // whole merged tower would push the antenna outline away from its surface.
    const hullGeometry = wobbleGeo(geometry, 0.00015);
    const positions = hullGeometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i,
        positions.getX(i) + normals.getX(i) * 0.0001,
        positions.getY(i) + normals.getY(i) * 0.0001,
        positions.getZ(i) + normals.getZ(i) * 0.0001,
      );
    }
    positions.needsUpdate = true;
    hullGeometry.computeBoundingSphere();
    group.add(new Mesh(hullGeometry, ink));
    disposables.push(geometry, hullGeometry, material);
  }
  return { group, dispose() { for (const resource of disposables) resource.dispose(); } };
}
