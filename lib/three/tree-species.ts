import { BufferGeometry, ConeGeometry, Float32BufferAttribute, SphereGeometry } from "three";

export const TREE_SPECIES = ['pine', 'broadleaf', 'oak', 'cypress', 'palm', 'blossom'] as const;
export type TreeSpecies = typeof TREE_SPECIES[number];
export const TREE_COLORS = ['#6d9077','#93ac80','#819668','#708971','#8ba474','#d7ada9'];

/** One shared canopy per species; all coordinates use a foot-level origin. */
export function treeCanopy(kind: TreeSpecies): BufferGeometry {
  const parts: BufferGeometry[]=[];
  const blob=(x:number,y:number,z:number,rx:number,ry:number,rz:number)=>{
    const g=new SphereGeometry(1,10,7);g.scale(rx,ry,rz);g.translate(x,y,z);parts.push(g);
  };
  if(kind==='pine') {
    for(const [r,h,y] of [[.83,1.25,1.20],[.65,1.15,1.75],[.42,.95,2.22]]) {
      const g=new ConeGeometry(r,h,9);g.translate(0,y,0);parts.push(g);
    }
  } else if(kind==='cypress') {
    blob(0,1.65,0,.38,1.22,.38);blob(.03,2.36,0,.23,.64,.23);
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
    blob(0,1.53,0,.65*wide,.65,.58*wide);
    blob(-.43,1.44,.13,.52*wide,.47,.50);
    blob(.40,1.67,.13,.55*wide,.53,.48);
    blob(.04,1.91,-.16,.52,.49,.49);
  }
  const positions:number[]=[],normals:number[]=[];
  for(const geo of parts) {
    const flat=geo.index?geo.toNonIndexed():geo;
    positions.push(...flat.getAttribute('position').array);normals.push(...flat.getAttribute('normal').array);
    if(flat!==geo)flat.dispose();geo.dispose();
  }
  const result=new BufferGeometry();result.setAttribute('position',new Float32BufferAttribute(positions,3));result.setAttribute('normal',new Float32BufferAttribute(normals,3));result.computeBoundingSphere();return result;
}
