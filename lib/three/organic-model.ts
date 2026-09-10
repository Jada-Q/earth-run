import { BackSide, BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector2, Vector3 } from "three";
import { WORLD_STYLE } from "./palette";
import { wobbleGeo } from "./wobble-geo";

/** Shared smooth surfaces with restrained ink; callers own the returned kit. */
export function organicKit(detail: "hero" | "resident" = "hero") {
  const resources: Array<{ dispose(): void }> = [];
  const materials = new Map<string, MeshStandardMaterial>();
  const ink = new MeshBasicMaterial({ color: WORLD_STYLE.ink, side: BackSide });
  resources.push(ink);
  const material = (color: string) => {
    let mat = materials.get(color);
    if (!mat) { mat = new MeshStandardMaterial({ color, roughness: 0.82 }); materials.set(color, mat); resources.push(mat); }
    return mat;
  };
  function mesh(parent: Group, geo: BufferGeometry, color: string, x: number, y: number, z: number, outline = true) {
    resources.push(geo);
    const solid = new Mesh(geo, material(color));
    solid.position.set(x, y, z);
    parent.add(solid);
    if (outline && detail === "hero") {
      const edge = wobbleGeo(geo, 0.0003);
      resources.push(edge);
      const hull = new Mesh(edge, ink);
      hull.scale.setScalar(1.018);
      solid.add(hull);
    }
    return solid;
  }
  function oval(parent: Group, color: string, x: number, y: number, z: number, rx: number, ry: number, rz: number, outline = true) {
    const geo = new SphereGeometry(1, detail === "hero" ? 20 : 10, detail === "hero" ? 14 : 8);
    geo.scale(rx, ry, rz);
    return mesh(parent, geo, color, x, y, z, outline);
  }
  function profile(parent: Group, color: string, points: number[][], x: number, y: number, z: number, depth = 1) {
    const geo = new LatheGeometry(points.map(([radius, height]) => new Vector2(radius, height)), detail === "hero" ? 20 : 12);
    // Lathe radius describes shoulder/hip width across Z; X is body depth.
    geo.scale(depth, 1, 1);
    return mesh(parent, geo, color, x, y, z);
  }
  function curve(parent: Group, color: string, points: number[][], radius: number) {
    const geo = new TubeGeometry(new CatmullRomCurve3(points.map(p => new Vector3(...p as [number, number, number]))), detail === "hero" ? 16 : 8, radius, 6, false);
    return mesh(parent, geo, color, 0, 0, 0);
  }
  function loft(parent: Group, color: string, sections: number[][], x: number, y: number, z: number) {
    const path=new CatmullRomCurve3(sections.map(p=>new Vector3(p[0],p[1],p[2])));
    const rows=detail==='hero'?32:16,columns=detail==='hero'?24:12;
    const vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<=rows;i++) {
      const p=path.getPoint(i/rows);
      for(let j=0;j<=columns;j++) {
        const angle=j/columns*Math.PI*2;
        vertices.push(p.x, Math.cos(angle)*Math.max(.0001,p.y), Math.sin(angle)*Math.max(.0001,p.z));
      }
    }
    for(let i=0;i<rows;i++)for(let j=0;j<columns;j++) {
      const a=i*(columns+1)+j,b=a+columns+1;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    return mesh(parent,geometry,color,x,y,z,false);
  }
  return { oval, profile, curve, loft, dispose() { for (const r of resources) r.dispose(); } };
}
