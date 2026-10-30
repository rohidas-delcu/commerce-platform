import type {Order,OrderQuery,OrderAction} from '../domain/orders.js';
export interface OrderReadRepositoryPort {
  find(storeId:string,id:string):Promise<Order|null>;
  list(storeId:string,input:OrderQuery&{limit:number;offset:number}):Promise<Order[]>;
}

export interface OrderRepositoryPort extends OrderReadRepositoryPort {
  command(storeId:string,id:string,input:{expectedVersion:number;key:string;action:OrderAction},actor:string):Promise<Order>;
}
