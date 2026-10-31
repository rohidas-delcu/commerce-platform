export interface ExpiryResult {checkouts:number;reservations:number;carts:number;skipped:number;failed:number;}
export interface MaintenanceRepositoryPort {checkHealth():Promise<void>;expire(limit:number,storeId?:string):Promise<ExpiryResult>;close():Promise<void>;}
