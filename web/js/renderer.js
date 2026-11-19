/* 原生 WebGL2：VAO / instancing / MSAA resolve / HDR Bloom / FXAA。 */
(function (global) {
  'use strict';
  const M4=global.M4,UP=[0,1,0];
  function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);console.error(log,src);throw new Error('Shader 编译失败：'+log);}return s;}
  function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Shader 链接失败：'+gl.getProgramInfoLog(p));const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i),name=info.name.replace(/\[0\]$/,'');u[name]=gl.getUniformLocation(p,name);}return{p,u};}
  function bindVec(gl,loc,size,data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);return b;}
  function fbo(gl,w,h,depth,hdr){const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,hdr?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);let rb=null;if(depth){rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);}if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer 初始化失败');gl.bindFramebuffer(gl.FRAMEBUFFER,null);return{fb,tex,rb,w,h};}
  function sceneTarget(gl,w,h,hdr,samples){
    const resolve=fbo(gl,w,h,samples<2,hdr);let ms=null;
    if(samples>1){const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);const color=gl.createRenderbuffer(),depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,color);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,hdr?gl.RGBA16F:gl.RGBA8,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,color);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('MSAA Framebuffer 初始化失败');ms={fb,color,depth};}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);return{resolve,ms,samples};
  }
  function destroyFBO(gl,f){if(!f)return;gl.deleteFramebuffer(f.fb);gl.deleteTexture(f.tex);if(f.rb)gl.deleteRenderbuffer(f.rb);}
  function destroyScene(gl,s){if(!s)return;destroyFBO(gl,s.resolve);if(s.ms){gl.deleteFramebuffer(s.ms.fb);gl.deleteRenderbuffer(s.ms.color);gl.deleteRenderbuffer(s.ms.depth);}}
  function Renderer(canvas){
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
    if(!gl)throw new Error('此浏览器不支持 WebGL2');
    this.gl=gl;this.canvas=canvas;this.floatExt=!!gl.getExtension('EXT_color_buffer_float');this.hdr=this.floatExt;this.quality=2;this.cinema=false;this.requestedSamples=4;this.msaaSamples=1;this.dpr=Math.min(devicePixelRatio||1,1);this.drawCalls=0;
    const S=global.SHADERS;
    this.programs={object:program(gl,S.baseVS,S.objectFS),dolphin:program(gl,S.dolphinVS,S.dolphinFS),fish:program(gl,S.fishVS,S.fishFS),inst:program(gl,S.instVS,S.objectFS),kelp:program(gl,S.instVS,S.kelpFS),terrain:program(gl,S.terrainVS,S.terrainFS),water:program(gl,S.waterVS,S.waterFS),sky:program(gl,S.fsQuadVS,S.skyFS),particle:program(gl,S.particleVS,S.particleFS),shaft:program(gl,S.shaftVS,S.shaftFS),bright:program(gl,S.fsQuadVS,S.brightFS),blur:program(gl,S.fsQuadVS,S.blurFS),composite:program(gl,S.fsQuadVS,S.compositeFS),fxaa:program(gl,S.fsQuadVS,S.fxaaFS)};
    this.quad=gl.createVertexArray();gl.bindVertexArray(this.quad);bindVec(gl,0,2,new Float32Array([-1,-1,3,-1,-1,3]));gl.bindVertexArray(null);
    this.proj=M4.create();this.view=M4.create();this.vp=M4.create();this.invVP=M4.create();this.fbos=null;
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  }
  Renderer.prototype.uploadMesh=function(m){const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);bindVec(gl,0,3,m.pos);if(m.nrm)bindVec(gl,1,3,m.nrm);if(m.col)bindVec(gl,2,3,m.col);if(m.uv)bindVec(gl,3,2,m.uv);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,count:m.idx.length};};
  Renderer.prototype.uploadInstances=function(m,data,dynamic){const gl=this.gl,out=this.uploadMesh(m);gl.bindVertexArray(out.vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);for(let i=0;i<3;i++){const loc=4+i;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,48,i*16);gl.vertexAttribDivisor(loc,1);}gl.bindVertexArray(null);out.buffer=b;out.instances=data.length/12;out.data=data;return out;};
  Renderer.prototype.uploadShafts=function(data){const gl=this.gl,m=global.GEO.mesh([-1,0,0,1,0,0,-1,1,0,1,1,0],[0,1,2,2,1,3],null,null,[0,0,1,0,0,1,1,1]),out=this.uploadMesh(m);gl.bindVertexArray(out.vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);for(let i=0;i<2;i++){gl.enableVertexAttribArray(4+i);gl.vertexAttribPointer(4+i,4,gl.FLOAT,false,32,i*16);gl.vertexAttribDivisor(4+i,1);}gl.bindVertexArray(null);out.instances=data.length/8;return out;};
  Renderer.prototype.uploadParticles=function(data){const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);bindVec(gl,0,4,data);gl.bindVertexArray(null);return{vao,count:data.length/4};};
  Renderer.prototype.sampleConfig=function(requested){
    const gl=this.gl,max=Math.min(requested,gl.getParameter(gl.MAX_SAMPLES));let hdr=this.floatExt;
    function supported(format){const a=gl.getInternalformatParameter(gl.RENDERBUFFER,format,gl.SAMPLES);let best=0;for(let i=0;i<a.length;i++)best=Math.max(best,a[i]);return best;}
    let floatSamples=hdr?supported(gl.RGBA16F):0;if(hdr&&max>1&&floatSamples<2)hdr=false;
    const available=hdr?floatSamples:supported(gl.RGBA8),samples=max>1?Math.max(1,Math.min(max,available)):1;
    return{hdr,samples};
  };
  Renderer.prototype.resize=function(){const c=this.canvas,w=Math.max(2,Math.floor(c.clientWidth*this.dpr)),h=Math.max(2,Math.floor(c.clientHeight*this.dpr));if(c.width===w&&c.height===h&&this.fbos&&this.fbos.requestedSamples===this.requestedSamples)return;c.width=w;c.height=h;this.width=w;this.height=h;const gl=this.gl,cfg=this.sampleConfig(this.requestedSamples);this.hdr=cfg.hdr;this.msaaSamples=cfg.samples;if(this.fbos){destroyScene(gl,this.fbos.scene);destroyFBO(gl,this.fbos.a);destroyFBO(gl,this.fbos.b);destroyFBO(gl,this.fbos.ldr);}const bw=Math.max(2,Math.floor(w/4)),bh=Math.max(2,Math.floor(h/4));this.fbos={scene:sceneTarget(gl,w,h,cfg.hdr,cfg.samples),a:fbo(gl,bw,bh,false,cfg.hdr),b:fbo(gl,bw,bh,false,cfg.hdr),ldr:fbo(gl,w,h,false,false),requestedSamples:this.requestedSamples};};
  Renderer.prototype.setCommon=function(p,scene,time){const gl=this.gl,u=p.u;if(u.uVP)gl.uniformMatrix4fv(u.uVP,false,this.vp);if(u.uView)gl.uniformMatrix4fv(u.uView,false,this.view);if(u.uProj)gl.uniformMatrix4fv(u.uProj,false,this.proj);if(u.uTime)gl.uniform1f(u.uTime,time);if(u.uEye)gl.uniform3fv(u.uEye,scene.camera.eye);if(u.uSunDir)gl.uniform3fv(u.uSunDir,scene.sunDir);if(u.uDpr)gl.uniform1f(u.uDpr,this.dpr);};
  Renderer.prototype.draw=function(p,o){const gl=this.gl;gl.bindVertexArray(o.vao);if(o.instances)gl.drawElementsInstanced(gl.TRIANGLES,o.count,gl.UNSIGNED_INT,0,o.instances);else gl.drawElements(gl.TRIANGLES,o.count,gl.UNSIGNED_INT,0);this.drawCalls++;};
  Renderer.prototype.renderScene=function(scene,camera,time){
    const gl=this.gl,w=this.width,h=this.height,S=this.fbos.scene;this.drawCalls=0;scene.camera=camera;
    M4.perspective(this.proj,camera.fov,w/h,.12,500);M4.lookAt(this.view,camera.eye,camera.target,UP);M4.multiply(this.vp,this.proj,this.view);M4.invert(this.invVP,this.vp);
    gl.bindFramebuffer(gl.FRAMEBUFFER,S.ms?S.ms.fb:S.resolve.fb);gl.viewport(0,0,w,h);gl.clearColor(.004,.07,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
    let p=this.programs.sky;gl.useProgram(p.p);gl.uniformMatrix4fv(p.u.uInvVP,false,this.invVP);gl.uniform3fv(p.u.uEye,camera.eye);gl.uniform1f(p.u.uTime,time);gl.bindVertexArray(this.quad);gl.drawArrays(gl.TRIANGLES,0,3);this.drawCalls++;
    gl.enable(gl.DEPTH_TEST);
    p=this.programs.terrain;gl.useProgram(p.p);this.setCommon(p,scene,time);this.draw(p,scene.terrain);
    p=this.programs.inst;gl.useProgram(p.p);this.setCommon(p,scene,time);gl.uniform1f(p.u.uSway,0);gl.uniform4f(p.u.uTint,1,1,1,1);this.draw(p,scene.rocks);this.draw(p,scene.corals);
    p=this.programs.kelp;gl.useProgram(p.p);this.setCommon(p,scene,time);gl.uniform1f(p.u.uSway,1);this.draw(p,scene.kelp);
    p=this.programs.dolphin;gl.useProgram(p.p);this.setCommon(p,scene,time);for(let i=0;i<scene.dolphins.length;i++){const d=scene.dolphins[i];gl.uniformMatrix4fv(p.u.uModel,false,d.model);gl.uniform1f(p.u.uPhase,d.phase);this.draw(p,d.mesh);}
    p=this.programs.fish;gl.useProgram(p.p);this.setCommon(p,scene,time);for(let i=0;i<scene.schools.length;i++){const s=scene.schools[i];gl.uniform1i(p.u.uKind,s.kind);this.draw(p,s.mesh);}
    p=this.programs.water;gl.useProgram(p.p);this.setCommon(p,scene,time);this.draw(p,scene.waterMeshes[this.quality]);
    gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    p=this.programs.shaft;gl.useProgram(p.p);this.setCommon(p,scene,time);this.draw(p,scene.shafts);
    p=this.programs.particle;gl.useProgram(p.p);this.setCommon(p,scene,time);gl.bindVertexArray(scene.particles.vao);gl.drawArrays(gl.POINTS,0,scene.particleCounts[this.quality]);this.drawCalls++;
    gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);
    if(S.ms){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,S.ms.fb);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,S.resolve.fb);gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);}
  };
  Renderer.prototype.post=function(time){
    const gl=this.gl,F=this.fbos;gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(this.quad);gl.activeTexture(gl.TEXTURE0);
    if(this.quality>0){let p=this.programs.bright;gl.bindFramebuffer(gl.FRAMEBUFFER,F.a.fb);gl.viewport(0,0,F.a.w,F.a.h);gl.useProgram(p.p);gl.bindTexture(gl.TEXTURE_2D,F.scene.resolve.tex);gl.uniform1i(p.u.uTex,0);gl.drawArrays(gl.TRIANGLES,0,3);
      p=this.programs.blur;gl.useProgram(p.p);gl.uniform1i(p.u.uTex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,F.b.fb);gl.bindTexture(gl.TEXTURE_2D,F.a.tex);gl.uniform2f(p.u.uDir,1/F.a.w,0);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,F.a.fb);gl.bindTexture(gl.TEXTURE_2D,F.b.tex);gl.uniform2f(p.u.uDir,0,1/F.a.h);gl.drawArrays(gl.TRIANGLES,0,3);this.drawCalls+=3;
    }
    let p=this.programs.composite;gl.bindFramebuffer(gl.FRAMEBUFFER,F.ldr.fb);gl.viewport(0,0,this.width,this.height);gl.useProgram(p.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,F.scene.resolve.tex);gl.uniform1i(p.u.uScene,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.quality>0?F.a.tex:F.scene.resolve.tex);gl.uniform1i(p.u.uBloom,1);gl.uniform1f(p.u.uBloomAmount,this.cinema?.24:this.quality===2?.20:this.quality===1?.14:0);gl.uniform1f(p.u.uTime,time);gl.drawArrays(gl.TRIANGLES,0,3);this.drawCalls++;
    p=this.programs.fxaa;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(p.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,F.ldr.tex);gl.uniform1i(p.u.uTex,0);gl.uniform2f(p.u.uInvResolution,1/this.width,1/this.height);gl.uniform1f(p.u.uTime,time);gl.drawArrays(gl.TRIANGLES,0,3);this.drawCalls++;gl.bindVertexArray(null);gl.enable(gl.DEPTH_TEST);
  };
  global.Renderer=Renderer;
})(window);
