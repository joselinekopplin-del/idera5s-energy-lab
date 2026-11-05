/** Original reference-informed Neo exterior. No downloaded mesh, photo or texture.
 * All units metres. +X forward, +Y left, +Z up. npm run export:models.
 */
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsClearcoat, KHRMaterialsIOR } from '@gltf-transform/extensions';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = fileURLToPath(new URL('../public/models/', import.meta.url));
const PI = Math.PI, TAU = PI*2;
const lerp=(a,b,t)=>a+(b-a)*t, clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lin=(a,b,n)=>Array.from({length:n+1},(_,i)=>lerp(a,b,i/n));
const unique=a=>[...new Set(a)].sort((a,b)=>a-b);
// Shape-preserving cubic Hermite avoids Catmull-Rom overshoot at wheel envelopes.
function profile(xs,ys) {
  const h=xs.slice(1).map((x,i)=>x-xs[i]), d=h.map((v,i)=>(ys[i+1]-ys[i])/v), m=ys.map(()=>0);
  m[0]=d[0]; m[m.length-1]=d[d.length-1];
  for(let i=1;i<m.length-1;i++) if(d[i-1]*d[i]>0) {const w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]);}
  return x=>{if(x<=xs[0])return ys[0];if(x>=xs.at(-1))return ys.at(-1);let i=0;while(xs[i+1]<x)i++;const t=(x-xs[i])/h[i],q=t*t;return (2*q*t-3*q+1)*ys[i]+(q*t-2*q+t)*h[i]*m[i]+(-2*q*t+3*q)*ys[i+1]+(q*t-q)*h[i]*m[i+1];};
}
const xp=[-2.418,-2.27,-1.92,-1.29,-.65,0,.65,1.15,1.476,1.85,2.15,2.418];
const width=profile(xp,[.867,.903,.927,.940,.924,.918,.929,.939,.940,.922,.898,.864]);
const deck=profile(xp,[1.045,1.068,1.062,1.057,1.050,1.044,1.033,1.015,.988,.954,.904,.878]);
const rx=[-1.86,-1.65,-1.40,-1.14,-.84,-.46,-.22,.06,.31,.52,.74,.94,1.12];
const roof=profile(rx,[1.061,1.134,1.276,1.398,1.466,1.500,1.505,1.493,1.454,1.385,1.280,1.125,1.017]);
const roofWidth=profile([-2.418,-2.03,...rx,1.40,1.90,2.418],[.760,.810,.823,.790,.743,.703,.679,.670,.670,.673,.684,.706,.749,.800,.835,.830,.801,.760]);
const R=x=>x<rx[0]||x>rx.at(-1)?deck(x):roof(x);
const C=x=>roofWidth(x);
const topDrop=x=>.012+.030*Math.exp(-(((x+.3)/1.25)**4))+.036*Math.exp(-(((x-1.48)/.61)**4));
const frontX=(y,z)=>2.405-.182*(Math.abs(y)/.94)**2.7-.025*((z-.59)/.5)**2-.068*clamp((.46-z)/.223)**2-.075*clamp((z-.64)/.24)**2;
const rearX=(y,z)=>-2.405+.125*(Math.abs(y)/.94)**2.9+.030*((z-.73)/.53)**2+.090*clamp((.48-z)/.243)**2;
function warp(x,y,z){const f=clamp((x-1.92)/.498),r=clamp((-x-1.92)/.498);return x-f*f*(2.418-frontX(y,z))+r*r*(rearX(y,z)+2.418);}
function upper(x,u){const y=C(x)*u,z=R(x)-topDrop(x)*u*u+.006*Math.exp(-(((Math.abs(u)-.72)/.10)**2))*Math.exp(-(((x-1.40)/.60)**4));return [warp(x,y,z),y,z];}
function shoulder(x,t,side=1){
  // Window panel and shoulder share vertices with both roof and lower body.
  const y0=C(x),y1=width(x),z0=R(x)-topDrop(x),z1=deck(x)-.105;
  // A smooth glass belt lands at 91.5% width, then rolls into the body side.
  const q=t<.84?t/.84:1, h=clamp((R(x)-deck(x))/.35);
  let y,z;
  if(t<=.84){y=lerp(y0,.915*y1,q)+.009*Math.sin(PI*q)*h;z=lerp(z0,deck(x)-.026,q);}
  else {const a=(t-.84)/.16;y=lerp(.915*y1,y1,Math.sin(a*PI/2));z=lerp(deck(x)-.026,z1,1-Math.cos(a*PI/2));}
  y*=side; return [warp(x,y,z),y,z];
}
const archR=.383, tireR=.33965;
function lowerEdge(x){let z=.237;for(const a of [-1.290,1.476])if(Math.abs(x-a)<archR)z=Math.max(z,tireR+Math.sqrt(Math.max(0,archR*archR-(x-a)**2)));return z;}
function sidePoint(x,z,s){const top=deck(x)-.105,t=clamp((z-.237)/(top-.237));let y=width(x)-.031*(1-t)**2;
  // Subtle convex door panel, lower sculpted concavity and crisp upper shoulder.
  y+=.005*Math.sin(PI*t)-.012*Math.exp(-(((z-(.365+.025*(1-x/2.4)))/.055)**2))*Math.exp(-((x/1.3)**8));
  y=Math.min(.94,y);return [warp(x,s*y,z),s*y,z];
}

function build(quality){
  const q={low:{nx:64,nv:10,nc:40,tube:4},standard:{nx:128,nv:18,nc:72,tube:6},high:{nx:208,nv:28,nc:112,tube:8}}[quality];
  const buckets=new Map(), wheels=new Map();let parts=0;
  function add(kind,g,target=buckets){
    g.deleteAttribute('uv');g.deleteAttribute('tangent');g.clearGroups();if(!g.index){const count=g.getAttribute('position').count;g.setIndex(Array.from({length:count},(_,i)=>i));}
    if(!g.getAttribute('normal'))g.computeVertexNormals();if(!target.has(kind))target.set(kind,[]);target.get(kind).push(g);parts++;return g;
  }
  function surface(as,bs,fn,kind,normal,mask=null,target=buckets){
    const p=[],idx=[];for(const a of as)for(const b of bs)p.push(...fn(a,b));
    const nb=bs.length;
    const push=(ia,ib,ic)=>{const va=new T.Vector3().fromArray(p,ia*3),vb=new T.Vector3().fromArray(p,ib*3),vc=new T.Vector3().fromArray(p,ic*3);const cross=vb.clone().sub(va).cross(vc.clone().sub(va));if(cross.lengthSq()<1e-18)return;const mid=va.clone().add(vb).add(vc).multiplyScalar(1/3);const n=typeof normal==='function'?normal(mid):normal;if(cross.dot(new T.Vector3(...n))<0)idx.push(ia,ic,ib);else idx.push(ia,ib,ic);};
    for(let a=0;a<as.length-1;a++)for(let b=0;b<bs.length-1;b++){if(mask&&!mask((as[a]+as[a+1])/2,(bs[b]+bs[b+1])/2))continue;const i=a*nb+b;push(i,i+nb,i+nb+1);push(i,i+nb+1,i+1);}
    if(!idx.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return add(kind,g,target);
  }
  function tube(points,r,kind,closed=false,target=buckets){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal');const segments=Math.max(8,Math.ceil(curve.getLength()*(quality==='high'?80:quality==='standard'?44:22)));return add(kind,new T.TubeGeometry(curve,segments,r,q.tube,closed),target);}
  function ellipsoid(c,r,kind,target=buckets){const g=new T.SphereGeometry(1,q.nc/2,q.nv);g.scale(...r);g.translate(...c);return add(kind,g,target);}
  function poly(coords,kind,map,normal,target=buckets,rounded=false){
    let a=coords;
    if(rounded)for(let k=0;k<2;k++){const b=[];for(let j=0;j<a.length;j++){let p=a[j],n=a[(j+1)%a.length];b.push([lerp(p[0],n[0],.13),lerp(p[1],n[1],.13)],[lerp(p[0],n[0],.87),lerp(p[1],n[1],.87)]);}a=b;}
    const shape=new T.Shape(a.map(p=>new T.Vector2(...p)));let g=new T.ShapeGeometry(shape,quality==='low'?4:8);
    // Tessellate in the 2D source domain before mapping to the curved fascia.
    // Large un-subdivided polygons would sink through the rounded bumper.
    g=new TessellateModifier(quality==='low'?.08:quality==='standard'?.045:.027,7).modify(g);
    if(!g.index)g.setIndex(Array.from({length:g.getAttribute('position').count},(_,i)=>i));
    const pos=g.getAttribute('position');
    for(let i=0;i<pos.count;i++)pos.setXYZ(i,...map(pos.getX(i),pos.getY(i)));
    const index=g.index.array;for(let i=0;i<index.length;i+=3){const va=new T.Vector3().fromBufferAttribute(pos,index[i]),vb=new T.Vector3().fromBufferAttribute(pos,index[i+1]),vc=new T.Vector3().fromBufferAttribute(pos,index[i+2]);if(vb.sub(va).cross(vc.sub(va)).dot(new T.Vector3(...normal))<0){[index[i+1],index[i+2]]=[index[i+2],index[i+1]];}}
    g.deleteAttribute('normal');g.computeVertexNormals();return add(kind,g,target);
  }
  const x=unique([...lin(-2.418,2.418,q.nx),...rx,...xp,.38,.97,-1.56,-.88,1.476,-1.29,...[-1.29,1.476].flatMap(a=>[-archR,-archR*.97,0,archR*.97,archR].map(v=>a+v)),...[-1.65,-1.12,-1.07,-.20,-.115,.94]]);
  const u=unique([...lin(-1,1,q.nv*2),-.91,.91]);
  const wind=(a,b)=>((a>=.38&&a<=.97)||(a>=-1.56&&a<=-.88))&&Math.abs(b)<.91;
  surface(x,u,upper,'paint',[0,0,1],(a,b)=>!wind(a,b));
  surface(x,u,upper,'glass',[0,0,1],wind);
  for(const s of [-1,1]){
    const t=unique([...lin(0,1,q.nv),.09,.78,.84]);
    // Taper the fixed rear quarter light to a rounded point, instead of a
    // clipped vertical rectangle. This local reparameterisation has no hole.
    const glassT=(a,b)=>{const q=clamp((-a-1.28)/.37),lo=.09+.63*q*q,hi=.78-.06*q;return b<.09?b/.09*lo:b<.78?lerp(lo,hi,(b-.09)/.69):lerp(hi,1,(b-.78)/.22);};
    const window=(a,b)=>((a>-.115&&a<.94)||(a>-1.07&&a<-.20)||(a>-1.65&&a<-1.12))&&b>.09&&b<.78;
    const cDivider=(a,b)=>a>-1.12&&a<-1.07&&b>.09&&b<.78;
    surface(x,t,(a,b)=>shoulder(a,glassT(a,b),s),'paint',p=>[0,s,.25],(a,b)=>!window(a,b)&&!cDivider(a,b));
    surface(x,t,(a,b)=>shoulder(a,glassT(a,b),s),'glass',p=>[0,s,.25],window);
    surface(x,t,(a,b)=>shoulder(a,glassT(a,b),s),'trim',p=>[0,s,.25],cDivider);
    const v=lin(0,1,q.nv);
    surface(x,v,(a,b)=>sidePoint(a,lerp(lowerEdge(a),deck(a)-.105,b),s),'paint',[0,s,0]);
    // The Neo has a painted sheet-metal cutout, not a separate white arch flare.
    // Use the side panel's exact circular boundary and only a recessed liner.
    for(const a of [-1.29,1.476]){
      surface(lin(-.14,PI+.14,q.nc),[.77,.90],(th,y)=>[a+(archR-.004)*Math.cos(th),s*y,tireR+(archR-.004)*Math.sin(th)],'trim',p=>[0,s,0]);
      poly(lin(0,PI,q.nc/2).map(th=>[a+(archR-.006)*Math.cos(th),tireR+(archR-.006)*Math.sin(th)]),'trim',(xx,z)=>[xx,s*.765,z],[0,s,0]);
    }
    // True window borders, three separate panes with a body-colour B pillar.
    for(const e of [.09,.78])tube(lin(-1.65,.96,70).map(a=>{const p=shoulder(a,glassT(a,e),s);p[1]+=s*.0017;return p;}),.004,'trim');
    for(const a of [-1.65,-1.10,-.155,.96])tube(lin(.09,.78,20).map(v=>{const p=shoulder(a,glassT(a,v),s);p[1]+=s*.002;return p;}),a===-.155?.0035:.0045,'trim');
    const seams=[[[.94,deck(.94)-.03],[.98,.79],[.99,.52],[.94,.25]],[[-.155,deck(-.155)-.024],[-.17,.80],[-.18,.48],[-.20,.25]],[[-1.12,deck(-1.12)-.02],[-1.18,.86],[-1.10,.68],[-.96,.28]]];
    for(const points of seams)tube(points.map(([a,z])=>{const p=sidePoint(a,z,s);p[1]+=s*.0015;return p;}),.0017,'seam');
    // Sill contour and integrated door shoulder crease are shallow, not stickers.
    tube(lin(-.88,1.05,55).map(a=>{const p=sidePoint(a,.255,s);p[1]+=s*.001;return p;}),.002,'trim');
    for(const a of [-.94,.05]){
      const coords=[[-.122,-.027],[.107,-.027],[.125,.005],[.103,.028],[-.103,.028],[-.126,.005]];
      poly(coords,'trim',(dx,dz)=>{const p=sidePoint(a+dx,.933+dz,s);p[1]+=s*.002;return p;},[0,s,0],buckets,true);
      poly(coords.map(([dx,dz])=>[dx*.94,dz*.50+.013]),'paint',(dx,dz)=>{const p=sidePoint(a+dx,.933+dz,s);p[1]+=s*.005;return p;},[0,s,0],buckets,true);
    }
    tube([[-1.60,.947],[-1.76,.947],[-1.77,1.038],[-1.52,1.038],[-1.50,.953],[-1.60,.947]].map(([a,z])=>{const p=sidePoint(a,z,s);p[1]+=s*.002;return p;}),.0013,'seam',true);
    ellipsoid([.82,s*.927,1.072],[.12,.053,.033],'trim');
    ellipsoid([.77,s*1.035,1.116],[.139,.092,.058],'trim');
    surface(lin(0,TAU,q.nc),lin(0,1,q.nv),(th,r)=>{const y=.071*r*Math.cos(th),z=.044*r*Math.sin(th),xx=.77-.139*Math.sqrt(Math.max(0,1-(y/.092)**2-(z/.058)**2))-.002;return [xx,s*1.035+y,1.116+z];},'mirror',[-1,0,0]);
    tube(lin(-.09,.10,16).map(dx=>[.77+dx,s*1.120,1.109+.004*Math.cos(dx*12)]),.0027,'chrome');
  }
  // Windshield seals, wipers and rear defogger wires.
  for(const [lo,hi] of [[.38,.97],[-1.56,-.88]]){
    for(const e of [-.91,.91])tube(lin(lo,hi,45).map(a=>{const p=upper(a,e);p[2]+=.0018;return p;}),.004,'trim');
    for(const a of [lo,hi])tube(lin(-.91,.91,45).map(b=>{const p=upper(a,b);p[2]+=.0018;return p;}),.004,'trim');
  }
  for(const [a,b] of [[.925,-.40],[.91,.40]])tube(lin(-.28,.28,14).map(v=>{const p=upper(a-.035*v,b+v);p[2]+=.008;return p;}),.0035,'trim');
  if(quality!=='low')for(const a of lin(-1.48,-.96,8))tube(lin(-.84,.84,32).map(b=>{const p=upper(a,b);p[2]+=.0018;return p;}),.00055,'defog');
  // Continuous radiused front/rear fascia, all decoration sits on the same map.
  function faceMap(which,y,z,depth=.003){return [which==='front'?frontX(y,z)+depth:rearX(y,z)-depth,y,z];}
  function facePoly(which,yz,kind,rounded=true,depth=.004){return poly(yz,kind,(y,z)=>faceMap(which,y,z,depth),[which==='front'?1:-1,0,0],buckets,rounded);}
  function band(which,a,b,z,thick,kind,depth=.005){surface(lin(Math.min(a,b),Math.max(a,b),Math.max(12,Math.round(Math.abs(a-b)*q.nc))),[-.5,.5],(y,v)=>faceMap(which,y,(typeof z==='function'?z(y):z)+v*thick,depth),kind,[which==='front'?1:-1,0,0]);}
  for(const which of ['front','rear']){
    const end=which==='front'?2.418:-2.418;
    // The fascia boundary uses the EXACT same vertices as the roof, rolled
    // shoulders and side panels. Welded normals round the bumper corners.
    const border=[];
    for(const b of u)border.push(upper(end,b));
    const ts=unique([...lin(0,1,q.nv),.09,.78,.84]);
    for(const t of ts.slice(1))border.push(shoulder(end,t,1));
    for(const v of lin(1,0,q.nv).slice(1))border.push(sidePoint(end,lerp(.237,deck(end)-.105,v),1));
    border.push(sidePoint(end,.237,-1));
    for(const v of lin(0,1,q.nv).slice(1))border.push(sidePoint(end,lerp(.237,deck(end)-.105,v),-1));
    for(const t of [...ts].reverse().slice(1))border.push(shoulder(end,t,-1));
    border.push(border[0]);
    surface(lin(0,border.length-1,border.length-1),lin(0,1,q.nv),(i,r)=>{const p=border[Math.round(i)];return faceMap(which,p[1]*r,lerp(.57,p[2],r),0);},'paint',[which==='front'?1:-1,0,0]);
  }
  band('front',-.853,.853,y=>.823+.027*(Math.abs(y)/.85)**3,.049,'trim');
  band('front',-.79,.79,y=>.824+.024*(Math.abs(y)/.85)**3,.010,'chrome',.007);
  band('rear',-.86,.86,y=>.987-.007*(Math.abs(y)/.86)**2,.064,'trim');
  band('rear',-.82,.82,.992,.014,'redlens',.007);
  for(const s of [-1,1]){
    band('front',s*.43,s*.835,y=>.832+.020*(Math.abs(y)/.85)**3,.016,'drl',.009);
    facePoly('front',[[.51,.432],[.66,.634],[.735,.724],[.825,.715],[.852,.652],[.862,.423],[.823,.364],[.745,.371]].map(([y,z])=>[s*y,z]),'trim');
    facePoly('front',[[.660,.651],[.828,.660],[.824,.704],[.724,.711]].map(([y,z])=>[s*y,z]),'headlamp',true,.009);
    for(const z of [.455,.532,.605])band('front',s*.683,s*.838,z,.011,'slat',.009);
    band('rear',s*.23,s*.837,.998,.016,'taillamp',.009);
    band('rear',s*.44,s*.83,.972,.012,'brakelamp',.009);
    band('rear',s*.47,s*.74,.439,.012,'redlens',.007);
    // Rear corner lens wraps onto the wing and leaves the centre passive.
    surface(lin(-2.418,-2.03,36),[-.5,.5],(xx,v)=>{const z=deck(xx)-.052+v*.037*clamp((-xx-2.03)/.15),p=sidePoint(xx,z,s);p[1]+=s*.002;return p;},'redlens',[0,s,0]);
    surface(lin(2.04,2.418,32),[-.5,.5],(xx,v)=>{const z=deck(xx)-.027+v*.026*clamp((xx-2.04)/.12),p=sidePoint(xx,z,s);p[1]+=s*.002;return p;},'trim',[0,s,0]);
  }
  facePoly('front',[[-.68,.274],[-.49,.414],[.49,.414],[.68,.274]],'trim');
  for(const z of [.309,.363])band('front',-.52,.52,z,.010,'slat',.008);
  for(const y of [-.43,-.26,.26,.43])facePoly('front',[[y-.006,.284],[y+.006,.284],[y+.006,.401],[y-.006,.401]],'slat',false,.009);
  facePoly('front',[[-.075,.278],[-.075,.416],[.075,.416],[.075,.278]],'trim',false,.010);
  band('front',-.75,.75,.245,.017,'trim');
  facePoly('rear',[[-.80,.258],[-.80,.403],[-.70,.466],[.70,.466],[.80,.403],[.80,.258]],'trim');
  band('rear',-.68,.68,.688,.0025,'seam');
  for(const y of [-.68,.68])tube(lin(.69,1.045,25).map(z=>faceMap('rear',y,z,.005)),.0017,'seam');
  facePoly('front',[[-.212,.49],[.212,.49],[.212,.605],[-.212,.605]],'plate');
  facePoly('rear',[[-.215,.515],[.215,.515],[.215,.638],[-.215,.638]],'plate');
  // Geometric badges and lettering: authored vector strokes, never an image.
  function badge(which,z,r){
    facePoly(which,lin(0,TAU,q.nc).map(th=>[r*Math.cos(th),z+r*Math.sin(th)]),'trim',false,.011);
    surface(lin(0,TAU,q.nc),[r-.004,r],(th,rr)=>faceMap(which,rr*Math.cos(th),z+rr*Math.sin(th),.012),'chrome',[which==='front'?1:-1,0,0]);
    const p1=[[-.54,.60],[0,-.08],[.54,.60]],p2=[[-.80,.24],[-.43,-.63],[0,-.14],[.43,-.63],[.80,.24]];
    for(const p of [p1,p2])tube(p.map(([y,dz])=>faceMap(which,y*r,z+dz*r,.014)),r*.050,'chrome');
  }
  badge('front',.823,.061);badge('rear',.986,.054);
  const chars={I:[[[0,0],[0,1]]],D:[[[0,0],[0,1],[.55,1],[.8,.8],[.8,.2],[.55,0],[0,0]]],E:[[[.8,1],[0,1],[0,0],[.8,0]],[[0,.5],[.6,.5]]],R:[[[0,0],[0,1],[.65,1],[.8,.8],[.8,.6],[.6,.5],[0,.5]],[[.4,.5],[.85,0]]],A:[[[0,0],[.35,1],[.5,1],[.85,0]],[[.18,.4],[.68,.4]]],S:[[[.8,1],[.2,1],[0,.8],[.15,.55],[.65,.45],[.8,.2],[.6,0],[0,0]]],'5':[[[.8,1],[0,1],[0,.55],[.6,.55],[.8,.3],[.65,0],[0,0]]],'.':[[[.3,0],[.31,.01]]], ' ':[]};
  function text(which,str,z,h,y=0,kind='chrome'){let w=str.length*h*1.15;for(let i=0;i<str.length;i++)for(const stroke of chars[str[i]]||[])tube(stroke.map(([u,v])=>faceMap(which,y+(which==='front'?-1:1)*(w/2-i*h*1.15-u*h),z+v*h,.012)),h*.030,kind);}
  text('rear','ID.ERA',.861,.028);text('rear','5S',.750,.030,-.60);text('front','ID.ERA 5S',.533,.028,0,'chrome');text('rear','ID.ERA 5S',.556,.027,0,'chrome');
  // Dark cabin insert; a restrained continuous inner skin prevents glass holes.
  // It is part of the shell and is removed along with the body in teaching view.
  surface(lin(-1.62,.95,q.nx/2),lin(-.86,.86,q.nv),(a,b)=>{const p=upper(a,b);p[2]-=.07;return p;},'interior',[0,0,1]);
  // Four tyre instances share geometry for each mirrored side. Axle positions
  // remain invariant: animation only rotates the named group around local Y.
  function wheel(side){const target=new Map();
    function rev(section,kind){return surface(lin(0,TAU,q.nc),lin(0,section.length-1,section.length-1),(th,i)=>{const [y,r]=section[Math.round(i)];return [r*Math.cos(th),side*y,r*Math.sin(th)];},kind,p=>[p.x,p.y,p.z],null,target);}
    const section=[[-.089,.209],[-.100,.220],[-.109,.244],[-.1125,.270],[-.110,.299],[-.102,.321],[-.090,.333],[-.072,tireR],[-.054,tireR],[-.050,tireR-.0028],[-.046,tireR],[-.006,tireR],[0,tireR-.0028],[.006,tireR],[.046,tireR],[.050,tireR-.0028],[.054,tireR],[.072,tireR],[.090,.333],[.102,.321],[.110,.299],[.1125,.270],[.109,.244],[.100,.220],[.089,.209]];
    rev(section,'rubber');rev([[.080,.195],[.096,.208],[.104,.2159],[.108,.212],[.108,.205],[.096,.199]],'alloy');rev([[-.090,.197],[.080,.197]],'wheelblack');rev([[.05,.060],[.05,.174]],'brake');
    function wheelPoly(a,depth,kind){return poly(a,kind,(xx,z)=>[xx,side*(depth+.005*(1-Math.hypot(xx,z)/.2159)),z],[0,side,0],target);}
    const polar=(arr,phi)=>arr.map(([r,a])=>[r*Math.cos(phi+a*PI/180),r*Math.sin(phi+a*PI/180)]);
    for(let k=0;k<5;k++){
      const a=PI/2+k*TAU/5;
      wheelPoly(polar([[.052,15],[.188,-27],[.208,-25],[.208,21],[.166,29],[.059,26]],a),.099,'wheelblack');
      wheelPoly(polar([[.070,3],[.205,-25],[.212,-9],[.202,-7],[.115,12]],a),.105,'alloy');
      wheelPoly(polar([[.080,15],[.208,-5],[.214,19],[.180,18],[.090,23]],a),.105,'alloy');
      const cx=.055*Math.cos(a+.45),cz=.055*Math.sin(a+.45);
      ellipsoid([cx,side*.106,cz],[.006,.003,.006],'chrome',target);
    }
    rev([[.102,.037],[.110,.037],[.113,.030],[.113,0]],'wheelblack');rev([[.112,.031],[.113,.034]],'alloy');
    for(const a of [[[-.014,.016],[0,-.002],[.014,.016]],[[-.023,.006],[-.012,-.018],[0,-.004],[.012,-.018],[.023,.006]]])tube(a.map(([xx,z])=>[xx,side*.114,z]),.0011,'chrome',false,target);
    if(quality!=='low')for(let j=0;j<(quality==='high'?48:32);j++)for(const y of [-.06,-.025,.025,.06]){
      const a=j*TAU/(quality==='high'?48:32);surface([a,a+.012],[-.009,.009],(th,d)=>[(tireR+.00009)*Math.cos(th+d*.6),side*(y+d),Math.max(-tireR,(tireR+.00009)*Math.sin(th+d*.6))],'tread',p=>[p.x,0,p.z],null,target);
    }
    return target;
  }
  wheels.set('left',wheel(1));wheels.set('right',wheel(-1));
  // Normalize X from the measured visible body geometry; leave axles fixed.
  let minX=Infinity,maxX=-Infinity;for(const gs of buckets.values())for(const g of gs){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));}}
  const factor=4.836/(maxX-minX);for(const [kind,gs] of buckets)for(const g of gs){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){p.setX(i,(p.getX(i)-minX)*factor-2.418);if(kind==='paint')p.setY(i,clamp(p.getY(i),-.94,.94));}g.computeVertexNormals();}
  function combine(map){const out=new Map();for(const [kind,gs]of map){let g=mergeGeometries(gs,false);g.deleteAttribute('normal');g=mergeVertices(g,1e-5);
    // Welding may collapse sub-millimetre seal triangles: remove those faces
    // and remap only referenced vertices before computing smooth unit normals.
    const old=g.getAttribute('position'),ix=g.index.array,keep=[],pa=new T.Vector3(),pb=new T.Vector3(),pc=new T.Vector3();
    for(let i=0;i<ix.length;i+=3){pa.fromBufferAttribute(old,ix[i]);pb.fromBufferAttribute(old,ix[i+1]);pc.fromBufferAttribute(old,ix[i+2]);if(pb.sub(pa).cross(pc.sub(pa)).lengthSq()>1e-18)keep.push(ix[i],ix[i+1],ix[i+2]);}
    const remap=new Map(),positions=[],index=[];for(const k of keep){if(!remap.has(k)){remap.set(k,positions.length/3);positions.push(old.getX(k),old.getY(k),old.getZ(k));}index.push(remap.get(k));}
    g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();out.set(kind,g);}return out;}
  return {quality,body:combine(buckets),left:combine(wheels.get('left')),right:combine(wheels.get('right')),partCount:parts};
}

const materialSpec={
  paint:{rgb:[.73,.70,.61],metal:.72,rough:.26,coat:1},glass:{rgb:[.005,.012,.018],metal:.08,rough:.18,coat:1},
  trim:{rgb:[.003,.005,.007],metal:.15,rough:.40},seam:{rgb:[.018,.021,.024],metal:.1,rough:.6},
  rubber:{rgb:[.005,.006,.008],metal:0,rough:.96},tread:{rgb:[.002,.003,.004],metal:0,rough:1},
  alloy:{rgb:[.50,.54,.58],metal:1,rough:.29},chrome:{rgb:[.76,.81,.84],metal:1,rough:.19},
  wheelblack:{rgb:[.003,.004,.006],metal:.30,rough:.36},brake:{rgb:[.030,.035,.040],metal:.65,rough:.70},
  drl:{rgb:[.70,.80,.85],metal:.15,rough:.16},headlamp:{rgb:[.36,.44,.49],metal:.35,rough:.15},
  taillamp:{rgb:[.32,.008,.016],metal:.1,rough:.18},brakelamp:{rgb:[.30,.005,.01],metal:.1,rough:.18},
  redlens:{rgb:[.17,.005,.013],metal:.2,rough:.20},slat:{rgb:[.055,.063,.073],metal:.32,rough:.42},
  mirror:{rgb:[.33,.45,.52],metal:1,rough:.08},plate:{rgb:[.023,.033,.042],metal:0,rough:.53},
  defog:{rgb:[.19,.14,.11],metal:.6,rough:.43},interior:{rgb:[.014,.018,.022],metal:0,rough:1}
};

async function exportGLB(model){
  const doc=new Document(),buffer=doc.createBuffer(),cc=doc.createExtension(KHRMaterialsClearcoat),ior=doc.createExtension(KHRMaterialsIOR),mats=new Map();
  for(const [name,s]of Object.entries(materialSpec)){const m=doc.createMaterial(name).setBaseColorFactor([...s.rgb,1]).setMetallicFactor(s.metal).setRoughnessFactor(s.rough);if(s.coat)m.setExtension('KHR_materials_clearcoat',cc.createClearcoat().setClearcoatFactor(s.coat).setClearcoatRoughnessFactor(.13));if(name==='glass')m.setExtension('KHR_materials_ior',ior.createIOR().setIOR(1.5));mats.set(name,m);}
  const scene=doc.createScene('Neo'),root=doc.createNode('vehicle'),body=doc.createNode('body');scene.addChild(root);root.addChild(body);root.setExtras({units:'metre',upAxis:'Z',forwardAxis:'+X',model:'2026 ID.ERA 5S Neo',approximation:true});
  let triangles=0,vertices=0,primitives=0,invalidNormals=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],paintMin=[Infinity,Infinity,Infinity],paintMax=[-Infinity,-Infinity,-Infinity];
  function addGroup(group,map,offset=[0,0,0],meshCache=null){for(const [kind,g]of map){const pos=g.getAttribute('position'),norm=g.getAttribute('normal'),ind=g.index;
      triangles+=ind.count/3;vertices+=pos.count;primitives++;
      for(let i=0;i<pos.count;i++){const arr=[pos.getX(i),pos.getY(i),pos.getZ(i)];for(let j=0;j<3;j++){min[j]=Math.min(min[j],arr[j]+offset[j]);max[j]=Math.max(max[j],arr[j]+offset[j]);if(group===body&&kind==='paint'){paintMin[j]=Math.min(paintMin[j],arr[j]);paintMax[j]=Math.max(paintMax[j],arr[j]);}}
        const len=Math.hypot(norm.getX(i),norm.getY(i),norm.getZ(i));if(!Number.isFinite(len)||Math.abs(len-1)>.01)invalidNormals++;
      }
      let mesh=meshCache?.get(kind);if(!mesh){const p=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.array)).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(norm.array)).setBuffer(buffer)).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ind.array)).setBuffer(buffer)).setMaterial(mats.get(kind));mesh=doc.createMesh(kind).addPrimitive(p);if(meshCache)meshCache.set(kind,mesh);}
      group.addChild(doc.createNode(group.getName()+'_'+kind).setMesh(mesh));
    }}
  addGroup(body,model.body);
  for(const [side,bank]of [[1,model.left],[-1,model.right]]){const cache=new Map();for(const [front,x,y]of [[true,1.476,.7995],[false,-1.290,.802]]){const pos=[x,side*y,tireR],wheel=doc.createNode('wheel_'+(front?'F':'R')+(side>0?'L':'R')).setTranslation(pos).setExtras({radius:tireR,axis:'Y'});root.addChild(wheel);addGroup(wheel,bank,pos,cache);}}
  const io=new NodeIO().registerExtensions([KHRMaterialsClearcoat,KHRMaterialsIOR]);const bytes=await io.writeBinary(doc);const file='vehicle-'+model.quality+'.glb';await writeFile(path.join(OUT,file),bytes);
  const out={quality:model.quality,file,bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex'),triangles,vertices,drawPrimitives:primitives,uniqueMeshes:doc.getRoot().listMeshes().length,invalidNormals,bounds:{min,max},paintBounds:{min:paintMin,max:paintMax},nominal:{length:4.836,width:1.880,height:1.505,wheelbase:2.766,wheelRadius:tireR,rimRadius:.2159},bodyLength:max[0]-min[0],bodyWidth:paintMax[1]-paintMin[1],height:max[2]-min[2],sourceSurfacePieces:model.partCount};
  if(invalidNormals)throw Error(`${file}: ${invalidNormals} invalid normals`);
  if(Math.abs(out.bodyLength-4.836)>1e-5||Math.abs(out.bodyWidth-1.880)>1e-5||Math.abs(out.height-1.505)>1e-5)throw Error(`${file}: dimension mismatch ${JSON.stringify(out)}`);
  return out;
}

await mkdir(OUT,{recursive:true});
const models=[];for(const quality of ['high','standard','low']){const model=build(quality),result=await exportGLB(model);models.push(result);console.log(JSON.stringify(result));}
await writeFile(path.join(OUT,'manifest.json'),JSON.stringify({schemaVersion:1,version:'neo-exterior-2.0.0',coordinateSystem:'metres; +X forward, +Y left, +Z up',origin:'Independent procedural geometry authored from publicly viewable Neo reference photographs; no source photograph or third-party CAD is redistributed.',referenceSources:['https://www.autohome.com.cn/cars/imglist-x-x-8651-78803-1-x-x-x-x-1.html','https://www.12365auto.com/xcdg/20260926/576354.shtml'],referencePhotoIds:[13402347,13402346,13402344,13402343,13402342,13402315,13402320],models,limitations:['Reference-informed visual reconstruction, not factory CAD or scanned geometry.','Paint colours, body curvature, lamps and tyre deformation are visual approximations.','Neo centre light bar and VW logos remain passive.','Width excludes mirrors; nominal tyre radius is unladen.'],validation:{finiteUnitNormals:true,nominalDimensions:true,negativeScaleNodes:false}},null,2)+'\n');
