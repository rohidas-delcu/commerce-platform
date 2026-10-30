import {verifyRaster} from './image-verifier.js';
import {mkdir,writeFile,readFile,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DomainError} from '../../domain/commerce.js';
import {imageBytes,type MediaAsset} from '../domain/media.js';
import type {ObjectStoragePort} from '../application/media.port.js';
export class LocalObjectStorage implements ObjectStoragePort {
  readonly provider='local' as const;
  constructor(private root=process.env.DEV_STORAGE_DIR??fileURLToPath(new URL('../../../../../.data/media/',import.meta.url))){if(process.env.NODE_ENV==='production')throw new Error('Local object storage is development-only.');}
  private path(asset:MediaAsset){if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(asset.key))throw new DomainError('INVALID','Invalid object key.');return join(this.root,asset.key);}
  async uploadPlan(asset:MediaAsset,token:string){return{method:'PUT' as const,url:`/v1/dev/uploads/${asset.id}`,headers:{'content-type':asset.contentType,'x-upload-token':token},expiresAt:asset.expiresAt};}
  async put(asset:MediaAsset,bytes:Uint8Array){
    imageBytes(bytes,asset);await verifyRaster(bytes,asset.contentType,asset.checksum);const path=this.path(asset),folder=join(this.root,asset.storeId);await mkdir(folder,{recursive:true,mode:0o700});
    const temp=join(folder,`.upload-${randomUUID()}`);await writeFile(temp,bytes,{flag:'wx',mode:0o600});
    try{try{await link(temp,path);}catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='EEXIST')throw error;imageBytes(await readFile(path),asset);}}
    finally{await unlink(temp);}
  }
  async read(asset:MediaAsset){try{const bytes=await readFile(this.path(asset));imageBytes(bytes,asset);await verifyRaster(bytes,asset.contentType,asset.checksum);return bytes;}catch(error){if(error instanceof DomainError)throw error;throw new DomainError('NOT_FOUND','Object is unavailable.');}}
  async remove(asset:MediaAsset){try{await unlink(this.path(asset));}catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='ENOENT')throw error;}}
}
