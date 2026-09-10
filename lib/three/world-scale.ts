import { Box3, Group, Vector3 } from "three";

/** All physical objects share this conversion. Globe geography remains compressed. */
export const METERS_TO_WORLD = 0.0002;
export const meters = (value: number) => value * METERS_TO_WORLD;
export const HUMAN_HEIGHT_M = 1.75;
export const DOG_HEIGHT_M = 0.75;
// Height including antenna/pedestal where present; see scale-reference.md.
export const LANDMARK_HEIGHT_M: Record<string, number> = {
  tokyo:333, la:13.716, chicago:527, nyc:92.9894, london:96.3,
  paris:330, rome:48.5, istanbul:55.6, dubai:828, delhi:42, shanghai:468,
};
export const SHIP_LENGTH_M = { ferry:60, cargo:180, fishing:18, sailboat:12 };
export const HOUSE_HEIGHT_M: Record<string,number> = {
  tokyo:12,la:5,chicago:11,nyc:12,london:12,paris:16,rome:13,istanbul:10,dubai:32,delhi:5,shanghai:32,
};
export function fitPhysicalDimension(group:Group,axis:'x'|'y'|'z',sizeMeters:number) {
  group.updateMatrixWorld(true);
  const size=new Box3().setFromObject(group).getSize(new Vector3())[axis];
  if(size<=0)throw new Error('Cannot size an empty physical model');
  group.scale.multiplyScalar(meters(sizeMeters)/size);
  group.userData.physicalDimension={axis,meters:sizeMeters};
}

export const SHIP_SIZE_M = {
  ferry:{x:60,y:12,z:12}, cargo:{x:180,y:22,z:28},
  fishing:{x:18,y:8,z:5}, sailboat:{x:12,y:16,z:3.8},
};
export function fitPhysicalSize(group:Group,target:{x:number;y:number;z:number}) {
  group.updateMatrixWorld(true);
  const size=new Box3().setFromObject(group).getSize(new Vector3());
  group.scale.multiply(new Vector3(meters(target.x)/size.x,meters(target.y)/size.y,meters(target.z)/size.z));
  group.userData.physicalSizeMeters=target;
}
