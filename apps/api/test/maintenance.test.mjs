import assert from 'node:assert/strict';
import test from 'node:test';
import {MaintenanceService} from '../src/operations/application/maintenance.service.ts';
test('trusted expiry refuses memory mode and invalid tenant/batch input',async()=>{
 const previous=process.env.DATA_DRIVER;let calls=0;const service=new MaintenanceService({expire:async()=>{calls++;return{checkouts:0,reservations:0,carts:0,failed:0,skipped:0};}});
 try{process.env.DATA_DRIVER='memory';await assert.rejects(service.runOnce(),/PostgreSQL/);process.env.DATA_DRIVER='postgres';for(const limit of [0,101,1.1])await assert.rejects(service.runOnce(limit));await assert.rejects(service.runOnce(1,'not-a-uuid'));assert.equal(calls,0);assert.equal((await service.runOnce(1)).failed,0);assert.equal(calls,1);}finally{if(previous===undefined)delete process.env.DATA_DRIVER;else process.env.DATA_DRIVER=previous;}
});
