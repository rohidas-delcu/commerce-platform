import type {MediaAsset} from '../../media/domain/media.js';
export interface CleanupClaim {asset:MediaAsset;leaseToken:string;}
export interface CleanupRepositoryPort {
 checkHealth():Promise<void>;close():Promise<void>;
 claim(limit:number,provider:string,storeId?:string):Promise<{claims:CleanupClaim[];skipped:number}>;
 accepted(claim:CleanupClaim):Promise<boolean>;
}
