import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import sharp from 'sharp';
import {S3Client,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {LocalObjectStorage} from '../src/media/infrastructure/local.storage.ts';
import {S3ObjectStorage} from '../src/media/infrastructure/s3.storage.ts';
import {imageRequest,imageBytes,imageOrder} from '../src/media/domain/media.ts';

test('local image storage verifies actual rasters, checksums and immutable upload bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'delcu-media-test-'));
  try{
    const bytes=await sharp({create:{width:2,height:2,channels:4,background:{r:10,g:20,b:30,alpha:1}}}).png().toBuffer();
    const id=randomUUID(),storeId=randomUUID(),asset={id,storeId,key:`${storeId}/${id}`,provider:'local',contentType:'image/png',size:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),tokenDigest:'a'.repeat(64),status:'PENDING',expiresAt:new Date(Date.now()+60000)};
    imageRequest(asset);const storage=new LocalObjectStorage(root);
    await storage.put(asset,bytes);await storage.put(asset,bytes);assert.deepEqual(Buffer.from(await storage.read(asset)),bytes);
    const malformed=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
    await assert.rejects(storage.put({...asset,id:randomUUID(),size:malformed.length,checksum:createHash('sha256').update(malformed).digest('hex')},malformed),{code:'INVALID'});
    assert.throws(()=>imageBytes(Buffer.from('different'),asset),{code:'INVALID'});
    await assert.rejects(storage.read({...asset,key:'../../private'}),{code:'INVALID'});
    assert.throws(()=>imageRequest({...asset,contentType:'image/svg+xml'}));
    assert.throws(()=>imageOrder([id,id],id));assert.throws(()=>imageOrder([id],randomUUID()));
    assert.equal(imageOrder([id],null,{[id]:' Example '})[0].altText,'Example');
    await storage.remove(asset);await storage.remove(asset);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('S3 signing and reader boundary use SDK checksums; this is not a live provider test',async()=>{
  const bytes=await sharp({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer();
  const id=randomUUID(),storeId=randomUUID(),asset={id,storeId,key:`${storeId}/${id}`,provider:'s3',contentType:'image/png',size:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),tokenDigest:'a'.repeat(64),status:'PENDING',expiresAt:new Date(Date.now()+60000)};
  const client=new S3Client({region:'ap-south-1',credentials:{accessKeyId:'fixture-key',secretAccessKey:'fixture-secret'}});
  try{const plan=await new S3ObjectStorage(client,'fixture-bucket').uploadPlan(asset,'unused');assert.equal(plan.method,'PUT');assert.equal(new URL(plan.url).protocol,'https:');assert.equal(plan.headers['x-amz-checksum-sha256'],Buffer.from(asset.checksum,'hex').toString('base64'));}finally{client.destroy();}
  let deleted=false;
  const fake={send:async command=>{
    assert.equal(command.input.Bucket,'fixture-bucket');assert.equal(command.input.Key,asset.key);
    if(command instanceof DeleteObjectCommand){deleted=true;return{};}
    assert.ok(command instanceof GetObjectCommand);assert.equal(command.input.ChecksumMode,'ENABLED');
    return{Body:Readable.from([bytes]),ContentType:'image/png',ChecksumSHA256:Buffer.from(asset.checksum,'hex').toString('base64')};
  }};
  const adapter=new S3ObjectStorage(fake,'fixture-bucket');assert.deepEqual(Buffer.from(await adapter.read(asset)),bytes);await adapter.remove(asset);assert.equal(deleted,true);
  await assert.rejects(new S3ObjectStorage({send:async()=>({Body:Readable.from([bytes]),ContentType:'image/png',ChecksumSHA256:'wrong'})},'fixture-bucket').read(asset),{code:'INVALID'});
});
