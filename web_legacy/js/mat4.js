/* 手写 mat4 / mat3 —— 不依赖任何库 */
(function (global) {
  'use strict';

  const M4 = {
    create() {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },

    identity(out) {
      out[0]=1; out[1]=0; out[2]=0; out[3]=0;
      out[4]=0; out[5]=1; out[6]=0; out[7]=0;
      out[8]=0; out[9]=0; out[10]=1; out[11]=0;
      out[12]=0; out[13]=0; out[14]=0; out[15]=1;
      return out;
    },

    multiply(out, a, b) {
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      const a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      const a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      const a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      for (let i = 0; i < 4; i++) {
        const b0=b[i], b1=b[i+4], b2=b[i+8], b3=b[i+12];
        out[i]    = b0*a00 + b1*a10 + b2*a20 + b3*a30;
        out[i+4]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
        out[i+8]  = b0*a02 + b1*a12 + b2*a22 + b3*a32;
        out[i+12] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
      }
      return out;
    },

    perspective(out, fovy, aspect, near, far) {
      const f = 1.0 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      out[0]=f/aspect; out[1]=0; out[2]=0; out[3]=0;
      out[4]=0; out[5]=f; out[6]=0; out[7]=0;
      out[8]=0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
      out[12]=0; out[13]=0; out[14]=2*far*near*nf; out[15]=0;
      return out;
    },

    lookAt(out, eye, center, up) {
      let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
      let len = Math.hypot(zx, zy, zz) || 1;
      zx/=len; zy/=len; zz/=len;

      let xx = up[1]*zz - up[2]*zy;
      let xy = up[2]*zx - up[0]*zz;
      let xz = up[0]*zy - up[1]*zx;
      len = Math.hypot(xx, xy, xz) || 1;
      xx/=len; xy/=len; xz/=len;

      const yx = zy*xz - zz*xy;
      const yy = zz*xx - zx*xz;
      const yz = zx*xy - zy*xx;

      out[0]=xx; out[1]=yx; out[2]=zx; out[3]=0;
      out[4]=xy; out[5]=yy; out[6]=zy; out[7]=0;
      out[8]=xz; out[9]=yz; out[10]=zz; out[11]=0;
      out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
      out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
      out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
      out[15]=1;
      return out;
    },

    translate(out, m, v) {
      const x=v[0], y=v[1], z=v[2];
      if (out !== m) out.set(m);
      out[12] = m[0]*x + m[4]*y + m[8]*z  + m[12];
      out[13] = m[1]*x + m[5]*y + m[9]*z  + m[13];
      out[14] = m[2]*x + m[6]*y + m[10]*z + m[14];
      out[15] = m[3]*x + m[7]*y + m[11]*z + m[15];
      return out;
    },

    scale(out, m, v) {
      const x=v[0], y=v[1], z=v[2];
      out[0]=m[0]*x;  out[1]=m[1]*x;  out[2]=m[2]*x;  out[3]=m[3]*x;
      out[4]=m[4]*y;  out[5]=m[5]*y;  out[6]=m[6]*y;  out[7]=m[7]*y;
      out[8]=m[8]*z;  out[9]=m[9]*z;  out[10]=m[10]*z; out[11]=m[11]*z;
      out[12]=m[12]; out[13]=m[13]; out[14]=m[14]; out[15]=m[15];
      return out;
    },

    rotateY(out, m, rad) {
      const s = Math.sin(rad), c = Math.cos(rad);
      const a00=m[0],a01=m[1],a02=m[2],a03=m[3];
      const a20=m[8],a21=m[9],a22=m[10],a23=m[11];
      if (out !== m) out.set(m);
      out[0]=a00*c - a20*s;  out[1]=a01*c - a21*s;
      out[2]=a02*c - a22*s;  out[3]=a03*c - a23*s;
      out[8]=a00*s + a20*c;  out[9]=a01*s + a21*c;
      out[10]=a02*s + a22*c; out[11]=a03*s + a23*c;
      return out;
    },

    rotateX(out, m, rad) {
      const s = Math.sin(rad), c = Math.cos(rad);
      const a10=m[4],a11=m[5],a12=m[6],a13=m[7];
      const a20=m[8],a21=m[9],a22=m[10],a23=m[11];
      if (out !== m) out.set(m);
      out[4]=a10*c + a20*s;  out[5]=a11*c + a21*s;
      out[6]=a12*c + a22*s;  out[7]=a13*c + a23*s;
      out[8]=a20*c - a10*s;  out[9]=a21*c - a11*s;
      out[10]=a22*c - a12*s; out[11]=a23*c - a13*s;
      return out;
    },

    rotateZ(out, m, rad) {
      const s = Math.sin(rad), c = Math.cos(rad);
      const a00=m[0],a01=m[1],a02=m[2],a03=m[3];
      const a10=m[4],a11=m[5],a12=m[6],a13=m[7];
      if (out !== m) out.set(m);
      out[0]=a00*c + a10*s;  out[1]=a01*c + a11*s;
      out[2]=a02*c + a12*s;  out[3]=a03*c + a13*s;
      out[4]=a10*c - a00*s;  out[5]=a11*c - a01*s;
      out[6]=a12*c - a02*s;  out[7]=a13*c - a03*s;
      return out;
    },

    invert(out, a) {
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      const a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      const a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      const a30=a[12],a31=a[13],a32=a[14],a33=a[15];

      const b00 = a00*a11 - a01*a10;
      const b01 = a00*a12 - a02*a10;
      const b02 = a00*a13 - a03*a10;
      const b03 = a01*a12 - a02*a11;
      const b04 = a01*a13 - a03*a11;
      const b05 = a02*a13 - a03*a12;
      const b06 = a20*a31 - a21*a30;
      const b07 = a20*a32 - a22*a30;
      const b08 = a20*a33 - a23*a30;
      const b09 = a21*a32 - a22*a31;
      const b10 = a21*a33 - a23*a31;
      const b11 = a22*a33 - a23*a32;

      let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
      if (!det) return null;
      det = 1.0 / det;

      out[0]  = ( a11*b11 - a12*b10 + a13*b09) * det;
      out[1]  = (-a01*b11 + a02*b10 - a03*b09) * det;
      out[2]  = ( a31*b05 - a32*b04 + a33*b03) * det;
      out[3]  = (-a21*b05 + a22*b04 - a23*b03) * det;
      out[4]  = (-a10*b11 + a12*b08 - a13*b07) * det;
      out[5]  = ( a00*b11 - a02*b08 + a03*b07) * det;
      out[6]  = (-a30*b05 + a32*b02 - a33*b01) * det;
      out[7]  = ( a20*b05 - a22*b02 + a23*b01) * det;
      out[8]  = ( a10*b10 - a11*b08 + a13*b06) * det;
      out[9]  = (-a00*b10 + a01*b08 - a03*b06) * det;
      out[10] = ( a30*b04 - a31*b02 + a33*b00) * det;
      out[11] = (-a20*b04 + a21*b02 - a23*b00) * det;
      out[12] = (-a10*b09 + a11*b07 - a12*b06) * det;
      out[13] = ( a00*b09 - a01*b07 + a02*b06) * det;
      out[14] = (-a30*b03 + a31*b01 - a32*b00) * det;
      out[15] = ( a20*b03 - a21*b01 + a22*b00) * det;
      return out;
    },

    /** mat4 的法线矩阵（左上 3x3 的逆转置），输出 mat3 */
    normalMatrix(out, model) {
      const inv = M4.create();
      M4.invert(inv, model);
      out[0] = inv[0]; out[1] = inv[4]; out[2] = inv[8];
      out[3] = inv[1]; out[4] = inv[5]; out[5] = inv[9];
      out[6] = inv[2]; out[7] = inv[6]; out[8] = inv[10];
      return out;
    },
  };

  global.M4 = M4;
})(window);
