/* 程序化几何：鲸鱼放样 / 鳍片 / 二十面体 / 岛屿 / 树
   坐标约定：Y 向上，鲸鱼沿 X 轴，Z 为横向宽度 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const NZ = global.NZ;

  function smoothstep(a, b, x) {
    if (b === a) return x < a ? 0 : 1;
    let t = (x - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }

  function curveVal(pts, t) {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (t >= x0 && t <= x1) {
        let u = (t - x0) / (x1 - x0);
        u = u * u * (3 - 2 * u);
        return y0 + (y1 - y0) * u;
      }
    }
    return pts[pts.length - 1][1];
  }

  /* ---------------- 网格工具 ---------------- */

  function emptyMesh() { return { pos: [], nrm: [], idx: [], count: 0 }; }

  /** 用面法线累加出顶点法线（要求索引网格） */
  function computeNormals(mesh) {
    const n = mesh.pos.length / 3;
    const nrm = new Float32Array(n * 3);
    const p = mesh.pos, ix = mesh.idx;
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
      nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (let i = 0; i < n * 3; i += 3) {
      const L = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
      nrm[i] /= L; nrm[i + 1] /= L; nrm[i + 2] /= L;
    }
    mesh.nrm = nrm;
    return mesh;
  }

  function mergeMeshes(list) {
    let vc = 0, ic = 0;
    for (const m of list) { vc += m.pos.length / 3; ic += m.idx.length; }
    const out = { pos: new Float32Array(vc * 3), nrm: new Float32Array(vc * 3), idx: new Uint32Array(ic) };
    let vo = 0, io = 0;
    for (const m of list) {
      const base = vo / 3;
      out.pos.set(m.pos, vo);
      if (m.nrm) out.nrm.set(m.nrm, vo);
      for (let i = 0; i < m.idx.length; i++) out.idx[io + i] = m.idx[i] + base;
      vo += m.pos.length;
      io += m.idx.length;
    }
    return out;
  }

  /* ---------------- 鲸鱼 ---------------- */

  const HALF = 8.0;

  const PROFILE = [
    [0.000, 0.075], [0.020, 0.130], [0.060, 0.150], [0.110, 0.255],
    [0.180, 0.400], [0.270, 0.585], [0.360, 0.760], [0.450, 0.910],
    [0.540, 1.040], [0.620, 1.135], [0.700, 1.190], [0.770, 1.200],
    [0.830, 1.160], [0.880, 1.060], [0.920, 0.980], [0.950, 0.880],
    [0.972, 0.700], [0.988, 0.450], [0.997, 0.200], [1.000, 0.060],
  ];

  const bx = (t) => -HALF + 2 * HALF * t;
  const by = (t) => 0.60 * Math.sin(Math.PI * t) - 0.30;
  const bz = (t) => 0.50 * Math.sin(TAU * t * 0.9) * smoothstep(0.0, 0.25, t);
  const br = (t) => curveVal(PROFILE, t);
  const bw = (t) => 0.58 + 0.05 * Math.sin(Math.PI * t);
  const bh = (t) => 1.0 - 0.20 * smoothstep(0.70, 1.0, t);

  function buildBody(N, M) {
    N = N || 190; M = M || 72;
    const pos = [], idx = [];
    const ringStart = [];

    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const r = br(t), w = bw(t), h = bh(t);
      const cx = bx(t), cy = by(t), cz = bz(t);
      ringStart.push(pos.length / 3);

      for (let j = 0; j < M; j++) {
        const a = TAU * j / M;
        let sy = Math.sin(a), cz2 = Math.cos(a);
        if (sy < 0) sy *= 0.86;

        let rr = r;
        if (t > 0.66) {                       // 口腔缝
          const g = Math.exp(-((sy + 0.46) ** 2) / 0.010);
          rr *= 1.0 - 0.060 * g * smoothstep(0.66, 0.78, t);
        }
        const px = cx;
        const py = cy + rr * h * sy;
        const pz = cz + rr * w * cz2;
        const n = NZ.noise3(px * 0.42, py * 0.42, pz * 0.42, 3) - 0.5;
        pos.push(px + n * 0.05, py + n * 0.05, pz + n * 0.05);
      }
    }

    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < M; j++) {
        const a = ringStart[i] + j;
        const b = ringStart[i] + (j + 1) % M;
        const c = ringStart[i + 1] + (j + 1) % M;
        const d = ringStart[i + 1] + j;
        idx.push(a, b, c, a, c, d);
      }
    }

    // 尾尖 / 吻端封口
    const tailIdx = pos.length / 3;
    pos.push(bx(0) - 0.10, by(0), bz(0));
    const headIdx = pos.length / 3;
    pos.push(bx(1) + 0.10, by(1), bz(1));
    for (let j = 0; j < M; j++) {
      const a = ringStart[0] + j;
      const b = ringStart[0] + (j + 1) % M;
      idx.push(tailIdx, b, a);
      const c = ringStart[N - 1] + j;
      const d = ringStart[N - 1] + (j + 1) % M;
      idx.push(headIdx, c, d);
    }

    return computeNormals({ pos: new Float32Array(pos), nrm: null, idx: new Uint32Array(idx) });
  }

  /** 鳍片：局部 XY 平面生成，再按基向量摆到世界里（之后由着色器双面照明） */
  function blade(origin, spanDir, chordDir, span, chord, sweep, camber) {
    const NU = 22, NV = 12;
    const su = norm3(spanDir), sc = norm3(chordDir);
    const sn = cross3(su, sc);
    const o = origin;
    const pos = [], idx = [];

    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const ch = chord * Math.pow(1 - u, 0.85) + chord * 0.09;
      const x0 = -sweep * Math.pow(u, 1.4);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        const d = x0 + ch * v;
        const hh = span * u;
        const lift = (camber || 0.10) * chord * Math.sin(Math.PI * v) * (1 - 0.6 * u)
                   + 0.03 * chord * Math.sin(Math.PI * u);
        pos.push(
          o[0] + sc[0] * d + su[0] * hh + sn[0] * lift,
          o[1] + sc[1] * d + su[1] * hh + sn[1] * lift,
          o[2] + sc[2] * d + su[2] * hh + sn[2] * lift
        );
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const a = i * (NV + 1) + j;
        const b = (i + 1) * (NV + 1) + j;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    return computeNormals({ pos: new Float32Array(pos), nrm: null, idx: new Uint32Array(idx) });
  }

  function norm3(v) {
    const L = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / L, v[1] / L, v[2] / L];
  }
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function buildFins() {
    const parts = [];
    const tz = by(0), tzz = bz(0);

    // 尾鳍（左右两片，水平展开）
    for (const s of [1, -1]) {
      parts.push(blade(
        [-HALF + 0.30, tz, tzz - 0.02],
        [0, 0.26, s * 0.96],
        [-1, 0, 0],
        3.00, 1.70, 1.30, 0.10
      ));
    }

    // 胸鳍
    const t = 0.70;
    const fx = bx(t), fy = by(t) - br(t) * 0.45, fz = br(t) * bw(t) * 0.90;
    for (const s of [1, -1]) {
      parts.push(blade(
        [fx, fy, s * fz],
        [0.62, -0.48, s * 0.62],
        [-0.92, -0.10, s * 0.20],
        2.30, 1.45, 1.05, 0.16
      ));
    }

    // 背鳍
    const td = 0.56;
    parts.push(blade(
      [bx(td) - 0.35, by(td) + br(td) * 0.86, bz(td)],
      [0.10, 1.0, 0],
      [-1, 0, 0],
      0.95, 1.30, 0.75, 0.06
    ));

    return mergeMeshes(parts);
  }

  /* ---------------- 二十面体 / 岛屿 ---------------- */

  function icosphere(subdiv) {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ];
    let faces = [
      [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
      [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
      [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
      [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
    ];

    for (let s = 0; s < (subdiv || 0); s++) {
      const cache = new Map();
      const newFaces = [];
      const mid = (a, b) => {
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (cache.has(key)) return cache.get(key);
        const va = verts[a], vb = verts[b];
        const m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
        const L = Math.hypot(m[0], m[1], m[2]) || 1;
        verts.push([m[0] / L, m[1] / L, m[2] / L]);
        const id = verts.length - 1;
        cache.set(key, id);
        return id;
      };
      for (const [a, b, c] of faces) {
        const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = newFaces;
    }

    const pos = new Float32Array(verts.length * 3);
    for (let i = 0; i < verts.length; i++) {
      const L = Math.hypot(verts[i][0], verts[i][1], verts[i][2]) || 1;
      pos[i * 3] = verts[i][0] / L;
      pos[i * 3 + 1] = verts[i][1] / L;
      pos[i * 3 + 2] = verts[i][2] / L;
    }
    const idx = new Uint32Array(faces.length * 3);
    for (let i = 0; i < faces.length; i++) {
      idx[i * 3] = faces[i][0]; idx[i * 3 + 1] = faces[i][1]; idx[i * 3 + 2] = faces[i][2];
    }
    return { pos, nrm: null, idx };
  }

  function buildIslandRock(seed, radius, height, subdiv) {
    const ico = icosphere(subdiv || 5);
    const p = ico.pos;
    for (let i = 0; i < p.length; i += 3) {
      let x = p[i], y = p[i + 1], z = p[i + 2];

      const n1 = NZ.noise3(x * 1.2 + seed * 3.1, y * 1.2 + seed * 1.7, z * 1.2 + seed * 2.3, 11) - 0.5;
      const n2 = NZ.noise3(x * 3.4 + seed * 0.7, y * 3.4 + seed * 2.9, z * 3.4 + seed * 1.3, 23) - 0.5;
      const n3 = NZ.noise3(x * 8.5 + seed * 1.3, y * 8.5 + seed * 0.5, z * 8.5 + seed * 2.7, 41) - 0.5;
      const strata = 0.020 * Math.sin(y * 24.0 + n2 * 2.2);
      const r = 1.0 + n1 * 0.36 + n2 * 0.15 + n3 * 0.056 + strata;

      let X = x * r, Y = y * r, Z = z * r;

      if (Y >= 0) {              // 顶部草甸基底：压平
        Y *= 0.40;
        X *= 1.0 + 0.10 * Y;
        Z *= 1.0 + 0.10 * Y;
      } else {                   // 底部收成石笋
        Y *= 2.00;
        const taper = Math.max(0.02, 1.0 - 0.78 * Math.pow(-Y, 1.35));
        X *= taper;
        Z *= taper;
      }
      p[i] = X * radius;
      p[i + 1] = Y * height;
      p[i + 2] = Z * radius * 0.94;
    }
    return computeNormals({ pos: p, nrm: null, idx: ico.idx });
  }

  function buildGrassCap(seed, radius, height) {
    const ico = icosphere(3);
    const p = ico.pos;
    const keep = [];
    // 只保留上半球并做软化
    for (let i = 0; i < p.length; i += 3) {
      const y = p[i + 1];
      if (y < 0.08) { p[i] = p[i]; }
    }
    for (let i = 0; i < p.length; i += 3) {
      let x = p[i], y = p[i + 1], z = p[i + 2];
      const n = NZ.noise3(x * 3.4 + seed, y * 3.4 + seed * 2.2, z * 3.4 + seed * 0.4, 7) - 0.5;
      const r = 1.0 + n * 0.32;
      x *= r; y *= r; z *= r;
      y = Math.max(y, 0.02) * 0.52;
      p[i] = x * radius * 0.96;
      p[i + 1] = y * height * 0.95;
      p[i + 2] = z * radius * 0.90;
    }
    return computeNormals({ pos: p, nrm: null, idx: ico.idx });
  }

  function buildTree(x, y, z, h, seed) {
    const parts = [];
    // 树干
    const trunkH = h * 0.75, trunkR = h * 0.075;
    const seg = 7, ring = 7;
    const tp = [], ti = [];
    for (let i = 0; i <= seg; i++) {
      const yy = (i / seg) * trunkH;
      for (let j = 0; j < ring; j++) {
        const a = TAU * j / ring;
        tp.push(x + Math.cos(a) * trunkR, y + yy, z + Math.sin(a) * trunkR);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < ring; j++) {
        const a = i * ring + j, b = i * ring + (j + 1) % ring;
        const c = (i + 1) * ring + (j + 1) % ring, d = (i + 1) * ring + j;
        ti.push(a, b, c, a, c, d);
      }
    }
    parts.push(computeNormals({ pos: new Float32Array(tp), nrm: null, idx: new Uint32Array(ti) }));

    // 树冠：3 个球
    for (let k = 0; k < 3; k++) {
      const r = h * (0.26 + 0.06 * NZ.noise3(k * 3.1, seed, 0.5, 5));
      const off = [(NZ.noise3(k, seed, 1, 9) - 0.5) * 0.5 * h,
                   trunkH + h * (0.30 + k * 0.26),
                   (NZ.noise3(k, seed, 2, 13) - 0.5) * 0.5 * h];
      const ball = icosphere(2);
      for (let i = 0; i < ball.pos.length; i += 3) {
        ball.pos[i] = ball.pos[i] * r + x + off[0];
        ball.pos[i + 1] = ball.pos[i + 1] * r + y + off[1];
        ball.pos[i + 2] = ball.pos[i + 2] * r + z + off[2];
      }
      parts.push(computeNormals({ pos: ball.pos, nrm: null, idx: ball.idx }));
    }
    return mergeMeshes(parts);
  }

  global.GEO = {
    buildBody, buildFins, buildIslandRock, buildGrassCap, buildTree,
    icosphere, mergeMeshes, computeNormals, blade,
    HALF, bx, by, bz, br, bw, bh, curveVal, smoothstep,
  };
})(window);
