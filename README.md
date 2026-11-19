# 云海鲸歌 · Sky Whale

一个**完全程序化**的 Blender 场景：一头带生物荧光斑点的巨鲸，从浮空群岛与云带之上掠过，
远处是带环的紫色行星与星野。

不依赖任何外部模型/贴图/HDRI —— 所有几何体、材质、灯光都由 `build_scene.py` 生成。

## 运行

```bash
./render.sh                    # 默认 1280x720 / 32 采样 / 机位 E
./render.sh 1920x1080 128 E    # 高分辨率高采样（更吃 GPU）
```

### 关于电脑卡顿

EEVEE 渲染会把 Metal GPU 吃满，前台应用会明显掉帧。`render.sh` 已经用
`nice -n 20 taskpolicy -b` 把 Blender 压到**最低调度优先级 + 后台 QoS**，
前台依然流畅，代价是渲染时间变长（1280x720/32 采样约 2 分钟）。

想更省，可以再降参数：`./render.sh 960x540 16`。

> 不建议在渲染时同时开视频会议/剪辑，GPU 仍是共享的。

或直接调用 Blender：

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
    --python build_scene.py -- \
    --res 1280x720 --samples 48 \
    --blend build/sky_whale.blend \
    --out   renders/sky_whale.png
```

参数：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| `--res WxH` | 输出分辨率 | `1280x720` |
| `--samples N` | EEVEE 采样数 | `64` |
| `--blend PATH` | 保存的 .blend 路径 | `build/sky_whale.blend` |
| `--out PATH` | 渲染图路径 | `renders/sky_whale.png` |
| `--seed N` | 随机种子（岛、云、星、微粒） | `11` |
| `--cam A\|B\|C\|D\|E` | 相机机位（E 为当前成品机位） | `A` |

> 注意：macOS 上 Blender 需要访问 Metal GPU，若在受限沙箱中运行会崩溃，请用普通终端执行。

## 产物

- `renders/sky_whale.png` —— 成品图
- `build/sky_whale.blend` —— 可直接打开的工程文件（相机/灯光/材质全部可改）

## 场景结构

| 集合 | 内容 |
| --- | --- |
| `Whale` | 鲸身（190×72 环的放样曲面）、尾鳍、胸鳍、背鳍、双眼，挂在 `Whale_Root` 空物体下 |
| `Island_*` | 7 座浮空岛：噪声位移的岩石 + 苔原穹顶 + 团状树冠 |
| `FX` | 鲸鱼周围漂浮的荧光微粒 |
| `Environment` | 天空穹顶、云带（metaball）、星空、行星与星环、灯光、相机 |

## 关键材质做法

- **鲸鱼皮肤**：`Generated` 坐标 Z 做垂直渐变（腹部近白 → 背部深蓝）；
  `Voronoi F1` 距离阈值生成均匀分布于**腹侧**的发光斑点，用 `Mix Shader` 混入自发光；
  高频 `Noise → Bump` 给皮肤一层细微颗粒感。
- **草地 / 岩石**：`Noise + ColorRamp` 控制色相与粗糙度，岩石额外接 `Bump`。
- **岩石分层**：岛体由三层噪声（大形 / 中景 / 细碎）叠加 `sin(z*24)` 沉积层理，细分 5 级。
- **月轮**：`Voronoi (DISTANCE_TO_EDGE)` 生成环形山网状纹理，乘到噪声色带上。
- **天空穹顶**：`Generated` Z 垂直渐变 + `Noise` 的 SCREEN 混合，做出紫靛色暮光。
- **后期**：合成器 `Glare (FOG_GLOOW)`，阈值 1.0、强度 -0.30，给发光斑点与星空加柔光。

## 想改哪里

- 鲸鱼体型：`BODY_PROFILE`（t 从 0 尾尖到 1 吻端，对应半径）
- 鲸鱼姿态：`build_whale()` 末尾 `root.rotation_euler`
- 相机：`setup_camera()` 的 `loc` / `lens`，以及 `main()` 里的注视点
- 岛屿位置尺寸：`build_islands()` 里的 `specs` 列表 `(位置, 半径, 高度, 种子, 树数量)`
- 配色：各处 `hexc("#...")`
