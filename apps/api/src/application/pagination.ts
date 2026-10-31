import {DomainError} from '../domain/commerce.js';
export interface PageWindow {limit:number;offset:number;}
export function pageWindow(input:Partial<PageWindow>={}):PageWindow {
  const {limit=50,offset=0}=input;
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000)throw new DomainError('INVALID','Page limit must be 1–100 and offset 0–10000.');
  return{limit,offset};
}
export function nextPageOffset(loaded:number,limit:number,offset:number){return loaded>limit&&offset+limit<=10000?offset+limit:null;}
export function pageResult<T>(rows:T[],page:PageWindow){return{items:rows.slice(0,page.limit),...page,nextOffset:nextPageOffset(rows.length,page.limit,page.offset)};}
