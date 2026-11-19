# -*- coding: utf-8 -*-
"""
给已生成好的 sky_whale.blend 加"游动"动画，并渲染 PNG 帧序列。

用法:
  blender -b build/sky_whale.blend --python make_anim.py -- \
      --frames 48 --fps 24 --res 640x360 --samples 6 --out build/frames

做法:
  - 沿身体 X 轴做正弦"行波"位移（振幅向尾部递增），模拟鲸类上下摆尾
  - 尾鳍/胸鳍/背鳍/眼睛与身体共用同一形变场，避免脱节
  - 主体轻微浮沉 + 相机缓慢环绕，首尾相位对齐 → 无缝循环
"""
import bpy
import math
import os
import sys
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(k, d):
    if k in ARGV and ARGV.index(k) + 1 < len(ARGV):
        return ARGV[ARGV.index(k) + 1]
    return d


FRAMES = int(arg("--frames", "48"))
FPS = int(arg("--fps", "24"))
RES_W, RES_H = (int(v) for v in arg("--res", "640x360").lower().split("x"))
SAMPLES = int(arg("--samples", "6"))
OUTDIR = os.path.abspath(arg("--out", "build/frames"))
AMP = float(arg("--amp", "0.55"))

scene = bpy.context.scene

TARGETS = ["Whale_Body", "Whale_Fluke_L", "Whale_Fluke_R",
           "Whale_Flipper_L", "Whale_Flipper_R", "Whale_Dorsal",
           "Whale_Eye_L", "Whale_Eye_R"]

objs = [bpy.data.objects[n] for n in TARGETS if n in bpy.data.objects]
if not objs:
    raise SystemExit("!! 找不到鲸鱼对象，请确认打开的是 sky_whale.blend")

BASE = {o.name: [v.co.copy() for v in o.data.vertices] for o in objs}
root = bpy.data.objects.get("Whale_Root")
# 统一使用全景机位 E（避免继承上次保存的特写相机）
if scene.camera is not None:
    scene.camera.location = Vector((-14.0, -34.0, 8.5))
    scene.camera.data.lens = 48.0
    _d = Vector((-1.0, 0.0, 2.0)) - scene.camera.location
    scene.camera.rotation_euler = _d.to_track_quat("-Z", "Y").to_euler()
cam = scene.camera
cam_base = cam.location.copy()
cam_rot = cam.rotation_euler.copy()
root_base = root.location.copy() if root else Vector((0, 0, 0))
root_rot = root.rotation_euler.copy() if root else None

HALF = 8.0          # 鲸鱼半长
LOOK_AT = Vector((0.0, 0.0, 1.2))


def swim(scene, depsgraph=None):
    f = scene.frame_current - 1
    ph = 2.0 * math.pi * f / FRAMES

    for o in objs:
        base = BASE[o.name]
        verts = o.data.vertices
        for i, v in enumerate(verts):
            t = (base[i].x + HALF) / (2.0 * HALF)
            if t < 0.0:
                t = 0.0
            elif t > 1.0:
                t = 1.0
            w = 0.0 if t < 0.30 else ((t - 0.30) / 0.70) ** 1.8 * 2.4
            dz = AMP * math.sin(ph - 4.2 * t) * w
            v.co.z = base[i].z + dz
            v.co.y = base[i].y + dz * 0.12

    if root is not None:
        root.location = root_base + Vector((0.0, 0.0, 0.16 * math.sin(ph)))
        root.rotation_euler = root_rot.copy()
        root.rotation_euler.y = root_rot.y + math.radians(1.1) * math.sin(ph + 1.0)

    if cam is not None:
        cam.location = cam_base + Vector((0.50 * math.sin(ph),
                                          0.32 * math.cos(ph),
                                          0.20 * math.sin(ph * 1.5)))
        d = LOOK_AT - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


bpy.app.handlers.frame_change_pre.append(swim)

# ---- 渲染设置 ----
scene.render.resolution_x = RES_W
scene.render.resolution_y = RES_H
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = FRAMES

ee = getattr(scene, "eevee", None)
if ee is not None:
    if hasattr(ee, "taa_render_samples"):
        ee.taa_render_samples = SAMPLES
    if hasattr(ee, "use_raytracing"):
        ee.use_raytracing = False        # 动画关掉光线追踪，快很多

if cam is not None and hasattr(cam.data, "dof"):
    cam.data.dof.use_dof = False         # 动画关掉景深，避免闪烁

os.makedirs(OUTDIR, exist_ok=True)
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = os.path.join(OUTDIR, "f_")

print(f">> 渲染 {FRAMES} 帧 @ {RES_W}x{RES_H} / {SAMPLES} 采样 -> {OUTDIR}")
bpy.ops.render.render(animation=True)
print(">> 动画帧序列完成")
