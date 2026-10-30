import type {MediaAsset,ProductImage} from '../domain/media.js';
export interface MediaRepositoryPort {
  reserve(asset:MediaAsset):Promise<MediaAsset>;
  asset(id:string):Promise<MediaAsset|null>;
  complete(storeId:string,id:string):Promise<MediaAsset>;
  remove(storeId:string,id:string):Promise<MediaAsset>;
  setImages(storeId:string,productId:string,images:ProductImage[],version:number):Promise<void>;
  links(id:string):Promise<string[]>;
  images(productId:string):Promise<ProductImage[]>;
}
export interface UploadPlan {method:'PUT';url:string;headers:Record<string,string>;expiresAt:Date}
export interface ObjectStoragePort {
  readonly provider:'local'|'s3';
  uploadPlan(asset:MediaAsset,token:string):Promise<UploadPlan>;
  put(asset:MediaAsset,bytes:Uint8Array):Promise<void>;
  read(asset:MediaAsset):Promise<Uint8Array>;
  remove(asset:MediaAsset):Promise<void>;
}
export const OBJECT_STORAGE=Symbol('OBJECT_STORAGE');
