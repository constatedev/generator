export const presets={
 concrete:{name:'Бетон',color:'#a5a29a',rough:.85,metal:0,scale:4},
 stone:{name:'Камень',color:'#757e75',rough:.8,metal:0,scale:5},
 brick:{name:'Кирпич',color:'#a2644a',rough:.85,metal:0,scale:6},
 wood:{name:'Дерево',color:'#9a704b',rough:.65,metal:0,scale:4},
 sand:{name:'Песок',color:'#c5ac7e',rough:.95,metal:0,scale:5},
 rust:{name:'Ржавый металл',color:'#ac5f37',rough:.65,metal:.85,scale:4}
};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const mod=(x,n)=>(x%n+n)%n;
function hash(x,y,s){let t=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1442695041);t=Math.imul(t^(t>>>13),1274126177);return ((t^(t>>>16))>>>0)/4294967295}
function field(freq,seed){const a=new Float32Array(freq*freq);for(let y=0;y<freq;y++)for(let x=0;x<freq;x++)a[y*freq+x]=hash(x,y,seed);return (u,v)=>{let x=u*freq,y=v*freq,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);let x0=mod(ix,freq),x1=(x0+1)%freq,y0=mod(iy,freq)*freq,y1=((mod(iy,freq)+1)%freq)*freq;return (a[y0+x0]*(1-fx)+a[y0+x1]*fx)*(1-fy)+(a[y1+x0]*(1-fx)+a[y1+x1]*fx)*fy}}
export function generate(p,n,progress=()=>{}){
 const count=n*n,h=new Float32Array(count),variation=new Float32Array(count),metal=new Float32Array(count),rough=new Float32Array(count);
 const scale=Math.max(2,Math.round(p.scale)),real=p.style==='realistic',detail=real?1:.38;
 const fields=[1,2,4,8,16,32].map((k,i)=>field(Math.min(256,scale*k),p.seed+i*71));
 const micro=field(512,p.seed+991),aoStep=Math.max(1,Math.round(n/64));
 const f0=fields[0],f1=fields[1],f2=fields[2],f3=fields[3],f4=fields[4],f5=fields[5];
 for(let y=0;y<n;y++){
  const v=y/n;
  for(let x=0;x<n;x++){
   const i=y*n+x,u=x/n,g=micro(u,v),a=f0(u,v),b=f1(u,v),c=f2(u,v),d=f3(u,v),e=f4(u,v),f=f5(u,v);
   let height=.5,shade=.5,r=p.rough,m=0;
   if(p.material==='concrete'){
    const pits=smooth(.63,.85,f)*.32;
    height=.33+a*.12+b*.12+c*.1+detail*(d*.08+e*.05+(g-.5)*.035-pits);
    shade=.4+a*.12+b*.1+c*.1+detail*((e-.5)*.1+(g-.5)*.13);r=clamp(p.rough+(c-.5)*.18+pits*.3);
   }else if(p.material==='brick'){
    const rows=scale*2,cols=scale;let ry=v*rows+(b-.5)*.04,iy=Math.floor(ry),fy=ry-iy;
    let rx=u*cols+(mod(iy,2))*.5+(c-.5)*.04,ix=Math.floor(rx),fx=rx-ix;
    const edge=Math.min(fx,1-fx,fy,1-fy),body=smooth(.025,.095,edge);
    const tone=hash(mod(ix,cols),mod(iy,rows),p.seed);
    height=.15+body*(.4+tone*.12+detail*(d-.5)*.14);shade=body*(.48+tone*.26+detail*(e-.5)*.15)+(1-body)*.28;
    r=clamp(p.rough+(1-body)*.12+(d-.5)*.08);
   }else if(p.material==='wood'){
    const grain=Math.sin(u*2*Math.PI*scale*3+(a-.5)*6+(b-.5)*2);
    const fine=Math.sin(u*2*Math.PI*scale*18+(b-.5)*9);
    height=.5+grain*.13+detail*fine*.025+(c-.5)*.05;shade=.53+grain*.16+(a-.5)*.16+detail*(e-.5)*.08;r=clamp(p.rough+(grain*.08));
   }else if(p.material==='sand'){
    const wave=Math.sin(u*2*Math.PI*scale*2+(a-.5)*3);
    height=.48+wave*.09+(b-.5)*.08+detail*((e-.5)*.06+(f-.5)*.03);shade=.6+wave*.06+(a-.5)*.14+detail*(f-.5)*.18;r=clamp(p.rough+(e-.5)*.06);
   }else if(p.material==='rust'){
    const patina=smooth(.36,.66,a*.55+b*.3+c*.15);
    height=.32+patina*.2+detail*(d*.1+e*.06);shade=.3+patina*.34+(b-.5)*.17+detail*(e-.5)*.15;
    m=p.metal*(1-patina);r=clamp(p.rough*(1-patina)+patina*.95);
   }else{
    // Periodic Voronoi cells: seed positions wrap across the texture boundary.
    let px=u*scale+(b-.5)*.25,py=v*scale+(c-.5)*.25,ix=Math.floor(px),iy=Math.floor(py),first=99,second=99,id=0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
     let cx=ix+ox,cy=iy+oy,cwx=mod(cx,scale),cwy=mod(cy,scale);
     let dx=cx+.2+hash(cwx,cwy,p.seed)*.6-px,dy=cy+.2+hash(cwx,cwy,p.seed+13)*.6-py,dist=dx*dx+dy*dy;
     if(dist<first){second=first;first=dist;id=hash(cwx,cwy,p.seed+91)}else if(dist<second)second=dist;
    }
    let joint=smooth(.008,.10,Math.sqrt(second)-Math.sqrt(first));
    height=.17+joint*(.3+id*.17+detail*(d-.5)*.12);shade=.24+joint*(.22+id*.23)+(b-.5)*.13+detail*(e-.5)*.1;r=clamp(p.rough+(d-.5)*.16);
   }
   h[i]=clamp(height+detail*(g-.5)*.012);variation[i]=shade+detail*(g-.5)*.035;rough[i]=r;metal[i]=p.material==='rust'?m:p.metal;
  }
  if(y%128===0)progress(y/n*.65);
 }
 const maps={};for(const name of ['albedo','normal','roughness','ao','metallic','height'])maps[name]=new Uint8ClampedArray(count*4);
 const color=p.color.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,j=i*4;
  const left=h[y*n+mod(x-1,n)],right=h[y*n+(x+1)%n],up=h[mod(y-1,n)*n+x],down=h[((y+1)%n)*n+x];
  // Resolution-independent central differences, OpenGL tangent-space convention.
  let nx=(left-right)*n*.025*p.normal,ny=(down-up)*n*.025*p.normal,nz=1,inv=1/Math.hypot(nx,ny,nz);
  const surround=(left+right+up+down+h[y*n+mod(x-aoStep,n)]+h[y*n+(x+aoStep)%n]+h[mod(y-aoStep,n)*n+x]+h[((y+aoStep)%n)*n+x])/8;
  let ao=clamp(1-Math.max(0,surround-h[i])*p.ao*4);
  const tone=clamp(.8+(variation[i]-.5)*p.contrast*1.6,.12,1.5);
  for(let k=0;k<3;k++)maps.albedo[j+k]=clamp(color[k]*tone,0,255);
  maps.normal[j]=(nx*inv*.5+.5)*255;maps.normal[j+1]=(ny*inv*.5+.5)*255;maps.normal[j+2]=(nz*inv*.5+.5)*255;
  for(const [name,val] of [['roughness',rough[i]],['ao',ao],['metallic',metal[i]],['height',h[i]]]){
   maps[name][j]=maps[name][j+1]=maps[name][j+2]=val*255;
  }
  for(const key in maps)maps[key][j+3]=255;
 }
 progress(1);return {maps,size:n};
}
