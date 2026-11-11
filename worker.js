import {generateDecal} from './decal-engine.mjs';
self.onmessage=({data})=>{try{const result=generateDecal(data.params,data.size,progress=>self.postMessage({progress}));self.postMessage(result,Object.values(result.maps).map(a=>a.buffer))}catch(e){self.postMessage({error:e.message})}};
