import type {Order,OrderQuery} from '../domain/orders.js';
export interface OrderReadRepositoryPort {
  find(storeId:string,id:string):Promise<Order|null>;
  list(storeId:string,input:OrderQuery&{limit:number;offset:number}):Promise<Order[]>;
}
