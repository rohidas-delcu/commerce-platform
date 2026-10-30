import {createHash,timingSafeEqual} from 'node:crypto';
import {DomainError} from '../../domain/commerce.js';
import {CommerceService} from '../../application/commerce.service.js';
import type {CommerceRepository} from '../../application/commerce.port.js';
import type {ObjectStoragePort} from './media.port.js';
import type {MediaAsset} from '../domain/media.js';
export class MediaService {
  constructor(private repo:CommerceRepository,private storage:ObjectStoragePort){}
  async upload(id:string,token:string){
    if(process.env.NODE_ENV!=='development'||this.storage.provider!=='local')throw new DomainError('NOT_FOUND','Development upload endpoint unavailable.');
    const asset=await this.repo.media.asset(id);
    const hashed=createHash('sha256').update(token).digest();
    if(!asset||asset.provider!=='local'||asset.status!=='PENDING'||asset.expiresAt<=new Date()||!/^[A-Za-z0-9_-]{43}$/.test(token)||!timingSafeEqual(hashed,Buffer.from(asset.tokenDigest,'hex')))throw new DomainError('FORBIDDEN','Invalid or expired upload capability.');
    return asset;
  }
  async put(asset:MediaAsset,bytes:Uint8Array){await this.storage.put(asset,bytes);}
  async publicRead(id:string){
    const asset=await this.repo.media.asset(id);if(!asset||asset.status!=='COMPLETE')throw new DomainError('NOT_FOUND','Image not found.');
    const store=await this.repo.findStoreById(asset.storeId);if(!store)throw new DomainError('NOT_FOUND','Image not found.');
    const service=new CommerceService(this.repo);let visible=false;
    for(const productId of await this.repo.media.links(id)){
      const product=await this.repo.findProduct(asset.storeId,productId);if(!product)continue;
      try{const publicProduct=await service.publicProductDetail(store.handle,product.handle);if(publicProduct.images.some(image=>image.id===id)){visible=true;break;}}
      catch(error){if(!(error instanceof DomainError)||error.code!=='NOT_FOUND')throw error;}
    }
    if(!visible)throw new DomainError('NOT_FOUND','Image not found.');
    if(asset.provider!==this.storage.provider)throw new DomainError('NOT_FOUND','Storage provider unavailable.');
    return{asset,bytes:await this.storage.read(asset)};
  }
}
