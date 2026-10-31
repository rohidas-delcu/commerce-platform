import {Logger} from '@nestjs/common';
import {DomainError} from '../../domain/commerce.js';
import type {ObjectStoragePort} from '../../media/application/media.port.js';
import type {CleanupRepositoryPort} from './cleanup.port.js';
export class CleanupService {
 constructor(private repository:CleanupRepositoryPort,private storage:ObjectStoragePort){}
 async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
 close(){return this.repository.close();}
 async runOnce(limit=5,storeId?:string){
  if(process.env.DATA_DRIVER!=='postgres'||!Number.isInteger(limit)||limit<1||limit>20||storeId!==undefined&&!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(storeId))throw new DomainError('INVALID','Cleanup requires PostgreSQL and a bounded, valid selector.');
  const batch=await this.repository.claim(limit,this.storage.provider,storeId),result={processed:0,accepted:0,failed:0,skipped:batch.skipped};
  await Promise.all(batch.claims.map(async claim=>{result.processed++;try{if(claim.asset.provider!==this.storage.provider)throw new Error('Wrong provider.');await this.storage.remove(claim.asset,AbortSignal.timeout(10000));if(await this.repository.accepted(claim))result.accepted++;else result.skipped++;}catch{result.failed++;Logger.error({event:'media_cleanup_failed'},undefined,'Maintenance');}}));return result;
 }
}
