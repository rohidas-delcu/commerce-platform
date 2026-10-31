import {createHash} from 'node:crypto';
import {DomainError} from '../../domain/commerce.js';
export const MAX_IMAGE_BYTES=5*1024*1024;
export interface MediaAsset {id:string;storeId:string;key:string;provider:string;contentType:string;size:number;checksum:string;tokenDigest:string;status:'PENDING'|'COMPLETE'|'DELETED';expiresAt:Date}
export interface ProductImage {assetId:string;position:number;altText:string;primary:boolean}
export function imageRequest(input:{contentType:string;size:number;checksum:string}){
  if(!['image/png','image/jpeg'].includes(input.contentType)||!Number.isInteger(input.size)||input.size<8||input.size>MAX_IMAGE_BYTES||!/^[a-f0-9]{64}$/.test(input.checksum))throw new DomainError('INVALID','Upload requires a PNG/JPEG, 8 bytes–5 MiB and SHA-256 hex checksum.');
  return input;
}
export function imageBytes(bytes:Uint8Array,asset:Pick<MediaAsset,'contentType'|'size'|'checksum'>){
  const data=Buffer.from(bytes);
  const valid=asset.contentType==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data[0]===255&&data[1]===216&&data[2]===255;
  if(data.length!==asset.size||!valid||createHash('sha256').update(data).digest('hex')!==asset.checksum)throw new DomainError('INVALID','Image bytes, type or checksum do not match the reservation.');
}
export function imageOrder(assetIds:string[],primaryId:string|null,altTexts:Record<string,string>={}){
  if(assetIds.length>20||new Set(assetIds).size!==assetIds.length||(primaryId!==null&&!assetIds.includes(primaryId)))throw new DomainError('INVALID','Invalid image order or primary asset. At most 20 images are allowed.');
  if(Object.keys(altTexts).some(id=>!assetIds.includes(id))||Object.values(altTexts).some(v=>typeof v!=='string'||v.length>300))throw new DomainError('INVALID','Invalid image alt text.');
  return assetIds.map((assetId,position)=>({assetId,position,primary:assetId===(primaryId??assetIds[0]),altText:(altTexts[assetId]??'').trim()}));
}
