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

const HOME_VIEW: ViewPreset = {
  lambda: -139, // start the camera over Japan — the race will start in Tokyo
  phi: -30,
  scale: 1.5,
  autoRotate: true,
};

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
  private detachControls: () => void;
  private raf = 0;
  private disposed = false;
  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
    } else if (!this.disposed) {
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  constructor({ canvas }: EarthRunAppOptions) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.rig = new CameraRig(HOME_VIEW);

    this.sun = new DirectionalLight(0xffffff, 2.2);
    this.applyLightDir();
    this.scene.add(this.sun, new AmbientLight(0xffffff, 0.55));

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

    this.rig.autoSpeed = this.params.rotationSpeed;
    this.rig.update(now, false);
    this.tiltGroup.rotation.x = this.rig.tiltRad();
    this.spinGroup.rotation.y = this.rig.spinRad();
    this.tiltGroup.position.y = Math.sin(now * 0.0004) * 0.012;

    if (this.params.dayNight) this.applyDayNight();
    this.clouds.update(this.params.cloudSpeed);
    this.planes.update(this.params.cloudSpeed);
    this.ships.update(this.params.cloudSpeed);
    this.birds.update(this.params.cloudSpeed, now);
    this.whale.update(now);
    this.satellite.update(this.params.cloudSpeed, now);

    this.planet.applyParams(this.params, this.lightDir);
    this.renderer.render(this.scene, this.rig.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.detachControls();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.planet.dispose();
    this.clouds.dispose();
    this.planes.dispose();
    this.ships.dispose();
    this.birds.dispose();
    this.whale.dispose();
    this.satellite.dispose();
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
