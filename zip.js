const crcTable=Uint32Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=(v&1)?0xedb88320^(v>>>1):v>>>1;return v>>>0});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
export async function zip(files){let parts=[],central=[],offset=0,centralSize=0;
 for(const [name,blob] of files){const bytes=new Uint8Array(await blob.arrayBuffer()),filename=new TextEncoder().encode(name),crc=crc32(bytes);let local=new Uint8Array(30+filename.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,filename.length,true);local.set(filename,30);
 let header=new Uint8Array(46+filename.length),d=new DataView(header.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,filename.length,true);d.setUint32(42,offset,true);header.set(filename,46);
 parts.push(local,bytes);central.push(header);offset+=local.length+bytes.length;centralSize+=header.length;
 }
 let end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
