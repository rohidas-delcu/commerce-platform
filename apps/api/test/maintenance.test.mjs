import assert from 'node:assert/strict';
import test from 'node:test';
import {MaintenanceService} from '../src/operations/application/maintenance.service.ts';
test('trusted expiry refuses memory mode and invalid tenant/batch input',async()=>{
 const previous=process.env.DATA_DRIVER;let calls=0;const service=new MaintenanceService({expire:async()=>{calls++;return{checkouts:0,reservations:0,carts:0,failed:0,skipped:0};}});
 try{process.env.DATA_DRIVER='memory';await assert.rejects(service.runOnce(),/PostgreSQL/);process.env.DATA_DRIVER='postgres';for(const limit of [0,101,1.1])await assert.rejects(service.runOnce(limit));await assert.rejects(service.runOnce(1,'not-a-uuid'));assert.equal(calls,0);assert.equal((await service.runOnce(1)).failed,0);assert.equal(calls,1);}finally{if(previous===undefined)delete process.env.DATA_DRIVER;else process.env.DATA_DRIVER=previous;}
});

test('media cleanup refuses invalid scope/limits and never acknowledges a failed storage delete',async()=>{
 const {CleanupService}=await import('../src/operations/application/cleanup.service.ts');const previous=process.env.DATA_DRIVER;let acknowledgements=0;const service=new CleanupService({claim:async()=>({claims:[{asset:{provider:'local'},leaseToken:'fixture'}],skipped:0}),accepted:async()=>{acknowledgements++;return true;}},{provider:'local',remove:async()=>{throw new Error('controlled storage failure');}});try{process.env.DATA_DRIVER='memory';await assert.rejects(service.runOnce());process.env.DATA_DRIVER='postgres';await assert.rejects(service.runOnce(21));await assert.rejects(service.runOnce(1,'invalid-store'));const result=await service.runOnce(1);assert.equal(result.failed,1);assert.equal(result.accepted,0);assert.equal(acknowledgements,0);}finally{if(previous===undefined)delete process.env.DATA_DRIVER;else process.env.DATA_DRIVER=previous;}
});
