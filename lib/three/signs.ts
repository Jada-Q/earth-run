import { beveledBox } from "./beveled-box";
// Physical nameplates — a paper signboard on two posts standing in front
// of every landmark, text rendered to a CanvasTexture (EN + CN). The DOM
// banner announces arrival; the sign keeps the name in the WORLD.

import {
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { WORLD_STYLE } from "./palette";
import { groundHeightAt } from "./elevation";
import { makeGradientMap } from "./clouds";
import type { Landmarks } from "./landmarks";

export interface Signs {
  group: Group;
  dispose(): void;
}

function nameTexture(name: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 224;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = WORLD_STYLE.paper;
  ctx.fillRect(0, 0, 1024, 224);
  ctx.strokeStyle = WORLD_STYLE.ink;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 1010, 210);
  ctx.fillStyle = WORLD_STYLE.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const [en, cn] = name.split(" · ");
  ctx.font = "italic 600 76px Georgia, serif";
  ctx.fillText(en ?? name, 512, cn ? 78 : 112);
  if (cn) {
    ctx.font = "54px 'Hiragino Sans GB', 'PingFang SC', sans-serif";
    ctx.fillText(cn, 512, 162);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function buildSigns(landmarks: Landmarks): Signs {
  const group = new Group();
  const disposables: Array<{ dispose(): void }> = [];

  const postGeo = beveledBox(0.0012, 0.0105, 0.0012);
  const frameGeo = beveledBox(0.027, 0.0067, 0.0013);
  disposables.push(frameGeo);
  const boardGeo = new PlaneGeometry(0.026, 0.0057);
  const postMat = new MeshToonMaterial({
    color: WORLD_STYLE.bark,
    gradientMap: makeGradientMap(3, 0.8),
  });
  disposables.push(postGeo, boardGeo, postMat, {
    dispose: () => postMat.gradientMap?.dispose(),
  });

  const basis = new Matrix4();

  for (const a of landmarks.anchors) {
    const tex = nameTexture(a.name);
    tex.anisotropy = 4;
    const mat = new MeshBasicMaterial({ map: tex, side: DoubleSide });
    disposables.push(tex, mat);

    // Halfway between the gate and the monument, facing the gate.
    const pos = new Vector3()
      .copy(a.dir)
      .addScaledVector(a.north, 0.011)
      .normalize();
    const up = pos.clone();
    const east = a.east
      .clone()
      .addScaledVector(up, -up.dot(a.east))
      .normalize();
    const holder = new Group();
    holder.scale.setScalar(.03);
    holder.position.copy(pos).multiplyScalar(1 + groundHeightAt(pos));
    basis.makeBasis(east, up, east.clone().cross(up)); // z = -north → faces gate
    holder.quaternion.setFromRotationMatrix(basis);

    const board = new Mesh(boardGeo, mat);
    board.position.set(0, 0.0105, 0.00072);
    const frame = new Mesh(frameGeo, postMat);
    frame.position.y = 0.0105;
    holder.add(frame);
    const postL = new Mesh(postGeo, postMat);
    postL.position.set(-0.0108, 0.00525, 0);
    const postR = new Mesh(postGeo, postMat);
    postR.position.set(0.0108, 0.00525, 0);
    holder.add(board, postL, postR);
    group.add(holder);
  }

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
