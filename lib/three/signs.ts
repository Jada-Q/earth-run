// Physical nameplates — a paper signboard on two posts standing in front
// of every landmark, text rendered to a CanvasTexture (EN + CN). The DOM
// banner announces arrival; the sign keeps the name in the WORLD.

import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
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
  ctx.fillStyle = "#efece3";
  ctx.fillRect(0, 0, 1024, 224);
  ctx.strokeStyle = "#22302c";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 1010, 210);
  ctx.fillStyle = "#22302c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const [en, cn] = name.split(" · ");
  ctx.font = "italic 600 76px Georgia, serif";
  ctx.fillText(en ?? name, 512, cn ? 78 : 112);
  if (cn) {
    ctx.font = "54px 'Hiragino Sans GB', 'PingFang SC', sans-serif";
    ctx.fillText(cn, 512, 162);
  }
  return new CanvasTexture(canvas);
}

export function buildSigns(landmarks: Landmarks): Signs {
  const group = new Group();
  const disposables: Array<{ dispose(): void }> = [];

  const postGeo = new BoxGeometry(0.0012, 0.008, 0.0012);
  const boardGeo = new PlaneGeometry(0.026, 0.0057);
  const postMat = new MeshToonMaterial({
    color: "#8a7d62",
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
    holder.position.copy(pos);
    basis.makeBasis(east, up, east.clone().cross(up)); // z = -north → faces gate
    holder.quaternion.setFromRotationMatrix(basis);

    const board = new Mesh(boardGeo, mat);
    board.position.y = 0.0105;
    const postL = new Mesh(postGeo, postMat);
    postL.position.set(-0.0108, 0.004, 0);
    const postR = new Mesh(postGeo, postMat);
    postR.position.set(0.0108, 0.004, 0);
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
