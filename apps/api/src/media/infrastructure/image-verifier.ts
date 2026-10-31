import sharp from 'sharp';
import {DomainError} from '../../domain/commerce.js';
const verified=new Map<string,Promise<void>>();
// Call only after verifying the bytes against checksum. Bound cache avoids repeated
// raster decoding on public reads of immutable assets without growing indefinitely.
export async function verifyRaster(bytes:Uint8Array,contentType:string,checksum:string){
  const key=contentType+':'+checksum;const prior=verified.get(key);if(prior)return prior;
  const check=(async()=>{
    try{
      const decoder=sharp(bytes,{limitInputPixels:16000000,failOn:'warning',animated:false});
      const metadata=await decoder.metadata();
      if(metadata.format!==(contentType==='image/png'?'png':'jpeg')||!metadata.width||!metadata.height||(metadata.pages??1)>1)throw new Error('Unsupported raster.');
      await decoder.raw({depth:'uchar'}).toBuffer();
    }catch{throw new DomainError('INVALID','Image must decode as a single-frame PNG/JPEG with at most 16 million pixels.');}
  })();
  verified.set(key,check);if(verified.size>256)verified.delete(verified.keys().next().value!);
  try{await check;}catch(error){verified.delete(key);throw error;}
}
