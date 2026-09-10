import { meters } from "./world-scale";
// Six regional tree silhouettes, batched by species. Placement awaits terrain.
import { Color, Group, InstancedMesh, Matrix4, MeshToonMaterial, Object3D, Vector3 } from "three";
import { makeGradientMap } from "./clouds";
import { loadLandMask, type LandMask } from "./ships";
import { ensureElevationLoaded, groundHeightAt } from "./elevation";
import type { Landmarks } from "./landmarks";
import { WORLD_STYLE } from "./palette";
import { TREE_SPECIES, TREE_COLORS, treeCanopy, treeWood } from "./tree-species";

const WILD_TREES=1600, CITY_TREES=14, BASE=meters(5);
const CHOP_REACH_COS=Math.cos(meters(2.5)), TREE_R=Math.cos(meters(.45)), FALL_MS=500;
function maskAt(mask:LandMask,lat:number,lng:number,vegetation:boolean) {
  const u=(((lng+180)/360)%1+1)%1,v=(90-lat)/180;
  const x=Math.min(mask.w-1,Math.max(0,Math.floor(u*mask.w)));
  const y=Math.min(mask.h-1,Math.max(0,Math.floor(v*mask.h)));
  const i=(y*mask.w+x)*4;
  return mask.data[i]>140&&(!vegetation||mask.data[i+1]>127);
}
export interface Trees {
  group:Group;
  colliders():Array<{dir:Vector3;minDot:number}>;
  tryChop(up:Vector3):boolean;
  update(nowMs:number):void;
  dispose():void;
}
interface TreeRec {dir:Vector3;s:number;species:number;slot:number;yaw:number;alive:boolean;}
export function buildTrees(landmarks:Landmarks):Trees {
  const group=new Group();group.name='Regional forests';
  const resources:Array<{dispose():void}>=[];
  const gradientMap=makeGradientMap(4,.76);resources.push(gradientMap);
  const total=WILD_TREES+CITY_TREES*landmarks.anchors.length;
  const trunkMat=new MeshToonMaterial({color:WORLD_STYLE.bark,gradientMap});
  resources.push(trunkMat);
  const trunks=TREE_SPECIES.map(species=>{
    const geo=treeWood(species),mesh=new InstancedMesh(geo,trunkMat,total);
    mesh.count=0;mesh.name=species+' branches';group.add(mesh);resources.push(geo,mesh);return mesh;
  });
  const canopies=TREE_SPECIES.map((species,i)=>{
    const geo=treeCanopy(species),mat=new MeshToonMaterial({color:'#ffffff',gradientMap,vertexColors:true});
    const mesh=new InstancedMesh(geo,mat,total);mesh.count=0;mesh.name=species;
    group.add(mesh);resources.push(geo,mat,mesh);return mesh;
  });
  const batches=[...trunks,...canopies];
  // Falling trees stay inside their standing bounds; no per-frame bounds rebuild.
  const recs:TreeRec[]=[],falls:Array<{idx:number;start:number}>=[];
  let colliderCache:Array<{dir:Vector3;minDot:number}>|null=null,disposed=false;
  let seed=4242424;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const tmp=new Object3D(),zero=new Matrix4().makeScale(0,0,0),pos=new Vector3();
  function writeTree(i:number,rec:TreeRec,k:number) {
    const ground=1+groundHeightAt(rec.dir),s=rec.s*k;
    tmp.position.copy(rec.dir).multiplyScalar(ground);
    tmp.lookAt(rec.dir.x*2,rec.dir.y*2,rec.dir.z*2);tmp.rotateX(Math.PI/2);tmp.rotateY(rec.yaw);
    tmp.scale.setScalar(s);tmp.updateMatrix();
    canopies[rec.species].setMatrixAt(rec.slot,k>.02?tmp.matrix:zero);
    trunks[rec.species].setMatrixAt(rec.slot,k>.02?tmp.matrix:zero);
  }
  function choose(lat:number,city?:string) {
    const r=rng();
    if(city==='tokyo')return r<.35?5:r<.8?1:0;
    if(['la','dubai','delhi'].includes(city??''))return r<.6?4:1;
    if(['rome','istanbul'].includes(city??''))return r<.5?3:2;
    if(city)return r<.4?1:r<.7?2:r<.85?3:5;
    if(Math.abs(lat)>46)return r<.75?0:1;
    if(Math.abs(lat)<24)return r<.28?4:r<.65?1:2;
    return r<.3?0:r<.65?1:r<.86?2:r<.96?3:5;
  }
  function place(lat:number,lng:number,city?:string) {
    const a=lat*Math.PI/180,b=lng*Math.PI/180;
    pos.set(Math.cos(a)*Math.cos(b),Math.sin(a),-Math.cos(a)*Math.sin(b));
    // Preserve open checkpoint plazas and building canopy clearance.
    if(landmarks.anchors.some(anchor=>pos.dot(anchor.dir)>Math.cos(.035)))return false;
    if(landmarks.colliders.some(c=>pos.dot(c.dir)>Math.cos(Math.acos(c.minDot)+.031)))return false;
    if(recs.some(rec=>pos.dot(rec.dir)>Math.cos(.0115)))return false;
    const species=choose(lat,city),mesh=canopies[species];
    const rec:TreeRec={dir:pos.clone(),s:BASE*(.7+rng()*.65),species,slot:mesh.count++,yaw:rng()*Math.PI*2,alive:true};
    const color=new Color(TREE_COLORS[species]);color.multiplyScalar(.90+rng()*.18);mesh.setColorAt(rec.slot,color);
    recs.push(rec);trunks[species].count=mesh.count;writeTree(recs.length-1,rec,1);return true;
  }
  void(async()=>{
    const [mask]=await Promise.all([loadLandMask(),ensureElevationLoaded()]);
    if(disposed||!mask)return;
    // Reserve town greenery first. Land checks prevent palms standing in water.
    for(const anchor of landmarks.anchors) {
      const lat=Math.asin(anchor.dir.y)*180/Math.PI,lng=Math.atan2(-anchor.dir.z,anchor.dir.x)*180/Math.PI;
      let placed=0;
      for(let tries=0;placed<CITY_TREES&&tries<400;tries++) {
        const angle=rng()*Math.PI*2,r=3.5+rng()*4;
        const la=lat+Math.sin(angle)*r,lo=lng+Math.cos(angle)*r/Math.max(.3,Math.cos(lat*Math.PI/180));
        if(maskAt(mask,la,lo,false)&&place(la,lo,anchor.key))placed++;
      }
    }
    let placed=0;
    for(let tries=0;placed<WILD_TREES&&tries<WILD_TREES*150;tries++) {
      const lat=Math.asin(-.82+rng()*1.76)*180/Math.PI,lng=-180+rng()*360;
      if(maskAt(mask,lat,lng,true)&&place(lat,lng))placed++;
    }
    colliderCache=null;
    for(const mesh of batches){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
    group.userData.treeCount=recs.length;
    group.userData.speciesCounts=Object.fromEntries(canopies.map(m=>[m.name,m.count]));
  })();
  return {group,colliders(){
    if(!colliderCache)colliderCache=recs.filter(r=>r.alive).map(r=>({dir:r.dir,minDot:TREE_R}));return colliderCache;
  },tryChop(up){
    let nearest=-1,dot=CHOP_REACH_COS;
    recs.forEach((r,i)=>{const d=r.dir.dot(up);if(r.alive&&d>dot){dot=d;nearest=i;}});
    if(nearest<0)return false;
    recs[nearest].alive=false;colliderCache=null;falls.push({idx:nearest,start:performance.now()});return true;
  },update(nowMs){
    if(!falls.length)return;
    for(let i=falls.length-1;i>=0;i--){const f=falls[i],t=(nowMs-f.start)/FALL_MS;writeTree(f.idx,recs[f.idx],Math.max(0,1-t));if(t>=1)falls.splice(i,1);}
    for(const mesh of batches)mesh.instanceMatrix.needsUpdate=true;
  },dispose(){disposed=true;for(const r of resources)r.dispose();}};
}
