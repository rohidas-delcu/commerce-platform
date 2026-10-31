import type {MediaAsset} from '../domain/media.js';
export function mediaAsset(row:Omit<MediaAsset,'status'>&{status:string}):MediaAsset{return{id:row.id,storeId:row.storeId,key:row.key,provider:row.provider,contentType:row.contentType,size:row.size,checksum:row.checksum,tokenDigest:row.tokenDigest,status:row.status as MediaAsset['status'],expiresAt:row.expiresAt};}
