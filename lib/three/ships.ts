import { fitPhysicalSize, SHIP_SIZE_M } from "./world-scale";
// Ocean traffic follows short, verified water-only routes in the planet frame.
import { Group, Matrix4, Vector3 } from "three";
import { buildShipModel, SHIP_TYPES } from "./ship-model";
import { latLngToVec3 } from "./geo";

/** CPU copy of the land mask R channel for sea/land lookups. */
export interface LandMask {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

export async function loadLandMask(): Promise<LandMask | null> {
  try {
    const res = await fetch("/textures/planet-mask.png");
    const bmp = await createImageBitmap(await res.blob());
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    return { data: img.data, w: bmp.width, h: bmp.height };
  } catch {
    // No mask → ships simply never fade; acceptable degradation.
    return null;
  }
}

/** True when (lat, lng) is open sea — with a safety margin so ships fade
 *  before visually touching the coastline (SDF 0.5 = coast; lower = sea). */
export function isSea(mask: LandMask, lat: number, lng: number): boolean {
  const u = (((lng + 180) / 360) % 1 + 1) % 1;
  const v = 1 - (lat + 90) / 180;
  const px = Math.min(mask.w - 1, Math.max(0, Math.round(u * mask.w)));
  const py = Math.min(mask.h - 1, Math.max(0, Math.round(v * mask.h)));
  return mask.data[(py * mask.w + px) * 4] < 110;
}

export interface Ships {
  group:Group;
  update(speedMul:number):void;
  dispose():void;
}
const BASINS=[[25,-45],[-20,-20],[30,-150],[-25,-130],[10,155],[-23,80],[5,-25],[-35,40]];
export function buildShips():Ships {
  const group=new Group();group.name='Ocean fleet';
  const fleet:Array<{model:ReturnType<typeof buildShipModel>;lat:number;lng:number;r:number;phase:number;speed:number}>=[];
  let disposed=false;
  const up=new Vector3(),ahead=new Vector3(),forward=new Vector3(),side=new Vector3(),matrix=new Matrix4();
  function pose(ship:typeof fleet[number]) {
    const lat=ship.lat+Math.sin(ship.phase)*ship.r,lng=ship.lng+Math.cos(ship.phase)*ship.r/Math.cos(ship.lat*Math.PI/180);
    latLngToVec3(lat,lng,up);
    latLngToVec3(ship.lat+Math.sin(ship.phase+.001)*ship.r,ship.lng+Math.cos(ship.phase+.001)*ship.r/Math.cos(ship.lat*Math.PI/180),ahead);
    forward.copy(ahead).addScaledVector(up,-ahead.dot(up)).normalize();side.copy(forward).cross(up);
    matrix.makeBasis(forward,up,side);ship.model.group.quaternion.setFromRotationMatrix(matrix);
    ship.model.group.position.copy(up).multiplyScalar(1.00001);
  }
  void loadLandMask().then(mask=>{
    if(disposed||!mask)return;
    const clear=(lat:number,lng:number)=>[[0,0],[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]].every(([a,b])=>isSea(mask,lat+a,lng+b/Math.cos(lat*Math.PI/180)));
    for(let basin=0;basin<BASINS.length;basin++)for(let j=0;j<3;j++) {
      let chosen:{lat:number;lng:number;r:number}|null=null;
      for(let attempt=0;attempt<24&&!chosen;attempt++) {
        const lat=BASINS[basin][0]+(j-1)*4+Math.sin(attempt*2.4)*3;
        const lng=BASINS[basin][1]+Math.cos(attempt*2.4)*4;
        const r=attempt<12?1.6:.8;
        let safe=true;
        for(let k=0;k<96&&safe;k++){const a=k/96*Math.PI*2;safe=clear(lat+Math.sin(a)*r,lng+Math.cos(a)*r/Math.cos(lat*Math.PI/180));}
        if(safe)chosen={lat,lng,r};
      }
      if(!chosen)continue;
      const model=buildShipModel(SHIP_TYPES[(basin*3+j)%4]);fitPhysicalSize(model.group,SHIP_SIZE_M[SHIP_TYPES[(basin*3+j)%4]]);
      const ship={model,...chosen,phase:j*2.1+basin*.6,speed:.00065+(j*.00012)};fleet.push(ship);pose(ship);group.add(model.group);
    }
    group.userData.shipCount=fleet.length;
    group.userData.routes=fleet.map(s=>({kind:s.model.group.name,lat:s.lat,lng:s.lng,r:s.r}));
  });
  return {group,update(speedMul){for(const ship of fleet){ship.phase+=ship.speed*speedMul;pose(ship);}},dispose(){disposed=true;for(const ship of fleet)ship.model.dispose();}};
}
