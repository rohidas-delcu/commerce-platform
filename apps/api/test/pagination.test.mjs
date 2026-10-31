import assert from 'node:assert/strict';
import test from 'node:test';
import {nextPageOffset,pageWindow} from '../src/application/pagination.ts';
test('bounded pagination never advertises an invalid continuation',()=>{
  assert.equal(nextPageOffset(101,100,9900),10000);
  assert.equal(nextPageOffset(101,100,10000),null);
  assert.equal(nextPageOffset(100,100,0),null);
  assert.equal(nextPageOffset(51,50,25),75);
  for(const input of [{limit:0},{limit:101},{offset:-1},{offset:10001},{offset:1.5}])assert.throws(()=>pageWindow(input),{code:'INVALID'});
});
