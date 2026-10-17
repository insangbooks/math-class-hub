// Rasterize the app's simple geometric mark without an external image package.
import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const size=Buffer.alloc(4);size.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
const lines=[[340,130,170,130],[170,130,265,256],[265,256,170,382],[170,382,340,382]];
function distance(x,y,x1,y1,x2,y2){const t=Math.max(0,Math.min(1,((x-x1)*(x2-x1)+(y-y1)*(y2-y1))/((x2-x1)**2+(y2-y1)**2)));return Math.hypot(x-x1-t*(x2-x1),y-y1-t*(y2-y1));}
for(const size of [192,512]){
  const raw=Buffer.alloc(size*(size*4+1));
  for(let row=0;row<size;row++)for(let col=0;col<size;col++){
    const x=col/size*512,y=row/size*512;const idx=row*(size*4+1)+1+col*4;
    const copper=lines.some(l=>distance(x,y,...l)<13);const dot=Math.hypot(x-380,y-382)<14;
    raw[idx]=dot?255:copper?204:8;raw[idx+1]=dot?255:copper?145:8;raw[idx+2]=dot?255:copper?102:10;raw[idx+3]=255;
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  await writeFile(new URL('../public/icon-'+size+'.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
