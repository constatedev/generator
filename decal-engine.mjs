export const presets={
 rust:{name:'Ржавые потёки',tag:'OXIDATION',color:'#843e24',accent:'#d4a064',rough:.87,metal:.12,spread:.72,density:.7,erosion:.36,drip:.8,normal:1.1,age:.7},
 damp:{name:'Следы сырости',tag:'MOISTURE',color:'#4a5040',accent:'#919374',rough:.75,metal:0,spread:.82,density:.65,erosion:.22,drip:.9,normal:.45,age:.75},
 cracks:{name:'Трещины',tag:'FRACTURE',color:'#39352e',accent:'#958c79',rough:.94,metal:0,spread:.88,density:.65,erosion:.18,drip:.5,normal:1.3,age:.6},
 chips:{name:'Сколы покрытия',tag:'DELAMINATION',color:'#858276',accent:'#c7c1a6',rough:.91,metal:0,spread:.72,density:.65,erosion:.48,drip:.5,normal:1.6,age:.65},
 splatter:{name:'Брызги грязи',tag:'SPLATTER',color:'#51402b',accent:'#a18b61',rough:.86,metal:0,spread:.8,density:.7,erosion:.25,drip:.45,normal:1,age:.5},
 mold:{name:'Мох и плесень',tag:'ORGANIC',color:'#34412a',accent:'#8c9550',rough:.97,metal:0,spread:.8,density:.75,erosion:.3,drip:.4,normal:.9,age:.8},
 scratches:{name:'Царапины',tag:'ABRASION',color:'#797b76',accent:'#d7d9ce',rough:.48,metal:.75,spread:.8,density:.6,erosion:.12,drip:.5,normal:1.3,age:.45},
 dents:{name:'Вмятины',tag:'DEFORMATION',color:'#a1a8a6',accent:'#c0c6bd',rough:.48,metal:.65,spread:.8,density:.45,erosion:.05,drip:.5,normal:1.9,age:.3},
 oil:{name:'Масляные пятна',tag:'CONTAMINATION',color:'#24231d',accent:'#635139',rough:.28,metal:0,spread:.83,density:.6,erosion:.2,drip:.3,normal:.25,age:.3},
 burn:{name:'Копоть и гарь',tag:'COMBUSTION',color:'#24211c',accent:'#645444',rough:.96,metal:0,spread:.82,density:.65,erosion:.28,drip:.5,normal:.3,age:.65},
 impact:{name:'Удар и разрушение',tag:'IMPACT',color:'#555045',accent:'#aaa18b',rough:.94,metal:0,spread:.75,density:.65,erosion:.33,drip:.5,normal:1.8,age:.55}
};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function hash(x,y,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295}
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function field(freq,seed){const arr=new Float32Array(freq*freq);for(let y=0;y<freq;y++)for(let x=0;x<freq;x++)arr[y*freq+x]=hash(x,y,seed);return(u,v)=>{let px=clamp(u)* (freq-1),py=clamp(v)*(freq-1),x=Math.floor(px),y=Math.floor(py),fx=px-x,fy=py-y;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);let x1=Math.min(x+1,freq-1),y1=Math.min(y+1,freq-1);return (arr[y*freq+x]*(1-fx)+arr[y*freq+x1]*fx)*(1-fy)+(arr[y1*freq+x]*(1-fx)+arr[y1*freq+x1]*fx)*fy}}
function color(hex){return hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16))}
export function generateDecal(input,n,progress=()=>{}){
 const p={direction:-25,length:.7,depth:1,rim:.55,wetness:.6,deposit:.55,...input};
 const count=n*n,shape=new Float32Array(count),height=new Float32Array(count),rnd=rng(p.seed),spread=p.spread,den=p.density;
 const low=field(12,p.seed+11),mid=field(48,p.seed+22),fine=field(192,p.seed+33),micro=field(768,p.seed+44),warp=field(26,p.seed+55),broad=field(6,p.seed+66);
 const isStain=['damp','oil','burn','splatter'].includes(p.type),isDent=p.type==='dents';
 const pools=[],dentCenters=[];
 function ellipse(cx,cy,rx,ry,power=1,angle=0){
  rx=Math.max(rx,1/n);ry=Math.max(ry,1/n);const ca=Math.cos(angle),sa=Math.sin(angle),bx=Math.abs(rx*ca)+Math.abs(ry*sa),by=Math.abs(rx*sa)+Math.abs(ry*ca);
  const x0=Math.max(0,Math.floor((cx-bx)*n)),x1=Math.min(n-1,Math.ceil((cx+bx)*n)),y0=Math.max(0,Math.floor((cy-by)*n)),y1=Math.min(n-1,Math.ceil((cy+by)*n));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const dx=(x+.5)/n-cx,dy=(y+.5)/n-cy,xx=(ca*dx+sa*dy)/rx,yy=(-sa*dx+ca*dy)/ry,d=xx*xx+yy*yy;
   if(d<1){const i=y*n+x,value=Math.min(1,(1-d)*4)*power;shape[i]=Math.max(shape[i],value)}
  }
 }
 function line(x0,y0,x1,y1,width,power=1){
  width=Math.max(width,.7/n);const xmin=Math.max(0,Math.floor((Math.min(x0,x1)-width)*n)),xmax=Math.min(n-1,Math.ceil((Math.max(x0,x1)+width)*n));
  const ymin=Math.max(0,Math.floor((Math.min(y0,y1)-width)*n)),ymax=Math.min(n-1,Math.ceil((Math.max(y0,y1)+width)*n)),dx=x1-x0,dy=y1-y0,len=dx*dx+dy*dy;
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
   const px=(x+.5)/n,py=(y+.5)/n,t=clamp(((px-x0)*dx+(py-y0)*dy)/Math.max(len,1e-10)),d=Math.hypot(px-x0-t*dx,py-y0-t*dy)/width;
   if(d<1){const i=y*n+x;shape[i]=Math.max(shape[i],Math.min(1,(1-d)*3)*power)}
  }
 }
 function crack(x,y,angle,length,width,depth){
  const steps=Math.max(3,Math.round(length*60));let px=x,py=y;
  for(let k=0;k<steps;k++){
   angle+=(rnd()-.5)*1.05*p.distortion;const len=length/steps,nx=px+Math.cos(angle)*len,ny=py+Math.sin(angle)*len;
   line(px,py,nx,ny,width*(1-k/steps*.65),.8+rnd()*.2);
   if(depth>0&&k>1&&rnd()<.18*den)crack(px,py,angle+(rnd()>.5?1:-1)*(.5+rnd()),length*(.15+rnd()*.25),width*.48,depth-1);
   px=nx;py=ny;
  }
 }
 if(p.type==='rust'){
  for(let j=0;j<18+den*35;j++){
   const x=.5+(rnd()-.5)*spread*.85,y=.18+(rnd()-.5)*.13;
   ellipse(x,y,(.014+rnd()*.055)*spread,.008+rnd()*.025,.45+rnd()*.55,rnd()*3);
  }
  for(let j=0;j<8+den*42;j++){
   let x=.5+(rnd()-.5)*spread*.72,y=.16+rnd()*.14;const start=x,length=(.12+rnd()*.62)*p.drip,width=(.0015+rnd()*.012)*p.width;
   const steps=22;let previousX=start,previousY=y;
   for(let k=1;k<=steps;k++){
    const yy=y+length*k/steps,xx=start+Math.sin(k*.25+j)*(.001+p.distortion*.004);
    line(previousX,previousY,xx,yy,width*(1-k/steps*.72),.7+rnd()*.3);
    previousX=xx;previousY=yy;x=xx;
   }
   if(rnd()<.3)ellipse(x,y+length,width*.9,width*1.8,.55);
  }
 }else if(p.type==='scratches'){
  const baseAngle=p.direction*Math.PI/180;
  for(let j=0;j<5+den*50;j++){
   const angle=baseAngle+(rnd()-.5)*(.04+p.distortion*.18),len=(.06+rnd()*.42)*spread*p.length;
   const cx=.5+(rnd()-.5)*spread*.68,cy=.5+(rnd()-.5)*spread*.6;
   const w=(.0006+Math.pow(rnd(),3)*.0038)*p.width;let px=cx-Math.cos(angle)*len/2,py=cy-Math.sin(angle)*len/2;
   for(let k=1;k<=12;k++){
    const t=k/12,edge=Math.sin(t*Math.PI)*.8+.2,nx=cx+Math.cos(angle)*len*(t-.5),ny=cy+Math.sin(angle)*len*(t-.5)+(rnd()-.5)*.002*p.distortion;
    if(rnd()>.08*p.erosion)line(px,py,nx,ny,w*edge,.7+rnd()*.3);px=nx;py=ny;
   }
  }
 }else if(p.type==='dents'){
  const number=1+Math.floor(den*7);
  for(let j=0;j<number;j++){
   const radius=(.035+rnd()*.09)*spread*p.width;
   dentCenters.push({x:.5+(rnd()-.5)*spread*.64,y:.5+(rnd()-.5)*spread*.62,rx:radius,ry:radius*(.65+rnd()*.6),angle:rnd()*Math.PI,depth:.6+rnd()*.4});
  }
 }else if(p.type==='damp'||p.type==='oil'||p.type==='burn'){
  const number=3+Math.floor(den*5),soot=p.type==='burn';
  pools.push({x:.5,y:.48,rx:spread*(soot?.13:.21),ry:spread*(soot?.28:p.type==='oil'?.15:.23),angle:soot?0:rnd()*.5,power:.9});
  for(let j=0;j<number;j++)pools.push({x:.5+(rnd()-.5)*spread*(soot?.24:.45),y:.48+(rnd()-.5)*spread*(soot?.55:.33),rx:(.065+rnd()*.1)*spread,ry:(.065+rnd()*.13)*spread,angle:rnd()*Math.PI,power:.35+rnd()*.55});
  if(p.type==='damp'||p.type==='oil')for(let j=0;j<den*16;j++){
   const x=.5+(rnd()-.5)*spread*.55,y=.45+(rnd()-.5)*spread*.24,len=(.04+rnd()*.3)*p.drip;
   line(x,y,x+(rnd()-.5)*.02,y+len,.001+rnd()*.004*p.width,.2+rnd()*.35);
  }
 }else if(p.type==='cracks'){
  for(let j=0;j<3+den*5;j++)crack(.5+(rnd()-.5)*.16,.5+(rnd()-.5)*.12,j*Math.PI*2/(3+den*5)+rnd()*.4,spread*(.18+rnd()*.26),(.0017+rnd()*.0025)*p.width,2);
 }else if(p.type==='impact'){
  ellipse(.5,.5,.08*spread,.07*spread,1);
  for(let j=0;j<20+den*35;j++){const a=rnd()*Math.PI*2,r=(.05+rnd()*.09)*spread;ellipse(.5+Math.cos(a)*r,.5+Math.sin(a)*r,(.01+rnd()*.035)*spread,(.005+rnd()*.018)*spread,.5+rnd()*.5,a)}
  for(let j=0;j<7+den*10;j++)crack(.5,.5,j*2.4+rnd(),spread*(.14+rnd()*.3),(.001+rnd()*.0025)*p.width,1);
 }else if(p.type==='splatter'){
  for(let j=0;j<4;j++)pools.push({x:.49+(rnd()-.5)*spread*.16,y:.48+(rnd()-.5)*spread*.13,rx:(.06+rnd()*.08)*spread,ry:(.05+rnd()*.065)*spread,angle:rnd()*Math.PI,power:.7+rnd()*.3});
  const angle=p.direction*Math.PI/180,ca=Math.cos(angle),sa=Math.sin(angle);
  for(let j=0;j<25+den*150;j++){
   const distance=Math.pow(rnd(),1.5)*spread*.45,a=rnd()*Math.PI*2;
   const dx=Math.cos(a)*distance,dy=Math.sin(a)*distance*.62;
   const x=.5+ca*dx-sa*dy,y=.48+sa*dx+ca*dy,rr=(.0015+Math.pow(rnd(),4)*.022)*p.width;
   ellipse(x,y,rr,rr*(.7+rnd()*.6),.25+rnd()*.7,a);
   if(j<5)line(x,y,x+ca*rr*4,y+sa*rr*4,rr*.25,.45);
  }

 }else{
  const total=p.type==='mold'?70+den*180:22+den*60;
  for(let j=0;j<total;j++){
   const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*spread*.35,x=.5+Math.cos(a)*r,y=.5+Math.sin(a)*r*.8;
   const radius=p.type==='mold'?(.006+Math.pow(rnd(),2)*.045)*p.width:(.012+rnd()*.09)*p.width;
   ellipse(x,y,radius,radius*(.5+rnd()),.5+rnd()*.5,rnd()*3);
  }
 }
 // Satellite flecks and edge debris share the same reproducible seed.
 if(!['cracks','scratches','dents','damp','oil','burn'].includes(p.type))for(let j=0;j<den*150;j++){
  const a=rnd()*Math.PI*2,r=(.15+rnd()*.3)*spread,rad=(.0008+rnd()*.003)*p.width;
  ellipse(.5+Math.cos(a)*r,.48+Math.sin(a)*r*.8,rad,rad*(.6+rnd()),.15+rnd()*.4);
 }
 for(const pool of pools)pool.rx*=Math.sqrt(p.width);
 progress(.2);
 const maps={};for(const key of ['albedo','normal','roughness','ao','metallic','height','mask'])maps[key]=new Uint8ClampedArray(count*4);
 const base=color(p.color),accent=color(p.accent),real=p.style==='realistic'?1:.4;
 for(let y=0;y<n;y++){
  for(let x=0;x<n;x++){
   const i=y*n+x,j=i*4,u=(x+.5)/n,v=(y+.5)/n;
   const shift=p.distortion*.014,uu=clamp(u+(warp(u,v)-.5)*shift),vv=clamp(v+(warp(u+.21,v+.17)-.5)*shift);
   const xx=Math.min(n-1,Math.floor(uu*n)),yy=Math.min(n-1,Math.floor(vv*n));
   let s=shape[yy*n+xx],fluidProfile=0,dentProfile=0,dentRim=0;
   if(pools.length){
    const bend=(broad(u,v)-.5)*.65*p.distortion+(low(u,v)-.5)*.25*p.distortion+(mid(u,v)-.5)*.11*p.distortion;
    const pu=u+(low(u+.13,v+.11)-.5)*spread*.25*p.distortion,pv=v+(low(u+.37,v+.23)-.5)*spread*.21*p.distortion;
    for(const pool of pools){const dx=pu-pool.x,dy=pv-pool.y,ca=Math.cos(pool.angle),sa=Math.sin(pool.angle);const rad=Math.hypot((dx*ca+dy*sa)/pool.rx,(-dx*sa+dy*ca)/pool.ry);const edge=1-rad+bend;
     const profile=smooth(-.02-p.softness*.2,.12+p.softness*.9,edge)*pool.power;fluidProfile=Math.max(fluidProfile,profile);
    }
    s=Math.max(s,fluidProfile);
   }
   if(isDent){for(const dent of dentCenters){
    const dx=u-dent.x,dy=v-dent.y,ca=Math.cos(dent.angle),sa=Math.sin(dent.angle),rad=Math.hypot((dx*ca+dy*sa)/dent.rx,(-dx*sa+dy*ca)/dent.ry);
    const r=rad+(low(u,v)-.5)*.09*p.distortion;
    if(r<1.2){const bowl=Math.pow(Math.max(0,1-r*r),2)*dent.depth;const rim=Math.exp(-Math.pow((r-.92)/.13,2))*.22*p.rim;
     dentProfile=Math.min(dentProfile,-bowl*.17);dentRim=Math.max(dentRim,rim*.17);s=Math.max(s,1-smooth(.9,1.2,r));
    }
   }}
   if(s<=0){maps.normal[j]=maps.normal[j+1]=128;maps.normal[j+2]=255;maps.roughness[j]=maps.roughness[j+1]=maps.roughness[j+2]=255;maps.ao[j]=maps.ao[j+1]=maps.ao[j+2]=255;maps.height[j]=maps.height[j+1]=maps.height[j+2]=128;
    for(const key of ['normal','roughness','ao','metallic','height','mask'])maps[key][j+3]=255;continue;}
   const a=low(u,v),b=mid(u,v),c=fine(u,v),d=micro(u,v),erosion=p.erosion*(.15+b*.35+c*.35+d*.15);
   const effectiveErosion=isStain?erosion*.14:isDent?0:erosion;
   const boundary=s-effectiveErosion,fade=smooth(.015,.035+p.softness*.38,boundary);
   const paper=smooth(.12+p.age*.05,.52,c*.6+d*.4),grain=1-p.micro*real*paper*.32;
   const margin=smooth(.018,.045,Math.min(u,v,1-u,1-v));
   const holes=1-smooth(.66,.92,p.erosion*.8+c*.45+(1-b)*.2);
   let alpha=clamp(fade*grain*holes*p.opacity*margin);
   if(isStain){
    // Pigment thickness: soft absorption, sparse grain, and capillary edge deposits.
    const thickness=clamp(s*(.83+(b-.5)*.16+(a-.5)*.24)-p.erosion*.12);
    const ring=Math.exp(-Math.pow((s-.15)/.085,2))*p.deposit;
    const soot=p.type==='burn';
    const optical=(1-Math.exp(-thickness*(soot?3.0:p.type==='damp'?1.7:2.5)))+ring*.14;
    alpha=clamp(optical*p.opacity*margin*(1-p.micro*real*(d-.5)*.12));
   }
   if(isDent)alpha=clamp((1-smooth(.85,1,s))*s*.2+Math.min(1,s)*.8)*p.opacity*margin;
   if(p.type==='mold')alpha*=.55+.45*c;
   if(p.type==='cracks')alpha*=.6+.4*b;
   let tone=clamp(.58+a*.45+(c-.5)*p.micro*real*(isStain?.08:.35)+(d-.5)*p.micro*real*(isStain?.035:.3),.2,1.3);
   if(isStain)tone=clamp(.75+a*.24+(b-.5)*.13-Math.exp(-Math.pow((s-.15)/.085,2))*p.deposit*.2,.3,1.2);
   if(isDent)tone=.95+(c-.5)*p.micro*.025;
   let mix=smooth(.18,.88,b*.65+a*.35)*(.25+p.age*.5);
   for(let k=0;k<3;k++)maps.albedo[j+k]=alpha>0?clamp((base[k]*(1-mix)+accent[k]*mix)*tone,0,255):0;
   maps.albedo[j+3]=alpha*255;
   const signed=['cracks','chips','impact','scratches'].includes(p.type)?-1:1;
   height[i]=signed*alpha*(.10+real*p.micro*(c-.5)*.1+real*p.micro*(d-.5)*.04)*p.depth;
   if(isStain)height[i]=alpha*(.002+(c-.5)*.002*real*p.micro)*p.depth;
   if(isDent)height[i]=(dentProfile+dentRim)*p.depth*p.opacity*margin;
   if(p.type==='scratches')height[i]*=.35;
   let rough=clamp(p.rough+(c-.5)*p.micro*.18+p.age*.05);
   if(['damp','oil','splatter'].includes(p.type))rough=clamp(rough-p.wetness*(1-p.age*.6)*.55);
   if(isDent)rough=p.rough;
   const ao=clamp(1-Math.abs(height[i])*.8*p.ao);
   const metallic=clamp(p.metal*(1-p.age*b*.6));
   for(let k=0;k<3;k++){
    maps.roughness[j+k]=rough*255;maps.ao[j+k]=ao*255;maps.metallic[j+k]=metallic*255;maps.height[j+k]=clamp(.5+height[i])*255;maps.mask[j+k]=alpha*255;
   }
   for(const key of ['normal','roughness','ao','metallic','height','mask'])maps[key][j+3]=255;
  }
  if(y%128===0)progress(.2+y/n*.6);
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,j=i*4,l=height[y*n+Math.max(0,x-1)],r=height[y*n+Math.min(n-1,x+1)],t=height[Math.max(0,y-1)*n+x],b=height[Math.min(n-1,y+1)*n+x];
  const nx=(l-r)*n*.012*p.normal,ny=(b-t)*n*.012*p.normal,inv=1/Math.hypot(nx,ny,1);
  maps.normal[j]=(nx*inv*.5+.5)*255;maps.normal[j+1]=(ny*inv*.5+.5)*255;maps.normal[j+2]=(.5+.5*inv)*255;
 }
 progress(1);return {maps,size:n,generatorVersion:2};
}
