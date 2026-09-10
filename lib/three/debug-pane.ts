// Tweakpane for live-tuning the toon look. Dynamically imported (dev or
// ?debug=1) — never in the default production path.

import type { ToonParams } from "./palette";

interface TunableApp {
  params: ToonParams;
  applyLightDir(): void;
  debugPlacePlayer(lat: number, lng: number): void;
}

export async function mountDebugPane(app: TunableApp): Promise<() => void> {
  const { Pane } = await import("tweakpane");
  const pane = new Pane({ title: "earth run" });
  // Selecting a city with arrow keys must not also steer the runner.
  const stopGameKeys = (event: KeyboardEvent) => event.stopPropagation();
  pane.element.addEventListener("keydown", stopGameKeys);
  const p = app.params;

  const f1 = pane.addFolder({ title: "shading" });
  f1.addBinding(p, "steps", { min: 2, max: 6, step: 1 });
  f1.addBinding(p, "shadeMul", { min: 0.3, max: 1, step: 0.01 });
  f1.addBinding(p, "dayNight", { label: "day/night clock" });
  f1.addBinding(p, "lightAzimuth", { min: -180, max: 180, step: 1 });
  f1.addBinding(p, "lightElevation", { min: -60, max: 80, step: 1 });

  const f2 = pane.addFolder({ title: "ink" });
  f2.addBinding(p, "inkWidth", { min: 0.001, max: 0.08, step: 0.001 });
  f2.addBinding(p, "inkStrength", { min: 0, max: 1, step: 0.01 });
  f2.addBinding(p, "outlineWidth", { min: 0, max: 0.05, step: 0.001 });

  const f3 = pane.addFolder({ title: "motion" });
  f3.addBinding(p, "rotationSpeed", { min: 0, max: 0.5, step: 0.01 });
  f3.addBinding(p, "cloudSpeed", { min: 0, max: 4, step: 0.1 });

  // Existing debug-only UI: begin the game, then inspect every city at game scale.
  const cities: Record<string, [number, number]> = {
    Tokyo: [35.7, 139.7], Hollywood: [34.1, -118.2], Chicago: [41.9, -87.6],
    "New York": [40.7, -74], London: [51.5, -0.1], Paris: [48.9, 2.3],
    Rome: [41.9, 12.5], Istanbul: [41, 28.9], Dubai: [25.2, 55.3],
    Delhi: [28.6, 77.2], Shanghai: [31.2, 121.5],
    "Atlantic fleet": [25.5, -42], "Pacific fleet": [30, -146],
  };
  const preview = { city: "Tokyo" };
  const f4 = pane.addFolder({ title: "city preview (after Begin)" });
  f4.addBinding(preview, "city", { options: Object.fromEntries(Object.keys(cities).map((name) => [name, name])) })
    .on("change", () => {
      const [lat, lng] = cities[preview.city];
      app.debugPlacePlayer(lat, lng);
    });

  pane.on("change", () => app.applyLightDir());

  return () => {
    pane.element.removeEventListener("keydown", stopGameKeys);
    pane.dispose();
  };
}
