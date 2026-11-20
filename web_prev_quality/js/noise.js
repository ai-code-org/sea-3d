/* 值噪声 / fbm —— 程序化造形与材质都用它 */
(function (global) {
  'use strict';

  function fract(x) { return x - Math.floor(x); }

  function hash3(x, y, z, seed) {
    let h = x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695040888963407;
    h = (h ^ (h >> 13)) * 1274126177;
    return fract(Math.abs(h * 1e-9));
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /** 3D 值噪声，返回 [0,1] */
  function noise3(x, y, z, seed) {
    seed = seed || 0;
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);

    const c000 = hash3(xi,     yi,     zi,     seed);
    const c100 = hash3(xi + 1, yi,     zi,     seed);
    const c010 = hash3(xi,     yi + 1, zi,     seed);
    const c110 = hash3(xi + 1, yi + 1, zi,     seed);
    const c001 = hash3(xi,     yi,     zi + 1, seed);
    const c101 = hash3(xi + 1, yi,     zi + 1, seed);
    const c011 = hash3(xi,     yi + 1, zi + 1, seed);
    const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

    const x00 = lerp(c000, c100, xf);
    const x10 = lerp(c010, c110, xf);
    const x01 = lerp(c001, c101, xf);
    const x11 = lerp(c011, c111, xf);

    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
  }

  /** 分形叠加 */
  function fbm3(x, y, z, octaves, seed) {
    octaves = octaves || 4;
    let amp = 0.5, freq = 1.0, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise3(x * freq, y * freq, z * freq, (seed || 0) + i * 17);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }

  global.NZ = { noise3, fbm3, hash3, smooth, lerp, fract };
})(window);
