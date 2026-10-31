import {Module} from '@nestjs/common';
import {MaintenanceService} from './application/maintenance.service.js';
import {PrismaMaintenanceRepository} from './infrastructure/prisma-maintenance.repository.js';
@Module({exports:[MaintenanceService],providers:[
 {provide:PrismaMaintenanceRepository,useFactory:()=>new PrismaMaintenanceRepository()},
 {provide:MaintenanceService,useFactory:(repository:PrismaMaintenanceRepository)=>new MaintenanceService(repository),inject:[PrismaMaintenanceRepository]}
]})
export class OperationsModule{}
