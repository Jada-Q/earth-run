import { BackSide, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, ExtrudeGeometry } from "three";
import { beveledBox } from "./beveled-box";
import { WORLD_STYLE } from "./palette";
export const SHIP_TYPES=['ferry','cargo','fishing','sailboat'] as const;
export type ShipType=typeof SHIP_TYPES[number];
/** Tapered waterline hull, +X forward, Y=0 waterline. */
export function buildShipModel(kind:ShipType) {
  const group=new Group();group.name=kind;
  const resources:Array<{dispose():void}>=[];
  const materials=new Map<string,MeshStandardMaterial>();
  const ink=new MeshBasicMaterial({color:WORLD_STYLE.ink,side:BackSide});resources.push(ink);
  function add(geo:BufferGeometry,color:string,x=0,y=0,z=0,outlined=false){
    let mat=materials.get(color);if(!mat){mat=new MeshStandardMaterial({color,roughness:.8});materials.set(color,mat);resources.push(mat);}
    const mesh=new Mesh(geo,mat);mesh.position.set(x,y,z);group.add(mesh);resources.push(geo);
    if(outlined){const hull=new Mesh(geo,ink);hull.scale.setScalar(1.018);mesh.add(hull);}return mesh;
  }
  const box=(c:string,w:number,h:number,d:number,x:number,y:number,z:number)=>add(beveledBox(w,h,d),c,x,y,z);
  const long=kind==='cargo'?1.6:kind==='ferry'?1.3:1;
  const shape=new Shape();shape.moveTo(-long/2,-.21);shape.lineTo(long*.26,-.21);shape.quadraticCurveTo(long/2,-.15,long/2,0);shape.quadraticCurveTo(long/2,.15,long*.26,.21);shape.lineTo(-long/2,.21);shape.closePath();
  const geo=new ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelThickness:.035,bevelSize:.045,bevelSegments:2,steps:1,curveSegments:8});geo.rotateX(Math.PI/2);geo.translate(0,.115,0);
  add(geo,kind==='cargo'?'#9d6956':WORLD_STYLE.paper,0,0,0,true);
  box(WORLD_STYLE.bark,long*.80,.025,.30,-.03,.14,0);
  const glass='#577a83';
  if(kind==='ferry') {
    box(WORLD_STYLE.paper,.72,.18,.30,-.09,.23,0);box(WORLD_STYLE.paper,.46,.14,.25,-.14,.38,0);
    for(const z of [-.157,.157])for(let i=0;i<5;i++)box(glass,.08,.075,.012,-.36+i*.135,.25,z);
    box(glass,.38,.07,.265,-.14,.39,0);box('#ae7454',.12,.15,.11,-.30,.50,0);
  } else if(kind==='cargo') {
    box(WORLD_STYLE.paper,.28,.28,.32,-.55,.29,0);box(glass,.25,.06,.335,-.55,.37,0);
    const colors=['#8b9c88','#b58a6d','#718c95'];
    for(let i=0;i<3;i++)for(let z=0;z<2;z++)for(let level=0;level<2;level++){
      const x=-.16+i*.27,zz=-.088+z*.176;box(colors[(i+z)%3],.25,.11,.155,x,.215+level*.12,zz);
      for(let stripe=0;stripe<4;stripe++)box('#bec4af',.009,.085,.003,x-.09+stripe*.06,.215+level*.12,zz+.079);
    }
  } else if(kind==='fishing') {
    box(WORLD_STYLE.teal,.30,.23,.29,.02,.26,0);box(glass,.16,.09,.303,.02,.29,0);
    add(new CylinderGeometry(.018,.018,.57,8),WORLD_STYLE.bark,-.23,.43,0);
    box(WORLD_STYLE.bark,.52,.025,.026,-.08,.69,0);
    for(const z of [-.19,.19])box(WORLD_STYLE.teal,.45,.025,.016,-.10,.22,z);
  } else {
    add(new CylinderGeometry(.014,.019,.85,8),WORLD_STYLE.bark,0,.55,0);
    const sail=new BufferGeometry();sail.setAttribute('position',new Float32BufferAttribute([0,.96,0,0,.26,0,.40,.28,.035, .40,.28,.035,0,.26,0,0,.96,0],3));sail.computeVertexNormals();add(sail,WORLD_STYLE.paper);
    const jib=new BufferGeometry();jib.setAttribute('position',new Float32BufferAttribute([-.02,.82,0,-.39,.24,0,-.02,.26,.025, -.02,.26,.025,-.39,.24,0,-.02,.82,0],3));jib.computeVertexNormals();add(jib,'#c4b894');
  }
  return {group,dispose(){for(const r of resources)r.dispose();}};
}
