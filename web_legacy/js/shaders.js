/* 全部 GLSL ES 3.0 —— 手写，不依赖任何着色器库 */
(function (global) {
  'use strict';

  const COMMON_NOISE = /* glsl */`
    vec3 hash33(vec3 p) {
      p = fract(p * vec3(0.1031, 0.1030, 0.0973));
      p += dot(p, p.yxz + 33.33);
      return fract((p.xxy + p.yxx) * p.zyx);
    }

    float vnoise(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = dot(hash33(i + vec3(0,0,0)), vec3(0.333));
      float n100 = dot(hash33(i + vec3(1,0,0)), vec3(0.333));
      float n010 = dot(hash33(i + vec3(0,1,0)), vec3(0.333));
      float n110 = dot(hash33(i + vec3(1,1,0)), vec3(0.333));
      float n001 = dot(hash33(i + vec3(0,0,1)), vec3(0.333));
      float n101 = dot(hash33(i + vec3(1,0,1)), vec3(0.333));
      float n011 = dot(hash33(i + vec3(0,1,1)), vec3(0.333));
      float n111 = dot(hash33(i + vec3(1,1,1)), vec3(0.333));
      return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
    }

    float fbm(vec3 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
      return s;
    }

    // 3D Voronoi F1：生物荧光斑点
    float voronoiF1(vec3 p) {
      vec3 ip = floor(p), fp = fract(p);
      float best = 8.0;
      for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash33(ip + g);
        vec3 r = g + o - fp;
        best = min(best, dot(r, r));
      }
      return sqrt(best);
    }
  `;

  /* ---------- 通用不透明物体 ---------- */
  const sceneVS = /* glsl */`#version 300 es
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec3 aNrm;

    uniform mat4 uProj, uView, uModel;
    uniform mat3 uNormalMat;
    uniform float uTime;
    uniform float uWave;

    out vec3 vWorld;
    out vec3 vNormal;
    out vec3 vModel;
    out vec3 vNrmLocal;

    void main() {
      vec3 p = aPos;
      // 鲸鱼摆尾：沿 X 的行波，振幅向尾部递增（纯 GPU 计算）
      if (uWave > 0.001) {
        float t = clamp((aPos.x + 8.0) / 16.0, 0.0, 1.0);
        float w = pow(max(t - 0.30, 0.0) / 0.70, 1.8) * 2.4;
        p.y += uWave * sin(uTime * 2.6 - 4.2 * t) * w;
        p.z += uWave * 0.25 * sin(uTime * 2.6 - 4.2 * t + 0.6) * w;
      }
      vec4 wp = uModel * vec4(p, 1.0);
      vWorld  = wp.xyz;
      vNormal = normalize(uNormalMat * aNrm);
      vModel  = aPos;
      vNrmLocal = aNrm;
      gl_Position = uProj * uView * wp;
    }
  `;

  const sceneFS = /* glsl */`#version 300 es
    precision highp float;
    in vec3 vWorld;
    in vec3 vNormal;
    in vec3 vModel;
    in vec3 vNrmLocal;
    out vec4 fragColor;

    uniform vec3  uCamPos;
    uniform vec3  uLightDir;
    uniform vec3  uLightColor;
    uniform vec3  uAmbient;
    uniform vec3  uAlbedo;
    uniform vec3  uAlbedo2;
    uniform vec3  uSpotColor;
    uniform float uGradient;
    uniform float uRough;
    uniform float uSpotty;
    uniform float uSpotStrength;
    uniform float uSpotScale;
    uniform float uEmissive;
    uniform float uRimStrength;
    uniform float uNoiseScale;

    ${COMMON_NOISE}

    void main() {
      vec3 N = normalize(vNormal);
      if (!gl_FrontFacing) N = -N;
      vec3 V = normalize(uCamPos - vWorld);
      vec3 L = normalize(uLightDir);

      // 腹背渐变：用模型空间法线的朝上程度（比世界 Y 稳定得多）
      float g = clamp(vModel.y / 1.45 * 0.5 + 0.5, 0.0, 1.0);
      // 三段：腹部白 → 侧腹银蓝 → 背部深蓝
      vec3 mid = vec3(0.10, 0.22, 0.40);
      vec3 base3 = mix(uAlbedo, mid, smoothstep(0.02, 0.42, g));
      base3 = mix(base3, uAlbedo2, smoothstep(0.42, 0.82, g));
      vec3 base = mix(uAlbedo, base3, uGradient);

      // 皮肤细微斑驳
      base *= 0.88 + 0.24 * fbm(vModel * uNoiseScale);

      // 生物荧光斑点：只长在腹部/侧面
      float spot = 0.0;
      if (uSpotty > 0.5) {
        float d = voronoiF1(vModel * uSpotScale);
        float m = smoothstep(0.34, 0.03, d);
        float zone = smoothstep(0.55, 0.02, vModel.y * 1.4 + 0.15);
        spot = m * zone;
      }

      float diff = max(dot(N, L), 0.0);
      vec3  H = normalize(L + V);
      float shininess = mix(180.0, 10.0, uRough);
      float spec = pow(max(dot(N, H), 0.0), shininess) * (1.0 - uRough);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);

      vec3 col = base * (uAmbient + uLightColor * diff * 0.62);
      col += uLightColor * spec * 0.45;
      col += uSpotColor * rim * uRimStrength;
      col += uSpotColor * spot * uSpotStrength;
      col += base * uEmissive;

      fragColor = vec4(col, 1.0);
    }
  `;

  /* ---------- 天空穹顶（全屏） ---------- */
  const fsQuadVS = /* glsl */`#version 300 es
    layout(location=0) in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const skyFS = /* glsl */`#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;

    uniform mat4  uInvVP;
    uniform vec3  uZenith;
    uniform vec3  uHorizon;
    uniform vec3  uNebula;

    ${COMMON_NOISE}

    void main() {
      vec4 p = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
      vec3 dir = normalize(p.xyz / p.w);

      float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, smoothstep(0.42, 0.95, h));
      col = mix(col, uHorizon * 0.55, smoothstep(0.42, 0.20, h));

      float n = fbm(dir * 3.2 + 5.0);
      float band = smoothstep(0.55, 0.95, n) * smoothstep(0.35, 0.75, h);
      col += uNebula * band * 0.55;

      fragColor = vec4(col, 1.0);
    }
  `;

  /* ---------- 云（billboard） ---------- */
  const cloudVS = /* glsl */`#version 300 es
    layout(location=0) in vec2 aCorner;
    layout(location=1) in vec3 aCenter;
    layout(location=2) in vec2 aSize;
    layout(location=3) in float aSeed;

    uniform mat4 uProj, uView;
    uniform vec3 uCamRight, uCamUp;

    out vec2 vUv;
    out float vSeed;
    out vec3 vWorld;

    void main() {
      vec3 wp = aCenter + uCamRight * (aCorner.x * aSize.x) + uCamUp * (aCorner.y * aSize.y);
      vUv = aCorner * 0.5 + 0.5;
      vSeed = aSeed;
      vWorld = wp;
      gl_Position = uProj * uView * vec4(wp, 1.0);
    }
  `;

  const cloudFS = /* glsl */`#version 300 es
    precision highp float;
    in vec2 vUv;
    in float vSeed;
    in vec3 vWorld;
    out vec4 fragColor;

    uniform vec3 uCloudColor;
    uniform vec3 uCloudGlow;
    uniform float uOpacity;

    ${COMMON_NOISE}

    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p * vec2(1.0, 1.6));
      float shape = smoothstep(1.0, 0.15, r);

      float n = fbm(vec3(vUv * 3.4, vSeed * 7.0));
      float detail = fbm(vec3(vUv * 11.0, vSeed * 3.0 + 2.0));
      float a = shape * smoothstep(0.30, 0.72, n * 0.75 + detail * 0.35) * uOpacity;

      if (a < 0.004) discard;

      vec3 col = mix(uCloudColor * 0.55, uCloudColor, n + detail * 0.4);
      col += uCloudGlow * smoothstep(0.55, 1.0, 1.0 - r) * 0.35;

      fragColor = vec4(col, a);
    }
  `;

  /* ---------- 星空 / 光环粒子 ---------- */
  const starVS = /* glsl */`#version 300 es
    layout(location=0) in vec3 aPos;
    layout(location=1) in float aSize;
    layout(location=2) in float aSeed;

    uniform mat4 uProj, uView;
    uniform float uPixelRatio;
    uniform float uTime;

    out float vSeed;
    out float vTwinkle;

    void main() {
      vSeed = aSeed;
      vTwinkle = 0.72 + 0.28 * sin(uTime * 1.6 + aSeed * 23.0);
      vec4 vp = uView * vec4(aPos, 1.0);
      gl_Position = uProj * vp;
      gl_PointSize = aSize * uPixelRatio * (260.0 / max(-vp.z, 1.0)) * vTwinkle;
    }
  `;

  const starFS = /* glsl */`#version 300 es
    precision highp float;
    in float vSeed;
    in float vTwinkle;
    out vec4 fragColor;

    uniform vec3 uStarColor;

    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r = length(d);
      if (r > 0.5) discard;
      float core = smoothstep(0.5, 0.0, r);
      float glow = pow(core, 3.0);
      vec3 col = uStarColor * (0.6 + 0.9 * vTwinkle) * (glow * 1.6 + core * 0.35);
      fragColor = vec4(col, core);
    }
  `;

  /* ---------- 后期：亮度提取 / 模糊 / 合成 ---------- */
  const brightFS = /* glsl */`#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;
    uniform sampler2D uTex;
    uniform float uThreshold;

    void main() {
      vec3 c = texture(uTex, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(uThreshold, uThreshold + 0.35, l);
      fragColor = vec4(c * k, 1.0);
    }
  `;

  const blurFS = /* glsl */`#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;
    uniform sampler2D uTex;
    uniform vec2 uDir;      // 像素步长 * 方向

    void main() {
      const float w0 = 0.2270270270;
      const float w1 = 0.3162162162;
      const float w2 = 0.0702702703;
      vec3 sum = texture(uTex, vUv).rgb * w0;
      sum += texture(uTex, vUv + uDir * 1.3846153846).rgb * w1;
      sum += texture(uTex, vUv - uDir * 1.3846153846).rgb * w1;
      sum += texture(uTex, vUv + uDir * 3.2307692308).rgb * w2;
      sum += texture(uTex, vUv - uDir * 3.2307692308).rgb * w2;
      fragColor = vec4(sum, 1.0);
    }
  `;

  const compositeFS = /* glsl */`#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;

    uniform sampler2D uScene;
    uniform sampler2D uBloom;
    uniform float uBloomStrength;
    uniform float uExposure;
    uniform float uTime;

    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec3 scene = texture(uScene, vUv).rgb;
      vec3 bloom = texture(uBloom, vUv).rgb;
      vec3 col = scene + bloom * uBloomStrength;

      col *= uExposure;
      col = aces(col);

      // 暗角
      vec2 q = vUv - 0.5;
      float vig = 1.0 - dot(q, q) * 0.85;
      col *= clamp(vig, 0.0, 1.0);

      // 轻微颗粒
      float grain = fract(sin(dot(vUv + uTime * 0.0007, vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * 0.012;

      // gamma
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));
      fragColor = vec4(col, 1.0);
    }
  `;

  global.SHADERS = {
    sceneVS, sceneFS, fsQuadVS, skyFS, cloudVS, cloudFS,
    starVS, starFS, brightFS, blurFS, compositeFS,
  };
})(window);
