// EarthRunApp — imperative three.js orchestrator for the tiny-planet racing
// game. Step-1 shape: the living toon planet (clouds, planes, ships, birds,
// whale, satellite, day/night) with a free orbit camera; the runner,
// follow-cam and race systems land in later steps.
//
// Scene graph: tiltGroup (phi, X) ⊃ spinGroup (lambda, Y) ⊃ planet & co.

import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { defaultToonParams, type ToonParams } from "./palette";
import { buildPlanet, type Planet } from "./planet";
import { CameraRig, type ViewPreset } from "./camera-rig";
import { attachControls } from "./controls";
import { buildClouds, type Clouds } from "./clouds";
import { buildPlanes, type Planes } from "./planes";
import { buildShips, type Ships } from "./ships";
import { buildBirds, type Birds } from "./birds";
import { buildWhale, type Whale } from "./whale";
import { buildSatellite, type Satellite } from "./satellite";
import { buildPlayer, type Player } from "./player";
import { attachInput, type GameInput } from "./input";
import { buildRace, type Race, type RaceHud } from "./race";
import { buildIntroLetters, type IntroLetters } from "./intro-letters";
import { buildLandmarks, type Landmarks } from "./landmarks";
import { buildNpcs, type Npcs } from "./npcs";
import { buildStreetProps, type StreetProps } from "./streetprops";
import { buildTrees, type Trees } from "./trees";
import { buildCompanion, type Companion } from "./companion";
import { buildSigns, type Signs } from "./signs";
import { regionAt, type GeoKind } from "./regions-geo";
import type { Outfit } from "./runner";
import {
  ConeGeometry,
  Mesh as ThreeMesh,
  MeshBasicMaterial,
  Quaternion,
} from "three";
import { INK } from "./palette";

const HOME_VIEW: ViewPreset = {
  lambda: -139, // start the camera over Japan — the race will start in Tokyo
  phi: -30,
  scale: 1.5,
  autoRotate: true,
};

const SPAWN = { lat: 35.7, lng: 139.7 }; // Tokyo
const ENTER_MS = 900;
const ORBIT_FOV = 30;
const PLAY_FOV = 52;
const CAM_DIST = 0.21; // behind the (now pedestrian-sized) runner
const CAM_HEIGHT = 0.065; // low — street-level feel, horizon high in frame
// In town the camera rises and looks down over the rooftops — a ground
// level camera jammed between cottages/poles clips through everything.
const CAM_HEIGHT_CITY = 0.16;
const CAM_DIST_CITY = 0.27;
const CITY_CAM_COS = Math.cos((3.2 * Math.PI) / 180);
const CAM_SMOOTH = 7; // exponential smoothing rate

type Mode = "orbit" | "entering" | "play";

export interface EarthRunAppOptions {
  canvas: HTMLCanvasElement;
}

export class EarthRunApp {
  readonly params: ToonParams = defaultToonParams();
  readonly rig: CameraRig;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private tiltGroup = new Group();
  private spinGroup = new Group();
  private planet: Planet;
  private clouds: Clouds;
  private planes: Planes;
  private ships: Ships;
  private birds: Birds;
  private whale: Whale;
  private satellite: Satellite;
  private sun!: DirectionalLight;
  private lightDir = new Vector3(0, 0, 1);
  private detachControls: (() => void) | null;
  private raf = 0;
  private disposed = false;

  private mode: Mode = "orbit";
  private enterStartMs = 0;
  private enterFromTilt = 0;
  private enterFromSpin = 0;
  private player: Player | null = null;
  private companion: Companion | null = null;
  private outfit: Outfit | undefined;
  private input: GameInput | null = null;
  private race: Race;
  private landmarks: Landmarks;
  private npcs: Npcs;
  private streetProps: StreetProps;
  private trees: Trees;
  private signs: Signs;
  private introLetters: IntroLetters | null = null;
  private guideArrow: ThreeMesh;
  private guideDir = new Vector3();
  private guideQuat = new Quaternion();
  private readonly canvas: HTMLCanvasElement;
  private lastTickMs = 0;
  private camTarget = new Vector3();
  private camLook = new Vector3();
  private camDir = new Vector3();
  private camTan = new Vector3();
  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
    } else if (!this.disposed) {
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  constructor({ canvas }: EarthRunAppOptions) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.rig = new CameraRig(HOME_VIEW);

    this.sun = new DirectionalLight("#fff1d6", 2.35); // warm afternoon key
    this.applyLightDir();
    this.scene.add(this.sun, new AmbientLight("#dcebf5", 0.6)); // cool sky fill

    this.tiltGroup.add(this.spinGroup);
    this.scene.add(this.tiltGroup);
    this.planet = buildPlanet(this.params);
    this.spinGroup.add(this.planet.group);
    this.clouds = buildClouds();
    this.tiltGroup.add(this.clouds.group);
    this.planes = buildPlanes();
    this.tiltGroup.add(this.planes.group);
    this.ships = buildShips();
    this.spinGroup.add(this.ships.group);
    this.birds = buildBirds();
    this.tiltGroup.add(this.birds.group);
    this.whale = buildWhale();
    this.spinGroup.add(this.whale.group);
    this.satellite = buildSatellite();
    this.tiltGroup.add(this.satellite.group);
    // Checkpoint gates ride the spin group: aligned with geography in the
    // orbit view, world frame (identity) during play.
    this.race = buildRace();
    this.spinGroup.add(this.race.group);
    // Landmarks + residents live in the planet's frame too.
    this.landmarks = buildLandmarks();
    this.spinGroup.add(this.landmarks.group);
    this.npcs = buildNpcs(this.landmarks);
    this.spinGroup.add(this.npcs.group);
    this.streetProps = buildStreetProps(this.landmarks);
    this.spinGroup.add(this.streetProps.group);
    this.trees = buildTrees(this.landmarks);
    this.spinGroup.add(this.trees.group);
    this.signs = buildSigns(this.landmarks);
    this.spinGroup.add(this.signs.group);
    this.guideArrow = new ThreeMesh(
      new ConeGeometry(0.007, 0.02, 4),
      new MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.6 }),
    );
    this.guideArrow.visible = false;
    this.scene.add(this.guideArrow);

    this.introLetters = buildIntroLetters();
    this.scene.add(this.introLetters.group);

    this.detachControls = attachControls({
      canvas,
      rig: this.rig,
      onDoubleClick: () => {},
      onMouseMove: () => {},
    });

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Leave the orbit view and drop onto the planet (called from BEGIN). */
  startGame(outfit?: Outfit): void {
    if (this.mode !== "orbit") return;
    this.outfit = outfit;
    this.introLetters?.startExit(performance.now());
    this.mode = "entering";
    this.enterStartMs = performance.now();
    this.enterFromTilt = this.rig.tiltRad();
    // Unwind the spin to its nearest 2π multiple so the tween is short.
    const spin = this.rig.spinRad();
    this.enterFromSpin = spin - Math.round(spin / (2 * Math.PI)) * 2 * Math.PI;
    this.detachControls?.();
    this.detachControls = null;
  }

  /** Live joystick state for the HUD. */
  joystick() {
    return this.input?.joystick() ?? null;
  }

  pressJump(): void {
    this.input?.pressJump();
  }

  pressChop(): void {
    this.input?.pressChop();
  }

  setJumpHeld(held: boolean): void {
    this.input?.setJumpHeld(held);
  }

  /** Flight fuel 0..1 (1 when grounded/refilled). */
  flightFuel(): number {
    return this.player?.fuelRatio() ?? 1;
  }

  isFlying(): boolean {
    return this.player?.isFlying() ?? false;
  }

  /** Race HUD snapshot for React (poll-friendly). */
  raceHud(): RaceHud {
    return this.race.hud(performance.now());
  }

  /** Geography layer: country/range/ocean under the runner's feet. */
  currentRegion(): { name: string; kind: GeoKind } | null {
    if (!this.player) return null;
    return regionAt(this.player.up);
  }

  /** Landmark plaque: name of the monument you're standing near (≤3°). */
  nearbyLandmark(): string | null {
    if (!this.player) return null;
    const NEAR = Math.cos((3 * Math.PI) / 180);
    for (const a of this.landmarks.anchors) {
      if (this.player.up.dot(a.dir) > NEAR) return a.name;
    }
    return null;
  }

  /** Dev teleport — rebuild the runner at given coords (debug pane use). */
  debugPlacePlayer(lat: number, lng: number): void {
    if (this.mode !== "play" || !this.player) return;
    this.player.dispose();
    this.scene.remove(this.player.group);
    this.player = buildPlayer(lat, lng, this.outfit);
    this.scene.add(this.player.group);
  }

  /** Reset the lap and put the runner back on the start line. */
  restartRace(): void {
    if (this.mode !== "play" || !this.player) return;
    this.race.restart();
    this.player.dispose();
    this.scene.remove(this.player.group);
    this.player = buildPlayer(SPAWN.lat, SPAWN.lng);
    this.scene.add(this.player.group);
  }

  /** Place the sun + shader light from the shared azimuth/elevation params. */
  applyLightDir(): void {
    const az = (this.params.lightAzimuth * Math.PI) / 180;
    const el = (this.params.lightElevation * Math.PI) / 180;
    this.lightDir.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el),
    );
    this.sun.position.copy(this.lightDir).multiplyScalar(10);
  }

  /** Stylized sun-follows-local-clock (see quake-globe for rationale). */
  private applyDayNight(): void {
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    this.params.lightAzimuth = (h - 12) * 15;
    const dayT = Math.sin(((h - 6) / 12) * Math.PI);
    this.params.lightElevation = dayT > 0 ? 8 + dayT * 47 : -6 + dayT * 12;
    this.sun.intensity = 0.9 + Math.max(0, dayT) * 1.3;
    this.applyLightDir();
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.rig.setViewport(w, h);
  };

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.lastTickMs) / 1000, 0.05);
    this.lastTickMs = now;
    const cam = this.rig.camera;

    if (this.mode === "orbit") {
      this.rig.autoSpeed = this.params.rotationSpeed;
      this.rig.update(now, false);
      this.tiltGroup.rotation.x = this.rig.tiltRad();
      this.spinGroup.rotation.y = this.rig.spinRad();
      this.tiltGroup.position.y = Math.sin(now * 0.0004) * 0.012;
    } else if (this.mode === "entering") {
      // Tween the world groups to identity so the geographic frame is the
      // world frame, then spawn the runner.
      const t = Math.min((now - this.enterStartMs) / ENTER_MS, 1);
      const e = 1 - Math.pow(1 - t, 3);
      this.tiltGroup.rotation.x = this.enterFromTilt * (1 - e);
      this.spinGroup.rotation.y = this.enterFromSpin * (1 - e);
      this.tiltGroup.position.y *= 1 - e;
      if (t >= 1) {
        this.tiltGroup.rotation.x = 0;
        this.spinGroup.rotation.y = 0;
        this.tiltGroup.position.y = 0;
        this.player = buildPlayer(SPAWN.lat, SPAWN.lng, this.outfit);
        this.scene.add(this.player.group);
        this.companion = buildCompanion();
        this.scene.add(this.companion.group);
        this.input = attachInput(this.canvas);
        cam.fov = PLAY_FOV;
        cam.updateProjectionMatrix();
        this.mode = "play";
      }
    } else if (this.player && this.input) {
      const frame = this.input.read();
      // The clock starts the first time you move.
      if (frame.forward !== 0 || frame.turn !== 0) this.race.start(now);
      if (frame.chop && this.trees.tryChop(this.player.up)) {
        this.player.chop();
      }
      const colliders = [
        ...this.landmarks.colliders,
        ...this.trees.colliders(),
      ];
      this.player.update(dt, frame, colliders);
      this.companion?.update(
        dt,
        now,
        this.player.up,
        this.player.forward,
        colliders,
      );
      this.race.update(now, this.player.up);
      // Ground guide arrow toward the active gate.
      const t = this.race.targetTangent(this.player.up, this.guideDir);
      if (t) {
        this.guideArrow.visible = true;
        this.guideArrow.position
          .copy(this.player.group.position)
          .addScaledVector(this.player.up, 0.006)
          .addScaledVector(t, 0.075);
        this.guideQuat.setFromUnitVectors(this.guideArrow.up, t);
        this.guideArrow.quaternion.copy(this.guideQuat);
      } else {
        this.guideArrow.visible = false;
      }
      // Follow cam: behind and above the runner, "up" = the runner's up so
      // the horizon stays level across the whole sphere (poles included).
      const up = this.player.up;
      const fwd = this.player.forward;
      // In town the camera rises over the rooftops — a ground-level cam
      // jammed between cottages/poles clips through everything.
      let cityness = 0;
      for (const a of this.landmarks.anchors) {
        if (up.dot(a.dir) > CITY_CAM_COS) {
          cityness = 1;
          break;
        }
      }
      const camH = CAM_HEIGHT + (CAM_HEIGHT_CITY - CAM_HEIGHT) * cityness;
      const camD = CAM_DIST + (CAM_DIST_CITY - CAM_DIST) * cityness;
      // Based on the player's actual radial position so the camera rides
      // up and over mountain terrain with them.
      this.camTarget
        .copy(this.player.group.position)
        .addScaledVector(up, camH)
        .addScaledVector(fwd, -camD);
      const k = 1 - Math.exp(-dt * CAM_SMOOTH);
      cam.position.lerp(this.camTarget, k);
      // The camera itself respects building columns: push its ground
      // projection out of any keep-out disc.
      const camR = cam.position.length();
      this.camDir.copy(cam.position).normalize();
      for (const c of colliders) {
        const d = this.camDir.dot(c.dir);
        if (d > c.minDot) {
          const minTheta = Math.acos(Math.min(1, c.minDot));
          this.camTan.copy(this.camDir).addScaledVector(c.dir, -d);
          if (this.camTan.lengthSq() < 1e-10) continue;
          this.camTan.normalize();
          this.camDir
            .copy(c.dir)
            .multiplyScalar(Math.cos(minTheta))
            .addScaledVector(this.camTan, Math.sin(minTheta));
        }
      }
      cam.position.copy(this.camDir).multiplyScalar(camR);
      cam.up.copy(up);
      // Look well past the runner so the horizon sits high in frame
      // (street-level feel, like the reference).
      this.camLook.copy(this.player.group.position).addScaledVector(fwd, 0.3);
      cam.lookAt(this.camLook);
    }

    if (this.introLetters && this.introLetters.update(now)) {
      this.scene.remove(this.introLetters.group);
      this.introLetters.dispose();
      this.introLetters = null;
    }

    this.trees.update(now);
    if (this.params.dayNight) this.applyDayNight();
    this.clouds.update(this.params.cloudSpeed);
    this.planes.update(this.params.cloudSpeed);
    this.ships.update(this.params.cloudSpeed);
    this.birds.update(this.params.cloudSpeed, now);
    this.whale.update(now);
    this.satellite.update(this.params.cloudSpeed, now);
    this.npcs.update(now, dt);

    this.planet.applyParams(this.params, this.lightDir);
    this.renderer.render(this.scene, cam);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.detachControls?.();
    this.input?.detach();
    this.player?.dispose();
    this.companion?.dispose();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.planet.dispose();
    this.clouds.dispose();
    this.planes.dispose();
    this.ships.dispose();
    this.birds.dispose();
    this.whale.dispose();
    this.satellite.dispose();
    this.race.dispose();
    this.landmarks.dispose();
    this.npcs.dispose();
    this.streetProps.dispose();
    this.trees.dispose();
    this.signs.dispose();
    this.introLetters?.dispose();
    this.guideArrow.geometry.dispose();
    (this.guideArrow.material as MeshBasicMaterial).dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    this.renderer.dispose();
  }
}
