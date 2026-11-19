/* GLSL ES 3.00：所有纹理、波形、焦散与微粒均实时程序化生成。 */
(function (global) {
  'use strict';
  const head = `#version 300 es
precision highp float;
`;
  const common = `
uniform vec3 uEye;
uniform float uTime;
uniform vec3 uSunDir;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float f=0.0;f+=noise2(p)*.55;p=mat2(.8,-.6,.6,.8)*p*2.03;f+=noise2(p)*.28;p=mat2(.8,-.6,.6,.8)*p*2.01;f+=noise2(p)*.17;return f;}
float voronoi(vec2 p){vec2 i=floor(p),f=fract(p);float d=8.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);vec2 r=g+vec2(hash21(i+g),hash21(i+g+19.7))-f;d=min(d,dot(r,r));}return sqrt(d);}
float caustics(vec2 p,float t){
  vec2 q=p*.72+vec2(t*.035,-t*.022);
  float a=voronoi(q+vec2(noise2(q*.6+t*.025),noise2(q*.6-t*.018))*.65);
  float b=voronoi(q*1.37+vec2(-t*.028,t*.018));
  float c=pow(max(0.0,1.0-a),7.0)+.45*pow(max(0.0,1.0-b),9.0);
  return clamp(c,0.0,1.6);
}
vec3 oceanBackground(vec3 ray){
  float up=clamp(ray.y*.5+.5,0.0,1.0);
  return mix(vec3(.003,.055,.083),vec3(.018,.29,.32),pow(up,1.35));
}
vec3 waterFog(vec3 col,vec3 world,float dist){
  float depth=clamp((18.0-world.y)/34.0,0.0,1.0);
  float opticalDist=max(0.0,dist-6.0);
  float fog=1.0-exp(-opticalDist*(.020+depth*.009));
  vec3 ray=normalize(world-uEye);
  return mix(col,oceanBackground(ray),clamp(fog,0.0,1.0));
}
vec3 shade(vec3 base,vec3 n,vec3 world){
  float ndl=max(0.0,dot(n,uSunDir));
  float ca=caustics(world.xz,uTime)*pow(max(0.0,n.y),.6);
  vec3 col=base*(.30+.80*ndl)+vec3(.32,.78,.65)*ca*.42;
  vec3 V=normalize(uEye-world);
  float rim=pow(1.0-max(0.0,dot(n,V)),3.0);
  col+=vec3(.08,.26,.30)*rim;
  return col;
}
`;
  const baseVS = head+`
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vWorld;out vec3 vNormal;out vec3 vColor;out vec3 vLocal;
void main(){vec4 w=uModel*vec4(aPos,1);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;vLocal=aPos;gl_Position=uVP*w;}
`;
  const objectFS = head+common+`
in vec3 vWorld;in vec3 vNormal;in vec3 vColor;in vec3 vLocal;out vec4 frag;
uniform vec4 uTint;
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;float mott=fbm(vLocal.xz*2.4+vLocal.yy*.7);vec3 base=vColor*uTint.rgb*(.88+mott*.22);vec3 col=shade(base,n,vWorld);float spec=pow(max(0.0,dot(reflect(-uSunDir,n),normalize(uEye-vWorld))),48.0);col+=vec3(.65,.90,.89)*spec*.25;col=waterFog(col,vWorld,distance(uEye,vWorld));frag=vec4(col,uTint.a);}
`;
  const dolphinVS = head+`
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec3 aColor;
uniform mat4 uVP;uniform mat4 uModel;uniform float uTime;uniform float uPhase;
out vec3 vWorld;out vec3 vNormal;out vec3 vColor;out vec3 vLocal;
void main(){vec3 p=aPos;float tail=1.0-smoothstep(-3.35,.65,p.x);float wave=sin(p.x*1.45-uTime*3.7+uPhase);p.y+=wave*.22*tail*tail;p.z+=sin(p.x*.85-uTime*2.1+uPhase)*.055*tail;vec4 w=uModel*vec4(p,1);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;vLocal=p;gl_Position=uVP*w;}
`;
  const dolphinFS = head+common+`
in vec3 vWorld;in vec3 vNormal;in vec3 vColor;in vec3 vLocal;out vec4 frag;
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;float pores=noise2(vLocal.xz*31.0)*.035;float scars=smoothstep(.975,1.0,noise2(vLocal.xy*7.0))*.07;vec3 base=vColor+pores-scars;vec3 col=shade(base,n,vWorld);vec3 V=normalize(uEye-vWorld);float spec=pow(max(0.0,dot(reflect(-uSunDir,n),V)),72.0);col+=vec3(.58,.9,.94)*spec*.55;col+=vec3(.03,.14,.17)*pow(1.0-max(0.0,dot(n,V)),2.0);frag=vec4(waterFog(col,vWorld,distance(uEye,vWorld)),1);}
`;
  const fishVS = head+`
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec3 aColor;
layout(location=4) in vec4 iPosScale;layout(location=5) in vec4 iDirPhase;layout(location=6) in vec4 iColorSpeed;
uniform mat4 uVP;uniform float uTime;
out vec3 vWorld;out vec3 vNormal;out vec3 vColor;out vec3 vLocal;
void main(){vec3 p=aPos;float tail=1.0-smoothstep(-.9,.45,p.x);p.z+=sin(uTime*iColorSpeed.a+iDirPhase.w+p.x*3.2)*.17*tail;vec3 f=normalize(iDirPhase.xyz);vec3 up=vec3(0,1,0);vec3 side=normalize(cross(up,f));up=normalize(cross(f,side));float s=iPosScale.w;vec3 w=iPosScale.xyz+(f*p.x+up*p.y+side*p.z)*s;vWorld=w;vNormal=normalize(f*aNormal.x+up*aNormal.y+side*aNormal.z);vColor=aColor*iColorSpeed.rgb;vLocal=aPos;gl_Position=uVP*vec4(w,1);}
`;
  const fishFS = head+common+`
in vec3 vWorld;in vec3 vNormal;in vec3 vColor;in vec3 vLocal;out vec4 frag;uniform int uKind;
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 base=vColor;float stripes=.5+.5*sin(vLocal.x*(uKind==0?25.0:uKind==1?17.0:12.0)+vLocal.y*4.0);if(uKind==1)base*=.76+.32*smoothstep(.45,.75,stripes);if(uKind==2){base=mix(base,base*vec3(.25,.42,.48),smoothstep(.62,.85,stripes)*.65);base+=vec3(.18,.16,.02)*max(0.0,vLocal.y);}float scales=noise2(vLocal.xy*vec2(45.0,65.0));base*=.91+.15*scales;vec3 col=shade(base,n,vWorld);vec3 V=normalize(uEye-vWorld);float glint=pow(max(0.0,dot(reflect(-uSunDir,n),V)),uKind==0?90.0:45.0);col+=vec3(.65,.95,1.0)*glint*(uKind==0?1.35:.45);col=waterFog(col,vWorld,distance(uEye,vWorld));frag=vec4(col,1);}
`;
  const instVS = head+`
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec3 aColor;
layout(location=4) in vec4 iPosScale;layout(location=5) in vec4 iDirPhase;layout(location=6) in vec4 iColorSpeed;
uniform mat4 uVP;uniform float uTime;uniform float uSway;
out vec3 vWorld;out vec3 vNormal;out vec3 vColor;out vec3 vLocal;
void main(){float a=iDirPhase.x,c=cos(a),s=sin(a);vec3 p=aPos;float bend=pow(max(0.0,p.y/3.8),1.45);p.x+=sin(uTime*.72+iDirPhase.y+p.y*.43)*.46*bend*uSway;p.z+=cos(uTime*.51+iDirPhase.y*1.7+p.y*.27)*.25*bend*uSway;p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);float sc=iPosScale.w;vec3 w=iPosScale.xyz+p*sc;vWorld=w;vNormal=normalize(vec3(c*aNormal.x+s*aNormal.z,aNormal.y,-s*aNormal.x+c*aNormal.z));vColor=aColor*iColorSpeed.rgb;vLocal=aPos;gl_Position=uVP*vec4(w,1);}
`;
  const kelpFS = head+common+`
in vec3 vWorld;in vec3 vNormal;in vec3 vColor;in vec3 vLocal;out vec4 frag;
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;float veins=.82+.18*sin(vLocal.y*34.0+noise2(vLocal.xy*8.0)*3.0);vec3 base=vColor*veins;vec3 col=shade(base,n,vWorld);float back=pow(max(0.0,dot(-n,uSunDir)),2.0);col+=base*back*.65;col=waterFog(col,vWorld,distance(uEye,vWorld));frag=vec4(col,1);}
`;
  const terrainVS = head+`
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=3) in vec2 aUV;
uniform mat4 uVP;out vec3 vWorld;out vec3 vNormal;out vec2 vUV;
void main(){vWorld=aPos;vNormal=aNormal;vUV=aUV;gl_Position=uVP*vec4(aPos,1);}
`;
  const terrainFS = head+common+`
in vec3 vWorld;in vec3 vNormal;in vec2 vUV;out vec4 frag;
void main(){vec3 n=normalize(vNormal);float dist=distance(uEye,vWorld);vec3 sand=vec3(.34,.405,.335);float ca=0.0,pools=1.0;if(dist<105.0){float ripples=sin(vWorld.x*7.5+sin(vWorld.z*1.7)*2.0)*.5+.5;float grains=noise2(vWorld.xz*48.0);float broad=fbm(vWorld.xz*.12);sand=mix(vec3(.22,.31,.28),vec3(.48,.52,.39),broad);sand*=.90+grains*.16+ripples*.035;ca=caustics(vWorld.xz,uTime);pools=.65+.35*noise2(vWorld.xz*.24+uTime*.015);}vec3 col=sand*(.38+.72*max(0.0,dot(n,uSunDir)))+vec3(.39,.85,.68)*ca*pools*.70;col=waterFog(col,vWorld,dist);frag=vec4(col,1);}
`;
  const waterVS = head+`
layout(location=0) in vec3 aPos;layout(location=3) in vec2 aUV;
uniform mat4 uVP;uniform float uTime;out vec3 vWorld;out vec3 vNormal;out vec2 vUV;out float vCrest;
void gerstner(inout vec3 p,inout vec2 slope,vec2 d,float amp,float len,float speed,float steep){d=normalize(d);float k=6.2831853/len;float f=k*dot(d,aPos.xz)+uTime*speed;float c=cos(f);p.xz+=d*(steep*amp*c);p.y+=amp*sin(f);slope+=d*(amp*k*c);}
void main(){vec3 p=aPos;vec2 sl=vec2(0);gerstner(p,sl,vec2(1,.24),.34,10.5,1.08,.65);gerstner(p,sl,vec2(-.35,1),.20,6.2,1.46,.48);gerstner(p,sl,vec2(.7,-.6),.12,3.8,1.90,.35);gerstner(p,sl,vec2(-.8,-.3),.065,2.15,2.45,.24);p.y+=18.0;vWorld=p;vNormal=normalize(vec3(-sl.x,1,-sl.y));vUV=aUV;vCrest=p.y-18.0;gl_Position=uVP*vec4(p,1);}
`;
  const waterFS = head+common+`
in vec3 vWorld;in vec3 vNormal;in vec2 vUV;in float vCrest;out vec4 frag;
void main(){vec3 n=normalize(vNormal);vec3 V=normalize(uEye-vWorld);if(dot(n,V)<0.0)n=-n;float micro=noise2(vWorld.xz*3.5+vec2(uTime*.16,-uTime*.11));n=normalize(n+vec3((micro-.5)*.13,0,(noise2(vWorld.zx*4.1-uTime*.08)-.5)*.13));float facing=max(0.0,dot(n,V));float fres=pow(1.0-facing,3.0);float window=smoothstep(.48,.78,facing);float dist=distance(uEye,vWorld);float ca=0.0;if(dist<120.0)ca=caustics(vWorld.xz*1.5,uTime*1.4);float spec=pow(max(0.0,dot(reflect(-uSunDir,n),V)),180.0);float glitter=pow(max(0.0,dot(reflect(-uSunDir,normalize(n+vec3((micro-.5)*.3,0,0))),V)),650.0);vec3 deep=vec3(.012,.19,.22);vec3 sky=vec3(.22,.67,.72);vec3 col=mix(deep,sky,window*.64+fres*.18);col+=vec3(.20,.62,.58)*ca*.12;col+=vec3(1.15,1.25,1.05)*spec*2.5+vec3(1.3)*glitter*3.0;col+=vec3(.08,.22,.20)*max(0.0,vCrest)*.2;col=waterFog(col,vWorld,dist);frag=vec4(col,1);}
`;
  const fsQuadVS = head+`layout(location=0) in vec2 aPos;out vec2 vUV;void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0,1);}`;
  const skyFS = head+common+`
in vec2 vUV;out vec4 frag;uniform mat4 uInvVP;
void main(){vec4 a=uInvVP*vec4(vUV*2.0-1.0,-1,1),b=uInvVP*vec4(vUV*2.0-1.0,1,1);vec3 ray=normalize(b.xyz/b.w-a.xyz/a.w);vec3 col=oceanBackground(ray);float sun=pow(max(0.0,dot(ray,normalize(vec3(.30,.88,.24)))),18.0);col+=vec3(.08,.30,.28)*sun;float rays=pow(max(0.0,sin(atan(ray.z,ray.x)*19.0+uTime*.025)),12.0)*max(0.0,ray.y)*.015;col+=vec3(.12,.38,.32)*rays;frag=vec4(col,1);}
`;
  const particleVS = head+`
layout(location=0) in vec4 aSeed;uniform mat4 uView;uniform mat4 uProj;uniform float uTime;uniform float uDpr;out float vAlpha;
void main(){vec3 p=aSeed.xyz;p.x+=sin(uTime*.16+aSeed.w*17.0)*1.4;p.z+=cos(uTime*.12+aSeed.w*23.0)*1.1;p.y=mod(p.y+12.0+uTime*(.05+aSeed.w*.08),30.0)-12.0;vec4 view=uView*vec4(p,1);gl_Position=uProj*view;gl_PointSize=clamp((1.2+aSeed.w*2.3)*uDpr*22.0/max(2.0,-view.z),1.0,6.0);vAlpha=(.16+aSeed.w*.35)*(1.0-smoothstep(8.0,95.0,-view.z));}
`;
  const particleFS = head+`in float vAlpha;out vec4 frag;void main(){vec2 q=gl_PointCoord-.5;float a=smoothstep(.5,.08,length(q))*vAlpha;frag=vec4(.48,.86,.82,a);}`;
  const shaftVS = head+`
layout(location=0) in vec3 aPos;layout(location=3) in vec2 aUV;layout(location=4) in vec4 iPosScale;layout(location=5) in vec4 iDirPhase;
uniform mat4 uVP;uniform vec3 uEye;uniform float uTime;out vec2 vUV;out float vFade;
void main(){vec3 c=iPosScale.xyz;vec3 toEye=uEye-c;vec3 right=normalize(vec3(toEye.z,0,-toEye.x));float width=iPosScale.w;vec3 p=c+right*aPos.x*width+vec3(aPos.x*.18,aPos.y*iDirPhase.y,aPos.x*.08);vUV=aUV;vFade=exp(-length(toEye)*.011)*(.72+.28*sin(uTime*.22+iDirPhase.x));gl_Position=uVP*vec4(p,1);}
`;
  const shaftFS = head+`
in vec2 vUV;in float vFade;out vec4 frag;uniform float uTime;
void main(){float x=abs(vUV.x*2.0-1.0);float core=pow(max(0.0,1.0-x),2.4);float ends=smoothstep(0.0,.18,vUV.y)*(1.0-smoothstep(.58,1.0,vUV.y));float shimmer=.78+.22*sin(vUV.y*19.0+uTime*.32);float a=core*ends*shimmer*vFade*.27;frag=vec4(.30,.78,.72,a);}
`;
  const brightFS = head+`in vec2 vUV;out vec4 frag;uniform sampler2D uTex;void main(){vec3 c=texture(uTex,vUV).rgb;float b=max(c.r,max(c.g,c.b));frag=vec4(c*smoothstep(.72,1.55,b),1);}`;
  const blurFS = head+`in vec2 vUV;out vec4 frag;uniform sampler2D uTex;uniform vec2 uDir;void main(){vec3 c=texture(uTex,vUV).rgb*.227027;c+=texture(uTex,vUV+uDir*1.384615).rgb*.316216;c+=texture(uTex,vUV-uDir*1.384615).rgb*.316216;c+=texture(uTex,vUV+uDir*3.230769).rgb*.070270;c+=texture(uTex,vUV-uDir*3.230769).rgb*.070270;frag=vec4(c,1);}`;
  const compositeFS = head+`
in vec2 vUV;out vec4 frag;uniform sampler2D uScene;uniform sampler2D uBloom;uniform float uTime;uniform float uBloomAmount;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec3 c=texture(uScene,vUV).rgb+texture(uBloom,vUV).rgb*uBloomAmount;c=aces(c*.94);c=pow(c,vec3(.91));vec2 q=vUV-.5;float vig=1.0-dot(q,q)*.60;c*=vig;frag=vec4(c,1);}
`;

  const fxaaFS = head+`
in vec2 vUV;out vec4 frag;uniform sampler2D uTex;uniform vec2 uInvResolution;uniform float uTime;
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec3 nw=texture(uTex,vUV+vec2(-1,-1)*uInvResolution).rgb,ne=texture(uTex,vUV+vec2(1,-1)*uInvResolution).rgb;
  vec3 sw=texture(uTex,vUV+vec2(-1,1)*uInvResolution).rgb,se=texture(uTex,vUV+vec2(1,1)*uInvResolution).rgb;
  vec3 mid=texture(uTex,vUV).rgb;float lnw=luma(nw),lne=luma(ne),lsw=luma(sw),lse=luma(se),lm=luma(mid);
  float lo=min(lm,min(min(lnw,lne),min(lsw,lse))),hi=max(lm,max(max(lnw,lne),max(lsw,lse)));
  vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));
  float reduce=max((lnw+lne+lsw+lse)*.03125,.0078125);float inv=1.0/(min(abs(dir.x),abs(dir.y))+reduce);
  dir=clamp(dir*inv,vec2(-7),vec2(7))*uInvResolution;
  vec3 a=.5*(texture(uTex,vUV-dir/6.0).rgb+texture(uTex,vUV+dir/6.0).rgb);
  vec3 b=a*.5+.25*(texture(uTex,vUV-dir*.5).rgb+texture(uTex,vUV+dir*.5).rgb);
  float lb=luma(b);vec3 filtered=(lb<lo||lb>hi)?a:b;filtered=mix(mid,filtered,.88);
  filtered+=(hash(gl_FragCoord.xy+fract(uTime)*97.0)-.5)*.0035;
  frag=vec4(filtered,1);
}
`;
  global.SHADERS={baseVS,objectFS,dolphinVS,dolphinFS,fishVS,fishFS,instVS,kelpFS,terrainVS,terrainFS,waterVS,waterFS,fsQuadVS,skyFS,particleVS,particleFS,shaftVS,shaftFS,brightFS,blurFS,compositeFS,fxaaFS};
})(window);
