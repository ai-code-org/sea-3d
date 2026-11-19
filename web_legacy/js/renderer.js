/* 原生 WebGL2 渲染器：程序编译 / VAO / FBO / Bloom 后期 */
(function (global) {
  'use strict';

  const M4 = global.M4;

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('Shader 编译失败:\n' + log + '\n--- 源码 ---\n' + src);
      throw new Error(log);
    }
    return sh;
  }

  function createProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { prog: p, u: uniforms };
  }

  function meshToVAO(gl, mesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    if (mesh.nrm) {
      const nb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, nb);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.nrm, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    }

    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return { vao, count: mesh.idx.length };
  }

  function createFBO(gl, w, h, withDepth, hdr) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    let depth = null;
    if (withDepth) {
      depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, depth, w, h, ok };
  }

  function Renderer(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, powerPreference: 'high-performance', depth: true,
    });
    if (!gl) throw new Error('浏览器不支持 WebGL2');

    this.gl = gl;
    this.canvas = canvas;
    const extCBF = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    this.hdr = !!extCBF;

    const S = global.SHADERS;
    this.pScene  = createProgram(gl, S.sceneVS, S.sceneFS);
    this.pSky    = createProgram(gl, S.fsQuadVS, S.skyFS);
    this.pCloud  = createProgram(gl, S.cloudVS, S.cloudFS);
    this.pStar   = createProgram(gl, S.starVS, S.starFS);
    this.pBright = createProgram(gl, S.fsQuadVS, S.brightFS);
    this.pBlur   = createProgram(gl, S.fsQuadVS, S.blurFS);
    this.pComp   = createProgram(gl, S.fsQuadVS, S.compositeFS);

    // 全屏三角形
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.normalBuf = new Float32Array(9);
    this.proj = M4.create();
    this.view = M4.create();
    this.vp = M4.create();
    this.invVP = M4.create();

    this.fbos = null;
    this.dpr = Math.min(global.devicePixelRatio || 1, 1.0);
  }

  Renderer.prototype.resize = function () {
    const gl = this.gl;
    const w = Math.floor(this.canvas.clientWidth * this.dpr);
    const h = Math.floor(this.canvas.clientHeight * this.dpr);
    if (w === 0 || h === 0) return;
    if (this.canvas.width === w && this.canvas.height === h) return;

    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;

    if (this.fbos) {
      for (const f of Object.values(this.fbos)) {
        if (f.fb) gl.deleteFramebuffer(f.fb);
        if (f.tex) gl.deleteTexture(f.tex);
        if (f.depth) gl.deleteRenderbuffer(f.depth);
      }
    }
    const hw = Math.max(2, Math.floor(w / 2));
    const hh = Math.max(2, Math.floor(h / 2));
    const hdr = this.hdr;
    this.fbos = {
      scene:  createFBO(gl, w, h, true, hdr),
      bright: createFBO(gl, hw, hh, false, hdr),
      blurA:  createFBO(gl, hw, hh, false, hdr),
      blurB:  createFBO(gl, hw, hh, false, hdr),
    };
    if (!this.fbos.scene.ok && hdr) {
      // 显卡不支持浮点 FBO，退回 8bit
      this.hdr = false;
      for (const f of Object.values(this.fbos)) {
        gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex);
        if (f.depth) gl.deleteRenderbuffer(f.depth);
      }
      this.fbos = {
        scene:  createFBO(gl, w, h, true, false),
        bright: createFBO(gl, hw, hh, false, false),
        blurA:  createFBO(gl, hw, hh, false, false),
        blurB:  createFBO(gl, hw, hh, false, false),
      };
    }
  };

  /* ---------- 场景渲染 ---------- */

  Renderer.prototype.renderScene = function (scene, camera, time) {
    const gl = this.gl;

    M4.perspective(this.proj, camera.fov, this.width / this.height, 0.1, 900);
    M4.lookAt(this.view, camera.eye, camera.target, [0, 1, 0]);
    M4.multiply(this.vp, this.proj, this.view);
    M4.invert(this.invVP, this.vp);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.scene.fb);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 1. 天空
    gl.useProgram(this.pSky.prog);
    gl.uniformMatrix4fv(this.pSky.u.uInvVP, false, this.invVP);
    gl.uniform3fv(this.pSky.u.uZenith, scene.palette.zenith);
    gl.uniform3fv(this.pSky.u.uHorizon, scene.palette.horizon);
    gl.uniform3fv(this.pSky.u.uNebula, scene.palette.nebula);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. 云（半透明，先画）
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const camRight = [this.view[0], this.view[4], this.view[8]];
    const camUp = [this.view[1], this.view[5], this.view[9]];

    gl.useProgram(this.pCloud.prog);
    gl.uniformMatrix4fv(this.pCloud.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pCloud.u.uView, false, this.view);
    gl.uniform3fv(this.pCloud.u.uCamRight, camRight);
    gl.uniform3fv(this.pCloud.u.uCamUp, camUp);
    gl.uniform3fv(this.pCloud.u.uCloudColor, scene.palette.cloudColor);
    gl.uniform3fv(this.pCloud.u.uCloudGlow, scene.palette.cloudGlow);
    gl.uniform1f(this.pCloud.u.uOpacity, 0.68);
    gl.bindVertexArray(scene.cloudVAO);
    gl.drawArrays(gl.TRIANGLES, 0, scene.cloudCount);

    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 3. 不透明物体
    gl.useProgram(this.pScene.prog);
    const P = this.pScene;
    gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(P.u.uView, false, this.view);
    gl.uniform3fv(P.u.uCamPos, camera.eye);
    gl.uniform3fv(P.u.uLightDir, scene.lightDir);
    gl.uniform3fv(P.u.uLightColor, scene.palette.lightColor);
    gl.uniform3fv(P.u.uAmbient, scene.palette.ambient);
    gl.uniform1f(P.u.uTime, time);

    for (const obj of scene.objects) {
      const m = obj.material;
      gl.uniformMatrix4fv(P.u.uModel, false, obj.model);
      M4.normalMatrix(this.normalBuf, obj.model);
      gl.uniformMatrix3fv(P.u.uNormalMat, false, this.normalBuf);

      gl.uniform3fv(P.u.uAlbedo, m.albedo);
      gl.uniform3fv(P.u.uAlbedo2, m.albedo2 || m.albedo);
      gl.uniform3fv(P.u.uSpotColor, m.spotColor || scene.palette.spotColor);
      gl.uniform1f(P.u.uGradient, m.gradient || 0);
      gl.uniform1f(P.u.uRough, m.rough === undefined ? 0.8 : m.rough);
      gl.uniform1f(P.u.uSpotty, m.spotty || 0);
      gl.uniform1f(P.u.uSpotStrength, m.spotStrength || 0);
      gl.uniform1f(P.u.uSpotScale, m.spotScale || 5.5);
      gl.uniform1f(P.u.uEmissive, m.emissive || 0);
      gl.uniform1f(P.u.uRimStrength, m.rim === undefined ? 0.5 : m.rim);
      gl.uniform1f(P.u.uNoiseScale, m.noiseScale === undefined ? 3.4 : m.noiseScale);
      gl.uniform1f(P.u.uWave, m.wave || 0);

      gl.bindVertexArray(obj.vao);
      gl.drawElements(gl.TRIANGLES, obj.count, gl.UNSIGNED_INT, 0);
    }

    // 4. 星点（加色）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this.pStar.prog);
    gl.uniformMatrix4fv(this.pStar.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pStar.u.uView, false, this.view);
    gl.uniform1f(this.pStar.u.uPixelRatio, this.dpr);
    gl.uniform1f(this.pStar.u.uTime, time);
    gl.uniform3fv(this.pStar.u.uStarColor, scene.palette.starColor);
    gl.bindVertexArray(scene.starVAO);
    gl.drawArrays(gl.POINTS, 0, scene.starCount);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  /* ---------- 后期 ---------- */

  Renderer.prototype.post = function (time) {
    const gl = this.gl;
    const f = this.fbos;

    // 亮度提取
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.bright.fb);
    gl.viewport(0, 0, f.bright.w, f.bright.h);
    gl.useProgram(this.pBright.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, f.scene.tex);
    gl.uniform1i(this.pBright.u.uTex, 0);
    gl.uniform1f(this.pBright.u.uThreshold, 0.72);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 高斯模糊：横 → 纵 → 横 → 纵
    const pass = (srcTex, dst, dx, dy) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.useProgram(this.pBlur.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(this.pBlur.u.uTex, 0);
      gl.uniform2f(this.pBlur.u.uDir, dx / dst.w, dy / dst.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const s = 1.6;
    pass(f.bright.tex, f.blurA, s, 0);
    pass(f.blurA.tex, f.blurB, 0, s);
    pass(f.blurB.tex, f.blurA, s * 1.9, 0);
    pass(f.blurA.tex, f.blurB, 0, s * 1.9);

    // 合成到屏幕
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.pComp.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, f.scene.tex);
    gl.uniform1i(this.pComp.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, f.blurB.tex);
    gl.uniform1i(this.pComp.u.uBloom, 1);
    gl.uniform1f(this.pComp.u.uBloomStrength, 0.62);
    gl.uniform1f(this.pComp.u.uExposure, 1.0);
    gl.uniform1f(this.pComp.u.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  /* ---------- 资源上传 ---------- */

  Renderer.prototype.uploadMesh = function (mesh) {
    return meshToVAO(this.gl, mesh);
  };

  Renderer.prototype.uploadClouds = function (clouds) {
    const gl = this.gl;
    // 每个云 6 顶点（两个三角形）
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    const n = clouds.length * 6;
    const cornerData = new Float32Array(n * 2);
    const centerData = new Float32Array(n * 3);
    const sizeData = new Float32Array(n * 2);
    const seedData = new Float32Array(n);
    let k = 0;
    for (const c of clouds) {
      for (const cr of corners) {
        cornerData[k * 2] = cr[0];
        cornerData[k * 2 + 1] = cr[1];
        centerData[k * 3] = c.x;
        centerData[k * 3 + 1] = c.y;
        centerData[k * 3 + 2] = c.z;
        sizeData[k * 2] = c.w;
        sizeData[k * 2 + 1] = c.h;
        seedData[k] = c.seed;
        k++;
      }
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attrs = [
      [0, cornerData, 2], [1, centerData, 3], [2, sizeData, 2], [3, seedData, 1],
    ];
    for (const [loc, data, size] of attrs) {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    return { vao, count: n };
  };

  Renderer.prototype.uploadStars = function (stars) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, stars.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, stars.size, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);

    const eb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, eb);
    gl.bufferData(gl.ARRAY_BUFFER, stars.seed, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return { vao, count: stars.count };
  };

  global.Renderer = Renderer;
})(window);
