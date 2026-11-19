# -*- coding: utf-8 -*-
"""
Sky Whale / 云海鲸歌  —— 纯程序化 Blender 场景

用法:
    blender -b --python build_scene.py -- --res 1280x720 --samples 64 \
            --out renders/sky_whale.png --blend build/sky_whale.blend

所有几何体均由脚本生成，不依赖任何外部素材。
"""

import bpy
import bmesh
import math
import os
import sys
import random
from mathutils import Vector, Matrix, Euler, noise

# ----------------------------------------------------------------------------
# CLI 参数
# ----------------------------------------------------------------------------
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    if name in ARGV and ARGV.index(name) + 1 < len(ARGV):
        return ARGV[ARGV.index(name) + 1]
    return default


RES_W, RES_H = (int(v) for v in arg("--res", "1280x720").lower().split("x"))
SAMPLES = int(arg("--samples", "64"))
OUT_PNG = os.path.abspath(arg("--out", "renders/sky_whale.png"))
OUT_BLEND = os.path.abspath(arg("--blend", "build/sky_whale.blend"))
SEED = int(arg("--seed", "11"))

random.seed(SEED)

TAU = math.pi * 2.0

# 调色方案：A 紫夜 / B 冷蓝极夜 / C 暖金黄昏
PALETTES = {
    "A": dict(
        sky=[("#2b1c42", 0.30), ("#0d1533", 0.52), ("#05091a", 0.78), ("#02040b", 1.00)],
        nebula="#4a2a6a", world="#05070f", world_strength=0.42, exposure=0.45,
        key="#ffe2bd", rim="#7fe4ff", fill="#8f7dff", bounce="#ffab6a",
        cloud=("#a894c2", 0.06), star="#e8f3ff", spark="#a6f4ff"),
    "B": dict(
        sky=[("#0e2a44", 0.28), ("#0a1a33", 0.55), ("#050c1c", 0.80), ("#01030a", 1.00)],
        nebula="#1b4a6b", world="#040a14", world_strength=0.38, exposure=0.42,
        key="#cfe9ff", rim="#3fd0ff", fill="#3d6dff", bounce="#2fa8ff",
        cloud=("#8fa6c4", 0.05), star="#dff2ff", spark="#8ce9ff"),
    "C": dict(
        sky=[("#5a3320", 0.30), ("#33191a", 0.55), ("#1a0d12", 0.80), ("#0a0508", 1.00)],
        nebula="#6b3a24", world="#140a0a", world_strength=0.40, exposure=0.52,
        key="#ffc07a", rim="#ff8a4c", fill="#c85a2a", bounce="#ffd08a",
        cloud=("#d8a98a", 0.08), star="#ffe9cf", spark="#ffc48a"),
}
MOOD = arg("--mood", "A").upper()
PAL = PALETTES.get(MOOD, PALETTES["A"])


# ----------------------------------------------------------------------------
# 小工具
# ----------------------------------------------------------------------------
def hexc(s, a=1.0):
    """#rrggbb -> 线性空间 RGBA"""
    s = s.lstrip("#")
    r, g, b = (int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4))

    def srgb2lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (srgb2lin(r), srgb2lin(g), srgb2lin(b), a)


def smoothstep(a, b, x):
    if b == a:
        return 0.0 if x < a else 1.0
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def curve_val(pts, t):
    """分段 smoothstep 插值，pts = [(x, y), ...] 按 x 升序"""
    if t <= pts[0][0]:
        return pts[0][1]
    if t >= pts[-1][0]:
        return pts[-1][1]
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        if x0 <= t <= x1:
            u = (t - x0) / (x1 - x0)
            u = u * u * (3.0 - 2.0 * u)
            return y0 + (y1 - y0) * u
    return pts[-1][1]


def new_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def link_to(obj, col):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def mesh_from_bmesh(name, bm, col=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    (col or bpy.context.scene.collection).objects.link(ob)
    return ob


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects,
                  bpy.data.metaballs, bpy.data.lights, bpy.data.cameras):
        for b in list(block):
            block.remove(b)


# ----------------------------------------------------------------------------
# 材质
# ----------------------------------------------------------------------------
def _new_mat(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (700, 0)
    return mat, nt, out


def mat_whale():
    mat, nt, out = _new_mat("M_Whale")
    n = nt.nodes
    L = nt.links

    tex = n.new("ShaderNodeTexCoord"); tex.location = (-1200, 200)
    sep = n.new("ShaderNodeSeparateXYZ"); sep.location = (-1000, 200)
    L.new(tex.outputs["Generated"], sep.inputs["Vector"])

    grad = n.new("ShaderNodeValToRGB"); grad.location = (-780, 320)
    L.new(sep.outputs["Z"], grad.inputs["Fac"])
    ramp = grad.color_ramp
    ramp.elements[0].position = 0.03
    ramp.elements[0].color = hexc("#ffffff")
    ramp.elements[1].position = 0.28
    ramp.elements[1].color = hexc("#b9d6ef")
    e = ramp.elements.new(0.50); e.color = hexc("#4c86bd")
    e = ramp.elements.new(0.72); e.color = hexc("#28558c")
    e = ramp.elements.new(0.95); e.color = hexc("#132c52")

    # 皮肤斑驳
    nz = n.new("ShaderNodeTexNoise"); nz.location = (-780, -40)
    nz.inputs["Scale"].default_value = 5.5
    nz.inputs["Detail"].default_value = 6.0
    nz.inputs["Roughness"].default_value = 0.55
    L.new(tex.outputs["Object"], nz.inputs["Vector"])
    nzr = n.new("ShaderNodeValToRGB"); nzr.location = (-560, -40)
    nzr.color_ramp.elements[0].position = 0.35
    nzr.color_ramp.elements[0].color = hexc("#7d8fae")
    nzr.color_ramp.elements[1].position = 0.68
    nzr.color_ramp.elements[1].color = hexc("#ffffff")
    L.new(nz.outputs["Fac"], nzr.inputs["Fac"])

    mix = n.new("ShaderNodeMixRGB"); mix.location = (-330, 220)
    mix.blend_type = "OVERLAY"
    mix.inputs["Fac"].default_value = 0.28
    L.new(grad.outputs["Color"], mix.inputs["Color1"])
    L.new(nzr.outputs["Color"], mix.inputs["Color2"])

    # 发光斑点：Voronoi 距离 -> 阈值掩码
    vor = n.new("ShaderNodeTexVoronoi"); vor.location = (-780, -360)
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 8.5
    vor.inputs["Randomness"].default_value = 1.0
    L.new(tex.outputs["Object"], vor.inputs["Vector"])
    spot = n.new("ShaderNodeValToRGB"); spot.location = (-560, -360)
    spot.color_ramp.interpolation = "CONSTANT"
    spot.color_ramp.elements[0].position = 0.0
    spot.color_ramp.elements[0].color = (1, 1, 1, 1)
    spot.color_ramp.elements[1].position = 0.10
    spot.color_ramp.elements[1].color = (0, 0, 0, 1)
    L.new(vor.outputs["Distance"], spot.inputs["Fac"])

    # 斑点只长在腹部/侧面
    zone = n.new("ShaderNodeValToRGB"); zone.location = (-780, -600)
    zone.color_ramp.elements[0].position = 0.08
    zone.color_ramp.elements[0].color = (1, 1, 1, 1)
    zone.color_ramp.elements[1].position = 0.40
    zone.color_ramp.elements[1].color = (0, 0, 0, 1)
    L.new(sep.outputs["Z"], zone.inputs["Fac"])

    mul = n.new("ShaderNodeMath"); mul.location = (-330, -450)
    mul.operation = "MULTIPLY"
    L.new(spot.outputs["Color"], mul.inputs[0])
    L.new(zone.outputs["Color"], mul.inputs[1])

    nz2 = n.new("ShaderNodeTexNoise"); nz2.location = (-780, -760)
    nz2.inputs["Scale"].default_value = 46.0
    nz2.inputs["Detail"].default_value = 7.0
    nz2.inputs["Roughness"].default_value = 0.6
    L.new(tex.outputs["Object"], nz2.inputs["Vector"])
    skin_bump = n.new("ShaderNodeBump"); skin_bump.location = (-140, -640)
    skin_bump.inputs["Strength"].default_value = 0.45
    skin_bump.inputs["Distance"].default_value = 0.08
    L.new(nz2.outputs["Fac"], skin_bump.inputs["Height"])

    bsdf = n.new("ShaderNodeBsdfPrincipled"); bsdf.location = (60, 160)
    bsdf.inputs["Roughness"].default_value = 0.38
    L.new(skin_bump.outputs["Normal"], bsdf.inputs["Normal"])
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.55
    L.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    emi = n.new("ShaderNodeEmission"); emi.location = (60, -260)
    emi.inputs["Color"].default_value = hexc("#9ff0ff")
    emi.inputs["Strength"].default_value = 2.2

    mixs = n.new("ShaderNodeMixShader"); mixs.location = (420, 0)
    L.new(mul.outputs["Value"], mixs.inputs["Fac"])
    L.new(bsdf.outputs["BSDF"], mixs.inputs[1])
    L.new(emi.outputs["Emission"], mixs.inputs[2])
    L.new(mixs.outputs["Shader"], out.inputs["Surface"])
    return mat


def mat_rock():
    mat, nt, out = _new_mat("M_Rock")
    n, L = nt.nodes, nt.links
    tex = n.new("ShaderNodeTexCoord"); tex.location = (-900, 0)
    nz = n.new("ShaderNodeTexNoise"); nz.location = (-700, 100)
    nz.inputs["Scale"].default_value = 2.4
    nz.inputs["Detail"].default_value = 8.0
    L.new(tex.outputs["Object"], nz.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); ramp.location = (-480, 100)
    ramp.color_ramp.elements[0].color = hexc("#4a3f57")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].color = hexc("#8d7a8e")
    ramp.color_ramp.elements[1].position = 0.72
    L.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    bump = n.new("ShaderNodeBump"); bump.location = (-220, -140)
    bump.inputs["Strength"].default_value = 0.45
    L.new(nz.outputs["Fac"], bump.inputs["Height"])
    bsdf = n.new("ShaderNodeBsdfPrincipled"); bsdf.location = (60, 0)
    bsdf.inputs["Roughness"].default_value = 0.88
    L.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def mat_grass():
    mat, nt, out = _new_mat("M_Grass")
    n, L = nt.nodes, nt.links
    tex = n.new("ShaderNodeTexCoord"); tex.location = (-900, 0)
    nz = n.new("ShaderNodeTexNoise"); nz.location = (-700, 80)
    nz.inputs["Scale"].default_value = 7.0
    nz.inputs["Detail"].default_value = 5.0
    L.new(tex.outputs["Object"], nz.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); ramp.location = (-470, 80)
    ramp.color_ramp.elements[0].color = hexc("#16302a")
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[1].color = hexc("#356350")
    ramp.color_ramp.elements[1].position = 0.75
    L.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    bsdf = n.new("ShaderNodeBsdfPrincipled"); bsdf.location = (60, 0)
    bsdf.inputs["Roughness"].default_value = 0.97
    L.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def mat_tree():
    mat, nt, out = _new_mat("M_Tree")
    n = nt.nodes
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = hexc("#43805f")
    bsdf.inputs["Roughness"].default_value = 0.75
    bsdf.inputs["Emission Color"].default_value = hexc("#2f6f52")
    bsdf.inputs["Emission Strength"].default_value = 0.10
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def mat_cloud(tint="#efe2f7", glow=0.35):
    mat, nt, out = _new_mat("M_Cloud")
    n, L = nt.nodes, nt.links
    bsdf = n.new("ShaderNodeBsdfPrincipled"); bsdf.location = (60, 0)
    bsdf.inputs["Base Color"].default_value = hexc(tint)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Emission Color"].default_value = hexc("#c9a8e8")
    bsdf.inputs["Emission Strength"].default_value = glow
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def mat_emissive(name, color, strength):
    mat, nt, out = _new_mat(name)
    n = nt.nodes
    emi = n.new("ShaderNodeEmission")
    emi.inputs["Color"].default_value = hexc(color)
    emi.inputs["Strength"].default_value = strength
    nt.links.new(emi.outputs["Emission"], out.inputs["Surface"])
    return mat


# ----------------------------------------------------------------------------
# 鲸鱼
# ----------------------------------------------------------------------------
WHALE_LEN = 16.0

# (t, 半径) —— t=0 尾尖, t=1 吻端
BODY_PROFILE = [
    (0.000, 0.075),
    (0.020, 0.130),
    (0.060, 0.150),
    (0.110, 0.255),
    (0.180, 0.400),
    (0.270, 0.585),
    (0.360, 0.760),
    (0.450, 0.910),
    (0.540, 1.040),
    (0.620, 1.135),
    (0.700, 1.190),
    (0.770, 1.200),
    (0.830, 1.160),
    (0.880, 1.060),
    (0.920, 0.980),
    (0.950, 0.880),
    (0.972, 0.700),
    (0.988, 0.450),
    (0.997, 0.200),
    (1.000, 0.060),
]


def b_x(t):
    return -WHALE_LEN * 0.5 + WHALE_LEN * t


def b_z(t):
    return 0.60 * math.sin(math.pi * t) - 0.30


def b_y(t):
    return 0.50 * math.sin(TAU * t * 0.9) * smoothstep(0.0, 0.25, t)


def b_r(t):
    return curve_val(BODY_PROFILE, t)


def b_w(t):
    """横向比例（鲸类侧扁）"""
    return 0.58 + 0.05 * math.sin(math.pi * t)


def b_h(t):
    """竖向比例，头部略扁"""
    return 1.0 - 0.20 * smoothstep(0.70, 1.0, t)


def build_body(col, mat):
    N_RING, M = 190, 72
    bm = bmesh.new()
    rings = []
    for i in range(N_RING):
        t = (i + 0.5) / N_RING
        r, w, h = b_r(t), b_w(t), b_h(t)
        cx, cy, cz = b_x(t), b_y(t), b_z(t)
        ring = []
        for j in range(M):
            a = TAU * j / M
            zz, yy = math.sin(a), math.cos(a)
            if zz < 0.0:          # 腹部稍平
                zz *= 0.86
            rr = r
            if t > 0.66:                      # 口腔缝：沿体侧下缘的一道浅沟
                groove = math.exp(-((zz + 0.46) ** 2) / 0.010)
                rr *= 1.0 - 0.060 * groove * smoothstep(0.66, 0.78, t)
            px = cx
            py = cy + rr * w * yy
            pz = cz + rr * h * zz
            # 极轻微有机起伏
            n = noise.noise(Vector((px * 0.42, py * 0.42, pz * 0.42)))
            ring.append(bm.verts.new((px + n * 0.05, py + n * 0.05, pz + n * 0.05)))
        rings.append(ring)

    for i in range(N_RING - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(M):
            bm.faces.new((a[j], a[(j + 1) % M], b[(j + 1) % M], b[j]))

    tail = bm.verts.new((b_x(0.0) - 0.10, b_y(0.0), b_z(0.0)))
    head = bm.verts.new((b_x(1.0) + 0.10, b_y(1.0), b_z(1.0)))
    for j in range(M):
        bm.faces.new((tail, rings[0][(j + 1) % M], rings[0][j]))
        bm.faces.new((head, rings[-1][j], rings[-1][(j + 1) % M]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bmesh("Whale_Body", bm, col)
    ob.data.materials.append(mat)
    return ob


def blade(col, name, origin, span_dir, chord_dir, span, chord, sweep,
          thick, mat, subdiv=(26, 14), camber=0.10):
    """鳍片：由平面网格 + Solidify 厚度构成"""
    su = Vector(span_dir).normalized()
    sc = Vector(chord_dir).normalized()
    sn = su.cross(sc).normalized()
    o = Vector(origin)

    bm = bmesh.new()
    grid = {}
    NU, NV = subdiv
    for i in range(NU + 1):
        u = i / NU
        ch = chord * (1.0 - u) ** 0.85 + chord * 0.09
        x0 = -sweep * u ** 1.4
        for j in range(NV + 1):
            v = j / NV
            d = x0 + ch * v
            h = span * u
            lift = (camber * chord * math.sin(math.pi * v) * (1.0 - 0.6 * u)
                    + 0.03 * chord * math.sin(math.pi * u))
            p = o + sc * d + su * h + sn * lift
            grid[(i, j)] = bm.verts.new(p)

    for i in range(NU):
        for j in range(NV):
            bm.faces.new((grid[(i, j)], grid[(i + 1, j)],
                          grid[(i + 1, j + 1)], grid[(i, j + 1)]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bmesh(name, bm, col)
    ob.data.materials.append(mat)

    mod = ob.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = thick
    mod.offset = 0.0
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def build_fins(col, mat):
    fins = []
    # 尾鳍（两片）
    tz = 0.45
    for s in (1, -1):
        fins.append(blade(
            col, f"Whale_Fluke_{'R' if s > 0 else 'L'}",
            origin=(-WHALE_LEN * 0.5 + 0.30, 0.0, b_z(0.0) - 0.02),
            span_dir=(0.0, s * 1.0, s * 0.10),
            chord_dir=(-1.0, 0.0, 0.0),
            span=3.00, chord=1.70, sweep=1.30, thick=0.13, mat=mat,
            camber=0.10))

    # 胸鳍（两片）
    t = 0.70
    fx = b_x(t)
    fz = b_z(t) - b_r(t) * 0.45
    fy = b_r(t) * b_w(t) * 0.90
    for s in (1, -1):
        fins.append(blade(
            col, f"Whale_Flipper_{'R' if s > 0 else 'L'}",
            origin=(fx, s * fy, fz),
            span_dir=(0.30, s * 0.86, -0.62),
            chord_dir=(-0.90, s * 0.12, -0.24),
            span=2.90, chord=1.75, sweep=1.25, thick=0.12, mat=mat,
            camber=0.14))

    # 背鳍
    t = 0.56
    fins.append(blade(
        col, "Whale_Dorsal",
        origin=(b_x(t) - 0.35, b_y(t), b_z(t) + b_r(t) * 0.86),
        span_dir=(0.10, 0.0, 1.0),
        chord_dir=(-1.0, 0.0, 0.0),
        span=0.95, chord=1.30, sweep=0.75, thick=0.10, mat=mat,
        camber=0.06))

    return fins


def build_eye(col, mat):
    t = 0.925
    for s in (1, -1):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=24, ring_count=12, radius=0.16,
            location=(b_x(t) - 0.10, s * b_r(t) * b_w(t) * 0.86,
                      b_z(t) + b_r(t) * 0.16))
        ob = bpy.context.object
        ob.name = f"Whale_Eye_{'R' if s > 0 else 'L'}"
        ob.data.materials.append(mat)
        link_to(ob, col)


def build_whale():
    col = new_collection("Whale")
    skin = mat_whale()
    eye_mat = mat_emissive("M_Eye", "#c8fbff", 12.0)
    body = build_body(col, skin)
    fins = build_fins(col, skin)
    build_eye(col, eye_mat)

    # 整体轻微姿态：绕 Y 轴倾斜、按 Z 轴转向
    root = bpy.data.objects.new("Whale_Root", None)
    root.empty_display_size = 1.5
    col.objects.link(root)
    for ob in [body] + fins:
        ob.parent = root
    root.rotation_euler = Euler((math.radians(4.0), math.radians(-7.0),
                                 math.radians(-6.0)), "XYZ")
    root.location = (0.0, 0.0, 0.0)
    return root


# ----------------------------------------------------------------------------
# 浮空岛
# ----------------------------------------------------------------------------
def icosphere_bm(subdiv=4, radius=1.0):
    bm = bmesh.new()
    try:
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    except TypeError:
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, diameter=radius)
    return bm


def make_island(loc, radius, height, seed, rock_mat, grass_mat, tree_count=0, tree_mat=None):
    tree_mat = tree_mat or grass_mat
    col = new_collection(f"Island_{seed}")
    bm = icosphere_bm(5, 1.0)
    for v in bm.verts:
        p = v.co.normalized()
        n1 = noise.noise(p * 1.2 + Vector((seed * 3.1, seed * 1.7, seed * 2.3)))
        n2 = noise.noise(p * 3.4 + Vector((seed * 0.7, seed * 2.9, seed * 1.3)))
        n3 = noise.noise(p * 8.5 + Vector((seed * 1.3, seed * 0.5, seed * 2.7)))
        strata = 0.020 * math.sin(p.z * 24.0 + n2 * 2.2)
        r = 1.0 + n1 * 0.18 + n2 * 0.075 + n3 * 0.028 + strata
        x, y, z = p.x * r, p.y * r, p.z * r
        if z >= 0.0:                      # 顶面：平坦草甸
            z *= 0.40
            x *= 1.0 + 0.10 * z
            y *= 1.0 + 0.10 * z
        else:                             # 底部：收成石笋状
            z *= 2.00
            taper = max(0.02, 1.0 - 0.78 * (-z) ** 1.35)
            x *= taper
            y *= taper
        v.co = Vector((x * radius, y * radius * 0.94, z * height))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rock = mesh_from_bmesh(f"Island_Rock_{seed}", bm, col)
    rock.location = loc
    rock.data.materials.append(rock_mat)

    # 草甸
    gbm = icosphere_bm(3, 1.0)
    doomed = [v for v in gbm.verts if v.co.z < 0.08]
    bmesh.ops.delete(gbm, geom=doomed, context="VERTS")
    for v in gbm.verts:
        p = v.co.normalized()
        n = noise.noise(p * 3.4 + Vector((seed * 1.9, seed * 2.2, seed * 0.4)))
        v.co *= 1.0 + n * 0.16
        v.co.z *= 0.52
        v.co.x *= 1.02
        v.co.y *= 0.96
    grass = mesh_from_bmesh(f"Island_Grass_{seed}", gbm, col)
    grass.location = loc + Vector((0, 0, height * 0.22))
    grass.scale = (radius * 0.96, radius * 0.90, height * 0.95)
    grass.data.materials.append(grass_mat)

    # 树
    rng = random.Random(seed * 97 + 5)
    for _ in range(tree_count):
        ang = rng.uniform(0, TAU)
        rr = rng.uniform(0.10, 0.42) * radius
        px = loc.x + math.cos(ang) * rr
        py = loc.y + math.sin(ang) * rr * 0.9
        pz = loc.z + height * 0.54
        h = rng.uniform(1.0, 1.9) * (radius / 9.0) ** 0.5
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=h * 0.075,
                                            depth=h * 0.75,
                                            location=(px, py, pz + h * 0.32))
        trunk = bpy.context.object
        trunk.name = f"Tree_Trunk_{seed}"
        trunk.data.materials.append(tree_mat)
        link_to(trunk, col)
        for k in range(3):
            rr = h * rng.uniform(0.22, 0.32)
            bpy.ops.mesh.primitive_ico_sphere_add(
                subdivisions=2, radius=rr,
                location=(px + rng.uniform(-0.2, 0.2) * h,
                          py + rng.uniform(-0.2, 0.2) * h,
                          pz + h * rng.uniform(0.55, 0.95)))
            leaf = bpy.context.object
            leaf.name = f"Tree_Leaf_{seed}_{k}"
            leaf.data.materials.append(tree_mat)
            for fp in leaf.data.polygons:
                fp.use_smooth = True
            link_to(leaf, col)


def build_islands(rock_mat, grass_mat, tree_mat):
    specs = [
        ((-22.0, 4.0, -7.5), 5.0, 6.0, 1, 5),
        ((13.0, 14.0, -11.0), 7.5, 8.5, 2, 7),
        ((28.0, -4.0, -7.0), 3.6, 4.5, 3, 3),
        ((-40.0, -6.0, -9.0), 6.0, 6.5, 4, 4),
        ((-8.0, 22.0, -11.0), 4.5, 5.5, 5, 3),
        ((22.0, 28.0, -12.0), 9.0, 8.0, 6, 6),
        ((-48.0, 24.0, -13.0), 7.0, 7.0, 7, 4),
    ]
    for loc, r, h, s, trees in specs:
        make_island(Vector(loc), r, h, s, rock_mat, grass_mat, trees, tree_mat)


# ----------------------------------------------------------------------------
# 云海 / 星空 / 星球
# ----------------------------------------------------------------------------
def build_cloud_sea(col, mat):
    mb = bpy.data.metaballs.new("CloudSea")
    mb.resolution = 2.2
    mb.render_resolution = 1.5
    ob = bpy.data.objects.new("CloudSea", mb)
    col.objects.link(ob)
    ob.scale = (1.0, 1.0, 0.62)
    ob.data.materials.append(mat)

    rng = random.Random(round(SEED * 3.7))
    for _ in range(12):
        ang = rng.uniform(0.12 * math.pi, 0.88 * math.pi)
        rad = rng.uniform(55, 190)
        cx = math.cos(ang) * rad
        cy = math.sin(ang) * rad
        cz = rng.uniform(-24.0, -19.0)
        big = rng.uniform(7.0, 13.0)
        for _ in range(rng.randint(7, 11)):
            el = mb.elements.new()
            el.co = Vector((cx + rng.uniform(-big * 1.25, big * 1.25),
                            cy + rng.uniform(-big * 0.95, big * 0.95),
                            cz + rng.uniform(-0.35, 0.35)))
            el.radius = big * rng.uniform(0.30, 0.62)
            el.stiffness = 1.6

    # 远处低空薄云带
    for i in range(9):
        cx = -70 + i * 18 + rng.uniform(-4, 4)
        el = mb.elements.new()
        el.co = Vector((cx, 34 + rng.uniform(-6, 6), -6 + rng.uniform(-1.5, 1.5)))
        el.radius = rng.uniform(7, 12)
        el.stiffness = 1.2
    return ob


def build_stars(col, mat, count=520):
    bm = bmesh.new()
    rng = random.Random(round(SEED * 13.1))
    for _ in range(count):
        theta = rng.uniform(0, TAU)
        # 集中在相机前方与上方
        phi = math.acos(rng.uniform(-0.15, 1.0))
        d = 150.0 + rng.uniform(-15, 15)
        p = Vector((math.sin(phi) * math.cos(theta) * d,
                    math.sin(phi) * math.sin(theta) * d,
                    math.cos(phi) * d))
        r = rng.choice([0.05, 0.07, 0.09, 0.13])
        m = Matrix.Translation(p) @ Matrix.Scale(r, 4)
        try:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=m)
        except TypeError:
            bmesh.ops.create_icosphere(bm, subdivisions=1, diameter=1.0, matrix=m)
    ob = mesh_from_bmesh("Stars", bm, col, smooth=False)
    ob.data.materials.append(mat)
    return ob


def build_planet(col, mat, ring_mat):
    center = Vector((54.0, 196.0, 4.0))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48,
                                         radius=15.5, location=center)
    pl = bpy.context.object
    pl.name = "Planet"
    pl.data.materials.append(mat)
    pl.rotation_euler = (math.radians(18), 0, math.radians(-24))
    link_to(pl, col)

    bpy.ops.mesh.primitive_torus_add(major_radius=24.0, minor_radius=0.30,
                                     major_segments=180, minor_segments=12,
                                     location=center)
    ring = bpy.context.object
    ring.name = "Planet_Ring"
    ring.scale = (1.0, 1.0, 0.06)
    ring.rotation_euler = (math.radians(64), math.radians(12), math.radians(-18))
    ring.data.materials.append(ring_mat)
    link_to(ring, col)

    # 光环里的尘埃
    bm = bmesh.new()
    rng = random.Random(7)
    for _ in range(1400):
        a = rng.uniform(0, TAU)
        rr = rng.uniform(22.0, 26.0)
        p = Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.8, 0.8)))
        p.rotate(Euler((math.radians(64), math.radians(12), math.radians(-18))))
        p += center
        m = Matrix.Translation(p) @ Matrix.Scale(rng.uniform(0.03, 0.09), 4)
        try:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=m)
        except TypeError:
            bmesh.ops.create_icosphere(bm, subdivisions=1, diameter=1.0, matrix=m)
    dust = mesh_from_bmesh("Planet_Ring_Dust", bm, col, smooth=False)
    dust.data.materials.append(ring_mat)
    return pl


def mat_sky():
    mat, nt, out = _new_mat("M_Sky")
    n, L = nt.nodes, nt.links
    tex = n.new("ShaderNodeTexCoord"); tex.location = (-1000, 0)
    sep = n.new("ShaderNodeSeparateXYZ"); sep.location = (-820, 160)
    L.new(tex.outputs["Generated"], sep.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); ramp.location = (-600, 160)
    sky_pts = PAL["sky"]
    ramp.color_ramp.elements[0].position = sky_pts[0][1]
    ramp.color_ramp.elements[0].color = hexc(sky_pts[0][0])
    ramp.color_ramp.elements[1].position = sky_pts[1][1]
    ramp.color_ramp.elements[1].color = hexc(sky_pts[1][0])
    for col, pos in sky_pts[2:]:
        ee = ramp.color_ramp.elements.new(pos)
        ee.color = hexc(col)
    L.new(sep.outputs["Z"], ramp.inputs["Fac"])

    nz = n.new("ShaderNodeTexNoise"); nz.location = (-820, -220)
    nz.inputs["Scale"].default_value = 1.6
    nz.inputs["Detail"].default_value = 8.0
    nz.inputs["Roughness"].default_value = 0.65
    L.new(tex.outputs["Generated"], nz.inputs["Vector"])
    nr = n.new("ShaderNodeValToRGB"); nr.location = (-600, -220)
    nr.color_ramp.elements[0].position = 0.42
    nr.color_ramp.elements[0].color = hexc("#000000")
    nr.color_ramp.elements[1].position = 0.72
    nr.color_ramp.elements[1].color = hexc("#ffffff")
    L.new(nz.outputs["Fac"], nr.inputs["Fac"])

    mix = n.new("ShaderNodeMixRGB"); mix.location = (-330, 60)
    mix.blend_type = "SCREEN"
    mix.inputs["Fac"].default_value = 0.30
    L.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nv = n.new("ShaderNodeRGB"); nv.location = (-520, -60)
    nv.outputs[0].default_value = hexc(PAL["nebula"])
    L.new(nv.outputs[0], mix.inputs["Color2"])

    emi = n.new("ShaderNodeEmission"); emi.location = (0, 0)
    emi.inputs["Strength"].default_value = 1.0
    L.new(mix.outputs["Color"], emi.inputs["Color"])
    nt.links.new(emi.outputs["Emission"], out.inputs["Surface"])
    return mat


def build_sky_dome(col):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=36,
                                         radius=420.0, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = "SkyDome"
    ob.data.materials.append(mat_sky())
    for p in ob.data.polygons:
        p.use_smooth = True
    link_to(ob, col)
    return ob


def mat_planet():
    mat, nt, out = _new_mat("M_Planet")
    n, L = nt.nodes, nt.links
    tex = n.new("ShaderNodeTexCoord"); tex.location = (-900, 0)
    nz = n.new("ShaderNodeTexNoise"); nz.location = (-700, 60)
    nz.inputs["Scale"].default_value = 7.5
    nz.inputs["Detail"].default_value = 9.0
    nz.inputs["Roughness"].default_value = 0.62
    L.new(tex.outputs["Generated"], nz.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); ramp.location = (-470, 60)
    ramp.color_ramp.elements[0].position = 0.36
    ramp.color_ramp.elements[0].color = hexc("#1d1636")
    ramp.color_ramp.elements[1].position = 0.66
    ramp.color_ramp.elements[1].color = hexc("#b98ad8")
    e = ramp.color_ramp.elements.new(0.94); e.color = hexc("#f6dcff")
    vor = n.new("ShaderNodeTexVoronoi"); vor.location = (-700, -320)
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 15.0
    vor.inputs["Randomness"].default_value = 1.0
    L.new(tex.outputs["Generated"], vor.inputs["Vector"])
    cr = n.new("ShaderNodeValToRGB"); cr.location = (-470, -320)
    cr.color_ramp.elements[0].position = 0.0
    cr.color_ramp.elements[0].color = hexc("#6b5a7a")
    cr.color_ramp.elements[1].position = 0.10
    cr.color_ramp.elements[1].color = hexc("#ffffff")
    L.new(vor.outputs["Distance"], cr.inputs["Fac"])
    cmix = n.new("ShaderNodeMixRGB"); cmix.location = (-200, -80)
    cmix.blend_type = "MULTIPLY"
    cmix.inputs["Fac"].default_value = 0.38
    L.new(ramp.outputs["Color"], cmix.inputs["Color1"])
    L.new(cr.outputs["Color"], cmix.inputs["Color2"])

    emi = n.new("ShaderNodeEmission"); emi.location = (60, 0)
    emi.inputs["Strength"].default_value = 1.6
    L.new(cmix.outputs["Color"], emi.inputs["Color"])
    L.new(emi.outputs["Emission"], out.inputs["Surface"])
    return mat


def build_sparkles(col, mat, count=90):
    """鲸鱼周围漂浮的荧光微粒"""
    bm = bmesh.new()
    rng = random.Random(round(SEED * 5.3))
    for _ in range(count):
        t = rng.uniform(0.0, 1.0)
        spread = 3.0 + 2.0 * rng.random()
        p = Vector((b_x(t) + rng.uniform(-2.0, 2.0),
                    b_y(t) + rng.uniform(-spread, spread),
                    b_z(t) + rng.uniform(-spread * 0.7, spread * 0.7)))
        r = rng.choice([0.02, 0.03, 0.045, 0.065]) * rng.uniform(0.8, 1.5)
        m = Matrix.Translation(p) @ Matrix.Scale(r, 4)
        try:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=m)
        except TypeError:
            bmesh.ops.create_icosphere(bm, subdivisions=1, diameter=1.0, matrix=m)
    ob = mesh_from_bmesh("Sparkles", bm, col, smooth=False)
    ob.data.materials.append(mat)
    return ob


# ----------------------------------------------------------------------------
# 灯光 / 相机 / 渲染
# ----------------------------------------------------------------------------
def add_light(col, name, ltype, loc, energy, color, size=10.0, target=None):
    data = bpy.data.lights.new(name, ltype)
    data.energy = energy
    data.color = hexc(color)[:3]
    if ltype == "AREA":
        data.size = size
        data.shape = "DISK"
    elif ltype == "SUN":
        data.angle = math.radians(2.5)
    ob = bpy.data.objects.new(name, data)
    col.objects.link(ob)
    ob.location = loc
    if target is not None:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def setup_lights(col, focus=Vector((0, 0, 1))):
    # 主光：冷白偏暖，斜后方
    add_light(col, "Key_Sun", "SUN", (-28, -26, 30), 6.0, PAL["key"],
              target=focus)
    # 轮廓光：青色，从鲸鱼背后打
    add_light(col, "Rim_Cyan", "AREA", (16, 24, 12), 12000, PAL["rim"],
              size=26, target=focus)
    # 补光：紫蓝
    add_light(col, "Fill_Violet", "AREA", (-18, -24, 6), 4000, PAL["fill"],
              size=34, target=focus)
    # 底部暖光（云海反光）
    add_light(col, "Bounce_Cloud", "AREA", (-4, -10, -18), 6000, PAL["bounce"],
              size=40, target=focus + Vector((0, 0, -3)))


CAM_PRESETS = {
    "A": (Vector((-10.0, -38.0, 6.0)), Vector((-1.0, 0.0, 2.4)), 50.0),
    "B": (Vector((-16.0, -30.0, 13.0)), Vector((0.0, 0.0, 1.0)), 45.0),
    "C": (Vector((-2.0, -34.0, 17.0)), Vector((-0.5, 0.0, 0.5)), 50.0),
    "D": (Vector((-22.0, -26.0, 9.0)), Vector((0.0, 0.0, 1.5)), 45.0),
    "E": (Vector((-14.0, -34.0, 8.5)), Vector((-1.0, 0.0, 2.0)), 48.0),
    "F": (Vector((-0.5, -16.5, 5.2)), Vector((4.0, 0.0, 0.8)), 48.0),
}


def setup_camera(col, target, loc=(-10.0, -38.0, 6.0), lens=50.0):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    cam_data.sensor_width = 36.0
    cam = bpy.data.objects.new("Camera", cam_data)
    col.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def setup_world():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("W_Night")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = hexc(PAL["world"])
    bg.inputs["Strength"].default_value = PAL["world_strength"]
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup_render():
    scene = bpy.context.scene
    r = scene.render
    r.resolution_x = RES_W
    r.resolution_y = RES_H
    r.resolution_percentage = 100
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.filepath = OUT_PNG

    engines = ["BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"]
    for eng in engines:
        try:
            r.engine = eng
            break
        except TypeError:
            continue

    ee = getattr(scene, "eevee", None)
    if ee is not None:
        for attr, val in (("taa_render_samples", SAMPLES),
                          ("use_raytracing", True),
                          ("use_shadows", True),
                          ("use_bloom", True),
                          ("use_gtao", True)):
            if hasattr(ee, attr):
                try:
                    setattr(ee, attr, val)
                except Exception:
                    pass

    vs = scene.view_settings
    for vt in ("AgX", "Filmic", "Standard"):
        try:
            vs.view_transform = vt
            break
        except TypeError:
            continue
    if vs.view_transform == "AgX":
        for look in ("AgX - Medium High Contrast", "None"):
            try:
                vs.look = look
                break
            except TypeError:
                continue
    vs.exposure = PAL["exposure"]


def setup_compositor():
    scene = bpy.context.scene
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    glare = nt.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "HIGH"
    glare.threshold = 1.0
    if hasattr(glare, "size"):
        glare.size = 8
    if hasattr(glare, "mix"):
        glare.mix = -0.30
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
    nt.links.new(glare.outputs["Image"], comp.inputs["Image"])
    return glare


# ----------------------------------------------------------------------------
# 主流程
# ----------------------------------------------------------------------------
def main():
    clear_scene()
    scene = bpy.context.scene

    env = new_collection("Environment")
    fx = new_collection("FX")

    rock_mat = mat_rock()
    grass_mat = mat_grass()
    cloud_mat = mat_cloud(PAL["cloud"][0], PAL["cloud"][1])
    star_mat = mat_emissive("M_Star", PAL["star"], 30.0)
    spark_mat = mat_emissive("M_Spark", PAL["spark"], 9.0)
    tree_mat = mat_tree()
    planet_mat = mat_planet()
    ring_mat = mat_emissive("M_Ring", "#d9b6ff", 3.0)

    print(">> 构建鲸鱼 ...")
    whale = build_whale()
    build_sparkles(fx, spark_mat)

    print(">> 构建浮空岛 ...")
    build_islands(rock_mat, grass_mat, tree_mat)

    print(">> 构建云海 / 星空 / 星球 ...")
    build_sky_dome(env)
    build_cloud_sea(env, cloud_mat)
    build_stars(env, star_mat, 560)
    build_planet(env, planet_mat, ring_mat)

    print(">> 布光 / 相机 ...")
    setup_lights(env, focus=Vector((0.0, 0.0, 1.0)))
    cam_loc, cam_tgt, cam_lens = CAM_PRESETS[arg("--cam", "A").upper()]
    cam = setup_camera(env, cam_tgt, loc=cam_loc, lens=cam_lens)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_object = whale
    cam.data.dof.aperture_fstop = 4.0

    setup_world()
    setup_render()
    setup_compositor()

    for d in (os.path.dirname(OUT_PNG), os.path.dirname(OUT_BLEND)):
        if d:
            os.makedirs(d, exist_ok=True)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print(f">> 已保存 {OUT_BLEND}")

    print(f">> 渲染 {RES_W}x{RES_H} samples={SAMPLES} -> {OUT_PNG}")
    bpy.ops.render.render(write_still=True)
    print(">> 完成")


if __name__ == "__main__":
    main()
