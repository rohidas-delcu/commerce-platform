import {IdentityError} from '../../identity/domain/identity.js';
import type {OrderRepositoryPort} from '../application/orders.port.js';
import type {Order} from '../domain/orders.js';
export class UnavailableOrderReadRepository implements OrderRepositoryPort {
  async command():Promise<Order>{throw new IdentityError(503,'Orders require PostgreSQL.');}
  async find():Promise<Order|null>{throw new IdentityError(503,'Orders require PostgreSQL.');}
  async list():Promise<Order[]>{throw new IdentityError(503,'Orders require PostgreSQL.');}
}
