import { meters, HOUSE_HEIGHT_M } from "./world-scale";
import { BackSide, Box3, BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { WORLD_STYLE } from "./palette";

export const REGIONAL_STYLES: Record<string,string> = {
  tokyo: "东京 · 浅色公寓、深窗带与阳台", la: "洛杉矶 · 灰泥别墅与陶瓦坡顶",
  chicago: "芝加哥 · 砖石排屋与凸窗", nyc: "纽约 · 褐石住宅、门廊与台阶",
  london: "伦敦 · 砖砌联排、白窗套与烟囱", paris: "巴黎 · 石灰石立面、折线屋顶与铁艺阳台",
  rome: "罗马 · 赭色灰泥、陶瓦与百叶窗", istanbul: "伊斯坦布尔 · 木立面、悬挑上层与坡顶",
  dubai: "迪拜 · 现代玻璃塔楼与浅沙色裙房", delhi: "新德里 · 浅色平房、柱廊与遮阳檐",
  shanghai: "上海 · 陆家嘴玻璃立面与阶梯裙房",
};

/** Architectural kit in meters-of-model space, batched by material at game scale. */
export function buildRegionalHouse(key: string, variant = 0) {
  const geometries = new Map<string,BufferGeometry[]>();
  const resources: Array<{dispose():void}> = [];
  const tmp=new Object3D();
  function part(geo:BufferGeometry,color:string,x:number,y:number,z:number,ry=0) {
    tmp.position.set(x*.032,y*.032,z*.032);tmp.rotation.set(0,ry,0);tmp.scale.setScalar(.032);tmp.updateMatrix();
    geo.applyMatrix4(tmp.matrix);
    const list=geometries.get(color)??[];list.push(geo);geometries.set(color,list);
  }
  function box(color:string,w:number,h:number,d:number,x:number,y:number,z:number) {part(new BoxGeometry(w,h,d),color,x,y,z);}
  const glass="#597780", trim="#dfd6c0", dark="#52605f", tile="#ad6e51";
  const walls:Record<string,string>={tokyo:"#dddcd0",la:"#e9d8b8",chicago:"#9d6956",nyc:"#99735e",london:"#a57864",paris:"#dfcfb1",rome:"#d9ad79",istanbul:"#b5bfa9",dubai:"#c9d6cf",delhi:"#dbc8a1",shanghai:"#a7bfc1"};
  const wall=walls[key]??trim;
  const w=.9,d=.68;
  let h=key==='la'||key==='delhi'?.56:key==='dubai'||key==='shanghai'?1.46:1.05;
  h+=variant*.10;
  box(wall,w,h,d,0,h/2,0);
  box(trim,w+.06,.055,d+.06,0,.0275,0);
  function band(y:number,width=w+.06,depth=d+.06,color=trim) {box(color,width,.035,depth,0,y,0);}
  function window(x:number,y:number,width=.15,height=.20,z=d/2+.006,shutters=false) {
    box(trim,width+.035,height+.035,.018,x,y,z);
    box(glass,width,height,.021,x,y,z+.01);
    box(trim,.009,height,.024,x,y,z+.022);
    if(shutters) for(const side of [-1,1]) {
      box(dark,.055,height,.028,x+side*(width/2+.047),y,z+.018);
      for(let j=0;j<4;j++) box(wall,.051,.008,.005,x+side*(width/2+.047),y-height/2+.025+j*height/4,z+.035);
    }
  }
  function door(x=0,y=.14) {box(trim,.20,.31,.04,x,y,d/2+.015);box(dark,.15,.265,.048,x,y-.008,d/2+.035);}
  function hipRoof(color:string,height=.22,topScale=0,topDepthScale=topScale) {
    // Four-sided truncated roof; narrow top makes a readable mansard silhouette.
    const levels=[[-w/2-.045,-d/2-.045],[w/2+.045,-d/2-.045],[w/2+.045,d/2+.045],[-w/2-.045,d/2+.045]];
    const vertices:number[]=[];
    for(let i=0;i<4;i++) {const a=levels[i],b=levels[(i+1)%4];const A=[a[0],h,a[1]],B=[b[0],h,b[1]],C=[b[0]*topScale,h+height,b[1]*topDepthScale],D=[a[0]*topScale,h+height,a[1]*topDepthScale];vertices.push(...A,...C,...B);if(C.some((v,j)=>v!==D[j]))vertices.push(...A,...D,...C);}
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeVertexNormals();part(g,color,0,0,0);
    if(topScale>0 && topDepthScale>0)box(color,(w+.09)*topScale,.025,(d+.09)*topDepthScale,0,h+height,0);
  }
  function balcony(y:number,width=.8) {
    box(trim,width,.028,.13,0,y-.13,d/2+.065);
    box(dark,width,.016,.016,0,y-.005,d/2+.13);
    for(let i=0;i<9;i++)box(dark,.009,.12,.012,-width/2+i*width/8,y-.066,d/2+.13);
  }
  function chimney(x:number) {box(wall,.09,.23,.11,x,h+.12,-.15);box(trim,.12,.035,.14,x,h+.235,-.15);}
  const floors=h>.9?3:1;
  if(!['dubai','shanghai'].includes(key)) {
    for(let level=0;level<floors;level++) for(const x of [-.27,0,.27]) {
      if(level===0&&x===0)continue;
      window(x,.25+level*.29,.14,.18,d/2+.006,key==='rome');
    }
    door();
    // Side and rear openings keep street silhouettes convincing from orbit.
    for(const side of [-1,1])for(let level=0;level<floors;level++)for(const z of [-.19,.15]) {
      box(trim,.018,.20,.155,side*(w/2+.003),.25+level*.29,z);
      box(glass,.022,.16,.12,side*(w/2+.012),.25+level*.29,z);
    }
    for(let level=0;level<floors;level++)for(const x of [-.27,0,.27])box(glass,.14,.18,.015,x,.25+level*.29,-d/2-.006);
  }
  if(key==='tokyo') {
    band(h);box(dark,w-.07,.025,d-.07,0,h+.025,0);
    for(const y of [.40,.69,.98]) {box(trim,w+.025,.025,.14,0,y,d/2+.06);box(wall,w,.095,.025,0,y+.05,d/2+.12);}
    box(trim,.22,.15,.20,-.22,h+.10,-.1); // rooftop plant enclosure
  } else if(key==='la') {
    hipRoof(tile,.20,.92,0);
    box(trim,.60,.045,.23,0,.42,d/2+.10);
    for(const x of [-.25,.25])part(new CylinderGeometry(.025,.03,.39,12),trim,x,.225,d/2+.18);
    const ridge=new CylinderGeometry(.018,.018,w+.03,10);ridge.rotateZ(Math.PI/2);
    part(ridge,tile,0,h+.205,0);
  } else if(key==='chicago') {
    band(h);band(h-.06,w+.025,d+.025,wall);
    box(trim,.40,h-.12,.13,-.16,h/2+.04,d/2+.06);
    for(const y of [.26,.55,.84])window(-.16,y,.27,.19,d/2+.14);
    for(let j=0;j<8;j++)box(trim,.055,.07,.06,-.39+j*.11,h-.07,d/2+.025);
    box(dark,w-.07,.018,d-.07,0,h+.025,0);
  } else if(key==='nyc') {
    band(h,w+.09,d+.055,dark);
    for(let j=0;j<8;j++)box(trim,.04,.07,.055,-.38+j*.11,h-.04,d/2+.02);
    for(let i=0;i<4;i++)box(wall,.25,.035*(i+1),.06,0,.0175*(i+1),d/2+.23-i*.05);
    box(trim,.26,.045,.14,0,.35,d/2+.05);
    for(const x of [-.135,.135])box(dark,.012,.22,.23,x,.15,d/2+.12);
    box(dark,w-.08,.02,d-.08,0,h+.018,0);
  } else if(key==='london') {
    hipRoof(dark,.24,.05);chimney(-.32);chimney(.32);
    band(.4);box(trim,.25,.045,.09,0,.34,d/2+.04);
    for(const x of [-.27,.27]){box(wall,.23,.32,.095,x,.20,d/2+.04);window(x,.23,.16,.21,d/2+.10);}
  } else if(key==='paris') {
    band(h);hipRoof(dark,.25,.60);
    for(const x of [-.27,0,.27]) {box(trim,.18,.17,.08,x,h+.10,d/2-.01);window(x,h+.10,.11,.12,d/2+.04);}
    balcony(.55);balcony(.84);band(.39);chimney(-.33);
  } else if(key==='rome') {
    hipRoof(tile,.17,.20);band(h);band(.40);
    balcony(.55,.24);box(trim,.27,.05,.06,0,.35,d/2+.02);
  } else if(key==='istanbul') {
    box(wall,w+.10,.40,d+.13,0,h-.22,.035);
    for(const x of [-.29,0,.29])window(x,h-.21,.18,.25,d/2+.115);
    for(let i=0;i<9;i++)box(trim,w+.105,.008,.012,0,h-.41+i*.047,d/2+.105);
    for(const x of [-.37,.37])box(dark,.025,.18,.11,x,h-.50,d/2+.04);
    hipRoof(tile,.20,.10);
  } else if(key==='delhi') {
    band(h,w+.10,d+.10);box(trim,w+.06,.07,d+.06,0,h+.045,0);
    box(trim,w+.10,.045,.30,0,h-.08,d/2+.12);
    for(const x of [-.38,-.13,.13,.38]) {
      part(new CylinderGeometry(.025,.029,h-.12,12),trim,x,(h-.12)/2,d/2+.23);
      box(trim,.075,.025,.075,x,h-.13,d/2+.23);
    }
    box(trim,w+.08,.055,.32,0,.025,d/2+.12);
  } else if(key==='dubai'||key==='shanghai') {
    const blue=key==='dubai'?'#769b9e':'#638b9a';
    box(blue,w-.10,h-.15,d+.015,0,h/2+.025,0);
    for(let j=0;j<7;j++){const y=.18+j*(h-.20)/7;band(y,w+.012,d+.04);}
    for(const x of [-.30,0,.30])box(trim,.025,h,.025,x,h/2,d/2+.025);
    box(wall,w+.12,.20,d+.14,0,.10,0);
    for(const x of [-.3,0,.3])box(glass,.19,.14,.025,x,.10,d/2+.08);
    if(key==='shanghai') {
      box(wall,.56,.13,.48,0,h+.045,0);box(blue,.35,.12,.30,0,h+.17,0);
    } else {
      box(trim,.12,h+.17,.12,-.34,(h+.17)/2,-.23);
      band(h);
    }
  }
  const group=new Group();group.name=REGIONAL_STYLES[key];
  for(const [color,parts] of geometries) {
    const positions:number[]=[],normals:number[]=[];
    for(const g of parts) {
      const non=g.index?g.toNonIndexed():g;
      positions.push(...non.getAttribute('position').array);normals.push(...non.getAttribute('normal').array);
      if(non!==g)non.dispose();g.dispose();
    }
    const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(positions,3));geo.setAttribute('normal',new Float32BufferAttribute(normals,3));geo.computeBoundingSphere();
    const material=new MeshStandardMaterial({color,roughness:.88});
    group.add(new Mesh(geo,material));resources.push(geo,material);
  }
  const initialBounds=new Box3().setFromObject(group);
  const factor=meters((HOUSE_HEIGHT_M[key]??12)+variant*3)/initialBounds.getSize(new Vector3()).y;
  for(const child of group.children) {const mesh=child as Mesh;mesh.geometry.scale(factor,factor,factor);mesh.geometry.computeBoundingSphere();}
  const bounds=new Box3().setFromObject(group),size=bounds.getSize(new Vector3());
  const radius=Math.hypot(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z)));
  return { group,radius,height:size.y,dispose(){for(const r of resources)r.dispose();} };
}

export function buildRegionalHouses(capacity:number) {
  const group=new Group();group.name='Regional neighborhood architecture';
  const resources:Array<{dispose():void}>=[];
  const batches=new Map<string,InstancedMesh[]>();
  let radius=0;
  for(const key of Object.keys(REGIONAL_STYLES)) for(let variant=0;variant<2;variant++) {
    const model=buildRegionalHouse(key,variant);resources.push(model);radius=Math.max(radius,model.radius);
    const meshes:InstancedMesh[]=[];
    for(const child of model.group.children) {
      const source=child as Mesh;
      const solid=new InstancedMesh(source.geometry,source.material,capacity);solid.count=0;meshes.push(solid);group.add(solid);resources.push(solid);
      const outline=new MeshBasicMaterial({color:WORLD_STYLE.ink,side:BackSide});resources.push(outline);
      const hullGeo=source.geometry.clone();hullGeo.scale(1.009,1.004,1.009);resources.push(hullGeo);
      const hull=new InstancedMesh(hullGeo,outline,capacity);hull.count=0;meshes.push(hull);group.add(hull);resources.push(hull);
    }
    batches.set(`${key}-${variant}`,meshes);
  }
  return {group,radius,place(key:string,variant:number,matrix:Matrix4){
    for(const mesh of batches.get(`${key}-${variant%2}`)??[]) if(mesh.count<capacity)mesh.setMatrixAt(mesh.count++,matrix);
  },finish(){for(const meshes of batches.values())for(const mesh of meshes){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}},dispose(){for(const r of resources)r.dispose();}};
}
