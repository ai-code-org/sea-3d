/* 全程序化几何：海豚、鱼、地形、海藻与珊瑚。仅在初始化时分配。 */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;

  function mesh(pos, idx, nrm, col, uv) {
    return {
      pos: pos instanceof Float32Array ? pos : new Float32Array(pos),
      idx: idx instanceof Uint32Array ? idx : new Uint32Array(idx),
      nrm: nrm ? (nrm instanceof Float32Array ? nrm : new Float32Array(nrm)) : null,
      col: col ? (col instanceof Float32Array ? col : new Float32Array(col)) : null,
      uv: uv ? (uv instanceof Float32Array ? uv : new Float32Array(uv)) : null,
    };
  }

  function computeNormals(m) {
    const n = new Float32Array(m.pos.length);
    for (let i = 0; i < m.idx.length; i += 3) {
      const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3;
      const ux = m.pos[b] - m.pos[a], uy = m.pos[b + 1] - m.pos[a + 1], uz = m.pos[b + 2] - m.pos[a + 2];
      const vx = m.pos[c] - m.pos[a], vy = m.pos[c + 1] - m.pos[a + 1], vz = m.pos[c + 2] - m.pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
      n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
      n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
    m.nrm = n;
    return m;
  }

  function merge(parts) {
    let np = 0, ni = 0;
    for (const p of parts) { np += p.pos.length; ni += p.idx.length; }
    const pos = new Float32Array(np), nrm = new Float32Array(np), col = new Float32Array(np);
    const idx = new Uint32Array(ni);
    let po = 0, io = 0, base = 0;
    for (const p of parts) {
      if (!p.nrm) computeNormals(p);
      pos.set(p.pos, po); nrm.set(p.nrm, po);
      if (p.col) col.set(p.col, po);
      else for (let i = 0; i < p.pos.length; i += 3) { col[po + i] = col[po + i + 1] = col[po + i + 2] = 1; }
      for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + base;
      base += p.pos.length / 3; po += p.pos.length; io += p.idx.length;
    }
    return { pos, nrm, col, idx };
  }

  function ellipsoid(rx, ry, rz, cx, cy, cz, seg, rings, color) {
    const p = [], id = [], co = [];
    for (let j = 0; j <= rings; j++) {
      const v = j / rings, ph = v * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * TAU;
        p.push(cx + Math.cos(ph) * rx, cy + Math.sin(ph) * Math.cos(a) * ry, cz + Math.sin(ph) * Math.sin(a) * rz);
        co.push(color[0], color[1], color[2]);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      id.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return computeNormals(mesh(p, id, null, co));
  }

  function solidFin(points, thickness, color) {
    const p = [], co = [], id = [];
    let cx = 0, cy = 0, cz = 0;
    for (const q of points) { cx += q[0]; cy += q[1]; cz += q[2]; }
    cx /= points.length; cy /= points.length; cz /= points.length;
    const a = points[0], b = points[1], c = points[2];
    const ux = b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    const nl=Math.hypot(nx,ny,nz)||1; nx=nx/nl*thickness; ny=ny/nl*thickness; nz=nz/nl*thickness;
    for (const s of [-1, 1]) {
      p.push(cx+nx*s,cy+ny*s,cz+nz*s); co.push(...color);
      for (const q of points) { p.push(q[0]+nx*s,q[1]+ny*s,q[2]+nz*s); co.push(...color); }
    }
    const n=points.length, off=n+1;
    for (let i=0;i<n;i++) {
      const j=(i+1)%n;
      id.push(0,1+j,1+i, off,off+1+i,off+1+j, 1+i,1+j,off+1+j, 1+i,off+1+j,off+1+i);
    }
    return computeNormals(mesh(p,id,null,co));
  }

  function profile(t, stops) {
    for (let i=0;i<stops.length-1;i++) if (t<=stops[i+1][0]) {
      const a=stops[i],b=stops[i+1],u=(t-a[0])/(b[0]-a[0]);
      const s=u*u*(3-2*u); return a[1]+(b[1]-a[1])*s;
    }
    return stops[stops.length-1][1];
  }

  function curvedFin(points,thickness,color,steps){
    const out=[],n=points.length,segments=steps||4;
    for(let i=0;i<n;i++)for(let j=0;j<segments;j++){
      const p0=points[(i-1+n)%n],p1=points[i],p2=points[(i+1)%n],p3=points[(i+2)%n],t=j/segments,t2=t*t,t3=t2*t,q=[];
      for(let k=0;k<3;k++)q[k]=.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
      out.push(q);
    }
    return solidFin(out,thickness,color);
  }

  function dolphin() {
    const parts=[],p=[],id=[],co=[],rings=52,seg=24;
    const radii=[[0,.07],[.08,.17],[.22,.48],[.40,.86],[.57,.91],[.68,.80],[.78,.72],[.85,.64],[.91,.52],[.96,.36],[1,.025]];
    for(let j=0;j<=rings;j++) {
      const t=j/rings,x=-3.45+t*6.15,r=profile(t,radii);
      const center=.11*Math.sin(t*Math.PI)-.08*t;
      for(let i=0;i<=seg;i++) {
        const a=i/seg*TAU,up=Math.cos(a);
        const melon=Math.exp(-Math.pow((x-2.02)/.48,2))*.18*Math.max(0,up);
        p.push(x,center+up*r*.88+melon,Math.sin(a)*r*.76);
        const belly=Math.max(0,-up),top=Math.max(0,up);
        co.push(.20+belly*.55-top*.035,.36+belly*.49-top*.04,.43+belly*.43-top*.03);
      }
    }
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++) {
      const a=j*(seg+1)+i,b=a+seg+1;id.push(a,a+1,b,b,a+1,b+1);
    }
    parts.push(computeNormals(mesh(p,id,null,co)));
    /* 短而钝圆的瓶鼻吻部，与额隆和身体合并后仍只有一次绘制。 */
    parts.push(ellipsoid(.65,.19,.22,2.92,-.13,0,20,12,[.28,.42,.47]));
    /* 前缘隆起、尖端后弯、后缘内凹的连续曲线背鳍。 */
    parts.push(curvedFin([[.65,.63,0],[.34,1.08,0],[.02,1.53,0],[-.42,1.88,0],[-.25,1.42,0],[-.38,1.02,0],[-.93,.64,0]],.065,[.16,.30,.36],5));
    for(const s of [-1,1])parts.push(curvedFin([[1.25,-.30,s*.53],[.48,-.66,s*1.04],[-.48,-1.03,s*1.72],[-.20,-.49,s*.75],[.55,-.16,s*.52]],.040,[.24,.40,.46],5));
    /* 左右独立弧形尾叶，中央 V 形分叉，外缘向后弯曲。 */
    for(const s of [-1,1])parts.push(curvedFin([[-3.17,0,0],[-3.29,.015,s*.62],[-3.53,.025,s*1.28],[-3.94,.015,s*1.68],[-4.17,0,s*1.46],[-3.96,-.01,s*.84],[-3.48,0,0]],.035,[.18,.33,.40],5));
    for(const s of [-1,1]) {
      parts.push(ellipsoid(.115,.105,.065,2.18,.24,s*.405,12,8,[.006,.012,.016]));
      parts.push(ellipsoid(.030,.030,.020,2.22,.275,s*.457,8,6,[.75,.95,1]));
    }
    return merge(parts);
  }

  function fish(kind) {
    const parts=[],p=[],id=[],co=[],rings=16,seg=12;
    const h=kind===0?.18:kind===1?.43:.66, w=kind===0?.09:kind===1?.16:.105;
    for(let j=0;j<=rings;j++) {
      const t=j/rings,x=-.82+t*1.72,r=Math.pow(Math.sin(t*Math.PI),.65)*(kind===0?.82:1);
      for(let i=0;i<=seg;i++) {
        const a=i/seg*TAU, up=Math.cos(a);
        p.push(x,up*r*h,Math.sin(a)*r*w);
        const belly=Math.max(0,-up); co.push(.82+belly*.18,.86+belly*.14,.88+belly*.12);
      }
    }
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++) {const a=j*(seg+1)+i,b=a+seg+1;id.push(a,a+1,b,b,a+1,b+1);}
    parts.push(computeNormals(mesh(p,id,null,co)));
    const tail=kind===2?1.0:kind===1?.78:.62;
    parts.push(solidFin([[-.72,0,0],[-1.30,tail,0],[-1.12,0,0],[-1.30,-tail,0]],.018,[.8,.82,.75]));
    parts.push(solidFin([[.28,h*.7,0],[-.38,h*1.55,0],[-.65,h*.55,0]],.015,[.72,.78,.76]));
    if(kind===2) parts.push(solidFin([[.35,-h*.65,0],[-.28,-h*1.45,0],[-.70,-h*.4,0]],.015,[.72,.78,.76]));
    for(const s of [-1,1]) parts.push(ellipsoid(.065,.065,.025,.60,h*.22,s*w*.78,8,6,[.008,.012,.014]));
    return merge(parts);
  }

  function grid(size, seg, heightFn, distributionPower) {
    const p=[],id=[],uv=[];
    for(let z=0;z<=seg;z++)for(let x=0;x<=seg;x++) {
      const ux=x/seg-.5,uz=z/seg-.5,power=distributionPower||1;
      const px=Math.sign(ux)*Math.pow(Math.abs(ux),power)*size,pz=Math.sign(uz)*Math.pow(Math.abs(uz),power)*size;
      p.push(px,heightFn?heightFn(px,pz):0,pz);uv.push(x/seg,z/seg);
    }
    for(let z=0;z<seg;z++)for(let x=0;x<seg;x++) {const a=z*(seg+1)+x,b=a+seg+1;id.push(a,b,a+1,b,b+1,a+1);}
    const m=mesh(p,id,null,null,uv); if(heightFn)computeNormals(m); return m;
  }

  function kelp() {
    const p=[],id=[],co=[];
    for(let blade=0;blade<3;blade++) {
      const a=blade*Math.PI/3,dx=Math.cos(a),dz=Math.sin(a),off=p.length/3,steps=11;
      for(let j=0;j<=steps;j++) {
        const t=j/steps,y=t*3.8,w=(.17+.13*Math.sin(t*Math.PI))*(1-t*.76);
        const bend=.22*Math.sin(t*2.8+blade);
        for(const s of [-1,1]) {p.push(dx*(s*w+bend),y,dz*(s*w+bend));co.push(.18+.14*t,.53+.27*t,.20+.13*t);}
      }
      for(let j=0;j<steps;j++){const q=off+j*2;id.push(q,q+2,q+1,q+1,q+2,q+3);}
    }
    return computeNormals(mesh(p,id,null,co));
  }

  function cylinderBetween(a,b,r,sides,p,id,co,color) {
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz)||1;
    const ux=dx/l,uy=dy/l,uz=dz/l;
    let vx=-uy,vy=ux,vz=0;const vl=Math.hypot(vx,vy,vz)||1;vx/=vl;vy/=vl;
    const wx=uy*vz-uz*vy,wy=uz*vx-ux*vz,wz=ux*vy-uy*vx;
    const off=p.length/3;
    for(const q of [a,b])for(let i=0;i<sides;i++){const an=i/sides*TAU,c=Math.cos(an)*r,s=Math.sin(an)*r;p.push(q[0]+vx*c+wx*s,q[1]+vy*c+wy*s,q[2]+vz*c+wz*s);co.push(...color);}
    for(let i=0;i<sides;i++){const j=(i+1)%sides;id.push(off+i,off+j,off+sides+i,off+j,off+sides+j,off+sides+i);}
  }

  function coral() {
    const p=[],id=[],co=[];
    function branch(x,y,z,len,ang,depth,seed) {
      const ex=x+Math.sin(ang)*len,ey=y+Math.cos(ang)*len,ez=z+Math.sin(seed*2.3)*len*.20;
      cylinderBetween([x,y,z],[ex,ey,ez],.025+depth*.025,6,p,id,co,[.9,.45+.08*depth,.38+.1*depth]);
      if(depth>0){branch(ex,ey,ez,len*.70,ang-.48,depth-1,seed+1);branch(ex,ey,ez,len*.66,ang+.54,depth-1,seed+2);}
    }
    branch(0,0,0,.72,0,4,1);branch(0,.15,0,.60,-.75,3,4);branch(0,.18,0,.58,.8,3,7);
    return computeNormals(mesh(p,id,null,co));
  }

  function rock() {
    const m=ellipsoid(1,1,1,0,0,0,14,10,[.32,.40,.39]);
    for(let i=0;i<m.pos.length;i+=3){const x=m.pos[i],y=m.pos[i+1],z=m.pos[i+2];const r=1+.10*Math.sin(x*7+y*4)*Math.sin(z*8-y*3);m.pos[i]=x*r;m.pos[i+1]=y*.63*r;m.pos[i+2]=z*r;}
    return computeNormals(m);
  }

  global.GEO={mesh,computeNormals,merge,dolphin,fish,grid,kelp,coral,rock};
})(window);
