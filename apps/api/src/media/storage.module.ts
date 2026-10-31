import {Module} from '@nestjs/common';
import {S3Client} from '@aws-sdk/client-s3';
import {OBJECT_STORAGE} from './application/media.port.js';
import {LocalObjectStorage} from './infrastructure/local.storage.js';
import {S3ObjectStorage} from './infrastructure/s3.storage.js';
@Module({providers:[{provide:OBJECT_STORAGE,useFactory:()=>{
  const provider=process.env.OBJECT_STORAGE??'local';
  if(provider==='local')return new LocalObjectStorage();
  if(provider==='s3'){if(!process.env.S3_REGION||!process.env.S3_BUCKET)throw new Error('S3_REGION/S3_BUCKET required.');return new S3ObjectStorage(new S3Client({region:process.env.S3_REGION}),process.env.S3_BUCKET);}
  throw new Error('Unknown OBJECT_STORAGE.');
}}],exports:[OBJECT_STORAGE]})
export class StorageModule{}
