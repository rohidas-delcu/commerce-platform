import {IsInt,Min,Max,IsIn,IsOptional,IsString,MaxLength,Matches} from 'class-validator';
import type {SimulationScenario,ProviderStatus} from '../domain/payments.js';
export class StartPaymentDto {
 @IsInt() @Min(0) expectedVersion!:number;
 @IsIn(['SIMULATOR']) method!:'SIMULATOR';
 @IsOptional() @IsIn(['MANUAL','SUCCESS','FAILURE','TIMEOUT','DELAYED']) scenario?:SimulationScenario;
 @IsOptional() @IsInt() @Min(1) @Max(300) delaySeconds?:number;
}
export class SimulatePaymentDto {
 @IsString() @Matches(/^[A-Za-z0-9_-]{8,100}$/) @MaxLength(100) key!:string;
 @IsIn(['PENDING','CAPTURED','FAILED','UNKNOWN']) event!:ProviderStatus;
}
