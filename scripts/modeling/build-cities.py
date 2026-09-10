"""Blender source for the remaining 10 landmarks and three instanced cottages.
Run: blender -b --python scripts/modeling/build-cities.py -- /absolute/output
The desktop Python console can run the same script with runpy.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(sys.argv[sys.argv.index('--')+1]).resolve()
OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('Earth Run - World Architecture')
bpy.context.window.scene=scene
parts=[]
assets={}
all_models=[]

def mat(name,hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (1,3,5)]
    rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1); p.inputs['Roughness'].default_value=.78
    return m

paper=mat('Ivory limestone','#e7dfcb')
trim=mat('Warm white','#f4f1e8')
teal=mat('Glazing and roofs','#365b60')
dark=mat('Charcoal steel','#35434a')
bronze=mat('Eiffel bronze','#897661')
copper=mat('Patinated copper','#66927f')
gold=mat('Muted brass','#cfa354')
rose=mat('Terracotta','#c9967d')
pearl=mat('Pearl rose','#c77d91')
silver=mat('Silver blue','#bacbd0')
green=mat('Garden green','#5e8764')

def register(o,name,material):
    o.name=name; o.data.materials.append(material); parts.append(o); return o

def box(name,loc,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=o.modifiers.new('Crafted edge','BEVEL');m.width=bevel;m.segments=1
        bpy.ops.object.modifier_apply(modifier=m.name)
    return register(o,name,material)

def cone(name,loc,r1,r2,h,material,n=12):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=h,location=loc)
    return register(bpy.context.object,name,material)

def sphere(name,loc,r,material,scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=r,location=loc)
    o=register(bpy.context.object,name,material);o.scale=scale;return o

def mesh(name,verts,faces,material):
    m=bpy.data.meshes.new(name); m.from_pydata(verts,[],faces);m.update()
    bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(m);bm.free()
    o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);return register(o,name,material)

def beam(name,a,b,w,material):
    a,b=Vector(a),Vector(b);o=box(name,(a+b)/2,(w,w,(b-a).length),material)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def dome(name,loc,r,h,material):
    verts=[];faces=[];n=16;rows=6
    for j in range(rows+1):
        t=(math.pi/2)*(j/rows)
        for i in range(n):
            a=2*math.pi*i/n
            verts.append((loc[0]+r*math.cos(t)*math.cos(a),loc[1]+r*math.cos(t)*math.sin(a),loc[2]+h*math.sin(t)))
    for j in range(rows):
        for i in range(n):
            k=j*n+i;k1=j*n+(i+1)%n;faces.append((k,k1,k1+n,k+n))
    faces.append(tuple(reversed(range(n))))
    return mesh(name,verts,faces,material)

def arch(name,x,y,z,r,t,depth,material,n=9):
    verts=[];faces=[]
    for i in range(n+1):
        a=math.pi*i/n
        for yy,rr in [(-depth/2,r),(depth/2,r),(-depth/2,r+t),(depth/2,r+t)]:
            verts.append((x+rr*math.cos(a),y+yy,z+rr*math.sin(a)))
    for i in range(n):
        k=i*4
        for a,b in [(0,1),(1,3),(3,2),(2,0)]:faces.append((k+a,k+b,k+4+b,k+4+a))
    faces.extend([(0,2,3,1),(4*n,4*n+1,4*n+3,4*n+2)])
    return mesh(name,verts,faces,material)

def text(name,body,loc,size,material):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.data.body=body;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.035;o.data.resolution_u=2
    bpy.ops.object.convert(target='MESH');return register(bpy.context.object,name,material)

def transform_since(start,loc,angle=0):
    bpy.context.view_layer.update()
    m=Matrix.Translation(Vector(loc))@Matrix.Rotation(angle,4,'Z')
    for o in parts[start:]:o.matrix_world=m@o.matrix_world

def la():
    cone('Faceted hillside',(0,.22,.18),2.5,1.8,.36,green,16).scale.y=.40
    text('Readable HOLLYWOOD letters','HOLLYWOOD',(0,-.1,.47),.72,trim)
    for x in (-1.8,-1.2,-.6,0,.6,1.2,1.8):beam('Sign rear supports',(x,.14,.23),(x,.14,.99),.042,dark)
    for x,y,h in [(-2.15,.0,1.35),(2.1,.4,1.55)]:
        beam('Palm trunk',(x,y,.18),(x+.10,y,h),.09,bronze)
        for k in range(6):
            a=k*math.pi/3;cx=x+.10
            mesh('Palm frond',[(cx,y,h),(cx+.34*math.cos(a)-.11*math.sin(a),y+.34*math.sin(a)+.11*math.cos(a),h+.08),(cx+.66*math.cos(a),y+.66*math.sin(a),h-.17),(cx+.34*math.cos(a)+.11*math.sin(a),y+.34*math.sin(a)-.11*math.cos(a),h+.08)],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],green)

def chicago():
    box('Granite plaza',(0,0,.09),(2.1,2.1,.18),paper,.07)
    heights=[[3.6,5.2,3.6],[5.2,7.1,6.8],[2.7,5.2,2.7]]
    for ix in range(3):
        for iy in range(3):
            x,y=(ix-1)*.53,(iy-1)*.53;h=heights[iy][ix]
            box('Bundled tube',(x,y,.18+h/2),(.525,.525,h),dark,.025)
            box('Stepped silver roof',(x,y,h+.19),(.53,.53,.055),silver)
            for z in [k*.44+.4 for k in range(int(h/.44))]:
                if ix in (0,2):box('Window band',(x+(-.268 if ix==0 else .268),y,z),(.012,.39,.10),teal)
                if iy in (0,2):box('Window band',(x,y+(-.268 if iy==0 else .268),z),(.39,.012,.10),teal)
    for x,y,base,h in [(0,0,7.28,1.1),(.53,0,6.98,1.0)]:cone('Twin antenna',(x,y,base+h/2),.035,.02,h,trim,6)

def nyc():
    box('Pedestal base',(0,0,.16),(1.9,1.7,.32),paper,.08)
    box('Pedestal',(0,0,.74),(1.3,1.2,.9),paper,.05)
    box('Pedestal cornice',(0,0,1.24),(1.5,1.4,.16),trim,.04)
    for x in (-.42,0,.42):box('Pedestal front recess',(x,-.608,.73),(.18,.022,.50),bronze)
    cone('Flared robe',(0,0,2.1),.59,.32,1.6,copper,9)
    sphere('Draped shoulders',(0,0,2.9),.45,copper,(1.05,.65,.6))
    for x in (-.3,-.10,.12,.32):beam('Robe folds',(x*.6,-.22,2.75),(x,-.40,1.43),.055,copper)
    cone('Neck',(0,0,3.16),.13,.13,.2,copper,8)
    sphere('Face',(0,-.015,3.43),.25,copper,(.8,.85,1.16))
    cone('Crown band',(0,0,3.56),.26,.23,.10,copper,12)
    for i in range(7):
        a=math.pi*(i/6)
        beam('Seven crown rays',(.20*math.cos(a),-.03,3.57+.08*math.sin(a)),(.51*math.cos(a),-.03,3.57+.42*math.sin(a)),.05,copper)
    beam('Raised arm',(.31,0,2.95),(.59,0,3.60),.19,copper)
    beam('Raised forearm',(.59,0,3.60),(.71,0,4.08),.14,copper)
    cone('Torch bowl',(.71,0,4.18),.14,.24,.2,copper,10)
    sphere('Torch flame',(.71,0,4.43),.18,gold,(.75,.75,1.65))
    beam('Tablet arm',(-.36,0,2.91),(-.45,-.27,2.56),.19,copper)
    tab=box('Tablet',(-.42,-.36,2.66),(.38,.13,.57),copper,.025);tab.rotation_euler.y=-.17

def london():
    box('Clock tower footing',(0,0,.1),(1.25,1.25,.2),paper,.045)
    box('Gothic shaft',(0,0,2.1),(.96,.96,4),paper,.025)
    for x in (-.49,.49):
        for y in (-.49,.49):box('Corner buttress',(x,y,2.55),(.13,.13,4.9),trim,.015)
    for z in (.7,1.4,2.1,2.8,3.5):
        box('Storey cornice',(0,0,z),(1.02,1.02,.075),trim)
        for a in range(4):
            start=len(parts)
            for x in (-.23,.23):box('Lancet window',(x,-.489,z+.32),(.14,.014,.33),teal)
            transform_since(start,(0,0,0),a*math.pi/2)
    box('Clock stage',(0,0,4.35),(1.2,1.2,.85),paper,.035)
    for a in range(4):
        start=len(parts)
        o=cone('Clock brass bezel',(0,-.62,4.35),.39,.39,.06,gold,24);o.rotation_euler.x=math.pi/2
        o=cone('Ivory clock dial',(0,-.656,4.35),.335,.335,.018,trim,24);o.rotation_euler.x=math.pi/2
        beam('Minute hand',(0,-.673,4.35),(0,-.673,4.62),.036,dark)
        beam('Hour hand',(0,-.675,4.35),(.18,-.675,4.29),.045,dark)
        for k in range(12):
            t=2*math.pi*k/12
            box('Clock hour marker',(.287*math.sin(t),-.674,4.35+.287*math.cos(t)),(.03,.014,.045),dark)
        transform_since(start,(0,0,0),a*math.pi/2)
    box('Belfry cornice',(0,0,4.88),(1.32,1.32,.13),trim)
    box('Belfry',(0,0,5.14),(.90,.90,.42),teal,.025)
    roof=cone('Pyramidal spire',(0,0,5.80),.85,0,1.04,teal,4);roof.rotation_euler.z=math.pi/4
    cone('Finial',(0,0,6.48),.035,0,.34,gold,6)

def paris():
    levels=[(0,1.55),(1.25,1.08),(2.35,.77),(3.25,.48),(4.2,.32),(5.2,.19),(6.2,.12)]
    for sx in (-1,1):
        for sy in (-1,1):
            box('Stone foot',(sx*1.55,sy*1.55,.06),(.42,.42,.12),paper,.03)
            for k,((z0,r0),(z1,r1)) in enumerate(zip(levels,levels[1:])):
                beam('Curved tapering leg',(sx*r0,sy*r0,z0+.1),(sx*r1,sy*r1,z1+.1),.17 if k<2 else .095,bronze)
    for axis in range(2):
        for sign in (-1,1):
            start=len(parts)
            arch('Open base arch',0,sign*1.05,.72,1.02,.12,.13,bronze,12)
            if axis:transform_since(start,(0,0,0),math.pi/2)
            for k,((z0,r0),(z1,r1)) in enumerate(zip(levels,levels[1:])):
                if k==0:continue
                def p(u,r,z):return (u,sign*r,z) if axis==0 else (sign*r,u,z)
                beam('Lattice cross',p(-r0,r0,z0+.1),p(r1,r1,z1+.1),.06,bronze)
                beam('Lattice cross',p(r0,r0,z0+.1),p(-r1,r1,z1+.1),.06,bronze)
                beam('Lattice rail',p(-r1,r1,z1+.1),p(r1,r1,z1+.1),.07,bronze)
    for z,w in [(1.44,2.35),(2.45,1.72),(5.85,.55)]:
        box('Observation platform',(0,0,z),(w,w,.12),bronze,.018)
        for sign in (-1,1):
            box('Platform parapet',(sign*w/2,0,z+.11),(.055,w,.12),bronze)
            box('Platform parapet',(0,sign*w/2,z+.11),(w,.055,.12),bronze)
    cone('Needle',(0,0,6.65),.07,.018,.9,bronze,8)

def rome():
    cone('Oval foundation',(0,0,.08),2.25,2.25,.16,paper,40).scale.y=.76
    cone('Arena floor',(0,0,.18),1.65,1.65,.06,rose,32).scale.y=.76
    n=20
    for row in range(3):
        for i in range(n if row<2 else 12):
            a=2*math.pi*i/n;start=len(parts);base=.16+row*.72
            a0,a1=a-math.pi/n,a+math.pi/n
            p0=Vector((2*math.cos(a0),1.52*math.sin(a0),0));p1=Vector((2*math.cos(a1),1.52*math.sin(a1),0))
            half=(p1-p0).length/2;r=half-.072
            for x in (-half+.034,half-.034):box('Arcade pier',(x,0,base+.19),(.068,.26,.38),paper)
            arch('Open arcade',0,0,base+.36,r,.072,.26,paper,7)
            # Fill the space above each arch without a coplanar overlapping box.
            for j in range(7):
                x0=-half*math.cos(math.pi*j/7);x1=-half*math.cos(math.pi*(j+1)/7)
                def top_at(x):return base+.36+math.sqrt(max(0,half*half-x*x))
                verts=[(x0,-.13,top_at(x0)),(x1,-.13,top_at(x1)),(x1,-.13,base+.66),(x0,-.13,base+.66),(x0,.13,top_at(x0)),(x1,.13,top_at(x1)),(x1,.13,base+.66),(x0,.13,base+.66)]
                mesh('Arcade spandrel',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],paper)
            mid=(p0+p1)/2;transform_since(start,mid,math.atan2((p1-p0).y,(p1-p0).x))
            verts=[]
            for z in (base+.655,base+.745):
                for rr,aa in [(1.82,a0),(2.18,a0),(2.18,a1),(1.82,a1)]:verts.append((rr*math.cos(aa),rr*.76*math.sin(aa),z))
            mesh('Continuous elliptical cornice',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],trim)

def istanbul():
    box('Terraced foundation',(0,0,.10),(3.8,3.1,.20),paper,.045)
    box('Rose masonry',(0,0,.68),(2.9,2.3,1.2),rose,.035)
    for x in (-1.45,1.45):
        for y in (-.9,.9):box('Buttress',(x,y,.85),(.28,.34,1.5),paper,.03)
    for x in (-1.13,1.13):dome('Shoulder half dome',(x,0,1.30),.85,.62,teal)
    cone('Central drum',(0,0,1.68),1.10,1.10,.50,paper,16)
    dome('Great central dome',(0,0,1.92),1.19,.94,teal)
    cone('Dome finial',(0,0,2.95),.045,0,.24,gold,6)
    for x in (-1.76,1.76):
        for y in (-1.35,1.35):
            cone('Minaret base',(x,y,.38),.21,.16,.76,paper,8)
            cone('Minaret shaft',(x,y,1.72),.115,.085,2.1,paper,10)
            cone('Balcony',(x,y,2.36),.17,.17,.10,trim,10)
            cone('Minaret cap',(x,y,3.05),.14,0,.60,teal,10)
    for x in (-.85,-.42,0,.42,.85):
        box('Arched window recess',(x,-1.166,.82),(.19,.02,.4),teal)
        arch('Window arch',x,-1.18,1.02,.095,.035,.025,paper,6)

def dubai():
    cone('Podium',(0,0,.12),1.22,1.16,.24,paper,12)
    for k in range(11):
        z=.24+k*.57;r=.42*(1-k*.067)
        cone('Setback core',(0,0,z+.29),r,r*.96,.58,silver,12)
        for a in range(3):
            extent=max(.13,.91-k*.074-(a*.055 if k%3==a else 0))
            start=len(parts)
            box('Y plan wing',(0,extent*.40,z+.28),(r*1.06,extent,.56),silver,.035)
            box('Glazing ribbon',(0,extent*.40,z+.32),(r*1.10,extent+.014,.055),teal)
            box('Setback ledge',(0,extent*.40,z+.56),(r*1.15,extent+.04,.035),trim)
            transform_since(start,(0,0,0),a*2*math.pi/3)
    cone('Upper mast',(0,0,6.96),.11,.05,.98,silver,8)
    cone('Needle',(0,0,7.8),.045,.006,.75,trim,6)

def delhi():
    box('Plinth',(0,0,.09),(3.35,1.62,.18),paper,.045)
    for x in (-1.12,1.12):
        box('Monument pier',(x,0,1.10),(.73,1.12,2.0),rose,.04)
        for y in (-.58,.58):
            box('Pier pilaster',(x,y,1.17),(.49,.12,1.75),paper,.025)
            box('Pier capital',(x,y,2.05),(.66,.17,.16),paper,.018)
    arch('Open central passage',0,0,1.51,.755,.30,1.12,rose,14)
    box('Entablature',(0,0,2.69),(3.2,1.32,.38),rose,.03)
    box('Upper cornice',(0,0,2.93),(3.4,1.47,.14),paper,.025)
    box('Attic',(0,0,3.15),(2.65,1.1,.31),rose,.03)
    text('INDIA inscription','INDIA',(0,-.673,2.64),.20,paper)
    cone('Top ceremonial bowl',(0,0,3.42),.43,.49,.16,paper,16)

def shanghai():
    cone('Circular podium',(0,0,.09),1.05,1.05,.18,paper,20)
    for k in range(3):
        a=k*2*math.pi/3
        beam('Tripod support',(.88*math.cos(a),.88*math.sin(a),.12),(.24*math.cos(a),.24*math.sin(a),2.20),.16,silver)
    cone('Central shaft',(0,0,3.69),.23,.10,4.62,silver,12)
    for z,r in [(2.0,.82),(4.83,.56),(5.9,.22)]:
        sphere('Pearl observation sphere',(0,0,z),r,pearl)
        cone('Equatorial glazing',(0,0,z),r*1.005,r*1.005,r*.17,teal,24)
        for dz in (-.11,.11):cone('Sphere silver collar',(0,0,z+dz*r),r*.997,r*.997,.025,silver,24)
    cone('Antenna base',(0,0,6.22),.10,.06,.52,silver,10)
    cone('Spire',(0,0,6.82),.042,.005,.76,silver,6)

def cottage(style):
    # Three distinct silhouettes; palette shared across all instances.
    w,d,h=[(1.55,1.35,1.45),(1.30,1.30,1.85),(1.75,1.25,1.30)][style]
    box('Cottage walls',(0,0,h/2),(w,d,h),paper,.035)
    box('Foundation',(0,0,.07),(w+.08,d+.08,.14),trim,.025)
    if style!=2:
        verts=[(-w*.58,-d*.59,h),(w*.58,-d*.59,h),(0,-d*.59,h+.66),(-w*.58,d*.59,h),(w*.58,d*.59,h),(0,d*.59,h+.66)]
        mesh('Gabled roof',verts,[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],teal)
        box('Chimney',(.42,.15,h+.53),(.18,.21,.58),rose,.018)
    else:
        box('Flat roof',(0,0,h+.07),(w+.16,d+.16,.14),teal,.035)
        box('Roof pavilion',(.32,.12,h+.31),(.61,.7,.48),paper,.03)
        box('Pavilion cap',(.32,.12,h+.58),(.72,.82,.09),teal,.015)
    box('Front door',(0,-d/2-.012,.38),(.29,.035,.66),teal,.012)
    box('Doorstep',(0,-d/2-.11,.07),(.45,.25,.14),trim,.02)
    for x in (-w*.30,w*.30):
        for z in ([.83,1.48] if style==1 else [.84]):
            box('Window frame',(x,-d/2-.025,z),(.32,.065,.39),trim,.012)
            box('Window glass',(x,-d/2-.062,z),(.24,.014,.29),teal)
    if style==2:
        box('Shop awning',(0,-d/2-.20,1.17),(1.25,.47,.10),rose,.015)

def export_mesh(objects,target_height):
    bpy.context.view_layer.update()
    top=max((o.matrix_world@v.co).z for o in objects for v in o.data.vertices)
    source_radius=max(math.hypot((o.matrix_world@v.co).x,(o.matrix_world@v.co).y) for o in objects for v in o.data.vertices)
    scale=min(target_height/top,.050/source_radius)
    result=[];radius=0
    for material in dict.fromkeys(o.data.materials[0] for o in objects):
        pos=[];norm=[];idx=[];cache={}
        for obj in objects:
            if obj.data.materials[0]!=material:continue
            obj.data.calc_loop_triangles();nm=obj.matrix_world.to_3x3().inverted().transposed()
            for tri in obj.data.loop_triangles:
                n=(nm@tri.normal).normalized()
                for vi in tri.vertices:
                    v=obj.matrix_world@obj.data.vertices[vi].co
                    radius=max(radius,math.hypot(v.x,v.y)*scale)
                    vp=tuple(round(a*scale,7) for a in (v.x,v.z,-v.y));vn=tuple(round(a,6) for a in (n.x,n.z,-n.y));key=vp+vn
                    if key not in cache:cache[key]=len(pos)//3;pos.extend(vp);norm.extend(vn)
                    idx.append(cache[key])
        rgb=[12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055 for c in material.diffuse_color[:3]]
        result.append(dict(name=material.name,color='#'+''.join(f'{round(c*255):02x}' for c in rgb),positions=pos,normals=norm,indices=idx))
    return dict(height=round(top*scale,6),radius=round(radius,6),parts=result)

def glb_export(objects,key):
    merged=[]
    for material in dict.fromkeys(o.data.materials[0] for o in objects):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            if obj.data.materials[0]!=material:continue
            copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy)
            copy.select_set(True);bpy.context.view_layer.objects.active=copy
        bpy.ops.object.join();merged.append(bpy.context.object)
    bpy.ops.object.select_all(action='DESELECT')
    for o in merged:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),use_selection=True,export_apply=True)
    for o in merged:bpy.data.objects.remove(o,do_unlink=True)

builders=[('la','HOLLYWOOD',la,.038),('chicago','WILLIS TOWER',chicago,.125),('nyc','LIBERTY',nyc,.097),('london','BIG BEN',london,.110),('paris','EIFFEL TOWER',paris,.128),('rome','COLOSSEUM',rome,.039),('istanbul','HAGIA SOPHIA',istanbul,.066),('dubai','BURJ KHALIFA',dubai,.145),('delhi','INDIA GATE',delhi,.077),('shanghai','ORIENTAL PEARL',shanghai,.114)]
for style in range(3):builders.append(('cottage-'+str(style),['GABLE HOUSE','TOWN HOUSE','CORNER SHOP'][style],lambda s=style:cottage(s),.048))

for key,title,fn,height in builders:
    start=len(parts);fn();objects=parts[start:];bpy.context.view_layer.update()
    assets[key]=export_mesh(objects,height);glb_export(objects,key)
    collection=bpy.data.collections.new(title);scene.collection.children.link(collection)
    for o in objects:
        for col in list(o.users_collection):col.objects.unlink(o)
        collection.objects.link(o)
    all_models.append((key,title,objects))

(ROOT/'lib/three/assets/city-buildings.json').write_text(json.dumps(assets,separators=(',',':')))
stats={key:dict(triangles=sum(len(p['indices'])//3 for p in a['parts']),materialGroups=len(a['parts']),height=a['height'],radius=a['radius']) for key,a in assets.items()}
(OUT/'building-stats.json').write_text(json.dumps(stats,indent=2))

# Arrange a contact sheet, with each model fitted to the same display tile.
# Mesh/GLB exports above retain centered origins and original authoring scales.
for index,(key,title,objects) in enumerate(all_models):
    col=index%5;row=index//5;offset=Vector(((col-2)*7,(1-row)*8,0))
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    height=max(v.z for v in points);width=max(v.x for v in points)-min(v.x for v in points)
    s=min(5.7/height,5.2/max(width,1))
    m=Matrix.Translation(offset)@Matrix.Scale(s,4)
    for o in objects:o.matrix_world=m@o.matrix_world
    box('Display tile',(offset.x,offset.y,-.18),(6.5,6.8,.30),paper,.10)
    text('Model label',title,(offset.x,offset.y-3.1,.05),.31,dark).rotation_euler=(0,0,0)
floor_mat=mat('Studio backdrop','#426e69')
box('Studio floor',(0,0,-.42),(200,200,.15),floor_mat)
bpy.ops.object.camera_add(location=(21,-38,39))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=46;scene.camera=camera
for loc,power,size in [((0,-12,24),6000,15),((-19,-3,15),3800,12),((10,16,24),7000,12)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Architecture studio');scene.world.color=(.4,.4,.4)
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=2400;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'world-buildings-preview.png')
if bpy.context.area and bpy.context.area.type=='CONSOLE':
    area=bpy.context.area;area.type='VIEW_3D'
    area.spaces.active.region_3d.view_perspective='CAMERA'
    area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'world-buildings.blend'))
bpy.ops.render.render(write_still=True)
print('CITY_BUILDINGS_READY',stats)
