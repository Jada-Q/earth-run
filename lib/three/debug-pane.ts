// Tweakpane for live-tuning the toon look. Dynamically imported (dev or
// ?debug=1) — never in the default production path.

import type { ToonParams } from "./palette";

interface TunableApp {
  params: ToonParams;
  applyLightDir(): void;
}

export async function mountDebugPane(app: TunableApp): Promise<() => void> {
  const { Pane } = await import("tweakpane");
  const pane = new Pane({ title: "earth run" });
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

  pane.on("change", () => app.applyLightDir());

  return () => pane.dispose();
}
