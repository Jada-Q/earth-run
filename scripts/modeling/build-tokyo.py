"""Run with Blender --background --python scripts/modeling/build-tokyo.py -- OUTPUT_DIR.
Produces editable Blender source, GLB, and dependency-free Three.js mesh data.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
# Work in a separate scene so an existing desktop scene is preserved.
bpy.context.window.scene = bpy.data.scenes.new('Earth Run - Tokyo Tower')

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .76
    return m

orange = material('Vermilion', (.64, .17, .065))
ivory = material('Warm ivory', (.89, .87, .79))
glass = material('Teal windows', (.045, .16, .18))
stone = material('Foundation', (.36, .43, .39))
parts = []

def box(name, loc, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod = o.modifiers.new('Small crafted edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(o)
    return o

def beam(name, a, b, width, mat):
    a, b = Vector(a), Vector(b)
    o = box(name, (a+b)/2, (width,width,(b-a).length), mat)
    o.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    return o

# Meters here are design units. The exported game tower is 0.13 units high.
levels = [(0,1.55),(1.0,1.19),(2.1,.85),(3.35,.59),(4.45,.45),(5.65,.31),(6.7,.20),(7.55,.12)]
for sx in (-1,1):
    for sy in (-1,1):
        box('Beveled concrete foot', (sx*1.55,sy*1.55,.08), (.54,.54,.16),stone,.045)
        for k, ((z0,r0),(z1,r1)) in enumerate(zip(levels,levels[1:])):
            beam('Continuous tapering corner', (sx*r0,sy*r0,z0+.15), (sx*r1,sy*r1,z1+.15), .16 if k<3 else .105, orange if k%3!=1 else ivory)

# Four open faces. The entrance tier stays clear; diagonals start above it.
for k, ((z0,r0),(z1,r1)) in enumerate(zip(levels,levels[1:])):
    z0 += .15; z1 += .15
    mat = ivory if k in (3,5) else orange
    for axis in (0,1):
        for sign in (-1,1):
            def p(u,r,z):
                return (u,sign*r,z) if axis==0 else (sign*r,u,z)
            beam('Horizontal lattice rail',p(-r1,r1,z1),p(r1,r1,z1),.085,mat)
            if k>0:
                beam('Cross brace A',p(-r0,r0,z0),p(r1,r1,z1),.063,mat)
                beam('Cross brace B',p(r0,r0,z0),p(-r1,r1,z1),.063,mat)

# Main deck has overhangs and continuous dark windows, readable at game distance.
for name,z,w,h,mat in [('Main lower rim',3.37,1.67,.12,ivory),('Observation glazing',3.57,1.48,.28,glass),('Main roof',3.76,1.74,.13,ivory),('Upper lower rim',6.80,.78,.10,ivory),('Upper glazing',6.96,.65,.22,glass),('Upper roof',7.13,.80,.10,ivory)]:
    box(name,(0,0,z),(w,w,h),mat,.025)
for sx in (-1,1):
    for sy in (-1,1):
        box('Main deck corner mullion',(sx*.71,sy*.71,3.57),(.07,.07,.29),orange)
for i in range(5):
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=.105-i*.015, radius2=.09-i*.015, depth=.39, location=(0,0,7.78+i*.39))
    o=bpy.context.object; o.name='Banded antenna'; o.data.materials.append(orange if i%2==0 else ivory); parts.append(o)

def export_data(objects, scale=1):
    result=[]
    # Bake transforms and split by material; one mesh per color, no runtime loader.
    for mat in dict.fromkeys(o.data.materials[0] for o in objects):
        positions=[]; normals=[]; indices=[]; vertices={}
        for obj in objects:
            if obj.data.materials[0]!=mat: continue
            mesh=obj.data; mesh.calc_loop_triangles()
            normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
            for tri in mesh.loop_triangles:
                n=(normal_matrix @ tri.normal).normalized()
                for vi in tri.vertices:
                    v=obj.matrix_world @ mesh.vertices[vi].co
                    vp=tuple(round(a*scale,7) for a in (v.x,v.z,-v.y))
                    vn=tuple(round(a,6) for a in (n.x,n.z,-n.y))
                    key=vp+vn
                    if key not in vertices:
                        vertices[key]=len(positions)//3
                        positions.extend(vp); normals.extend(vn)
                    indices.append(vertices[key])
        rgb=mat.diffuse_color[:3]
        srgb=[12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055 for c in rgb]
        result.append(dict(name=mat.name,color='#'+''.join(f'{round(c*255):02x}' for c in srgb),positions=positions,normals=normals,indices=indices))
    return result

bpy.context.view_layer.update()
data=export_data(parts,.13/9.535)
asset=ROOT/'lib/three/assets/tokyo-tower.json'
asset.write_text(json.dumps(data,separators=(',',':')))
(OUT/'tokyo-tower-mesh.json').write_text(asset.read_text())
bpy.ops.object.select_all(action='DESELECT')
export_objects=[]
for mat in dict.fromkeys(o.data.materials[0] for o in parts):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        if o.data.materials[0]!=mat: continue
        copy=o.copy(); copy.data=o.data.copy(); bpy.context.collection.objects.link(copy)
        copy.select_set(True); bpy.context.view_layer.objects.active=copy
    bpy.ops.object.join()
    obj=bpy.context.object; obj.name=mat.name+' merged export'; export_objects.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for o in export_objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'tokyo-tower.glb'),use_selection=True,export_apply=True)
for o in export_objects: bpy.data.objects.remove(o,do_unlink=True)

# Studio setup is excluded from game/GLB exports, retained in the .blend file.
floor=box('Studio floor',(0,0,-.16),(200,200,.12),material('Studio mint',(.20,.44,.39)))
bpy.ops.object.camera_add(location=(13,-18,12))
cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,4.6))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=12.2
bpy.context.scene.camera=cam
for loc,power,size in [((5,-8,14),1900,8),((-7,-3,9),1200,7),((3,7,12),1700,6)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,4))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.world=bpy.data.worlds.new('Tokyo studio world')
scene.world.color=(.35,.35,.35)
scene.render.resolution_x=1200; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(OUT/'tokyo-tower-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tokyo-tower.blend'))
bpy.ops.render.render(write_still=True)
stats={'triangles':sum(len(m['indices'])//3 for m in data),'materialGroups':len(data),'gameHeight':.13,'sourceHeight':9.535,'gameScale':.13/9.535}
(OUT/'model-stats.json').write_text(json.dumps(stats,indent=2))
print('MODEL_STATS',stats)
