/* 深海场景装配与动画：固定种子、闭合 Catmull-Rom、实例化群游。 */
(function (global) {
  'use strict';
  const G=global.GEO,NZ=global.NZ,M4=global.M4,TAU=Math.PI*2;
  const CONFIG={
    fishCounts:[72,48,36],kelpCount:192,rockCount:64,coralCount:48,particleCount:1600,
    terrainSize:600,terrainSegments:128,waterSegments:[32,56,88],tourSeconds:120,
  };
  function rng(seed){return function(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
  function height(x,z){const broad=NZ.fbm3(x*.035,z*.035,1.7,4,19);const detail=NZ.noise3(x*.16,z*.16,2.1,8);const ridge=Math.sin(x*.09+Math.sin(z*.06))*Math.cos(z*.075)*.55;return-11.5+broad*4.1+detail*.32+ridge;}
  function catmull(points,t,out){const n=points.length;let f=((t%1)+1)%1*n,i=Math.floor(f),u=f-i;const p0=points[(i-1+n)%n],p1=points[i%n],p2=points[(i+1)%n],p3=points[(i+2)%n],u2=u*u,u3=u2*u;for(let k=0;k<3;k++)out[k]=.5*((2*p1[k])+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u3);return out;}
  function modelAt(d,t){catmull(d.path,t,d.pos);catmull(d.path,t+.0008,d.next);let fx=d.next[0]-d.pos[0],fy=d.next[1]-d.pos[1],fz=d.next[2]-d.pos[2],fl=Math.hypot(fx,fy,fz)||1;fx/=fl;fy/=fl;fz/=fl;let ux=0,uy=1,uz=0;const dot=fx*uy;ux-=fx*dot;uy-=fy*dot;uz-=fz*dot;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;const sx=fy*uz-fz*uy,sy=fz*ux-fx*uz,sz=fx*uy-fy*ux,m=d.model,s=d.scale;m[0]=fx*s;m[1]=fy*s;m[2]=fz*s;m[3]=0;m[4]=ux*s;m[5]=uy*s;m[6]=uz*s;m[7]=0;m[8]=sx*s;m[9]=sy*s;m[10]=sz*s;m[11]=0;m[12]=d.pos[0];m[13]=d.pos[1];m[14]=d.pos[2];m[15]=1;}
  function buildDolphins(renderer){
    const dolphinMesh=G.dolphin(),upload=renderer.uploadMesh(dolphinMesh);
    const main=[[0,3,3],[-9,4,8],[-16,1,-1],[-8,0,-13],[6,2,-12],[17,2.6,-10],[19,2.2,1]];
    const paths=[main,[[-25,7,-8],[-12,9,-24],[8,8,-26],[25,5,-10],[18,8,8],[-4,10,15]],[[24,0,5],[15,1,20],[-4,2,25],[-20,4,14],[-12,3,-2],[8,0,-4]],[[2,11,-18],[18,10,-8],[22,12,8],[5,13,15],[-12,12,5],[-16,10,-10]]];
    const scales=[1,.58,.48,.40],speeds=[.014,.008,.010,.007],dolphins=[];
    for(let i=0;i<4;i++)dolphins.push({mesh:upload,path:paths[i],scale:scales[i],speed:speeds[i],phase:i*1.71,offset:i===0?0:i*.173,model:M4.create(),pos:new Float32Array(3),next:new Float32Array(3)});
    return dolphins;
  }
  function buildSchools(renderer){
    const random=rng(88421),schools=[];
    const colors=[[.54,.76,.79],[.95,.62,.15],[.24,.66,.74]];
    for(let kind=0;kind<3;kind++){
      const count=CONFIG.fishCounts[kind],data=new Float32Array(count*12),seeds=new Float32Array(count*4),mesh=renderer.uploadInstances(G.fish(kind),data,true);
      for(let i=0;i<count;i++){
        seeds[i*4]=random()*TAU;seeds[i*4+1]=random();seeds[i*4+2]=random();seeds[i*4+3]=random()*TAU;
        const scale=kind===0?.30+random()*.16:kind===1?.46+random()*.22:.52+random()*.24;
        data[i*12+3]=scale;const tone=.78+random()*.32;
        data[i*12+8]=colors[kind][0]*tone;data[i*12+9]=colors[kind][1]*tone;data[i*12+10]=colors[kind][2]*tone;data[i*12+11]=kind===0?8+random()*3:5+random()*2;
      }
      schools.push({kind,count,data,seeds,mesh,center:new Float32Array(3)});
    }
    return schools;
  }
  function updateFish(s,time){
    const data=s.data,seeds=s.seeds,kind=s.kind,c=s.center;
    if(kind===0){c[0]=Math.sin(time*.035)*3;c[1]=3.2+Math.sin(time*.08)*.7;c[2]=Math.cos(time*.04)*2;}
    else if(kind===1){c[0]=-13+Math.sin(time*.045)*4;c[1]=-2.2;c[2]=3+Math.cos(time*.04)*3;}
    else{c[0]=7;c[1]=1+Math.sin(time*.06);c[2]=-12+Math.sin(time*.035)*4;}
    for(let i=0;i<s.count;i++){
      const o=i*12,q=i*4,a0=seeds[q],r=seeds[q+1],h=seeds[q+2],ph=seeds[q+3];let a,x,y,z,nx,ny,nz;
      if(kind===0){
        a=a0+time*(.19+r*.055);const rad=4.3+r*6.2,aa=a+.025;
        x=c[0]+Math.cos(a)*rad;z=c[2]+Math.sin(a)*rad*.64;y=c[1]+Math.sin(a*2+ph)*1.35+(h-.5)*3.4;
        nx=c[0]+Math.cos(aa)*rad;nz=c[2]+Math.sin(aa)*rad*.64;ny=c[1]+Math.sin(aa*2+ph)*1.35+(h-.5)*3.4;
      }else if(kind===1){
        a=a0+time*.105;const rad=7+r*3,aa=a+.025;
        x=c[0]+Math.cos(a)*rad;z=c[2]+Math.sin(a)*rad*.48;y=c[1]+Math.sin(a*2+ph)*.85+(h-.5)*2.7;
        nx=c[0]+Math.cos(aa)*rad;nz=c[2]+Math.sin(aa)*rad*.48;ny=c[1]+Math.sin(aa*2+ph)*.85+(h-.5)*2.7;
      }else{
        a=a0*.42+time*.072;const rad=8+r*4,aa=a+.02;
        x=c[0]+Math.cos(a)*rad;z=c[2]+Math.sin(a)*rad*.7;y=c[1]+Math.sin(a*1.4+ph)*1.2+(h-.5)*4.2;
        nx=c[0]+Math.cos(aa)*rad;nz=c[2]+Math.sin(aa)*rad*.7;ny=c[1]+Math.sin(aa*1.4+ph)*1.2+(h-.5)*4.2;
      }
      data[o]=x;data[o+1]=y;data[o+2]=z;let dx=nx-x,dy=ny-y,dz=nz-z;const l=Math.hypot(dx,dy,dz)||1;
      data[o+4]=dx/l;data[o+5]=dy/l;data[o+6]=dz/l;data[o+7]=ph;data[o+11]=kind===0?8+r*3:5+r*2;
    }
  }
  function buildReef(renderer){
    const random=rng(31991),kelpData=new Float32Array(CONFIG.kelpCount*12),rockData=new Float32Array(CONFIG.rockCount*12),coralData=new Float32Array(CONFIG.coralCount*12);
    for(let i=0;i<CONFIG.kelpCount;i++){const o=i*12,a=random()*TAU,r=8+Math.sqrt(random())*57,x=Math.cos(a)*r,z=Math.sin(a)*r;kelpData[o]=x;kelpData[o+1]=height(x,z)-.08;kelpData[o+2]=z;kelpData[o+3]=.55+random()*1.05;kelpData[o+4]=random()*TAU;kelpData[o+5]=random()*TAU;kelpData[o+8]=.45+random()*.35;kelpData[o+9]=.68+random()*.30;kelpData[o+10]=.38+random()*.30;}
    for(let i=0;i<CONFIG.rockCount;i++){const o=i*12,a=random()*TAU,r=7+Math.sqrt(random())*65,x=Math.cos(a)*r,z=Math.sin(a)*r;rockData[o]=x;rockData[o+1]=height(x,z);rockData[o+2]=z;rockData[o+3]=.45+Math.pow(random(),2)*2.5;rockData[o+4]=random()*TAU;rockData[o+8]=.54+random()*.25;rockData[o+9]=.61+random()*.19;rockData[o+10]=.58+random()*.19;}
    for(let i=0;i<CONFIG.coralCount;i++){const o=i*12,a=random()*TAU,r=9+Math.sqrt(random())*48,x=Math.cos(a)*r,z=Math.sin(a)*r;coralData[o]=x;coralData[o+1]=height(x,z);coralData[o+2]=z;coralData[o+3]=.55+random()*1.25;coralData[o+4]=random()*TAU;coralData[o+8]=.65+random()*.55;coralData[o+9]=.38+random()*.48;coralData[o+10]=.45+random()*.45;}
    return{kelp:renderer.uploadInstances(G.kelp(),kelpData,false),rocks:renderer.uploadInstances(G.rock(),rockData,false),corals:renderer.uploadInstances(G.coral(),coralData,false)};
  }
  function buildAtmosphere(renderer){
    const random=rng(773),particles=new Float32Array(CONFIG.particleCount*4);for(let i=0;i<CONFIG.particleCount;i++){particles[i*4]=(random()-.5)*125;particles[i*4+1]=random()*30-12;particles[i*4+2]=(random()-.5)*125;particles[i*4+3]=random();}
    const shafts=new Float32Array(14*8);for(let i=0;i<14;i++){const o=i*8;shafts[o]=i<6?-18+i*7:(random()-.5)*85;shafts[o+1]=-10;shafts[o+2]=i<6?-4+(i%3)*7:(random()-.5)*85;shafts[o+3]=i<6?1.4+random()*2.2:.8+random()*2.1;shafts[o+4]=random()*TAU;shafts[o+5]=27+random()*3;}
    return{particles:renderer.uploadParticles(particles),shafts:renderer.uploadShafts(shafts)};
  }
  function buildScene(renderer){
    const terrain=renderer.uploadMesh(G.grid(CONFIG.terrainSize,CONFIG.terrainSegments,height,1.65)),waterMeshes=CONFIG.waterSegments.map(n=>renderer.uploadMesh(G.grid(800,n,null,1.55)));
    const dolphins=buildDolphins(renderer),schools=buildSchools(renderer),reef=buildReef(renderer),atm=buildAtmosphere(renderer);
    const cameraPath=[[16,1,30],[2,3,34],[-20,0,25],[-30,2,2],[-18,4,-24],[4,1,-30],[28,-1,-16],[30,2,12]];
    const targetPath=[[0,3,0],[-5,5,3],[-2,4,-4],[0,8,0],[3,-2,2],[0,2,0],[-4,4,4],[4,3,6]];
    const scene={terrain,waterMeshes,dolphins,schools,kelp:reef.kelp,rocks:reef.rocks,corals:reef.corals,particles:atm.particles,shafts:atm.shafts,particleCounts:[500,1000,CONFIG.particleCount],sunDir:new Float32Array([.32,.88,.27]),cameraPath,targetPath,camera:null};
    scene.update=function(time,tourPhase){for(let i=0;i<dolphins.length;i++)modelAt(dolphins[i],i===0?tourPhase+dolphins[i].offset:time*dolphins[i].speed+dolphins[i].offset);for(let i=0;i<schools.length;i++){const s=schools[i];updateFish(s,time);renderer.gl.bindBuffer(renderer.gl.ARRAY_BUFFER,s.mesh.buffer);renderer.gl.bufferSubData(renderer.gl.ARRAY_BUFFER,0,s.data);}};
    scene.update(0,0);return scene;
  }
  global.SCENE={buildScene,catmull,height,CONFIG};
})(window);
