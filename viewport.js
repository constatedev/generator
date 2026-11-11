import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {generate,presets} from './surface.mjs';
import {createWallTexture,applyWallMaterial,normalizeWallSettings,defaultWallSettings} from './wall-material.mjs';
export class Viewport {
 constructor(host,onError){
  this.host=host;this.onError=onError;this.textures=[];this.surfaceTextures=[];this.previewMode='wall';this.wallSource='concrete';this.userWallTextures=new Map();this.customWallSettings={...defaultWallSettings};
  const renderer=this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.domElement.setAttribute('aria-label','3D-просмотр декали на стене. Перетаскивайте для вращения, прокручивайте для приближения.');renderer.domElement.tabIndex=0;host.prepend(renderer.domElement);
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#242725');this.scene.fog=new THREE.Fog('#242725',13,25);
  this.camera=new THREE.PerspectiveCamera(40,1,.1,50);this.camera.position.set(2.35,1.0,5.7);
  this.controls=new OrbitControls(this.camera,renderer.domElement);this.controls.target.set(0,0,0);this.controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.controls.minDistance=2;this.controls.maxDistance=11;
  this.controls.minAzimuthAngle=-Math.PI*.44;this.controls.maxAzimuthAngle=Math.PI*.44;this.controls.minPolarAngle=.45;this.controls.maxPolarAngle=1.65;
  this.controls.enablePan=false;
  this.scene.add(new THREE.HemisphereLight('#d6e5e9','#403b31',1.6));
  this.key=new THREE.DirectionalLight('#ffedcc',4.2);this.key.position.set(-3,4,4);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);Object.assign(this.key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});this.key.shadow.bias=-.0003;this.scene.add(this.key);
  const fill=new THREE.DirectionalLight('#b6cee1',1.1);fill.position.set(4,2,2);this.scene.add(fill);
  const envScene=new THREE.Scene();envScene.background=new THREE.Color('#92999a');
  for(const [x,y,z,sx,sy] of [[-3,3,2,3,2],[4,1,-2,2,4]]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(sx,sy),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,0,0);envScene.add(panel)}
  const pmrem=new THREE.PMREMGenerator(renderer);this.env=pmrem.fromScene(envScene,.06);this.scene.environment=this.env.texture;pmrem.dispose();envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
  this.wall=new THREE.Mesh(new THREE.BoxGeometry(6,3.6,.18),new THREE.MeshStandardMaterial({color:'#a9a79d',roughness:.9}));this.wall.geometry.setAttribute('uv1',this.wall.geometry.getAttribute('uv').clone());this.wall.receiveShadow=true;this.wall.castShadow=true;this.scene.add(this.wall);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:'#55574f',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.8;floor.receiveShadow=true;this.scene.add(floor);
  const grid=new THREE.GridHelper(30,30,'#5f6358','#5f6358');grid.position.y=-1.795;grid.material.transparent=true;grid.material.opacity=.15;this.scene.add(grid);
  const geo=new THREE.PlaneGeometry(2.5,2.5);geo.setAttribute('uv1',geo.getAttribute('uv').clone());
  this.decal=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({transparent:true,depthWrite:false,roughness:.85,metalness:0,polygonOffset:true,polygonOffsetFactor:-2}));this.decal.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),3),new THREE.Plane(new THREE.Vector3(1,0,0),3),new THREE.Plane(new THREE.Vector3(0,-1,0),1.8),new THREE.Plane(new THREE.Vector3(0,1,0),1.8)];
  this.decal.receiveShadow=true;this.decal.position.set(0,0,.096);this.decal.renderOrder=1;this.scene.add(this.decal);
  this.setSurface('concrete');
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onError('Контекст WebGL потерян. Сохраните настройки и перезагрузите страницу.')});
  renderer.domElement.addEventListener('keydown',e=>{if(e.key==='Home'){this.reset();e.preventDefault()}if(e.key==='+'||e.key==='='){this.camera.position.multiplyScalar(.9);e.preventDefault()}if(e.key==='-'){this.camera.position.multiplyScalar(1.1);e.preventDefault()}});
  this.running=true;this.animate();
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
 animate(){if(!this.running)return;requestAnimationFrame(()=>this.animate());if(!this.host.hidden&&document.visibilityState!=='hidden'){this.controls.update();this.renderer.render(this.scene,this.camera)}}
 texture(data,size,color=false){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d').putImageData(new ImageData(data,size,size),0,0);const t=new THREE.CanvasTexture(canvas);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=this.renderer.capabilities.getMaxAnisotropy();return t}
 setSurface(key){
  if(!['concrete','plaster','brick','steel','custom'].includes(key))key='concrete';
  this.wallSource=key;
  if(key==='custom'){applyWallMaterial(this.wall.material,this.userWallTextures,this.customWallSettings);return}
  const type=key==='plaster'?'concrete':key==='steel'?'rust':key;const p={...presets[type],material:type,seed:1032,style:'realistic',contrast:key==='plaster'?.25:.65,normal:.5,ao:.7};
  if(key==='plaster')p.color='#c9c6b9';if(key==='steel'){p.color='#79848a';p.rough=.4;p.metal=1}
  const r=generate(p,512);for(const t of this.surfaceTextures)t.dispose();this.surfaceTextures=[];
  const mat=this.wall.material;mat.aoMap=null;mat.metalnessMap=null;mat.emissiveMap=null;mat.emissive.set('#000000');mat.emissiveIntensity=0;mat.color.set('#a9a79d');for(const [prop,map,color] of [['map','albedo',true],['normalMap','normal',false],['roughnessMap','roughness',false]]){
   const t=this.texture(r.maps[map],r.size,color);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1.2);this.surfaceTextures.push(t);mat[prop]=t;
  }
  mat.normalScale.set(.35,.35);mat.roughness=1;mat.metalness=key==='steel'?.75:0;mat.needsUpdate=true;
 }
 setWallMap(kind,image){
  const texture=createWallTexture(image,kind,this.customWallSettings,this.renderer.capabilities.getMaxAnisotropy());
  const previous=this.userWallTextures.get(kind);this.userWallTextures.set(kind,texture);this.setSurface('custom');previous?.dispose();
 }
 removeWallMap(kind){const previous=this.userWallTextures.get(kind);this.userWallTextures.delete(kind);if(this.wallSource==='custom')applyWallMaterial(this.wall.material,this.userWallTextures,this.customWallSettings);previous?.dispose()}
 clearWallMaps(){const previous=[...this.userWallTextures.values()];this.userWallTextures.clear();if(this.wallSource==='custom')applyWallMaterial(this.wall.material,this.userWallTextures,this.customWallSettings);for(const texture of previous)texture.dispose()}
 setWallSettings(settings){this.customWallSettings=normalizeWallSettings(settings);if(this.wallSource==='custom')applyWallMaterial(this.wall.material,this.userWallTextures,this.customWallSettings)}
 hasWallMaps(){return this.userWallTextures.size>0}
 update(result){
  for(const t of this.textures)t.dispose();this.textures=[];const mat=this.decal.material;
  for(const [prop,map,color] of [['map','albedo',true],['normalMap','normal',false],['roughnessMap','roughness',false],['metalnessMap','metallic',false],['aoMap','ao',false]]){
   const t=this.texture(result.maps[map],result.size,color);this.textures.push(t);mat[prop]=t;
  }
  mat.roughness=1;mat.metalness=1;mat.normalScale.set(1,1);mat.aoMapIntensity=1;mat.needsUpdate=true;
 }
 place({size,rotation,x,y}){this.decal.scale.setScalar(size);this.decal.rotation.z=-rotation*Math.PI/180;this.decal.position.x=x;this.decal.position.y=y}
 light(angle,intensity,exposure){const a=angle*Math.PI/180;this.key.position.set(Math.sin(a)*4,3,Math.max(.5,Math.cos(a)*4));this.key.intensity=intensity;this.renderer.toneMappingExposure=exposure}
 reset(){this.camera.position.set(2.35,1,5.7);this.controls.target.set(0,0,0);this.controls.update()}
 screenshot(){this.renderer.render(this.scene,this.camera);return new Promise(r=>this.renderer.domElement.toBlob(r,'image/png'))}
}
