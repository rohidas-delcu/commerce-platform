import {DomainError,type Product,type Store} from '../../domain/commerce.js';
import type {MediaAsset,ProductImage} from '../domain/media.js';
import type {MediaRepositoryPort} from '../application/media.port.js';
const clone=<T>(value:T):T=>structuredClone(value);
export class MemoryMediaRepository implements MediaRepositoryPort {
  private assets=new Map<string,MediaAsset>();
  private associations=new Map<string,ProductImage[]>();
  constructor(private stores:Map<string,Store>,private products:Map<string,Product>){}
  async reserve(asset:MediaAsset){if(!this.stores.has(asset.storeId))throw new DomainError('NOT_FOUND','Store not found.');this.assets.set(asset.id,clone(asset));return clone(asset);}
  async asset(id:string){return clone(this.assets.get(id)??null);}
  async complete(storeId:string,id:string){const asset=this.assets.get(id);if(!asset||asset.storeId!==storeId)throw new DomainError('NOT_FOUND','Asset not found.');if(asset.status!=='COMPLETE'&&(asset.status!=='PENDING'||asset.expiresAt<=new Date()))throw new DomainError('CONFLICT','Upload expired or deleted.');asset.status='COMPLETE';return clone(asset);}
  async remove(storeId:string,id:string){const asset=this.assets.get(id);if(!asset||asset.storeId!==storeId)throw new DomainError('NOT_FOUND','Asset not found.');if([...this.associations.values()].some(images=>images.some(i=>i.assetId===id)))throw new DomainError('CONFLICT','Detach referenced images before deleting an asset.');asset.status='DELETED';return clone(asset);}
  async setImages(storeId:string,productId:string,images:ProductImage[],version:number){const product=this.products.get(productId);if(!product||product.storeId!==storeId)throw new DomainError('NOT_FOUND','Product not found.');if(product.version!==version||product.status==='ARCHIVED')throw new DomainError('CONFLICT','Product changed or archived.');if(images.some(image=>{const a=this.assets.get(image.assetId);return !a||a.storeId!==storeId||a.status!=='COMPLETE';}))throw new DomainError('INVALID','All images must be verified assets of this store.');this.associations.set(productId,clone(images));product.images=clone(images);product.version++;}
  async links(id:string){return[...this.associations].filter(([,images])=>images.some(i=>i.assetId===id)).map(([id])=>id);}
  async images(productId:string){return clone((this.associations.get(productId)??[]).filter(i=>this.assets.get(i.assetId)?.status==='COMPLETE'));}
}
