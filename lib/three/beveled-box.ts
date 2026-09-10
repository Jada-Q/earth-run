import { ExtrudeGeometry, Shape } from "three";

/** Small, single-segment chamfers catch light without changing part bounds. */
export function beveledBox(w: number, h: number, d: number): ExtrudeGeometry {
  const r = Math.min(w, h, d) * 0.16;
  const x = w / 2 - r;
  const y = h / 2 - r;
  const shape = new Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    depth: d - 2 * r, steps: 1, bevelEnabled: true,
    bevelThickness: r, bevelSize: r, bevelSegments: 1, curveSegments: 1,
  });
  geo.translate(0, 0, -d / 2 + r);
  return geo;
}
