import {DomainError} from '../../domain/commerce.js';
import type {RefundRepositoryPort} from '../application/refunds.port.js';
import type {Refund} from '../domain/refunds.js';
export class UnavailableRefundRepository implements RefundRepositoryPort {
 async manual():Promise<Refund>{throw new DomainError('CONFLICT','Financial records require PostgreSQL.');}
 async list():Promise<Refund[]>{throw new DomainError('CONFLICT','Financial records require PostgreSQL.');}
}
