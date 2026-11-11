import {presets} from './decal-engine.mjs';
import {zip} from './zip.js';
import {decodeWallFile} from './wall-editor.js';
const $=id=>document.getElementById(id);
function assert(condition,message){if(!condition)throw new Error(message)}
function generated(params,size){
 return new Promise((resolve,reject)=>{
  let worker;const timeout=setTimeout(()=>{worker?.terminate();reject(new Error('Генерация превысила 60 секунд'))},60000);
  const end=(error,data)=>{clearTimeout(timeout);worker?.terminate();error?reject(error):resolve(data)};
  try{worker=new Worker('./worker.js',{type:'module'});worker.onmessage=({data})=>{if(data.progress!==undefined)return;data.error?end(new Error(data.error)):end(null,data)};worker.onerror=e=>end(new Error(e.message||'Ошибка Worker'));worker.postMessage({params,size})}catch(e){end(e)}
 });
}
function validate(data,size){
 assert(data.size===size,'Неверное разрешение');assert(Object.keys(data.maps).length===7,'Нужны семь карт');
 for(const [name,bytes]of Object.entries(data.maps))assert(bytes.length===size*size*4,'Неверный размер '+name);
 const a=data.maps.albedo,m=data.maps.mask;
 for(let j=0;j<a.length;j+=4)assert(a[j+3]===m[j],'Mask не совпадает с альфой Albedo');
 for(let x=0;x<size;x++)for(const i of [x,(size-1)*size+x,x*size,x*size+size-1])assert(a[i*4+3]===0,'Непрозрачное поле текстуры');
}
export function setupDiagnostics({getScene,isBusy}){
 let running=false,report=null;
 $('site-test').onclick=()=>$('test-dialog').showModal();$('test-close').onclick=()=>$('test-dialog').close();
 $('test-report').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='materia-site-test.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('test-run').onclick=async()=>{
  if(running)return;if(isBusy()){$('test-summary').textContent='Дождитесь завершения экспорта или загрузки карты стены.';return}
  running=true;$('test-run').disabled=true;$('test-report').disabled=true;$('test-results').replaceChildren();$('test-summary').textContent='Проверяем приложение. Стена и экспортные файлы не изменяются.';
  report={generator:'materia-decal',version:2,date:new Date().toISOString(),checks:[]};
  async function check(name,fn){const li=document.createElement('li');li.textContent='… '+name;$('test-results').append(li);const started=performance.now();try{const detail=await fn();const warn=detail?.warning;li.textContent=(warn?'△ ':'✓ ')+name+(detail?.message?' — '+detail.message:'');li.className=warn?'warning':'pass';report.checks.push({name,status:warn?'warning':'passed',ms:Math.round(performance.now()-started),detail:detail?.message})}catch(e){li.textContent='× '+name+' — '+e.message;li.className='fail';report.checks.push({name,status:'failed',error:e.message})}}
  const defaults={...presets.oil,type:'oil',seed:73248,opacity:1,softness:.22,micro:.8,width:1,distortion:1,style:'realistic',ao:1,wetness:.9};let one=null;
  try{
   await check('3D / WebGL2',()=>{const scene=getScene();if(!scene)return{warning:true,message:'3D недоступен; 2D и экспорт могут работать'};assert(!scene.renderer.getContext().isContextLost(),'Контекст потерян');assert(!scene.renderer.info.programs.some(p=>p.diagnostics?.runnable===false),'Ошибка компиляции GPU-шейдера');return{message:'контекст активен. Вращение и свет проверьте визуально'}});
   await check('Загрузка JS-модулей и Worker',async()=>{for(const file of ['worker.js','decal-engine.mjs','vendor/three.module.js','wall-editor.js','wall-material.mjs']){const r=await fetch('./'+file,{cache:'no-store'});assert(r.ok,file+': HTTP '+r.status);assert(/javascript|ecmascript/.test(r.headers.get('content-type')||''),'Неверный MIME: '+file)}});
   await check('Чтение локальной текстуры стены',async()=>{
    const canvas=document.createElement('canvas');canvas.width=4;canvas.height=2;const ctx=canvas.getContext('2d');ctx.fillStyle='rgb(20,160,70)';ctx.fillRect(0,0,4,2);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));assert(blob,'Не удалось создать тестовый PNG');
    const decoded=await decodeWallFile(new File([blob],'wall-test.png',{type:'image/png'}));assert(decoded.canvas.width===4&&decoded.canvas.height===2,'Неверные размеры стены');
    const pixel=decoded.canvas.getContext('2d').getImageData(0,0,1,1).data;assert(pixel[1]>pixel[0]+20&&pixel[1]>pixel[2]+20,'Неверное чтение цвета');
   });
   await check('Генерация 1K, семь карт и прозрачность',async()=>{one=await generated(defaults,1024);validate(one,1024)});
   await check('Кодирование и чтение PNG 1024×1024',async()=>{assert(one,'Нет результата генерации');const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;canvas.getContext('2d').putImageData(new ImageData(one.maps.albedo,1024,1024),0,0);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));assert(blob,'PNG не создан');const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);assert(bytes[0]===137&&bytes[1]===80,'Неверная сигнатура PNG');assert(view.getUint32(16)===1024&&view.getUint32(20)===1024,'Неверный PNG IHDR');const image=await createImageBitmap(blob);assert(image.width===1024&&image.height===1024,'Неверный размер после декодирования');canvas.getContext('2d').clearRect(0,0,1024,1024);canvas.getContext('2d').drawImage(image,0,0);image.close();assert(canvas.getContext('2d').getImageData(0,0,1,1).data[3]===0,'PNG потерял прозрачность')});one=null;
   await check('Упаковка ZIP',async()=>{const blob=await zip([['material.json',new Blob(['{"version":2}'])],['README.txt',new Blob(['Materia diagnostic'])]]),bytes=await blob.arrayBuffer(),view=new DataView(bytes);assert(view.getUint32(0,true)===0x04034b50,'Нет заголовка ZIP');assert(view.getUint32(bytes.byteLength-22,true)===0x06054b50,'Нет оглавления ZIP');assert(view.getUint16(bytes.byteLength-14,true)===2,'Неверное число файлов ZIP')});
   await check('Генерация 2K и рельеф вмятин',async()=>{const data=await generated({...defaults,...presets.dents,type:'dents'},2048);validate(data,2048);let depressed=false,raised=false;for(let j=0;j<data.maps.height.length;j+=4){if(data.maps.height[j]<126)depressed=true;if(data.maps.height[j]>129)raised=true}assert(depressed&&raised,'Нет впадины или поднятого края')});
   await check('Normal Strength = 0',async()=>{const data=await generated({...defaults,...presets.dents,type:'dents',normal:0},64);for(let j=0;j<data.maps.normal.length;j+=4)assert(data.maps.normal[j]===128&&data.maps.normal[j+1]===128&&data.maps.normal[j+2]===255,'Нормаль не плоская')});
   const failed=report.checks.filter(c=>c.status==='failed').length,warnings=report.checks.filter(c=>c.status==='warning').length;
   $('test-summary').textContent=failed?`Ошибок: ${failed}. Скачайте отчёт для разбора.`:`Автоматические проверки пройдены${warnings?' с предупреждениями: '+warnings:''}. Вручную проверьте вращение 3D, свет и сохранение PNG/ZIP кнопками экспорта.`;
  }finally{running=false;$('test-run').disabled=false;$('test-report').disabled=false}
 };
 return {isRunning:()=>running};
}
