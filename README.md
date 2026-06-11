# Earth Run

Race a little runner around a tiny toon planet — eastbound from Tokyo,
through 11 city checkpoint gates, back to the start line. Past drifting
clouds, blocky airplanes with contrails, ships that fade out near
coastlines, V-formations of birds, the occasional whale, and a satellite
watching it all. The sun follows your local clock; city lights come up on
the night side.

Sister piece to [Quake Globe](https://github.com/Jada-Q/quake-globe) —
the rendering engine (SDF land-mask toon planet, ink outlines, the whole
ambient life pack) was born there.

## Controls

- **WASD / arrows** — run & turn · **space** — jump
- **Touch** — left half of the screen is a joystick; round button jumps
- The gold gate is your next target; the ink arrow at your feet points
  the way along the sphere.

## Tech

- Next.js 16 + three.js, no physics engine — the planet is an analytic
  unit sphere, so the runner is one quaternion and walking is rotating it
- Planet shader samples a baked 2048×1024 mask: R = land SDF (crisp
  coastlines at any zoom + free coastline ink), G = vegetation noise,
  B = city-light splats (`pnpm bake` regenerates from world-atlas)
- Everything instanced; ~12 draw-call groups total

## Run

```bash
pnpm install
pnpm dev   # http://localhost:3014
```

MIT.
