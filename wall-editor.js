import {wallSlots,defaultWallSettings,normalizeWallSettings} from './wall-material.mjs';
const $=id=>document.getElementById(id);
const controls=[['repeatX','Повтор по X',.25,12,.25],['repeatY','Повтор по Y',.25,12,.25],['normalStrength','Сила нормалей стены',0,4,.05],['roughness','Шероховатость стены',0,1,.01],['metallic','Металличность стены',0,1,.01],['aoStrength','Сила AO стены',0,3,.05],['emissionStrength','Сила свечения',0,5,.05]];
export async function decodeWallFile(file){
 if(!file||file.size>32*1024*1024)throw new Error('Выберите изображение размером до 32 МБ');
 if(!/\.(png|jpe?g|webp)$/i.test(file.name))throw new Error('Поддерживаются PNG, JPG и WebP');
 let image,url;
 try{
  if(typeof createImageBitmap==='function')image=await createImageBitmap(file);
  else{url=URL.createObjectURL(file);image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Не удалось прочитать изображение'));img.src=url})}
  const width=image.width,height=image.height;if(!width||!height||width>16384||height>16384)throw new Error('Слишком большое или некорректное изображение');
  const ratio=Math.min(1,2048/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
  const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);return {canvas,width,height};
 }finally{image?.close?.();if(url)URL.revokeObjectURL(url)}
}
export function setupWallEditor({getViewport,onSurfaceChanged,onChange}){
 const names=new Map(),jobs=new Map(),rows=new Map();
 for(const [kind,slot]of Object.entries(wallSlots)){
  const row=document.createElement('div');row.className='wall-slot';
  const thumb=document.createElement('canvas');thumb.width=thumb.height=48;thumb.hidden=true;
  const info=document.createElement('div');info.className='wall-slot-info';const label=document.createElement('span');label.textContent=slot.label;const name=document.createElement('small');name.textContent='Не загружена';info.append(label,name);
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;
  const upload=document.createElement('button');upload.type='button';upload.className='wall-upload';upload.textContent='↑';upload.title='Загрузить '+slot.label;upload.setAttribute('aria-label','Загрузить '+slot.label);upload.onclick=()=>input.click();
  const remove=document.createElement('button');remove.type='button';remove.className='wall-remove';remove.textContent='×';remove.title='Удалить '+slot.label;remove.setAttribute('aria-label','Удалить '+slot.label);remove.disabled=true;
  row.append(thumb,info,upload,remove,input);$(kind==='color'?'wall-base-slot':'wall-map-slots').append(row);rows.set(kind,{thumb,name,remove,upload,input});
  remove.onclick=()=>{jobs.set(kind,(jobs.get(kind)||0)+1);getViewport()?.removeWallMap(kind);names.delete(kind);name.textContent='Не загружена';thumb.hidden=true;thumb.getContext('2d').clearRect(0,0,48,48);remove.disabled=true;upload.disabled=false;if(kind==='metallic')$('wall-metallic').value=0;if(kind==='roughness')$('wall-roughness').value=.85;update();sync();$('wall-status').textContent='Карта удалена.';onChange()};
  input.onchange=async()=>{
   const file=input.files[0];input.value='';if(!file)return;const scene=getViewport();if(!scene){$('wall-status').textContent='Для своей стены необходим работающий 3D-вьюпорт.';return}
   const job=(jobs.get(kind)||0)+1;jobs.set(kind,job);upload.disabled=true;remove.disabled=false;$('wall-status').textContent='Читаем '+slot.label+'…';
   try{
    const decoded=await decodeWallFile(file);if(jobs.get(kind)!==job)return;
    scene.setWallMap(kind,decoded.canvas);names.set(kind,file.name);name.textContent=file.name;name.title=`${file.name} · ${decoded.width}×${decoded.height} → ${decoded.canvas.width}×${decoded.canvas.height}`;
    thumb.hidden=false;const ctx=thumb.getContext('2d');ctx.clearRect(0,0,48,48);ctx.drawImage(decoded.canvas,0,0,48,48);remove.disabled=false;
    if(kind==='roughness')$('wall-roughness').value=1;if(kind==='metallic')$('wall-metallic').value=1;
    onSurfaceChanged('custom');update();sync();
    $('wall-status').textContent=`${slot.label}: ${decoded.canvas.width}×${decoded.canvas.height}. Применено к стене.`;
   }catch(e){if(jobs.get(kind)===job){$('wall-status').textContent='Не удалось загрузить карту: '+e.message;remove.disabled=!names.has(kind)}}
   finally{if(jobs.get(kind)===job)upload.disabled=false}
  };
 }
 for(const [key,label,min,max,step]of controls){const wrap=document.createElement('div');wrap.className='slider-field';wrap.innerHTML=`<label for="wall-${key}">${label}<output id="wall-${key}-out">${defaultWallSettings[key]}</output></label><input id="wall-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${defaultWallSettings[key]}">`;$('wall-controls').append(wrap);$('wall-'+key).oninput=update}
 $('wall-flip-y').onchange=update;
 function settings(){return normalizeWallSettings({...Object.fromEntries(controls.map(([key])=>[key,Number($('wall-'+key).value)])),flipNormalY:$('wall-flip-y').checked})}
 function update(){const p=settings();for(const [key]of controls)$('wall-'+key+'-out').value=p[key].toFixed(2);getViewport()?.setWallSettings(p);onChange()}
 function sync(){$('wall-clear').disabled=!names.size;const count=names.size;$('wall-count').textContent=count?count+' / 6 карт':'Карты необязательны'}
 $('wall-clear').onclick=()=>{for(const [kind,row]of rows){jobs.set(kind,(jobs.get(kind)||0)+1);row.name.textContent='Не загружена';row.thumb.hidden=true;row.remove.disabled=true;row.upload.disabled=false}names.clear();getViewport()?.clearWallMaps();onSurfaceChanged('concrete');for(const [key]of controls)$('wall-'+key).value=defaultWallSettings[key];$('wall-flip-y').checked=false;update();sync();$('wall-status').textContent='Карты очищены. Выбрана стандартная стена.';onChange()};
 $('wall-use-custom').onclick=()=>{onSurfaceChanged('custom');onChange()};
 sync();return {settings,isLoading:()=>[...rows.values()].some(row=>row.upload.disabled),hasMaps:()=>names.size>0,applySettings(value){const p=normalizeWallSettings(value);for(const [key]of controls)$('wall-'+key).value=p[key];$('wall-flip-y').checked=p.flipNormalY;update()}};
}
