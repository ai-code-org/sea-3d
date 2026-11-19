/* 入口：相机轨道控制、调色切换、渲染循环 */
(function () {
  'use strict';

  const canvas = document.getElementById('gl');
  let renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    document.getElementById('fatal').textContent = '初始化失败：' + e.message;
    document.getElementById('fatal').style.display = 'block';
    return;
  }

  let scene = SCENE.buildScene(renderer, 'night');
  window.__scene = scene;
  window.__renderer = renderer;

  const cam = {
    az: 0.10,
    el: 0.12,
    dist: 42,
    target: [0, 2.4, -8],
    fov: Math.PI / 4,
    eye: [0, 0, 46],
  };

  let autoRotate = true;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function updateCamera() {
    const ce = Math.cos(cam.el), se = Math.sin(cam.el);
    cam.eye = [
      cam.target[0] + Math.sin(cam.az) * ce * cam.dist,
      cam.target[1] + se * cam.dist,
      cam.target[2] + Math.cos(cam.az) * ce * cam.dist,
    ];
  }

  /* ---- 交互 ---- */
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    cam.az -= dx * 0.005;
    cam.el = Math.max(-0.55, Math.min(0.95, cam.el + dy * 0.004));
  });

  const endDrag = () => {
    dragging = false;
    canvas.classList.remove('grabbing');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.dist = Math.max(14, Math.min(120, cam.dist * (1 + Math.sign(e.deltaY) * 0.09)));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      autoRotate = !autoRotate;
    }
    if (e.key === '1') setPalette('night', document.querySelector('[data-pal="night"]'));
    if (e.key === '2') setPalette('arctic', document.querySelector('[data-pal="arctic"]'));
    if (e.key === '3') setPalette('dusk', document.querySelector('[data-pal="dusk"]'));
  });

  function setPalette(key, btn) {
    scene.palette = SCENE.PALETTES[key];
    document.querySelectorAll('.palette button').forEach((b) => b.classList.remove('on'));
    if (btn) btn.classList.add('on');
    document.body.dataset.palette = key;
  }

  document.querySelectorAll('.palette button').forEach((btn) => {
    btn.addEventListener('click', () => setPalette(btn.dataset.pal, btn));
  });

  /* ---- 主循环 ---- */
  let t0 = performance.now();
  let frames = 0, fpsTime = 0;
  const statsEl = document.getElementById('stats');

  function frame(now) {
    const time = (now - t0) / 1000;

    renderer.resize();
    if (autoRotate && !dragging) cam.az += 0.0012;
    updateCamera();

    renderer.renderScene(scene, cam, time);
    renderer.post(time);

    frames++;
    if (now - fpsTime > 500) {
      const fps = Math.round(frames * 1000 / (now - fpsTime));
      statsEl.textContent = fps + ' FPS · ' + (renderer.width || 0) + '×' + (renderer.height || 0);
      frames = 0;
      fpsTime = now;
    }
    requestAnimationFrame(frame);
  }

  renderer.resize();
  updateCamera();
  requestAnimationFrame(frame);

  document.getElementById('loading').style.display = 'none';
})();
