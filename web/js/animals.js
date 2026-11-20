/* 多物种程序化解剖、实例缓冲与独立行为。 */
(function(global){
'use strict';
const G=global.GEO,TAU=Math.PI*2,E=G.ellipsoid,C=G.curvedFin,B=G.cylinderBetween;
function tag(m,id,aux){const n=m.pos.length/3,u=new Float32Array(n*2);for(let i=0;i<n;i++){u[i*2]=id;u[i*2+1]=typeof aux==='function'?aux(m.pos[i*3],m.pos[i*3+1],m.pos[i*3+2]):(aux||0);}m.uv=u;return m;}
function merge(parts){let np=0,ni=0;for(const p of parts){np+=p.pos.length;ni+=p.idx.length;}const pos=new Float32Array(np),nrm=new Float32Array(np),col=new Float32Array(np),uv=new Float32Array(np/3*2),idx=new Uint32Array(ni);let po=0,io=0,base=0;for(const p of parts){if(!p.nrm)G.computeNormals(p);pos.set(p.pos,po);nrm.set(p.nrm,po);if(p.col)col.set(p.col,po);else for(let i=0;i<p.pos.length;i+=3)col[po+i]=col[po+i+1]=col[po+i+2]=1;if(p.uv)uv.set(p.uv,po/3*2);for(let i=0;i<p.idx.length;i++)idx[io+i]=p.idx[i]+base;base+=p.pos.length/3;po+=p.pos.length;io+=p.idx.length;}return{pos,nrm,col,uv,idx};}
function ell(rx,ry,rz,x,y,z,seg,rings,color,part,aux){return tag(E(rx,ry,rz,x,y,z,seg,rings,color),part,aux);}
function tube(points,r,color,part,aux){const p=[],id=[],co=[];for(let i=0;i<points.length-1;i++)B(points[i],points[i+1],r,7,p,id,co,color);return tag(G.computeNormals(G.mesh(p,id,null,co)),part,aux);}
function turtle(){
 const q=[];
 q.push(ell(1.32,.27,.76,0,.07,0,32,18,[.29,.38,.20],4));q.push(ell(1.15,.12,.68,-.06,-.13,0,24,12,[.48,.48,.28],0));
 q.push(ell(.46,.16,.16,1.08,.02,0,20,12,[.31,.43,.28],3));q.push(ell(.24,.17,.18,1.43,.07,0,20,14,[.34,.47,.30],3));
 for(const s of[-1,1]){
  q.push(ell(.026,.024,.016,1.54,.14,s*.135,10,8,[.035,.055,.045],3));
  const f=C([[.58,-.04,s*.58],[.48,-.10,s*.98],[.10,-.15,s*1.55],[-.12,-.10,s*1.77],[.05,-.04,s*1.24],[.38,.00,s*.72]],.042,[.30,.43,.28],5);tag(f,1,(x,y,z)=>s*(1+Math.min(1,Math.max(0,(Math.abs(z)-.58)/1.19))));q.push(f);
  const r=C([[-.78,-.09,s*.54],[-.98,-.13,s*.78],[-1.22,-.12,s*.94],[-1.12,-.05,s*.64],[-.88,-.03,s*.50]],.040,[.29,.40,.26],4);tag(r,2,s);q.push(r);
 }
 q.push(tag(C([[-1.12,-.05,0],[-1.48,-.10,.10],[-1.55,-.08,0],[-1.48,-.10,-.10]],.030,[.28,.38,.24],4),3));return merge(q);
}

function mantaWing(side){
 const p=[],id=[],co=[],uv=[],ns=12,nc=8;
 for(let layer=0;layer<2;layer++)for(let j=0;j<=ns;j++){const s=j/ns;for(let i=0;i<=nc;i++){const c=i/nc,chord=1.70*(1-s*.72),x=.78-c*chord-s*.42+.18*Math.sin(s*Math.PI),z=side*(.42+s*2.05),y=(layer?-.035:.035)*(1-s*.65)+Math.sin(c*Math.PI)*.035*(1-s);p.push(x,y,z);co.push(.20,.28,.31);uv.push(1,side*(1+s));}}
 const layerN=(ns+1)*(nc+1);for(let l=0;l<2;l++)for(let j=0;j<ns;j++)for(let i=0;i<nc;i++){const a=l*layerN+j*(nc+1)+i,b=a+nc+1;if(l===0)id.push(a,b,a+1,b,b+1,a+1);else id.push(a,a+1,b,b,a+1,b+1);}
 const m=G.computeNormals(G.mesh(p,id,null,co));m.uv=new Float32Array(uv);return m;
}
function manta(){
 const q=[ell(1.20,.075,.72,0,0,0,28,14,[.26,.34,.36],0),ell(.70,.10,.50,-.10,.035,0,22,12,[.25,.33,.35],0),ell(.55,.065,.48,.72,.005,0,20,12,[.26,.34,.36],0),mantaWing(1),mantaWing(-1)];
 for(const s of[-1,1]){
  q.push(tag(C([[.72,.005,s*.30],[1.10,0,s*.40],[1.22,-.01,s*.34],[.98,-.018,s*.27]],.020,[.26,.34,.36],4),0));
  q.push(ell(.026,.022,.016,.72,.055,s*.52,10,8,[.035,.05,.055],0));
 }
 q.push(tube([[-.90,0,0],[-1.65,-.01,0],[-2.55,-.02,0],[-3.55,-.01,0],[-4.20,0,0]],.022,[.22,.29,.31],0));return merge(q);
}

function whaleShark(){
 const p=[],id=[],co=[],uv=[],rings=52,seg=24,stops=[[0,.12],[.12,.25],[.30,.72],[.52,1.0],[.70,1.08],[.84,1.02],[.93,.82],[1,.28]];
 function prof(t){for(let i=0;i<stops.length-1;i++)if(t<=stops[i+1][0]){const a=stops[i],b=stops[i+1],u=(t-a[0])/(b[0]-a[0]),s=u*u*(3-2*u);return a[1]+(b[1]-a[1])*s;}return.28;}
 for(let j=0;j<=rings;j++){const t=j/rings,x=-4.8+t*9.15,r=prof(t);for(let i=0;i<=seg;i++){const a=i/seg*TAU,up=Math.cos(a);p.push(x,up*r*.68,Math.sin(a)*r*1.08);co.push(.20+.10*Math.max(0,-up),.31+.16*Math.max(0,-up),.38+.16*Math.max(0,-up));uv.push(0,0);}}
 for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=j*(seg+1)+i,b=a+seg+1;id.push(a,a+1,b,b,a+1,b+1);}
 const q=[G.computeNormals(G.mesh(p,id,null,co))];q[0].uv=new Float32Array(uv);
 q.push(tag(C([[-.2,.55,0],[-.62,1.15,0],[-.92,1.48,0],[-.78,.72,0],[-1.10,.48,0]],.065,[.19,.29,.35],5),0));
 for(const s of[-1,1]){q.push(tag(C([[1.50,-.18,s*.72],[.72,-.37,s*1.28],[-.10,-.34,s*1.60],[.22,-.17,s*.88]],.052,[.21,.31,.37],5),0));q.push(ell(.045,.035,.018,3.10,.20,s*.93,10,8,[.035,.055,.065],0));}
 q.push(tag(C([[-4.55,0,0],[-5.20,1.20,0],[-5.48,1.55,0],[-5.20,.35,0],[-5.05,0,0],[-5.35,-1.05,0],[-5.50,-1.30,0],[-5.10,-.35,0]],.065,[.19,.29,.35],5),0));
 q.push(tube([[3.95,-.20,-.67],[4.12,-.24,-.35],[4.18,-.25,0],[4.12,-.24,.35],[3.95,-.20,.67]],.012,[.10,.15,.16],0));return merge(q);
}
function jelly(){
 const q=[],p=[],id=[],co=[],uv=[],rings=14,seg=32;
 for(let layer=0;layer<2;layer++)for(let j=0;j<=rings;j++){const t=j/rings,a=t*Math.PI*.5,r=Math.sin(a)*.65*(layer?.94:1),y=Math.cos(a)*.55*(layer?.94:1);for(let i=0;i<=seg;i++){const th=i/seg*TAU;p.push(Math.cos(th)*r,y,Math.sin(th)*r);co.push(.48,.72,.75);uv.push(1,t);}}
 const N=(rings+1)*(seg+1);for(let l=0;l<2;l++)for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=l*N+j*(seg+1)+i,b=a+seg+1;if(l===0)id.push(a,b,a+1,b,b+1,a+1);else id.push(a,a+1,b,b,a+1,b+1);}
 const bell=G.computeNormals(G.mesh(p,id,null,co));bell.uv=new Float32Array(uv);q.push(bell);
 for(let k=0;k<4;k++){const a=k/4*TAU,dx=Math.cos(a),dz=Math.sin(a),f=C([[dx*.18,-.02,dz*.18],[dx*.30,-.38,dz*.30],[dx*.20,-.82,dz*.20],[dx*.36,-1.18,dz*.36],[dx*.12,-.92,dz*.12],[dx*.10,-.35,dz*.10]],.025,[.55,.68,.70],4);tag(f,2,(x,y,z)=>Math.min(1,-y/1.2));q.push(f);}
 for(let k=0;k<12;k++){const a=k/12*TAU,dx=Math.cos(a),dz=Math.sin(a),pts=[];for(let j=0;j<=7;j++){const t=j/7;pts.push([dx*(.53+.10*Math.sin(t*4+a)), -t*1.85,dz*(.53+.10*Math.cos(t*3+a))]);}for(let j=0;j<7;j++){const t=j/7,m=tube([pts[j],pts[j+1]],.009,[.45,.66,.70],3,t);q.push(m);}}
 return merge(q);
}
function lionfish(){
 const q=[ell(.68,.34,.23,0,0,0,24,16,[.66,.42,.22],0),ell(.25,.20,.19,.46,.02,0,20,14,[.70,.46,.24],0),ell(.20,.27,.225,.24,-.01,0,18,12,[.63,.40,.22],0)];
 for(const s of[-1,1]){q.push(ell(.030,.027,.014,.62,.10,s*.145,10,8,[.025,.045,.052],0));q.push(ell(.008,.008,.004,.635,.115,s*.155,8,6,[.52,.66,.68],0));}
 for(let i=0;i<12;i++){const x=.52-i*.095,h=.62+.20*Math.sin(i*.8),r=.007+.005*(.5+.5*Math.sin(i*1.7));q.push(tube([[x,.24,0],[x-.10,h,0]],r,[.72,.52,.30],1,i/11));if(i<11){const f=C([[x,.28,0],[x-.10,h*.70,0],[x-.095,.28,0]],.004,[.61,.39,.22],2);tag(f,1,i/11);q.push(f);}}
 for(const s of[-1,1]){
  const root=[.28,-.08,s*.16],ends=[];
  for(let i=0;i<9;i++){const t=i/8,x=.22-t*.55,z=s*(.56+.28*Math.sin(t*Math.PI)),y=-.18-.28*Math.sin(t*Math.PI*.85);ends.push([x,y,z]);q.push(tube([root,[x,y,z]],.006,[.68,.46,.28],2,t));}
  for(let i=0;i<8;i++){const t=(i+.5)/8,a=ends[i],b=ends[i+1],mid=[(a[0]+b[0])*.5,(a[1]+b[1])*.5+.025,(a[2]+b[2])*.5],m=G.computeNormals(G.mesh([...root,...mid,...b],[0,1,2],null,[.64,.48,.32]));tag(m,4,t);q.push(m);}
 }
 q.push(tag(C([[-.55,0,0],[-.98,.40,0],[-.90,0,0],[-.98,-.40,0]],.012,[.62,.40,.23],4),3));return merge(q);
}

function crab(){
 const q=[ell(.56,.20,.43,0,.25,0,22,14,[.42,.20,.12],0),ell(.42,.10,.32,.08,.14,0,18,10,[.34,.16,.10],0)];
 for(const s of[-1,1]){
  q.push(tube([[.30,.34,s*.15],[.38,.48,s*.17]],.025,[.30,.16,.10],0));q.push(ell(.035,.032,.030,.38,.49,s*.17,10,8,[.035,.045,.04],0));
  for(let i=0;i<4;i++){const x=.34-i*.22,k=i+(s===1?0:4),pts=[[x,.22,s*.34],[x+.08,.13,s*.66],[x+.18,-.06,s*.91],[x+.32,-.23,s*1.03]];q.push(tube(pts,.030,[.40,.20,.12],1,k));}
  q.push(tube([[.40,.22,s*.28],[.66,.20,s*.48],[.82,.28,s*.62]],.045,[.43,.21,.12],2,s));q.push(ell(.18,.10,.13,.90,.30,s*.67,14,10,[.45,.23,.13],2));
  q.push(tag(C([[.96,.31,s*.69],[1.16,.36,s*.78],[1.06,.26,s*.67]],.025,[.45,.23,.13],3),2,s));q.push(tag(C([[.96,.28,s*.64],[1.15,.23,s*.58],[1.06,.26,s*.67]],.025,[.45,.23,.13],3),2,s));
 }
 return merge(q);
}
const BUILDERS=[turtle,manta,whaleShark,jelly,lionfish,crab],COUNTS=[2,2,1,10,4,8],SCALES=[.72,.82,1,1,1,.62],NAMES=['海龟','蝠鲼','鲸鲨','水母','狮子鱼','螃蟹'];
function build(renderer){const out=[];for(let k=0;k<6;k++){const count=COUNTS[k],data=new Float32Array(count*12),mesh=renderer.uploadInstances(BUILDERS[k](),data,true);for(let i=0;i<count;i++){const o=i*12;data[o]=k===0?0:k===1?-4:k===2?8:k===3?-3+(i%5)*.45:k===4?3:5+(i%4)*.45;data[o+1]=k===0?1:k===1?5:k===2?2:k===3?1+(i%3)*.45:k===4?-2:-8;data[o+2]=k===0?4:k===1?-4:k===2?-12:k===3?2-(i%2):k===4?2:5+(i%2)*.4;data[o+3]=SCALES[k]*(i?(.82+(i%3)*.10):1);data[o+4]=1;data[o+5]=0;data[o+6]=0;data[o+7]=i*1.37+k*.61;data[o+8]=data[o+9]=data[o+10]=1;data[o+11]=1;}out.push({kind:k,name:NAMES[k],count,data,mesh,phase:new Float32Array(2),seeds:new Float32Array(count*4)});}return out;}

const EVENTS=[{phase:.12,window:.05},{phase:.36,window:.05},{phase:.84,window:.06},{phase:.46,window:.05},{phase:.64,window:.05},{phase:.94,window:.05}];
const PATHS=[
 [[-10,-1,5],[-4,-2,-8],[5,-1,-5],[3,0,6]],
 [[-15,6,0],[-4,8,-12],[12,6,-6],[8,5,10]],
 [[20,4,-20],[2,7,-25],[-18,5,-12],[-5,3,15]],
 [[-6,1,4],[-3,5,-4],[4,4,-2],[2,0,6]],
 [[-8,-3,5],[-3,-2,-5],[6,-3,-2],[4,-1,7]],
 [[22,-8,12],[26,-8,14],[29,-8,11],[25,-8,9]]
];
const INFO=new Float32Array(2),POSE=new Float32Array(3),NEXT=new Float32Array(3),GF=new Float32Array(3),GR=new Float32Array(3),GU=new Float32Array(3);
function eventWeight(phase,event,out){let d=((phase-event.phase+.5)%1+1)%1-.5,u=d/event.window+.5;out[1]=Math.max(0,Math.min(1,u));if(u<=0||u>=1){out[0]=0;return 0;}const a=Math.max(0,Math.min(1,u/.20)),b=Math.max(0,Math.min(1,(1-u)/.20));out[0]=a*a*(3-2*a)*b*b*(3-2*b);return out[0];}
function setDir(data,o,dx,dy,dz){const l=Math.hypot(dx,dy,dz)||1;data[o+4]=dx/l;data[o+5]=dy/l;data[o+6]=dz/l;}
function update(scene,time,phase,dt,eye,F,R,U,skipUpload){
 for(const a of scene.animals){
  const k=a.kind,event=EVENTS[k];eventWeight(phase,event,INFO);const w=INFO[0],progress=INFO[1];a.eventWeight=w;a.minDistance=a.minDistance||Infinity;
  for(let i=0;i<a.count;i++){
   const o=i*12,seed=i*.731+k*1.91;
   global.SCENE.catmull(PATHS[k],time*(k===2?.006:k===1?.010:.012)+i/a.count+seed*.03,POSE);global.SCENE.catmull(PATHS[k],time*(k===2?.006:k===1?.010:.012)+i/a.count+seed*.03+.001,NEXT);
   let x=POSE[0],y=POSE[1],z=POSE[2],dx=NEXT[0]-x,dy=NEXT[1]-y,dz=NEXT[2]-z;
   if(k===5){if(i<3){x=26+(i-1)*.68+Math.sin(time*.55+i*.8)*.22;z=14+(i%2)*.50;}else{x=-18+i*1.4;z=-8+(i%3);}y=global.SCENE.height(x,z)+.22;dx=0;dy=0;dz=1;}
   if(w>0&&(i===0||(k===3&&i<6))){
    let depth=3,lateral=0,vertical=0;
    if(k===0){depth=3.1;lateral=-1.0;vertical=-.45;dx=R[0]*.8+F[0]*.3;dy=R[1]*.8+F[1]*.3;dz=R[2]*.8+F[2]*.3;}
    else if(k===1){depth=4.4;lateral=.3;vertical=2.35;dx=R[0];dy=R[1];dz=R[2];}
    else if(k===2){depth=11.5;lateral=-2.5;vertical=.75;dx=R[0];dy=R[1];dz=R[2];}
    else if(k===3){depth=1.8+(i%4)*.55;lateral=((i%5)-2)*.55;vertical=.30+((i%3)-1)*.45;dx=R[0]*.2+F[0]*.1;dy=R[1]*.2+F[1]*.1;dz=R[2]*.2+F[2]*.1;}
    else if(k===4){depth=2.2;lateral=1.1;vertical=-.25;dx=R[0]*.3+F[0]*.2;dy=R[1]*.3+F[1]*.2;dz=R[2]*.3+F[2]*.2;}
    if(k<5){const nx=eye[0]+F[0]*depth+R[0]*lateral+U[0]*vertical,ny=eye[1]+F[1]*depth+R[1]*lateral+U[1]*vertical,nz=eye[2]+F[2]*depth+R[2]*lateral+U[2]*vertical;x=x*(1-w)+nx*w;y=y*(1-w)+ny*w;z=z*(1-w)+nz*w;if(w>.55)a.minDistance=Math.min(a.minDistance,Math.hypot(x-eye[0],y-eye[1],z-eye[2]));}
   }
   a.data[o+3]=SCALES[k]*(i?(.82+(i%3)*.10):1)*(k===3&&i<6?1-w*.45:1);dataSet(a.data,o,x,y,z,dx,dy,dz);
  }
  a.currentDistance=Math.hypot(a.data[0]-eye[0],a.data[1]-eye[1],a.data[2]-eye[2]);
  if(!skipUpload){const gl=scene.renderer?scene.renderer.gl:null;if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,a.mesh.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,a.data);}}
 }
}
function dataSet(data,o,x,y,z,dx,dy,dz){data[o]=x;data[o+1]=y;data[o+2]=z;setDir(data,o,dx,dy,dz);}
function cameraBasis(eye,target){let fx=target[0]-eye[0],fy=target[1]-eye[1],fz=target[2]-eye[2],l=Math.hypot(fx,fy,fz)||1;fx/=l;fy/=l;fz/=l;let rx=fz,rz=-fx;l=Math.hypot(rx,rz)||1;GF[0]=fx;GF[1]=fy;GF[2]=fz;GR[0]=rx/l;GR[1]=0;GR[2]=rz/l;GU[0]=GR[1]*fz-rz*fy;GU[1]=rz*fx-GR[0]*fz;GU[2]=GR[0]*fy-GR[1]*fx;}
function applyGaze(phase,eye,target,animals){
 eventWeight(phase,EVENTS[5],INFO);const crabW=INFO[0];if(crabW>0&&animals&&animals[5]){const d=animals[5].data,nx=d[0]-.7,ny=d[1]+1.1,nz=d[2]+1.35;eye[0]+=(nx-eye[0])*crabW;eye[1]+=(ny-eye[1])*crabW;eye[2]+=(nz-eye[2])*crabW;target[0]+=(d[0]-target[0])*crabW;target[1]+=(d[1]-target[1])*crabW;target[2]+=(d[2]-target[2])*crabW;const crab=animals[5];crab.minDistance=crab.minDistance||Infinity;if(crabW>.55)crab.minDistance=Math.min(crab.minDistance,Math.hypot(eye[0]-d[0],eye[1]-d[1],eye[2]-d[2]));}
 if(!animals)return;cameraBasis(eye,target);const strengths=[.66,.70,.55,.45,.75,0];
 for(let k=0;k<5;k++){eventWeight(phase,EVENTS[k],INFO);const w=INFO[0]*strengths[k];if(w>0){const d=animals[k].data;target[0]+=(d[0]-target[0])*w;target[1]+=(d[1]-target[1])*w;target[2]+=(d[2]-target[2])*w;}}
}
function slowFactor(phase){let slow=1;for(const e of EVENTS){eventWeight(phase,e,INFO);slow-=INFO[0]*.10;}return Math.max(.72,slow);}
global.ANIMALS={build,NAMES,update,applyGaze,slowFactor,EVENTS,PATHS};
})(window);
