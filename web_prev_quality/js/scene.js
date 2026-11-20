/* 生态、稳定朝向、群游流场与闭环近距遭遇编排。 */
(function (global) {
  'use strict';
  const G=global.GEO,NZ=global.NZ,M4=global.M4,TAU=Math.PI*2;
  const CONFIG={fishCounts:[72,48,36],kelpCount:192,rockCount:64,coralCount:48,particleCount:1600,terrainSize:600,terrainSegments:128,waterSegments:[32,56,88],tourSeconds:120};
  const DOLPHIN_EVENT={phase:.74,window:.065};
  const FISH_EVENTS=[{phase:.26,window:.070,side:1},{phase:.56,window:.075,side:-1}];
  function rng(seed){return function(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
  function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
  function height(x,z){const broad=NZ.fbm3(x*.035,z*.035,1.7,4,19),detail=NZ.noise3(x*.16,z*.16,2.1,8),ridge=Math.sin(x*.09+Math.sin(z*.06))*Math.cos(z*.075)*.55;return-11.5+broad*4.1+detail*.32+ridge;}
  function catmull(points,t,out){const n=points.length;let f=((t%1)+1)%1*n,i=Math.floor(f),u=f-i;const p0=points[(i-1+n)%n],p1=points[i%n],p2=points[(i+1)%n],p3=points[(i+2)%n],u2=u*u,u3=u2*u;for(let k=0;k<3;k++)out[k]=.5*(2*p1[k]+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u3);return out;}
  function phaseWindow(phase,event,out){let d=((phase-event.phase+.5)%1+1)%1-.5,u=d/event.window+.5;out[1]=u;if(u<=0||u>=1){out[0]=0;out[1]=Math.max(0,Math.min(1,u));return 0;}out[0]=smooth(u/.18)*(1-smooth((u-.82)/.18));return out[0];}
  function basis(eye,target,F,R,U){let fx=target[0]-eye[0],fy=target[1]-eye[1],fz=target[2]-eye[2],l=Math.hypot(fx,fy,fz)||1;fx/=l;fy/=l;fz/=l;let rx=fz,ry=0,rz=-fx;l=Math.hypot(rx,rz)||1;rx/=l;rz/=l;F[0]=fx;F[1]=fy;F[2]=fz;R[0]=rx;R[1]=0;R[2]=rz;U[0]=-fz*0;U[0]=R[1]*fz-rz*fy;U[1]=rz*fx-rx*fz;U[2]=rx*fy-R[1]*fx;}
  function compose(d,pos,fx,fy,fz,dt){
    let fl=Math.hypot(fx,fy,fz)||1;fx/=fl;fy/=fl;fz/=fl;
    const turn=d.prevDir[2]*fx-d.prevDir[0]*fz,targetBank=Math.max(-.30,Math.min(.30,turn*24)),blend=1-Math.exp(-Math.max(0,dt)*4);
    d.bank+=(targetBank-d.bank)*blend;d.prevDir[0]=fx;d.prevDir[1]=fy;d.prevDir[2]=fz;
    let ux=0,uy=1,uz=0,dot=fy;ux=-fx*dot;uy=1-fy*dot;uz=-fz*dot;let ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
    let sx=fy*uz-fz*uy,sy=fz*ux-fx*uz,sz=fx*uy-fy*ux;const c=Math.cos(d.bank),s=Math.sin(d.bank),ux2=ux*c+sx*s,uy2=uy*c+sy*s,uz2=uz*c+sz*s;sx=sx*c-ux*s;sy=sy*c-uy*s;sz=sz*c-uz*s;ux=ux2;uy=uy2;uz=uz2;
    const m=d.model,sc=d.scale;m[0]=fx*sc;m[1]=fy*sc;m[2]=fz*sc;m[3]=0;m[4]=ux*sc;m[5]=uy*sc;m[6]=uz*sc;m[7]=0;m[8]=sx*sc;m[9]=sy*sc;m[10]=sz*sc;m[11]=0;m[12]=pos[0];m[13]=pos[1];m[14]=pos[2];m[15]=1;d.pos.set(pos);
  }
  function modelAt(d,t,dt){catmull(d.path,t,d.pos);catmull(d.path,t+.0008,d.next);const fx=d.next[0]-d.pos[0],fy=d.next[1]-d.pos[1],fz=d.next[2]-d.pos[2];compose(d,d.pos,fx,fy,fz,dt);const target=4.2+d.speed*55;d.frequency+=(target-d.frequency)*(1-Math.exp(-dt*2));}
  function buildDolphins(renderer){
    const upload=renderer.uploadMesh(G.dolphin());
    const main=[[0,3,3],[-9,4,8],[-16,1,-1],[-8,0,-13],[6,2,-12],[17,2.6,-10],[19,2.2,1]];
    const paths=[main,[[-25,7,-8],[-12,9,-24],[8,8,-26],[25,5,-10],[18,8,8],[-4,10,15]],[[24,0,5],[15,1,20],[-4,2,25],[-20,4,14],[-12,3,-2],[8,0,-4]],[[2,11,-18],[18,10,-8],[22,12,8],[5,13,15],[-12,12,5],[-16,10,-10]]];
    const scales=[1,.58,.48,.40],speeds=[.014,.008,.010,.007],dolphins=[];
    for(let i=0;i<4;i++)dolphins.push({mesh:upload,path:paths[i],scale:scales[i],speed:speeds[i],phase:i*1.71,offset:i===0?0:i*.173,model:M4.create(),pos:new Float32Array(3),next:new Float32Array(3),prevDir:new Float32Array([1,0,0]),bank:0,frequency:4.6+i*.3,escortWeight:0});
    return dolphins;
  }
  function updateMain(d,phase,dt,eye,F,R,U,stats){
    catmull(d.path,phase,d.pos);catmull(d.path,phase+.0008,d.next);let fx=d.next[0]-d.pos[0],fy=d.next[1]-d.pos[1],fz=d.next[2]-d.pos[2],x=d.pos[0],y=d.pos[1],z=d.pos[2];
    const info=d.eventInfo;phaseWindow(phase,DOLPHIN_EVENT,info);const w=info[0],u=info[1];d.escortWeight=w;
    if(w>0){
      let depth,lateral,vertical,dx,dy,dz;
      if(u<.68){const v=u/.68;depth=3.55+.28*Math.sin(v*Math.PI);lateral=-1.90+.20*Math.sin(v*TAU);vertical=.28+.12*Math.sin(v*Math.PI);dx=F[0]+R[0]*.12;dy=F[1]+R[1]*.12;dz=F[2]+R[2]*.12;}
      else{const v=smooth((u-.68)/.32);depth=3.55-.88*v;lateral=-1.90+2.90*v;vertical=.28+.20*v;dx=R[0]*(.82+.18*v)+F[0]*.25;dy=R[1]*(.82+.18*v)+F[1]*.25+.025;dz=R[2]*(.82+.18*v)+F[2]*.25;}
      const nx=eye[0]+F[0]*depth+R[0]*lateral+U[0]*vertical,ny=eye[1]+F[1]*depth+R[1]*lateral+U[1]*vertical,nz=eye[2]+F[2]*depth+R[2]*lateral+U[2]*vertical;
      x=x*(1-w)+nx*w;y=y*(1-w)+ny*w;z=z*(1-w)+nz*w;fx=fx*(1-w)+dx*w;fy=fy*(1-w)+dy*w;fz=fz*(1-w)+dz*w;
      if(w>.75)stats.dolphin=Math.min(stats.dolphin,Math.hypot(x-eye[0],y-eye[1],z-eye[2]));
    }
    d.pose[0]=x;d.pose[1]=y;d.pose[2]=z;compose(d,d.pose,fx,fy,fz,dt);const target=4.8+w*1.15;d.frequency+=(target-d.frequency)*(1-Math.exp(-dt*2.5));
  }
  function buildSchools(renderer){
    const random=rng(88421),schools=[],colors=[[.54,.76,.79],[.95,.62,.15],[.24,.66,.74]];
    for(let kind=0;kind<3;kind++){
      const count=CONFIG.fishCounts[kind],data=new Float32Array(count*12),seeds=new Float32Array(count*4),scales=new Float32Array(count),mesh=renderer.uploadInstances(G.fish(kind),data,true);
      for(let i=0;i<count;i++){
        seeds[i*4]=random()*TAU;seeds[i*4+1]=random();seeds[i*4+2]=random();seeds[i*4+3]=random()*TAU;
        scales[i]=kind===0?.30+random()*.16:kind===1?.46+random()*.22:.52+random()*.24;data[i*12+3]=scales[i];const tone=.78+random()*.32;
        data[i*12+8]=colors[kind][0]*tone;data[i*12+9]=colors[kind][1]*tone;data[i*12+10]=colors[kind][2]*tone;data[i*12+11]=kind===0?8+random()*3:5+random()*2;
      }
      schools.push({kind,count,data,seeds,scales,mesh,center:new Float32Array(3),eventInfo:new Float32Array(2)});
    }return schools;
  }
  function updateFish(s,time,eye,F,R,U,stats){
    const data=s.data,seeds=s.seeds,kind=s.kind,c=s.center,event=FISH_EVENTS[kind===1?1:0],info=s.eventInfo;phaseWindow(currentPhase,event,info);const encounter=info[0],progress=info[1],nearCount=kind===2?0:8;
    if(kind===0){c[0]=Math.sin(time*.035)*3;c[1]=3.2+Math.sin(time*.08)*.7;c[2]=Math.cos(time*.04)*2;}
    else if(kind===1){c[0]=-13+Math.sin(time*.045)*4;c[1]=-2.2;c[2]=3+Math.cos(time*.04)*3;}
    else{c[0]=7;c[1]=1+Math.sin(time*.06);c[2]=-12+Math.sin(time*.035)*4;}
    for(let i=0;i<s.count;i++){
      const o=i*12,q=i*4,a0=seeds[q],r=seeds[q+1],h=seeds[q+2],ph=seeds[q+3];let a,x,y,z,nx,ny,nz;
      if(kind===0){a=a0+time*(.16+r*.045);const rad=3.8+r*6.5,aa=a+.025;x=c[0]+Math.cos(a)*rad;z=c[2]+Math.sin(a)*rad*.68;y=c[1]+Math.sin(a*1.7+ph)*1.6+(h-.5)*3.1;nx=c[0]+Math.cos(aa)*rad;nz=c[2]+Math.sin(aa)*rad*.68;ny=c[1]+Math.sin(aa*1.7+ph)*1.6+(h-.5)*3.1;}
      else if(kind===1){a=a0+time*.092;const rad=6.2+r*3.7,aa=a+.025;x=c[0]+Math.cos(a)*rad;z=c[2]+Math.sin(a)*rad*.52;y=c[1]+Math.sin(a*1.6+ph)*1.05+(h-.5)*2.5;nx=c[0]+Math.cos(aa)*rad;nz=c[2]+Math.sin(aa)*rad*.52;ny=c[1]+Math.sin(aa*1.6+ph)*1.05+(h-.5)*2.5;}
      else{a=a0*.42+time*.064;const rad=7+r*4.5,aa=a+.02;x=c[0]+Math.cos(a)*rad;z=c[2]+Math.sin(a)*rad*.72;y=c[1]+Math.sin(a*1.2+ph)*1.35+(h-.5)*3.8;nx=c[0]+Math.cos(aa)*rad;nz=c[2]+Math.sin(aa)*rad*.72;ny=c[1]+Math.sin(aa*1.2+ph)*1.35+(h-.5)*3.8;}
      x+=Math.sin(time*.41+ph+z*.13)*.32;y+=Math.sin(time*.31+ph+x*.17)*.18;z+=Math.cos(time*.37+ph+x*.11)*.28;
      let dx=nx-x,dy=ny-y,dz=nz-z;
      for(let k=1;k<=2;k++){const j=((i+k)%s.count)*12,rx=x-data[j],ry=y-data[j+1],rz=z-data[j+2],d2=rx*rx+ry*ry+rz*rz;if(d2>.001&&d2<1.44){const d=Math.sqrt(d2),push=(1.2-d)*.10/d;x+=rx*push;y+=ry*push;z+=rz*push;}dx+=data[j+4]*.055;dy+=data[j+5]*.055;dz+=data[j+6]*.055;}
      if(i<nearCount&&encounter>0){
        const side=event.side*(kind===2?-1:1),depth=1.90+(i%4)*.42+.16*Math.sin(time*.7+ph),lateral=side*(.55+(i%3)*.40)+(progress-.5)*2.35,vertical=((i%5)-2)*.25;
        const ex=eye[0]+F[0]*depth+R[0]*lateral+U[0]*vertical,ey=eye[1]+F[1]*depth+R[1]*lateral+U[1]*vertical,ez=eye[2]+F[2]*depth+R[2]*lateral+U[2]*vertical;
        x=x*(1-encounter)+ex*encounter;y=y*(1-encounter)+ey*encounter;z=z*(1-encounter)+ez*encounter;
        const vx=R[0]*side+F[0]*.14,vy=R[1]*side+F[1]*.14+.025*Math.sin(ph+time),vz=R[2]*side+F[2]*.14;dx=dx*(1-encounter)+vx*encounter;dy=dy*(1-encounter)+vy*encounter;dz=dz*(1-encounter)+vz*encounter;
        if(encounter>.65)stats.fish=Math.min(stats.fish,Math.hypot(x-eye[0],y-eye[1],z-eye[2]));
      }
      const l=Math.hypot(dx,dy,dz)||1;data[o+3]=s.scales[i]*(i<nearCount?1-encounter*.48:1);data[o]=x;data[o+1]=y;data[o+2]=z;data[o+4]=dx/l;data[o+5]=dy/l;data[o+6]=dz/l;data[o+7]=ph;data[o+11]=kind===0?8.5+r*3:kind===1?5.8+r*2:4.8+r*1.6;
    }
  }
  function buildReef(renderer){
    const random=rng(31991),kelpData=new Float32Array(CONFIG.kelpCount*12),rockData=new Float32Array(CONFIG.rockCount*12),coralData=new Float32Array(CONFIG.coralCount*12);
    for(let i=0;i<CONFIG.kelpCount;i++){const o=i*12,a=random()*TAU,r=8+Math.sqrt(random())*57,x=Math.cos(a)*r,z=Math.sin(a)*r;kelpData[o]=x;kelpData[o+1]=height(x,z)-.08;kelpData[o+2]=z;kelpData[o+3]=.55+random()*1.05;kelpData[o+4]=random()*TAU;kelpData[o+5]=random()*TAU;kelpData[o+8]=.45+random()*.35;kelpData[o+9]=.68+random()*.30;kelpData[o+10]=.38+random()*.30;}
    for(let i=0;i<CONFIG.rockCount;i++){const o=i*12,a=random()*TAU,r=7+Math.sqrt(random())*65,x=Math.cos(a)*r,z=Math.sin(a)*r;rockData[o]=x;rockData[o+1]=height(x,z);rockData[o+2]=z;rockData[o+3]=.45+Math.pow(random(),2)*2.5;rockData[o+4]=random()*TAU;rockData[o+8]=.54+random()*.25;rockData[o+9]=.61+random()*.19;rockData[o+10]=.58+random()*.19;}
    for(let i=0;i<CONFIG.coralCount;i++){const o=i*12,a=random()*TAU,r=9+Math.sqrt(random())*48,x=Math.cos(a)*r,z=Math.sin(a)*r;coralData[o]=x;coralData[o+1]=height(x,z);coralData[o+2]=z;coralData[o+3]=.55+random()*1.25;coralData[o+4]=random()*TAU;coralData[o+8]=.65+random()*.55;coralData[o+9]=.38+random()*.48;coralData[o+10]=.45+random()*.45;}
    return{kelp:renderer.uploadInstances(G.kelp(),kelpData,false),rocks:renderer.uploadInstances(G.rock(),rockData,false),corals:renderer.uploadInstances(G.coral(),coralData,false)};
  }
  function buildAtmosphere(renderer){const random=rng(773),particles=new Float32Array(CONFIG.particleCount*4);for(let i=0;i<CONFIG.particleCount;i++){particles[i*4]=(random()-.5)*125;particles[i*4+1]=random()*30-12;particles[i*4+2]=(random()-.5)*125;particles[i*4+3]=random();}const shafts=new Float32Array(14*8);for(let i=0;i<14;i++){const o=i*8;shafts[o]=i<6?-18+i*7:(random()-.5)*85;shafts[o+1]=-10;shafts[o+2]=i<6?-4+(i%3)*7:(random()-.5)*85;shafts[o+3]=i<6?1.4+random()*2.2:.8+random()*2.1;shafts[o+4]=random()*TAU;shafts[o+5]=27+random()*3;}return{particles:renderer.uploadParticles(particles),shafts:renderer.uploadShafts(shafts)};}
  let currentPhase=0;
  const gazeInfo=new Float32Array(2),gazeF=new Float32Array(3),gazeR=new Float32Array(3),gazeU=new Float32Array(3);
  function applyGaze(phase,eye,target,dolphinPos){
    basis(eye,target,gazeF,gazeR,gazeU);phaseWindow(phase,DOLPHIN_EVENT,gazeInfo);let w=gazeInfo[0];if(w>0)for(let k=0;k<3;k++)target[k]+=(dolphinPos[k]-target[k])*w;
    for(let i=0;i<FISH_EVENTS.length;i++){const e=FISH_EVENTS[i];phaseWindow(phase,e,gazeInfo);w=gazeInfo[0]*.22;if(w>0){const tx=eye[0]+gazeF[0]*2.6+gazeR[0]*e.side*.65,ty=eye[1]+gazeF[1]*2.6+gazeU[1]*.15,tz=eye[2]+gazeF[2]*2.6+gazeR[2]*e.side*.65;target[0]+=(tx-target[0])*w;target[1]+=(ty-target[1])*w;target[2]+=(tz-target[2])*w;}}
  }
  function slowFactor(phase){phaseWindow(phase,DOLPHIN_EVENT,gazeInfo);let slow=1-gazeInfo[0]*.35;for(const e of FISH_EVENTS){phaseWindow(phase,e,gazeInfo);slow-=gazeInfo[0]*.12;}return Math.max(.58,slow);}
  function buildScene(renderer){
    const terrain=renderer.uploadMesh(G.grid(CONFIG.terrainSize,CONFIG.terrainSegments,height,1.65)),waterMeshes=CONFIG.waterSegments.map(n=>renderer.uploadMesh(G.grid(800,n,null,1.55)));
    const dolphins=buildDolphins(renderer),schools=buildSchools(renderer),reef=buildReef(renderer),atm=buildAtmosphere(renderer);
    for(const d of dolphins){d.pose=new Float32Array(3);d.eventInfo=new Float32Array(2);}
    const cameraPath=[[16,1,30],[2,3,34],[-20,0,25],[-30,2,2],[-18,4,-24],[4,1,-30],[28,-1,-16],[30,2,12]],targetPath=[[0,3,0],[-5,5,3],[-2,4,-4],[0,8,0],[3,-2,2],[0,2,0],[-4,4,4],[4,3,6]];
    const scene={terrain,waterMeshes,dolphins,schools,kelp:reef.kelp,rocks:reef.rocks,corals:reef.corals,particles:atm.particles,shafts:atm.shafts,particleCounts:[500,1000,CONFIG.particleCount],sunDir:new Float32Array([.32,.88,.27]),cameraPath,targetPath,camera:null,encounterStats:{dolphin:Infinity,fish:Infinity}};
    const eye=new Float32Array(3),target=new Float32Array(3),F=new Float32Array(3),R=new Float32Array(3),U=new Float32Array(3);
    scene.resetStats=function(){scene.encounterStats.dolphin=Infinity;scene.encounterStats.fish=Infinity;};
    scene.update=function(time,tourPhase,dt,skipUpload){currentPhase=tourPhase;catmull(cameraPath,tourPhase,eye);catmull(targetPath,tourPhase,target);basis(eye,target,F,R,U);updateMain(dolphins[0],tourPhase,dt,eye,F,R,U,scene.encounterStats);for(let i=1;i<dolphins.length;i++)modelAt(dolphins[i],time*dolphins[i].speed+dolphins[i].offset,dt);for(let i=0;i<schools.length;i++){const s=schools[i];updateFish(s,time,eye,F,R,U,scene.encounterStats);if(!skipUpload){renderer.gl.bindBuffer(renderer.gl.ARRAY_BUFFER,s.mesh.buffer);renderer.gl.bufferSubData(renderer.gl.ARRAY_BUFFER,0,s.data);}}};
    scene.update(0,0,.016);return scene;
  }
  global.SCENE={buildScene,catmull,height,CONFIG,applyGaze,slowFactor,DOLPHIN_EVENT,FISH_EVENTS};
})(window);
