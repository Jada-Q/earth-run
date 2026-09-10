import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3 } from "three";

export const TREE_SPECIES = ['pine', 'broadleaf', 'oak', 'cypress', 'palm', 'blossom'] as const;
export type TreeSpecies = typeof TREE_SPECIES[number];
export const TREE_COLORS = ['#6d9077','#93ac80','#819668','#708971','#8ba474','#d7ada9'];

/** One shared canopy per species; all coordinates use a foot-level origin. */
export function treeCanopy(kind: TreeSpecies, detailed = false): BufferGeometry {
  const parts: BufferGeometry[]=[];
  const blob=(x:number,y:number,z:number,rx:number,ry:number,rz:number)=>{
    const g=new SphereGeometry(1,detailed ? 9 : 7,detailed ? 6 : 5);g.scale(rx,ry,rz);g.translate(x,y,z);parts.push(g);
  };
  if(kind==='pine') {
    for(const [r,h,y] of [[.83,1.25,1.20],[.65,1.15,1.75],[.42,.95,2.22]]) {
      const g=new ConeGeometry(r,h,9);g.translate(0,y,0);parts.push(g);
      for(let i=0;i<7;i++) {const a=i*2.39996;blob(Math.cos(a)*r*.63,y-h*.22,Math.sin(a)*r*.63,r*.33,h*.22,r*.33);}
    }
  } else if(kind==='cypress') {
    blob(0,1.65,0,.38,1.22,.38);blob(.03,2.36,0,.23,.64,.23);
    for(let i=0;i<12;i++) {const a=i*2.39996;blob(Math.cos(a)*.20,.85+i*.13,Math.sin(a)*.20,.17,.30,.17);}
  } else if(kind==='palm') {
    for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/7,c=Math.cos(a),s=Math.sin(a);
      const vertices:number[]=[];
      const point=(r:number,y:number,w:number)=>[c*r-s*w,y,s*r+c*w];
      for(let j=0;j<4;j++) {
        const r=j*.30, next=r+.30;
        const y=2.18+Math.sin(j/4*Math.PI)*.28-j*.10;
        const ny=2.18+Math.sin((j+1)/4*Math.PI)*.28-(j+1)*.10;
        const width=.18*Math.sin(j/4*Math.PI),nw=.18*Math.sin((j+1)/4*Math.PI);
        const A=point(r,y,-width),B=point(r,y,width),C=point(next,ny,-nw),D=point(next,ny,nw);
        vertices.push(...A,...C,...B,...B,...C,...D,...B,...C,...A,...D,...C,...B);
      }
      const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeVertexNormals();parts.push(g);
    }
    blob(0,2.13,0,.23,.20,.23);
  } else {
    const wide=kind==='oak'?1.18:1;
    // Open, branching crowns instead of four identical intersecting balls.
    for(let i=0;i<11;i++) {
      const angle=i*2.39996, radius=i===0?0:.32+(i%3)*.15;
      const x=Math.cos(angle)*radius*wide,z=Math.sin(angle)*radius;
      const y=1.60+Math.sin(i*1.71)*.20+(i%3)*.12;
      blob(x,y,z,.36*wide,.32,.35);
      if(detailed) for(let j=0;j<5;j++) {
        const a=angle+j*2.39996;
        blob(x+Math.cos(a)*.28,y+.12+Math.sin(j*2.1)*.19,z+Math.sin(a)*.28,.17,.15,.17);
      }
    }
    if(kind==='blossom' && detailed) {
      // Small five-petal flowers sit on the outer crown, visible at walking distance.
      for(let i=0;i<90;i++) {
        const cluster=i%11, angle=cluster*2.39996;
        const radius=cluster===0?0:.32+(cluster%3)*.15;
        const a=i*2.39996, elevation=Math.sin(i*1.31)*.85;
        const ring=Math.sqrt(1-elevation*elevation);
        const x=Math.cos(angle)*radius+Math.cos(a)*.36*ring;
        const z=Math.sin(angle)*radius+Math.sin(a)*.35*ring;
        const y=1.60+Math.sin(cluster*1.71)*.20+(cluster%3)*.12+.32*elevation;
        for(let j=0;j<5;j++) {
          const t=j*Math.PI*2/5;
          blob(x+Math.cos(t)*.023,y+Math.sin(t)*.023,z,.021,.025,.009);
        }
      }
    }
  }
  const positions:number[]=[],normals:number[]=[];
  for(const geo of parts) {
    const flat=geo.index?geo.toNonIndexed():geo;
    positions.push(...flat.getAttribute('position').array);normals.push(...flat.getAttribute('normal').array);
    if(flat!==geo)flat.dispose();geo.dispose();
  }
  const result=new BufferGeometry();result.setAttribute('position',new Float32BufferAttribute(positions,3));result.setAttribute('normal',new Float32BufferAttribute(normals,3));const colors:number[]=[];
  const tint=new Color();
  for(let i=0;i<positions.length;i+=3) {
    const light=.86+.13*Math.sin(positions[i]*17+positions[i+2]*13)+.06*positions[i+1];
    tint.setRGB(light,light,light);
    colors.push(tint.r,tint.g,tint.b);
  }
  result.setAttribute('color',new Float32BufferAttribute(colors,3));
  result.computeBoundingSphere();return result;
}

/** Tapered trunk, exposed roots and forks, shared by every tree of a species. */
export function treeWood(kind: TreeSpecies): BufferGeometry {
  const positions:number[]=[], normals:number[]=[];
  const segment=(a:Vector3,b:Vector3,r:number,tip:number)=>{
    const d=b.clone().sub(a);
    const g=new CylinderGeometry(tip,r,d.length(),7);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.clone().normalize()));
    g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
    const flat=g.toNonIndexed();
    positions.push(...flat.getAttribute('position').array);
    normals.push(...flat.getAttribute('normal').array);
    flat.dispose();g.dispose();
  };
  const palm=kind==='palm';
  segment(new Vector3(),new Vector3(.035,palm?2.16:1.42,0),.095,.045);
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    segment(new Vector3(Math.cos(a)*.23,.015,Math.sin(a)*.23),new Vector3(0,.28,0),.025,.05);
    if(!palm) {
      const start=new Vector3(.02,.72+i*.12,0);
      const end=new Vector3(Math.cos(a)*.51,1.65+(i%2)*.20,Math.sin(a)*.51);
      if(kind==='cypress') {end.x*=.4;end.z*=.4;}
      segment(start,end,.038,.012);
      segment(start.clone().lerp(end,.65),end.clone().add(new Vector3(.12,.17,-.10)),.018,.006);
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new Float32BufferAttribute(normals,3));g.computeBoundingSphere();return g;
}
