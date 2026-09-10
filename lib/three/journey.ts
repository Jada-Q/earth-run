import type { DiscoveryHud } from "./tokyo-discovery";
import { treeCanopy, treeWood } from "./tree-species";
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, TorusGeometry, Vector3 } from "three";
import type { Landmarks } from "./landmarks";
import { groundHeightAt, groundNormalAt } from "./elevation";
import { meters, LANDMARK_HEIGHT_M } from "./world-scale";

export const DESTINATIONS = [
  { key: "tokyo", label: "东京", title: "东京塔" },
  { key: "la", label: "洛杉矶", title: "好莱坞标志" },
  { key: "chicago", label: "芝加哥", title: "威利斯大厦" },
  { key: "nyc", label: "纽约", title: "自由女神像" },
  { key: "london", label: "伦敦", title: "大本钟" },
  { key: "paris", label: "巴黎", title: "埃菲尔铁塔" },
  { key: "rome", label: "罗马", title: "斗兽场" },
  { key: "istanbul", label: "伊斯坦布尔", title: "圣索菲亚大教堂" },
  { key: "dubai", label: "迪拜", title: "哈利法塔" },
  { key: "delhi", label: "德里", title: "印度门" },
  { key: "shanghai", label: "上海", title: "东方明珠" },
];
export type JourneyStage = "landmark" | "departure";
export interface JourneyHud {
  city: string; title: string; key: string; stage: JourneyStage;
  distance: number; ready: boolean; following: boolean; scenic: boolean;
  discovery: DiscoveryHud | null;
}

/** Short pedestrian approach outside each monument's actual collision footprint. */
export function buildJourney(landmarks: Landmarks) {
  const group = new Group();
  const gold = new MeshStandardMaterial({ color: "#d9a352", roughness: .85 });
  const stone = new MeshStandardMaterial({ color: "#dfd4b5", roughness: .95 });
  const teal = new MeshStandardMaterial({ color: "#426e6a", roughness: .9 });
  const pathGeo = new BoxGeometry(meters(2.8), meters(.06), meters(3.2));
  const ringGeo = new TorusGeometry(meters(2), meters(.10), 8, 32);
  const poleGeo = new BoxGeometry(meters(.15), meters(2.3), meters(.15));
  const signGeo = new BoxGeometry(meters(.2), meters(.75), meters(1.6));
  const canopyGeos = ["blossom", "broadleaf", "palm"].map(kind => {
    const geo = treeCanopy(kind as "blossom" | "broadleaf" | "palm", true);
    geo.scale(meters(3), meters(3), meters(3)); return geo;
  });
  const canopyGeo = canopyGeos[0];
  const leaf = new MeshStandardMaterial({ color: "#f0c1cc", roughness: 1, vertexColors: true, emissive: "#f0c1cc", emissiveIntensity: .12 });
  const woodGeos = (["blossom", "broadleaf", "palm"] as const).map(kind => treeWood(kind).scale(meters(3), meters(3), meters(3)));
  const trunkGeo = woodGeos[0];
  const bark = new MeshStandardMaterial({ color: "#86765c", roughness: 1 });
  const planted = Array.from({ length: 8 }, () => {
    const tree = new Group(); const trunk = new Mesh(trunkGeo, bark); trunk.position.y = 0;
    tree.add(trunk, new Mesh(canopyGeo, leaf)); group.add(tree); return tree;
  });
  const treeColliders = planted.map(() => ({ dir: new Vector3(), minDot: Math.cos(meters(.5)) }));
  const path = Array.from({ length: 25 }, () => {
    const mesh = new Mesh(pathGeo, stone); group.add(mesh); return mesh;
  });
  const ring = new Mesh(ringGeo, gold); group.add(ring);
  const station = new Group();
  const pole = new Mesh(poleGeo, teal); pole.position.y = meters(1.15);
  const sign = new Mesh(signGeo, gold); sign.position.y = meters(2);
  station.add(pole, sign); group.add(station);
  let key = "tokyo";
  let stage: JourneyStage = "landmark";
  const center = new Vector3(), west = new Vector3(), photo = new Vector3(), departure = new Vector3(), spawn = new Vector3();
  const radial = new Vector3(0, 1, 0);
  function configure(next: string) {
    const index = landmarks.anchors.findIndex(a => a.key === next);
    if (index < 0) return;
    key = next; stage = "landmark";
    leaf.color.set(next === "tokyo" ? "#f0c1cc" : "#93ac80");
    leaf.emissive.copy(leaf.color);
    planted.forEach(tree => { const species = next === "tokyo" ? 0 : ["dubai", "la"].includes(next) ? 2 : 1; (tree.children[1] as Mesh).geometry = canopyGeos[species]; (tree.children[0] as Mesh).geometry = woodGeos[species]; });
    center.copy(landmarks.colliders[index].dir);
    west.crossVectors(radial, center).normalize().negate();
    const radius = Math.acos(landmarks.colliders[index].minDot);
    const at = (distance: number, out: Vector3) => out.copy(center).multiplyScalar(Math.cos(distance)).addScaledVector(west, Math.sin(distance)).normalize();
    at(radius + meters(8), photo);
    at(radius + meters(85), departure);
    at(radius + meters(68), spawn);
    update();
  }
  function place(object: Group | Mesh, dir: Vector3, lift: number) {
    object.position.copy(dir).multiplyScalar(1 + groundHeightAt(dir) + lift);
    object.quaternion.setFromUnitVectors(radial, dir);
  }
  function update() {
    for (let i = 0; i < path.length; i++) {
      const p = departure.clone().lerp(photo, i / (path.length - 1)).normalize();
      place(path[i], p, meters(-.025));
      const surface = groundNormalAt(p, new Vector3());
      const along = photo.clone().sub(departure).addScaledVector(surface, -photo.clone().sub(departure).dot(surface)).normalize();
      const right = surface.clone().cross(along).normalize();
      path[i].quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, surface, along));
    }
    planted.forEach((tree, i) => {
      const p = departure.clone().lerp(photo, .15 + Math.floor(i / 2) * .2).normalize();
      const side = p.clone().cross(west).normalize();
      p.addScaledVector(side, meters(i % 2 ? 5.5 : -5.5)).normalize();
      place(tree, p, 0); treeColliders[i].dir.copy(p);
    });
    place(station, departure, 0);
    const target = stage === "landmark" ? photo : departure;
    ring.position.copy(target).multiplyScalar(1 + groundHeightAt(target) + meters(.12));
    ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), target);
  }
  configure(key);
  return {
    group, center, photo, departure, spawn, configure, update, colliders: treeColliders,
    get key() { return key; }, get stage() { return stage; },
    get height() { return meters(LANDMARK_HEIGHT_M[key]); },
    target() { return stage === "landmark" ? photo : departure; },
    stamp() { stage = "departure"; update(); },
    dispose() { [pathGeo, ringGeo, poleGeo, signGeo, gold, stone, teal, ...canopyGeos, ...woodGeos, leaf, bark].forEach(r => r.dispose()); },
  };
}
