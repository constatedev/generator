import {generateDecal,presets} from './decal-engine.mjs';
import {Viewport} from './viewport.js';
import {zip} from './zip.js';
import {setupDiagnostics} from './diagnostics.js';
import {setupWallEditor} from './wall-editor.js';
const $=id=>document.getElementById(id),mapNames={albedo:'Albedo',normal:'Normal',roughness:'Roughness',ao:'AO',metallic:'Metallic',height:'Height',mask:'Mask'};
const definitions={
 'shape-controls':[
 ['spread','Размер области',.25,1,.01,.72],['density','Плотность / ветвление',.1,1,.01,.7],['width','Ширина элементов',.3,2.5,.05,1],['drip','Длина потёков',0,1,.01,.8],['distortion','Искажение контура',0,2,.05,1],['direction','Направление следа',-180,180,1,-25],['length','Длина царапин',.1,1,.01,.7]],
 'wear-controls':[
 ['erosion','Эрозия и выкрашивание',0,.95,.01,.36],['softness','Мягкость краёв',0,1,.01,.22],['age','Возраст поверхности',0,1,.01,.7],['micro','Микрофактура',0,1,.01,.8],['opacity','Непрозрачность',0,1,.01,1],['deposit','Осадок по краю',0,1,.01,.55]],
 'material-controls':[
 ['normal','Сила рельефа',0,4,.05,1.1],['rough','Шероховатость',0,1,.01,.87],['metal','Металличность',0,1,.01,.12],['ao','Затенение AO',0,3,.05,1],['depth','Глубина повреждения',.1,3,.05,1],['rim','Поднятый край вмятин',0,1,.01,.55],['wetness','Влажность пятна',0,1,.01,.6]],
 'placement-controls':[
 ['size','Масштаб декали',.3,1.5,.01,1],['rotation','Поворот',-180,180,1,0],['x','Смещение по X',-1.8,1.8,.05,0],['y','Смещение по Y',-1,1,.05,0]],
 'light-controls':[
 ['lightAngle','Направление света',-85,85,1,-40],['lightIntensity','Яркость источника',0,8,.1,4.2],['exposure','Экспозиция',.3,2,.05,1.1]]
};
const allDefs=Object.values(definitions).flat(),materialKeys=Object.entries(definitions).filter(([id])=>!['placement-controls','light-controls'].includes(id)).flatMap(([,defs])=>defs.map(d=>d[0]));
let type='rust',style='realistic',mode='3d',selected='albedo',result=null,scene=null,worker=null,timer,exporting=false,webglAvailable=true,generationId=0,diagnostics=null,wallEditor=null;
for(const [host,defs] of Object.entries(definitions))for(const [key,label,min,max,step,value] of defs){
 const wrap=document.createElement('div');wrap.className='slider-field';wrap.dataset.param=key;wrap.innerHTML=`<label for="${key}">${label}<output id="${key}-out">${value}</output></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;$(host).append(wrap);
}
function params(){return {type,style,seed:Math.max(0,Math.min(2147483647,Math.floor(Number($('seed').value)||0))),color:$('color').value,accent:$('accent').value,...Object.fromEntries(materialKeys.map(k=>[k,Number($(k).value)]))}}
function sceneParams(){return Object.fromEntries(['size','rotation','x','y','lightAngle','lightIntensity','exposure'].map(k=>[k,Number($(k).value)]))}
function manifest(){return {generator:'materia-decal',version:2,material:params(),scene:{...sceneParams(),surface:$('surface').value,wall:wallEditor?.settings()},exportResolution:Number($('resolution').value)}}
function outputs(){
 for(const [key,,,,step] of allDefs)$(key+'-out').value=['rotation','lightAngle','direction'].includes(key)?$(key).value+'°':Number($(key).value).toFixed(step>=1?0:2);
 for(const k of ['color','accent'])$(k+'-out').textContent=$(k).value.toUpperCase();
 const visible={drip:['rust','damp','oil'],direction:['scratches','splatter'],length:['scratches'],rim:['dents'],wetness:['damp','oil','splatter'],deposit:['damp','oil','splatter','burn'],depth:['cracks','chips','impact','scratches','dents']};
 for(const [key,types] of Object.entries(visible))document.querySelector('[data-param="'+key+'"]').hidden=!types.includes(type);
 $('material-note').textContent=type==='dents'?'Вмятины: normal + height, без деформации меша':'7 карт · один seed · согласованный рельеф';
}
function persist(){try{localStorage.setItem('materia-decal-v1',JSON.stringify(manifest()))}catch{}}
function applyManifest(data){
 if(data.generator!=='materia-decal'||!data.material||!presets[data.material.type])throw new Error('Это не файл настроек Decal Studio.');
 const m=data.material;type=m.type;style=m.style==='semi'?'semi':'realistic';
 for(const [key,,,,,value] of allDefs)if(materialKeys.includes(key))$(key).value=presets[type][key]??value;
 for(const [key,,min,max] of allDefs){const v=materialKeys.includes(key)?m[key]:data.scene?.[key];if(typeof v==='number'&&Number.isFinite(v))$(key).value=Math.max(min,Math.min(max,v))}
 $('seed').value=Math.max(0,Math.min(2147483647,Math.floor(Number(m.seed)||0)));
 for(const k of ['color','accent'])if(/^#[0-9a-f]{6}$/i.test(m[k]))$(k).value=m[k];
 if(['concrete','plaster','brick','steel','custom'].includes(data.scene?.surface)){
  $('surface').value=data.scene.surface;
  if(data.scene.surface==='custom'&&!wallEditor?.hasMaps()){$('surface').value='concrete';$('wall-status').textContent='Для своей стены повторно загрузите изображения. JSON содержит только параметры.'}
 }
 wallEditor?.applySettings(data.scene?.wall);
 if([1024,2048].includes(data.exportResolution))$('resolution').value=data.exportResolution;
 for(const b of $('style').children){const active=b.dataset.value===style;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)}
 outputs();applyScene();scene?.setSurface($('surface').value);
}
function canvasOf(bytes,size){const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').putImageData(new ImageData(bytes,size,size),0,0);return c}
function checker(ctx,w,h,step=24){ctx.fillStyle='#484b42';ctx.fillRect(0,0,w,h);ctx.fillStyle='#56594e';for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step)if((Math.floor(x/step)+Math.floor(y/step))%2)ctx.fillRect(x,y,step,step)}
function mapCanvas(bytes,size,target,key){const ctx=target.getContext('2d');if(key==='albedo')checker(ctx,target.width,target.height,Math.max(7,target.width/12));else ctx.clearRect(0,0,target.width,target.height);ctx.drawImage(canvasOf(bytes,size),0,0,target.width,target.height)}
function drawFlat(){if(!result)return;const target=$('flat'),ctx=target.getContext('2d'),n=target.width;const bg=$('background').value;if(bg==='checker')checker(ctx,n,n,32);else{ctx.fillStyle=bg==='light'?'#d0ccbe':'#23271f';ctx.fillRect(0,0,n,n)}ctx.drawImage(canvasOf(result.maps[selected],result.size),0,0,n,n)}
function setMode(value){mode=value==='3d'&&webglAvailable?'3d':'2d';$('webgl-host').hidden=mode!=='3d';$('flat').hidden=mode!=='2d';$('background').hidden=mode!=='2d';$('reset-camera').hidden=mode!=='3d';$('screenshot').hidden=mode!=='3d';$('compare').hidden=mode!=='3d';
 for(const b of $('mode').children){const active=b.dataset.value===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)}
 $('view-badge').textContent=mode==='3d'?'PBR · ПЕРСПЕКТИВА':`${mapNames[selected].toUpperCase()} · ${selected==='albedo'?'RGBA':'LINEAR DATA'}`;
 $('view-caption').textContent=mode==='3d'?'ПЕРЕТАСКИВАНИЕ — ВРАЩЕНИЕ · КОЛЕСО — МАСШТАБ':'ЭКСПОРТ БЕЗ СТЕНЫ И ОСВЕЩЕНИЯ';if(mode==='2d')drawFlat();else scene?.resize();
}
function selectMap(key){selected=key;$('export-map').value=key;for(const b of $('maps').children){const active=b.dataset.map===key;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)}setMode('2d')}
for(const [key,label] of Object.entries(mapNames)){
 const b=document.createElement('button');b.type='button';b.className='map-card'+(key===selected?' active':'');b.dataset.map=key;b.setAttribute('aria-pressed',key===selected);b.innerHTML=`<canvas width="112" height="112" aria-hidden="true"></canvas><span>${label}</span>`;b.onclick=()=>selectMap(key);$('maps').append(b);
}
function generationError(message){$('busy').hidden=true;$('status').textContent='Ошибка генерации: '+message;worker?.terminate();worker=null}
function refresh(){
 if(exporting)return;clearTimeout(timer);worker?.terminate();worker=null;const id=++generationId;outputs();persist();$('busy').hidden=false;$('busy-text').textContent='Собираем слои материала…';
 for(const b of $('presets').children){const active=b.dataset.type===type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)}
 timer=setTimeout(()=>{const t=performance.now(),p=params(),size=Number($('quality').value);worker=new Worker('./worker.js',{type:'module'});
  worker.onmessage=({data})=>{if(id!==generationId)return;if(data.progress!==undefined){$('busy-text').textContent=`Слои и микрофактура… ${Math.round(data.progress*100)}%`;return}if(data.error){generationError(data.error);return}
   result=data;$('busy').hidden=true;$('render-info').textContent=`${size} PX · ${((performance.now()-t)/1000).toFixed(2)} С`;
   try{scene?.update(result)}catch(e){webglError(e.message)}
   for(const b of $('maps').children)mapCanvas(result.maps[b.dataset.map],result.size,b.querySelector('canvas'),b.dataset.map);drawFlat();worker?.terminate();worker=null;
  };worker.onerror=e=>generationError(e.message||'Web Worker недоступен');worker.postMessage({params:p,size});
 },160);
}
function setPreset(key){type=key;const p=presets[key];for(const [k,v] of Object.entries(p))if($(k))$(k).value=v;for(const [k,v] of Object.entries({width:1,distortion:1,softness:.22,micro:.8,opacity:1,ao:1,direction:-25,length:.7,depth:1,rim:.55,wetness:key==='oil'?.9:.6,deposit:.55}))$(k).value=v;outputs();refresh()}
function applyScene(){if(scene){scene.place(sceneParams());scene.light(Number($('lightAngle').value),Number($('lightIntensity').value),Number($('exposure').value))}outputs();persist()}
for(const [key] of allDefs)$(key).addEventListener('input',()=>{outputs();materialKeys.includes(key)?refresh():applyScene()});
for(const k of ['seed','color','accent'])$(k).addEventListener('input',()=>{outputs();refresh()});
$('random').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0]%2147483648;refresh()};$('reset').onclick=()=>setPreset(type);$('quality').onchange=refresh;
for(const b of $('style').children)b.onclick=()=>{style=b.dataset.value;for(const e of $('style').children){e.classList.toggle('active',e===b);e.setAttribute('aria-pressed',e===b)}refresh()};
for(const b of $('mode').children)b.onclick=()=>setMode(b.dataset.value);
$('background').onchange=drawFlat;$('surface').onchange=()=>{scene?.setSurface($('surface').value);if($('surface').value==='custom'&&!wallEditor?.hasMaps())$('wall-status').textContent='Загрузите Base Color или другие карты своей стены.';persist()};
$('reset-camera').onclick=()=>scene?.reset();$('front-camera').onclick=()=>{if(scene){scene.camera.position.set(0,0,5.8);scene.controls.target.set(0,0,0);scene.controls.update();setMode('3d')}};
$('compare').onpointerdown=e=>{if(scene){scene.decal.visible=false;e.currentTarget.setPointerCapture(e.pointerId)}};
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('compare').addEventListener(name,()=>{if(scene)scene.decal.visible=true});
$('compare').onkeydown=e=>{if(scene&&(e.key===' '||e.key==='Enter')){scene.decal.visible=false;e.preventDefault()}};$('compare').onkeyup=()=>{if(scene)scene.decal.visible=true};$('compare').onblur=()=>{if(scene)scene.decal.visible=true};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
$('screenshot').onclick=async()=>{try{const blob=await scene?.screenshot();if(!blob)throw new Error('Снимок недоступен');download(blob,`materia_${type}_${params().seed}_viewport.png`)}catch(e){$('status').textContent=e.message}};
$('save-settings').onclick=()=>download(new Blob([JSON.stringify(manifest(),null,2)],{type:'application/json'}),`materia_${type}_${params().seed}.json`);
document.querySelector('.import-label').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('import-settings').click()}};
$('import-settings').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1024*1024)throw new Error('JSON должен быть меньше 1 МБ');applyManifest(JSON.parse(await file.text()));refresh();$('status').textContent='Настройки загружены.'}catch(e){$('status').textContent='Не удалось загрузить настройки: '+e.message}finally{$('import-settings').value=''}};
function png(bytes,size){return new Promise((resolve,reject)=>canvasOf(bytes,size).toBlob(b=>b?resolve(b):reject(new Error('Не удалось создать PNG')),'image/png'))}
async function exportMaps(bundle){
 if(exporting)return;if(wallEditor?.isLoading()){$('status').textContent='Дождитесь загрузки карты стены.';return}if(diagnostics?.isRunning()){$('status').textContent='Дождитесь завершения проверки сайта.';return}exporting=true;clearTimeout(timer);worker?.terminate();worker=null;++generationId;$('busy').hidden=true;
 const p=params(),size=Number($('resolution').value),key=$('export-map').value,settings=manifest(),prefix=`materia_decal_${type}_${p.seed}_${size}`;
 const controls=[...document.querySelectorAll('.settings input,.settings button,.scene-panel input,.scene-panel select,.scene-panel button,.preset,.preview-toolbar select')];const disabled=controls.map(c=>c.disabled);for(const c of controls)c.disabled=true;
 let job;$('status').textContent=`Генерация ${size} × ${size}…`;
 try{
  job=new Worker('./worker.js',{type:'module'});
  const data=await new Promise((resolve,reject)=>{job.onmessage=({data})=>{if(data.progress!==undefined){$('status').textContent=`Генерация ${size} × ${size}… ${Math.round(data.progress*100)}%`;return}data.error?reject(new Error(data.error)):resolve(data)};job.onerror=e=>reject(new Error(e.message||'Ошибка Web Worker'));job.postMessage({params:p,size})});
  if(bundle){const files=[];for(const name of Object.keys(mapNames)){$('status').textContent=`Сохраняем ${mapNames[name]}…`;files.push([`${prefix}_${name}.png`,await png(data.maps[name],size)])}files.push(['material.json',new Blob([JSON.stringify(settings,null,2)],{type:'application/json'})]);files.push(['README.txt',new Blob(['Materia Decal Studio\nAlbedo: sRGB RGBA, transparent.\nNormal: tangent-space OpenGL +Y.\nRoughness, AO, Metallic, Height and Mask: linear data, RGB grayscale.\nHeight neutral: 0.5; normal neutral: (0.5,0.5,1).\nMask equals Albedo alpha. Viewport wall and lights are not baked.\nImport material.json to reproduce the parameters.\nAll images: '+size+' x '+size+', 8 bits per channel.\nProcedural approximations, not scanned material data.\n'])]);download(await zip(files),prefix+'_PBR.zip')}
  else download(await png(data.maps[key],size),`${prefix}_${key}.png`);
  $('status').textContent=`Готово: ${bundle?'7 PNG + JSON в ZIP':'PNG'} ${size} × ${size}. Файл передан в загрузки браузера.`;
 }catch(e){$('status').textContent='Ошибка экспорта: '+e.message+'. Попробуйте 1K.'}
 finally{job?.terminate();controls.forEach((c,i)=>c.disabled=disabled[i]);exporting=false;refresh()}
}
$('export').onclick=()=>exportMaps(false);$('bundle').onclick=()=>exportMaps(true);
function webglError(message){webglAvailable=false;$('webgl-error').textContent='3D недоступен: '+message+' Доступны 2D и экспорт.';$('webgl-error').hidden=false;setMode('2d');$('mode').children[0].disabled=true;if(scene){scene.running=false;scene.controls.enabled=false}}
try{scene=new Viewport($('webgl-host'),webglError)}catch(e){webglError(e.message)}
wallEditor=setupWallEditor({getViewport:()=>webglAvailable?scene:null,onSurfaceChanged:value=>{$('surface').value=value;scene?.setSurface(value);if(webglAvailable)setMode('3d')},onChange:persist});
for(const [key,p] of Object.entries(presets)){
 const b=document.createElement('button');b.className='preset';b.dataset.type=key;b.innerHTML=`<canvas width="240" height="140" aria-hidden="true"></canvas><div><b>${p.name}</b><small>${p.tag}</small></div>`;b.onclick=()=>setPreset(key);$('presets').append(b);
 const data=generateDecal({type:key,...p,seed:73248,opacity:1,softness:.22,micro:.8,width:1,distortion:1,style:'realistic',ao:1},192),ctx=b.querySelector('canvas').getContext('2d');
 ctx.fillStyle='#a5a18f';ctx.fillRect(0,0,240,140);ctx.drawImage(canvasOf(data.maps.albedo,192),43,-7,154,154);
}
for(const [id,sign] of [['preset-prev',-1],['preset-next',1]])$(id).onclick=()=>$('presets').scrollBy({left:sign*$('presets').clientWidth*.7,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
$('help').onclick=$('help-footer').onclick=()=>$('help-dialog').showModal();$('help-dialog').querySelector('.close').onclick=()=>$('help-dialog').close();$('help-dialog').onclick=e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}};
try{const saved=JSON.parse(localStorage.getItem('materia-decal-v1'));if(saved)applyManifest(saved)}catch{}
diagnostics=setupDiagnostics({getScene:()=>webglAvailable?scene:null,isBusy:()=>exporting||wallEditor?.isLoading()});
outputs();applyScene();refresh();
