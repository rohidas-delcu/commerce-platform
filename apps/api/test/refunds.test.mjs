import assert from 'node:assert/strict';
import test from 'node:test';
import {manualRefundInput,refundProjection} from '../src/refunds/domain/refunds.ts';
import {UnavailableRefundRepository} from '../src/refunds/infrastructure/unavailable-refunds.repository.ts';
test('manual COD refund requires positive exact money and explicit cash-return evidence',async()=>{
 const input={expectedVersion:4,key:'refund-fixture-key',amountMinor:'0001',confirmation:'CASH_RETURNED',reference:'  Cash return reference  '};assert.equal(manualRefundInput(input).amountMinor,'1');assert.equal(manualRefundInput(input).reference,'Cash return reference');for(const patch of [{amountMinor:'0'},{amountMinor:'1.5'},{amountMinor:'9223372036854775808'},{confirmation:'ASSUME_REFUNDED'},{reference:'\nunsafe'},{reference:' '},{expectedVersion:-1}])assert.throws(()=>manualRefundInput({...input,...patch}),{code:'INVALID'});const projection=refundProjection({amountMinor:9007199254740993n,key:'private-key',digest:'private-digest'});assert.equal(projection.amountMinor,'9007199254740993');assert.equal('digest'in projection,false);assert.equal('key'in projection,false);await assert.rejects(new UnavailableRefundRepository().manual(),{code:'CONFLICT'});
});
