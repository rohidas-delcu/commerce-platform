import type {MaintenanceRepositoryPort} from './maintenance.port.js';
export class MaintenanceService {
 constructor(private repository:MaintenanceRepositoryPort){}
 async checkHealth(){if(process.env.DATA_DRIVER==='postgres')await this.repository.checkHealth();}
 async runOnce(limit=50,storeId?:string){if(process.env.DATA_DRIVER!=='postgres')throw new Error('Commerce expiry requires PostgreSQL.');if(!Number.isInteger(limit)||limit<1||limit>100||storeId!==undefined&&!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(storeId))throw new Error('Invalid expiry batch or tenant selector.');return this.repository.expire(limit,storeId);}
 close(){return this.repository.close();}
}
