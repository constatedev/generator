import * as THREE from './vendor/three.module.js';
export const wallSlots={
 color:{label:'Base Color',property:'map',color:true},
 normal:{label:'Normal · OpenGL',property:'normalMap'},
 roughness:{label:'Roughness',property:'roughnessMap'},
 ao:{label:'Ambient Occlusion',property:'aoMap'},
 metallic:{label:'Metallic',property:'metalnessMap'},
 emission:{label:'Emission · свечение',property:'emissiveMap',color:true}
};
export const defaultWallSettings={repeatX:1,repeatY:1,normalStrength:1,flipNormalY:false,roughness:.85,metallic:0,aoStrength:1,emissionStrength:1};
export function normalizeWallSettings(settings={}){
 const result={...defaultWallSettings};
 const ranges={repeatX:[.25,12],repeatY:[.25,12],normalStrength:[0,4],roughness:[0,1],metallic:[0,1],aoStrength:[0,3],emissionStrength:[0,5]};
 for(const [key,[min,max]]of Object.entries(ranges)){const value=settings[key];if(typeof value==='number'&&Number.isFinite(value))result[key]=Math.max(min,Math.min(max,value))}
 result.flipNormalY=settings.flipNormalY===true;return result;
}
export function createWallTexture(image,kind,settings=defaultWallSettings,anisotropy=1){
 if(!wallSlots[kind])throw new Error('Неизвестная карта стены');
 const texture=new THREE.Texture(image);texture.colorSpace=wallSlots[kind].color?THREE.SRGBColorSpace:THREE.NoColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(settings.repeatX,settings.repeatY);texture.anisotropy=anisotropy;
 if(kind==='ao')texture.channel=1;
 texture.needsUpdate=true;return texture;
}
export function applyWallMaterial(material,textures,settings){
 const p=normalizeWallSettings(settings);
 for(const [key,slot]of Object.entries(wallSlots))material[slot.property]=textures.get(key)||null;
 material.color.set(textures.has('color')?'#ffffff':'#b8b5aa');
 material.normalScale.set(p.normalStrength,p.normalStrength*(p.flipNormalY?-1:1));
 material.roughness=p.roughness;material.metalness=p.metallic;material.aoMapIntensity=p.aoStrength;
 material.emissive.set(textures.has('emission')?'#ffffff':'#000000');material.emissiveIntensity=p.emissionStrength;
 for(const texture of textures.values())texture.repeat.set(p.repeatX,p.repeatY);
 material.needsUpdate=true;
}
