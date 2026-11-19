/* 场景装配：材质、物体矩阵、云、星空、"云海鲸歌"的构图 */
(function (global) {
  'use strict';

  const G = global.GEO, M4 = global.M4;

  /* sRGB(hex) -> 线性空间，和渲染管线一致 */
  function hexc(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return new Float32Array([lin(r), lin(g), lin(b)]);
  }

  const PALETTES = {
    night: {
      zenith: hexc('#0b1230'),
      horizon: hexc('#3a2456'),
      nebula: hexc('#4a2a6a'),
      lightColor: hexc('#ffe2bd'),
      ambient: hexc('#1e2a44'),
      spotColor: hexc('#9ff0ff'),
      starColor: hexc('#dff2ff'),
      cloudColor: hexc('#7a6a99'),
      cloudGlow: hexc('#c9a8e8'),
    },
    arctic: {
      zenith: hexc('#04101f'),
      horizon: hexc('#123a55'),
      nebula: hexc('#1b4a6b'),
      lightColor: hexc('#cfe9ff'),
      ambient: hexc('#0e1e30'),
      spotColor: hexc('#8ce9ff'),
      starColor: hexc('#e6f6ff'),
      cloudColor: hexc('#6f87a8'),
      cloudGlow: hexc('#7fc8e8'),
    },
    dusk: {
      zenith: hexc('#180a10'),
      horizon: hexc('#5a3320'),
      nebula: hexc('#6b3a24'),
      lightColor: hexc('#ffc07a'),
      ambient: hexc('#241520'),
      spotColor: hexc('#ffc48a'),
      starColor: hexc('#ffe9cf'),
      cloudColor: hexc('#a87f6a'),
      cloudGlow: hexc('#ffb877'),
    },
  };

  function mult(out, ...ms) {
    let acc = M4.create();
    for (const m of ms) M4.multiply(acc, acc, m);
    if (out) out.set(acc);
    return acc;
  }

  function T(x, y, z) { const m = M4.create(); M4.translate(m, m, [x, y, z]); return m; }
  function S(x, y, z) { const m = M4.create(); M4.scale(m, m, [x, y, z]); return m; }
  function RZ(a) { const m = M4.create(); M4.rotateZ(m, m, a); return m; }
  function RY(a) { const m = M4.create(); M4.rotateY(m, m, a); return m; }
  function RX(a) { const m = M4.create(); M4.rotateX(m, m, a); return m; }

  const MAT = {
    whale: () => ({
      albedo: hexc('#d6e6f7'), albedo2: hexc('#081634'),
      gradient: 1.0, rough: 0.30, spotty: 1, spotStrength: 2.4,
      spotScale: 4.2, emissive: 0.035, rim: 0.75, wave: 1.0, noiseScale: 3.6,
    }),
    rock: () => ({
      albedo: hexc('#3b3247'), albedo2: hexc('#7d6b80'),
      gradient: 0.45, rough: 0.94, spotty: 0, rim: 0.35,
    }),
    grass: () => ({
      albedo: hexc('#23443a'), albedo2: hexc('#5a9c78'),
      gradient: 0.55, rough: 0.97, spotty: 0, rim: 0.3, emissive: 0.05,
    }),
    tree: () => ({
      albedo: hexc('#2f6047'), albedo2: hexc('#16302a'),
      gradient: 0.5, rough: 0.9, spotty: 0, rim: 0.35, emissive: 0.05,
    }),
    fin: () => ({
      albedo: hexc('#25486e'), albedo2: hexc('#0a1834'),
      gradient: 0.85, rough: 0.34, spotty: 1, spotStrength: 2.0,
      spotScale: 4.2, emissive: 0.03, rim: 0.7, wave: 1.0, noiseScale: 3.6,
    }),
    eye: () => ({
      albedo: hexc('#c8fbff'), albedo2: hexc('#c8fbff'),
      gradient: 0, rough: 0.2, spotty: 0, emissive: 5.0, rim: 0.2, noiseScale: 1.0,
    }),
    moon: () => ({
      albedo: hexc('#cfbde8'), albedo2: hexc('#6a5b82'),
      gradient: 0.55, rough: 1.0, spotty: 0, emissive: 0.75, rim: 0.1, noiseScale: 0.10,
    }),
  };

  const ISLAND_SPECS = [
    { x: -19, y: -11.5, z: -18, r: 4.6, h: 5.6, seed: 1, trees: 5 },
    { x: 14,  y: -14.0, z: -22, r: 5.4, h: 6.4, seed: 2, trees: 7 },
    { x: 33,  y: -10.0, z: -28, r: 3.4, h: 4.2, seed: 3, trees: 3 },
    { x: -40, y: -12.5, z: -32, r: 3.8, h: 4.6, seed: 4, trees: 4 },
    { x: -4,  y: -16.5, z: -46, r: 3.0, h: 4.0, seed: 5, trees: 3 },
    { x: 26,  y: -18.5, z: -56, r: 4.2, h: 4.8, seed: 6, trees: 6 },
    { x: -50, y: -20.0, z: -64, r: 4.6, h: 5.0, seed: 7, trees: 4 },
  ];

  function buildScene(renderer, paletteKey) {
    const palette = PALETTES[paletteKey] || PALETTES.night;
    const objects = [];

    /* ---- 鲸鱼 ---- */
    const bodyMesh = G.buildBody(176, 64);
    const finMesh = G.buildFins();
    const whaleModel = mult(M4.create(), T(0, 3.6, 0), RY(0.05), RZ(-0.05));
    objects.push({
      vao: renderer.uploadMesh(bodyMesh).vao, count: bodyMesh.idx.length,
      model: whaleModel, material: MAT.whale(),
    });
    objects.push({
      vao: renderer.uploadMesh(finMesh).vao, count: finMesh.idx.length,
      model: whaleModel, material: MAT.fin(),
    });

    /* ---- 眼睛 ---- */
    for (const s of [1, -1]) {
      const t = 0.925;
      const ex = G.bx(t) - 0.1;
      const ey = G.by(t) + G.br(t) * 0.16;
      const ez = s * G.br(t) * G.bw(t) * 0.86;
      const eye = G.icosphere(2);
      for (let i = 0; i < eye.pos.length; i += 3) {
        eye.pos[i] = eye.pos[i] * 0.105 + ex;
        eye.pos[i + 1] = eye.pos[i + 1] * 0.17 + ey;
        eye.pos[i + 2] = eye.pos[i + 2] * 0.17 + ez;
      }
      G.computeNormals(eye);
      objects.push({
        vao: renderer.uploadMesh(eye).vao, count: eye.idx.length,
        model: whaleModel, material: MAT.eye(),
      });
    }

    /* ---- 浮空岛 ---- */
    for (const spec of ISLAND_SPECS) {
      const rock = G.buildIslandRock(spec.seed, spec.r, spec.h, 4);
      objects.push({
        vao: renderer.uploadMesh(rock).vao, count: rock.idx.length,
        model: T(spec.x, spec.y, spec.z), material: MAT.rock(),
      });

      const grass = G.buildGrassCap(spec.seed, spec.r, spec.h);
      objects.push({
        vao: renderer.uploadMesh(grass).vao, count: grass.idx.length,
        model: mult(M4.create(), T(spec.x, spec.y + spec.h * 0.22, spec.z)), material: MAT.grass(),
      });

      // 树
      let seed = spec.seed * 97 + 5;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < spec.trees; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = (0.10 + rnd() * 0.34) * spec.r;
        const tx = spec.x + Math.cos(a) * rr;
        const tz = spec.z + Math.sin(a) * rr * 0.9;
        const ty = spec.y + spec.h * 0.48;
        const hh = (0.9 + rnd() * 0.9) * Math.sqrt(spec.r / 9);
        const tree = G.buildTree(tx, ty, tz, hh, spec.seed * 13 + i);
        objects.push({
          vao: renderer.uploadMesh(tree).vao, count: tree.idx.length,
          model: M4.create(), material: MAT.tree(),
        });
      }
    }

    /* ---- 月亮 ---- */
    const moonR = 16.0;
    const moon = G.icosphere(4);
    for (let i = 0; i < moon.pos.length; i += 3) {
      moon.pos[i] *= moonR; moon.pos[i + 1] *= moonR; moon.pos[i + 2] *= moonR;
    }
    G.computeNormals(moon);
    objects.push({
      vao: renderer.uploadMesh(moon).vao, count: moon.idx.length,
      model: T(-34, 27, -132), material: MAT.moon(),
    });

    /* ---- 云 ---- */
    const clouds = [];
    let cs = 11;
    const crand = () => { cs = (cs * 16807) % 2147483647; return cs / 2147483647; };
    for (let i = 0; i < 20; i++) {
      const ang = 0.10 * Math.PI + crand() * 0.80 * Math.PI;
      const rad = 55 + crand() * 130;
      clouds.push({
        x: Math.cos(ang) * rad,
        y: -9 + crand() * 4,
        z: -Math.sin(ang) * rad * 0.85,
        w: 10 + crand() * 12,
        h: 5 + crand() * 5,
        seed: crand() * 10,
      });
    }
    // 近景几朵，制造纵深
    for (let i = 0; i < 3; i++) {
      clouds.push({
        x: -46 + i * 22 + crand() * 8,
        y: -4 - crand() * 3,
        z: -30 - crand() * 16,
        w: 9 + crand() * 8,
        h: 4 + crand() * 3,
        seed: crand() * 10,
      });
    }
    const cloudBuf = renderer.uploadClouds(clouds);

    /* ---- 星空 + 星环 ---- */
    const starPos = [], starSize = [], starSeed = [];
    let ss = 7331;
    const srand = () => { ss = (ss * 16807) % 2147483647; return ss / 2147483647; };
    for (let i = 0; i < 900; i++) {
      const th = srand() * Math.PI * 2;
      const ph = Math.acos(srand() * 1.15 - 0.15);
      const d = 380 + srand() * 60;
      starPos.push(
        Math.sin(ph) * Math.cos(th) * d,
        Math.cos(ph) * d * 0.85 + 40,
        -Math.abs(Math.sin(ph) * Math.sin(th)) * d
      );
      starSize.push(0.8 + srand() * 2.4);
      starSeed.push(srand());
    }
    // 月亮星环
    for (let i = 0; i < 520; i++) {
      const a = srand() * Math.PI * 2;
      const rr = 22 + srand() * 5;
      const tilt = 0.36;
      const px = Math.cos(a) * rr;
      const pz = Math.sin(a) * rr;
      starPos.push(
        -34 + px,
        27 + pz * Math.sin(tilt) + (srand() - 0.5) * 1.4,
        -132 + pz * Math.cos(tilt)
      );
      starSize.push(1.8 + srand() * 2.4);
      starSeed.push(srand());
    }
    const starBuf = renderer.uploadStars({
      pos: new Float32Array(starPos),
      size: new Float32Array(starSize),
      seed: new Float32Array(starSeed),
      count: starSize.length,
    });

    return {
      objects,
      clouds,
      cloudVAO: cloudBuf.vao,
      cloudCount: cloudBuf.count,
      starVAO: starBuf.vao,
      starCount: starBuf.count,
      palette,
      lightDir: new Float32Array([-0.45, 0.62, 0.65]),
    };
  }

  global.SCENE = { buildScene, PALETTES, hexc };
})(window);
