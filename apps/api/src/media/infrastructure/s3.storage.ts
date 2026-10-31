import {verifyRaster} from './image-verifier.js';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {DomainError} from '../../domain/commerce.js';
import {imageBytes,MAX_IMAGE_BYTES,type MediaAsset} from '../domain/media.js';
import type {ObjectStoragePort} from '../application/media.port.js';
export class S3ObjectStorage implements ObjectStoragePort {
  readonly provider='s3' as const;
  constructor(private client:S3Client,private bucket:string){if(!bucket)throw new Error('S3_BUCKET required.');}
  private key(asset:MediaAsset){if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(asset.key))throw new DomainError('INVALID','Invalid object key.');return asset.key;}
  async uploadPlan(asset:MediaAsset,_token:string){
    const checksum=Buffer.from(asset.checksum,'hex').toString('base64');
    const url=await getSignedUrl(this.client,new PutObjectCommand({Bucket:this.bucket,Key:this.key(asset),ContentType:asset.contentType,ChecksumSHA256:checksum}),{expiresIn:Math.max(1,Math.min(900,Math.floor((asset.expiresAt.getTime()-Date.now())/1000)))});
    return{method:'PUT' as const,url,headers:{'content-type':asset.contentType,'x-amz-checksum-sha256':checksum},expiresAt:asset.expiresAt};
  }
  async put(_asset:MediaAsset,_bytes:Uint8Array):Promise<void>{throw new Error('S3 uploads must use the signed upload plan.');}
  async read(asset:MediaAsset){
    const result=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:this.key(asset),ChecksumMode:'ENABLED'}),{abortSignal:AbortSignal.timeout(10000)});
    if(!result.Body)throw new DomainError('NOT_FOUND','Object unavailable.');
    const parts:Uint8Array[]=[];let size=0;
    for await(const chunk of result.Body as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>MAX_IMAGE_BYTES)throw new DomainError('INVALID','Object exceeds size limit.');parts.push(chunk);}
    const bytes=Buffer.concat(parts);imageBytes(bytes,asset);await verifyRaster(bytes,asset.contentType,asset.checksum);
    if(result.ContentType!==asset.contentType||result.ChecksumSHA256!==Buffer.from(asset.checksum,'hex').toString('base64'))throw new DomainError('INVALID','Object metadata or verified S3 checksum does not match.');return bytes;
  }
  async remove(asset:MediaAsset,signal?:AbortSignal){await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:this.key(asset)}),{abortSignal:signal??AbortSignal.timeout(10000)});}
}
