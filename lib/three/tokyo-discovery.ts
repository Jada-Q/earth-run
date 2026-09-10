import { beveledBox } from "./beveled-box";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry, Vector3 } from "three";
import { buildRunner } from "./runner";
import { groundHeightAt, groundNormalAt } from "./elevation";
import { meters } from "./world-scale";

export type DiscoveryState = "unseen" | "noticed" | "skipped" | "meet" | "search" | "return" | "done";
export interface DiscoveryHud { state: DiscoveryState; active: boolean; label: string; action: string; completed: boolean; }
const SAVE_KEY = "earth-run:tokyo-sakura-scarf:v1";

/** Optional branch: a resident's lost camera pouch, found with the dog. */
export function buildTokyoDiscovery() {
  const group = new Group(); group.name = "Tokyo lost camera pouch";
  const resident = buildRunner({ jacket: "#b87975", crest: "#efe4cc" }, "resident");
  const villager = new Group(); villager.add(resident.group); group.add(villager);
  const cream = new MeshStandardMaterial({ color: "#e8dabc", roughness: .95 });
  const rose = new MeshStandardMaterial({ color: "#bd7e78", roughness: .9 });
  const gold = new MeshStandardMaterial({ color: "#dfb057", roughness: .75 });
  const pathGeo = new BoxGeometry(meters(1.4), meters(.06), meters(1.4));
  const stones = Array.from({ length: 19 }, () => { const m = new Mesh(pathGeo, cream); group.add(m); return m; });
  const pouchGeo = beveledBox(meters(.28), meters(.20), meters(.12));
  const strapGeo = new TorusGeometry(meters(.09), meters(.013), 6, 16);
  const pouch = new Group();
  const bag = new Mesh(pouchGeo, rose); bag.position.y = meters(.13);
  const strap = new Mesh(strapGeo, gold); strap.position.y = meters(.29);
  pouch.add(bag, strap); group.add(pouch);
  const benchGeo = new BoxGeometry(meters(1.8), meters(.12), meters(.55));
  const bench = new Group(); const seat = new Mesh(benchGeo, cream); seat.position.y = meters(.5); bench.add(seat);
  const benchLegGeo = new BoxGeometry(meters(.09), meters(.5), meters(.09));
  for (const x of [-.7, .7]) for (const z of [-.18, .18]) {
    const leg = new Mesh(benchLegGeo, rose); leg.position.set(meters(x), meters(.25), meters(z)); bench.add(leg);
  }
  group.add(bench);
  const ringGeo = new TorusGeometry(meters(1.2), meters(.07), 6, 32);
  const ring = new Mesh(ringGeo, gold); group.add(ring);
  const fork = new Vector3(), residentPoint = new Vector3(), lostPoint = new Vector3(), up = new Vector3(0, 1, 0);
  let completed = false;
  try { completed = localStorage.getItem(SAVE_KEY) === "1"; } catch { /* Optional persistence. */ }
  let state: DiscoveryState = completed ? "done" : "unseen";
  let enabled = false;
  let resumeState: "meet" | "search" | "return" = "meet";
  const active = () => enabled && ["meet", "search", "return"].includes(state);
  const target = () => state === "search" ? lostPoint : residentPoint;
  const place = (object: Group | Mesh, point: Vector3, lift = 0) => {
    object.position.copy(point).multiplyScalar(1 + groundHeightAt(point) + lift);
    object.quaternion.setFromUnitVectors(up, point);
  };
  function configure(key: string, departure: Vector3, photo: Vector3) {
    enabled = key === "tokyo"; group.visible = enabled;
    if (!enabled) return;
    const along = photo.clone().sub(departure).normalize();
    fork.copy(departure).lerp(photo, .42).normalize();
    const side = fork.clone().cross(along).normalize();
    residentPoint.copy(fork).addScaledVector(side, meters(20)).normalize();
    lostPoint.copy(fork).addScaledVector(side, meters(35)).normalize();
    update();
  }
  function update(playerUp?: Vector3): boolean {
    if (!enabled) return false;
    let discovered = false;
    if (state === "unseen" && playerUp && playerUp.dot(fork) > Math.cos(meters(5))) {
      state = "noticed"; discovered = true;
    }
    stones.forEach((stone, i) => {
      const point = fork.clone().lerp(lostPoint, i / (stones.length - 1)).normalize();
      place(stone, point, meters(-.025));
      stone.quaternion.setFromUnitVectors(up, groundNormalAt(point, new Vector3()));
    });
    place(villager, residentPoint);
    place(pouch, lostPoint);
    place(bench, lostPoint.clone().addScaledVector(fork.clone().cross(lostPoint).normalize(), meters(1.5)).normalize());
    pouch.visible = state !== "return" && state !== "done";
    ring.visible = state === "noticed" || active();
    const goal = state === "noticed" ? fork : target();
    ring.position.copy(goal).multiplyScalar(1 + groundHeightAt(goal) + meters(.12));
    ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), goal);
    resident.setPose("idle", performance.now() * .001);
    return discovered;
  }
  return {
    group, fork, residentPoint, lostPoint, configure, update, target, active,
    get completed() { return completed; },
    hud(): DiscoveryHud | null {
      if (!enabled) return null;
      const label = state === "meet" ? "去问问岔路旁的居民" : state === "search" ? "跟小狗寻找相机袋" : state === "return" ? "把相机袋送还居民" : "樱花步道的小发现";
      const action = state === "meet" ? "和居民聊聊" : state === "search" ? "捡起相机袋" : "归还相机袋";
      return { state, active: active(), label, action, completed };
    },
    investigate() { if (enabled && ["noticed", "skipped", "unseen"].includes(state)) state = state === "skipped" ? resumeState : "meet"; },
    skip() { if (enabled && !completed) { if (state === "meet" || state === "search" || state === "return") resumeState = state; state = "skipped"; } },
    interact(playerUp: Vector3): "request" | "found" | "reward" | null {
      if (!active() || playerUp.dot(target()) < Math.cos(meters(4))) return null;
      if (state === "meet") { state = "search"; return "request"; }
      if (state === "search") { state = "return"; return "found"; }
      state = "done"; completed = true;
      try { localStorage.setItem(SAVE_KEY, "1"); } catch { /* Reward also works without storage. */ }
      return "reward";
    },
    dispose() { resident.dispose(); [cream, rose, gold, pathGeo, pouchGeo, strapGeo, benchGeo, benchLegGeo, ringGeo].forEach(r => r.dispose()); },
  };
}
