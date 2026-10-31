import {StorageModule} from '../media/storage.module.js';
import {OBJECT_STORAGE,type ObjectStoragePort} from '../media/application/media.port.js';
import {CleanupService} from './application/cleanup.service.js';
import {PrismaCleanupRepository} from './infrastructure/prisma-cleanup.repository.js';
import {Module} from '@nestjs/common';
import {MaintenanceService} from './application/maintenance.service.js';
import {PrismaMaintenanceRepository} from './infrastructure/prisma-maintenance.repository.js';
@Module({imports:[StorageModule],exports:[MaintenanceService,CleanupService],providers:[
 {provide:PrismaCleanupRepository,useFactory:()=>new PrismaCleanupRepository()},
 {provide:CleanupService,useFactory:(repository:PrismaCleanupRepository,storage:ObjectStoragePort)=>new CleanupService(repository,storage),inject:[PrismaCleanupRepository,OBJECT_STORAGE]},
 {provide:PrismaMaintenanceRepository,useFactory:()=>new PrismaMaintenanceRepository()},
 {provide:MaintenanceService,useFactory:(repository:PrismaMaintenanceRepository)=>new MaintenanceService(repository),inject:[PrismaMaintenanceRepository]}
]})
export class OperationsModule{}
