# 云海鲸歌 · 原生 WebGL 版

用 **WebGL2 + 原生 HTML/CSS/JS** 重写的《云海鲸歌》。
**没有 three.js，没有任何第三方库**，矩阵、几何、光照、后期全部手写。

## 打开方式

**方式 A：直接双击** `index.html`（普通 `<script src>`，`file://` 下可用）

**方式 B：本地服务器**（推荐，避免个别浏览器的本地文件限制）

```bash
./serve.sh          # 起在 http://127.0.0.1:8766
```

## 交互

| 操作 | 效果 |
| --- | --- |
| 拖拽 | 环绕旋转 |
| 滚轮 | 推拉镜头 |
| 空格 | 暂停/继续自动巡航 |
| 1 / 2 / 3 | 切换调色：紫夜 / 极夜 / 黄昏 |

## 文件结构

```
web/
├── index.html          页面骨架（HUD + canvas）
├── css/style.css       界面样式
└── js/
    ├── mat4.js         手写矩阵库（perspective / lookAt / invert / 法线矩阵）
    ├── noise.js        3D 值噪声 + fbm
    ├── geometry.js     程序化几何：鲸鱼放样、鳍片、二十面体、岛屿、树
    ├── shaders.js      全部 GLSL ES 3.0
    ├── renderer.js     WebGL2 封装：VAO / FBO / Bloom 后期
    ├── scene.js        场景装配：材质、构图、云、星空、月轮
    └── main.js         入口：轨道相机、调色切换、渲染循环
```

## 技术要点

**几何（全部 CPU 端程序化生成）**
- 鲸身：176 环 × 64 点的放样曲面，半径由 `PROFILE` 曲线控制，尾部封口成点
- 鳍：参数化薄片（弦长衰减 + 后掠 + 拱度），双面渲染时在片元里翻转法线
- 岛屿：二十面体 4 级细分，三层值噪声 + 沉积层理位移，底部按高度指数收缩成石笋
- 树：圆柱树干 + 3 个噪声偏移的球冠

**着色（片元级程序化，无贴图）**
- 腹背渐变：用模型空间 Y 分三段插值（白 → 银蓝 → 深蓝）
- 生物荧光斑点：3D Voronoi F1 距离场阈值，只在腹部区域显现
- 星空/星环：`gl.POINTS` + 圆形 `gl_PointCoord` 衰减 + 闪烁
- 云：面向相机的 billboard quad，fbm 噪声生成 alpha

**动画**
- 摆尾：在**顶点着色器**里沿 X 做正弦行波（振幅向尾部递增），CPU 零开销
- 相机：缓慢环绕 + 视点微移

**后期**
- 亮度提取 → 4 次高斯模糊（横/纵 ×2）→ 加色合成
- ACES 色调映射 + 暗角 + 轻微颗粒

## 性能

`devicePixelRatio` 上限锁到 1.0，Bloom 在 1/2 分辨率做。
在 Intel Mac + Chrome 上约 25–45 FPS（1920×902）。

想更快可以：
- 减少 `scene.js` 里云的循环次数
- 把 `renderer.js` 里 `this.dpr` 设成 `0.75`
- 关掉 Bloom（注释掉 `renderer.post()` 里的 blur pass）

## 调参入口

| 想改 | 位置 |
| --- | --- |
| 鲸鱼体型 | `geometry.js` 的 `PROFILE` |
| 鲸鱼姿态 | `scene.js` 里 `whaleModel` 的 `T/RY/RZ` |
| 相机初始视角 | `main.js` 的 `cam` |
| 配色 | `scene.js` 的 `PALETTES` |
| 岛屿位置尺寸 | `scene.js` 的 `ISLAND_SPECS` |
| 斑点密度 | `scene.js` 材质里的 `spotScale` / `spotStrength` |
| 摆尾幅度 | `shaders.js` `sceneVS` 里的 `uWave` 系数 |
