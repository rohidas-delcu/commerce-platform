import {PaymentModule} from '../payments/payments.module.js';
import {PaymentService} from '../payments/application/payments.service.js';
import {OperationsModule} from '../operations/operations.module.js';
import {MaintenanceService} from '../operations/application/maintenance.service.js';
import {Module,Logger} from '@nestjs/common';
import {SESv2Client} from '@aws-sdk/client-sesv2';
import {NotificationService} from './application/notifications.service.js';
import {PrismaNotificationRepository} from './infrastructure/prisma-notifications.repository.js';
import {DevelopmentMailer} from './infrastructure/development-mailer.js';
import {SesMailer} from './infrastructure/ses-mailer.js';
import {ConfiguredNotificationLinks} from './infrastructure/links.js';
import {decryptMail,digest} from '../identity/infrastructure/secrets.js';
export function notificationTransport(){
  const provider=process.env.NOTIFICATION_PROVIDER??'development';
  if(provider==='development')return new DevelopmentMailer();
  if(provider!=='ses')throw new Error('Unknown notification provider.');
  if(!process.env.SES_REGION||!process.env.SES_FROM_EMAIL||!process.env.MERCHANT_APP_URL||!process.env.STOREFRONT_APP_URL)throw new Error('SES requires region, verified sender and explicit application URLs.');
  for(const value of [process.env.MERCHANT_APP_URL,process.env.STOREFRONT_APP_URL])if(new URL(value).protocol!=='https:')throw new Error('SES application links require HTTPS.');
  return new SesMailer(new SESv2Client({region:process.env.SES_REGION,maxAttempts:1}),process.env.SES_FROM_EMAIL,process.env.SES_CONFIGURATION_SET);
}
// Runs in the same modular monolith. Disabled by default; no transport call at startup.
export class NotificationWorker {
  private timer?:ReturnType<typeof setInterval>;private active?:Promise<unknown>;
  constructor(private service:NotificationService,private maintenance?:MaintenanceService,private payments?:PaymentService){}
  onModuleInit(){
    const enabled=process.env.COMMERCE_WORKER_ENABLED??'false';if(!['true','false'].includes(enabled))throw new Error('COMMERCE_WORKER_ENABLED must be true or false.');
    if(enabled==='true'){
      if(process.env.DATA_DRIVER!=='postgres')throw new Error('Commerce worker requires PostgreSQL.');
      this.timer=setInterval(()=>{if(!this.active)this.active=(async()=>{await this.maintenance?.runOnce();await this.payments?.runOnce();return this.service.runOnce();})().catch(()=>Logger.error({event:'commerce_worker_failed'},undefined,'Notifications')).finally(()=>{this.active=undefined;});},1000);this.timer.unref();
    }
  }
  async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await this.active;await this.payments?.close();await this.maintenance?.close();await this.service.close();}
}
@Module({imports:[OperationsModule,PaymentModule],exports:[NotificationService],providers:[
  {provide:PrismaNotificationRepository,useFactory:()=>new PrismaNotificationRepository()},
  {provide:NotificationService,useFactory:(repository:PrismaNotificationRepository)=>new NotificationService(repository,notificationTransport(),{decrypt:decryptMail,digest},new ConfiguredNotificationLinks()),inject:[PrismaNotificationRepository]},
  {provide:NotificationWorker,useFactory:(service:NotificationService,maintenance:MaintenanceService,payments:PaymentService)=>new NotificationWorker(service,maintenance,payments),inject:[NotificationService,MaintenanceService,PaymentService]}
]})
export class NotificationModule{}
