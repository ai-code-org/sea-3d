/* 入口：闭合自动漫游、指数阻尼交互、自适应质量与 HUD。 */
(function(){
  'use strict';
  const canvas=document.getElementById('gl'),fatal=document.getElementById('fatal');
  function fail(e){console.error(e);fatal.textContent='深海场景初始化失败\n\n'+(e.stack||e.message||e);fatal.style.display='block';document.getElementById('loading').style.display='none';}
  let renderer,scene;
  try{renderer=new Renderer(canvas);scene=SCENE.buildScene(renderer);}catch(e){fail(e);return;}
  const camera={eye:new Float32Array(3),target:new Float32Array(3),baseEye:new Float32Array(3),baseTarget:new Float32Array(3),fov:Math.PI/3.15};
  const state={playing:true,phase:0,time:0,speed:1,speedTarget:1,yaw:0,pitch:0,yawTarget:0,pitchTarget:0,dragging:false,qualityMode:'auto',fps:60,drawCalls:0};
  let lastX=0,lastY=0,lastTime=performance.now(),statTime=lastTime,frames=0,adaptTime=lastTime,stableTime=0,captureRequested=false;
  const fpsEl=document.getElementById('fps'),qualityEl=document.getElementById('quality'),resEl=document.getElementById('resolution'),pauseText=document.getElementById('pauseText'),speed=document.getElementById('speed'),speedValue=document.getElementById('speedValue');
  function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800);}
  function togglePause(){state.playing=!state.playing;pauseText.textContent=state.playing?'暂停漫游':'继续漫游';document.querySelector('.pause-icon').textContent=state.playing?'Ⅱ':'▶';toast(state.playing?'漫游已继续':'镜头已停泊，海洋仍在呼吸');}
  function resetView(){state.yawTarget=state.pitchTarget=0;state.speedTarget=1;speed.value='1';speedValue.textContent='1.00×';toast('视角与航速已平滑复位');}
  function setQuality(mode){
    state.qualityMode=mode;renderer.cinema=mode==='cinema';renderer.preferHDR=mode==='cinema';
    if(mode==='cinema'){renderer.quality=2;renderer.requestedSamples=8;renderer.dpr=Math.min(Math.max(devicePixelRatio||1,1),1.75);}
    else if(mode==='high'){renderer.quality=2;renderer.requestedSamples=4;renderer.dpr=Math.min(devicePixelRatio||1,1);}
    else if(mode==='performance'){renderer.quality=0;renderer.requestedSamples=2;renderer.dpr=.75;}
    else{renderer.quality=2;renderer.requestedSamples=4;renderer.dpr=Math.min(devicePixelRatio||1,1);}
    document.getElementById('qualityBtn').textContent='画质：'+({auto:'自动',cinema:'电影',high:'高',performance:'流畅'}[mode]);
    toast(mode==='cinema'?'电影档：原生分辨率、高 MSAA，不自动降清晰度':mode==='auto'?'画质将根据帧率自动调节':'画质已锁定');
  }
  document.getElementById('pause').addEventListener('click',togglePause);document.getElementById('reset').addEventListener('click',resetView);
  document.getElementById('qualityBtn').addEventListener('click',()=>{const modes=['auto','cinema','high','performance'];setQuality(modes[(modes.indexOf(state.qualityMode)+1)%modes.length]);});
  speed.addEventListener('input',()=>{state.speedTarget=Number(speed.value);speedValue.textContent=state.speedTarget.toFixed(2)+'×';});
  canvas.addEventListener('pointerdown',e=>{state.dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.classList.add('grabbing');});
  canvas.addEventListener('pointermove',e=>{if(!state.dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;state.yawTarget-=dx*.0035;state.pitchTarget=Math.max(-.8,Math.min(.8,state.pitchTarget+dy*.003));});
  function endDrag(){state.dragging=false;canvas.classList.remove('grabbing');}canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.speedTarget=Math.max(.35,Math.min(2,state.speedTarget*Math.exp(-e.deltaY*.0008)));speed.value=state.speedTarget;speedValue.textContent=state.speedTarget.toFixed(2)+'×';},{passive:false});
  window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePause();}else if(e.key==='r'||e.key==='R')resetView();else if(e.key==='h'||e.key==='H')document.body.classList.toggle('ui-hidden');else if(e.key==='+'||e.key==='='){state.speedTarget=Math.min(2,state.speedTarget+.1);speed.value=state.speedTarget;speedValue.textContent=state.speedTarget.toFixed(2)+'×';}else if(e.key==='-'){state.speedTarget=Math.max(.35,state.speedTarget-.1);speed.value=state.speedTarget;speedValue.textContent=state.speedTarget.toFixed(2)+'×';}});
  document.getElementById('capture').addEventListener('click',()=>{captureRequested=true;});
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fatal.textContent='WebGL 上下文已丢失，请刷新页面恢复。';fatal.style.display='block';});
  function updateCamera(dt){
    state.speed+=(state.speedTarget-state.speed)*(1-Math.exp(-dt*3.5));state.yaw+=(state.yawTarget-state.yaw)*(1-Math.exp(-dt*8));state.pitch+=(state.pitchTarget-state.pitch)*(1-Math.exp(-dt*8));
    if(state.playing)state.phase=(state.phase+dt*state.speed*SCENE.slowFactor(state.phase)/SCENE.CONFIG.tourSeconds)%1;
    SCENE.catmull(scene.cameraPath,state.phase,camera.baseEye);SCENE.catmull(scene.targetPath,state.phase,camera.baseTarget);SCENE.applyGaze(state.phase,camera.baseEye,camera.baseTarget,scene.dolphins[0].pos);camera.eye.set(camera.baseEye);
    let dx=camera.baseTarget[0]-camera.eye[0],dy=camera.baseTarget[1]-camera.eye[1],dz=camera.baseTarget[2]-camera.eye[2];const len=Math.hypot(dx,dy,dz),yaw=Math.atan2(dx,dz)+state.yaw,pitch=Math.max(-1.1,Math.min(1.1,Math.atan2(dy,Math.hypot(dx,dz))+state.pitch)),cp=Math.cos(pitch);
    camera.target[0]=camera.eye[0]+Math.sin(yaw)*cp*len;camera.target[1]=camera.eye[1]+Math.sin(pitch)*len;camera.target[2]=camera.eye[2]+Math.cos(yaw)*cp*len;
  }
  function adapt(now,fps){if(state.qualityMode!=='auto'||now-adaptTime<2400)return;adaptTime=now;if(fps<43){stableTime=0;if(renderer.dpr>.66)renderer.dpr=Math.max(.65,renderer.dpr-.08);else if(renderer.quality>0){renderer.quality--;renderer.requestedSamples=renderer.quality===2?4:renderer.quality===1?2:1;} }else if(fps>57){stableTime++;if(stableTime>=2){stableTime=0;if(renderer.quality<2){renderer.quality++;renderer.requestedSamples=renderer.quality===2?4:2;}else renderer.dpr=Math.min(1.25,renderer.dpr+.05);}}else stableTime=0;}
  function capture(){captureRequested=false;canvas.toBlob(blob=>{if(!blob){toast('截图失败，请重试');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='深蓝漫游-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已保存当前深海画面');},'image/png');}
  function frame(now){
    const rawDt=(now-lastTime)/1000,dt=Math.min(.05,Math.max(.001,rawDt));lastTime=now;state.time+=dt;
    updateCamera(dt);scene.update(state.time,state.phase,dt);renderer.resize();renderer.renderScene(scene,camera,state.time);renderer.post(state.time);if(captureRequested)capture();
    frames++;const instant=1/Math.max(.001,rawDt);state.fps+= (Math.min(240,instant)-state.fps)*.06;
    if(now-statTime>600){const fps=Math.round(frames*1000/(now-statTime));state.fps=state.fps*.35+fps*.65;fpsEl.textContent=Math.round(state.fps)+' FPS';qualityEl.textContent=state.qualityMode==='cinema'?'电影':(state.qualityMode==='auto'?'自动 · ':'')+['流畅','中','高'][renderer.quality];resEl.textContent=renderer.dpr.toFixed(2)+'× DPR';document.getElementById('depth').innerHTML=(18-camera.eye[1]).toFixed(1)+' <small>M</small>';document.getElementById('depthLine').style.width=Math.max(5,Math.min(100,(18-camera.eye[1])/32*100))+'%';state.drawCalls=renderer.drawCalls;frames=0;statTime=now;adapt(now,state.fps);}
    requestAnimationFrame(frame);
  }
  window.__app={scene,renderer,camera,state,setQuality,resetView,version:'2.0.0'};
  updateCamera(.016);renderer.resize();scene.update(0,0,.016);renderer.renderScene(scene,camera,0);renderer.post(0);
  const err=renderer.gl.getError();if(err!==renderer.gl.NO_ERROR){fail(new Error('WebGL 首次绘制错误：0x'+err.toString(16)));return;}
  document.getElementById('loading').classList.add('done');setTimeout(()=>document.getElementById('loading').style.display='none',900);lastTime=performance.now();statTime=lastTime;adaptTime=lastTime;requestAnimationFrame(frame);
})();
