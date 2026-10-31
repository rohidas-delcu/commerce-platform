import {SESv2Client,SendEmailCommand} from '@aws-sdk/client-sesv2';
import type {NotificationTransportPort} from '../application/notifications.port.js';
import type {MailMessage,DeliveryOutcome} from '../domain/notifications.js';
export class SesMailer implements NotificationTransportPort {
  readonly provider='ses';readonly idempotent=false;
  constructor(private client:Pick<SESv2Client,'send'>&Partial<Pick<SESv2Client,'destroy'>>,private from:string,private configurationSet?:string){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))throw new Error('Verified SES_FROM_EMAIL required.');}
  close(){this.client.destroy?.();}
  async send(message:MailMessage):Promise<DeliveryOutcome>{
    try{
      const result=await this.client.send(new SendEmailCommand({FromEmailAddress:this.from,Destination:{ToAddresses:[message.to]},Content:{Simple:{Subject:{Data:message.subject,Charset:'UTF-8'},Body:{Text:{Data:message.text,Charset:'UTF-8'}}}},ConfigurationSetName:this.configurationSet,EmailTags:[{Name:'notification_id',Value:message.id}]}),{abortSignal:AbortSignal.timeout(10000)});
      return typeof result.MessageId==='string'&&result.MessageId.length>0&&result.MessageId.length<=200?{kind:'accepted',providerMessageId:result.MessageId}:{kind:'unknown',code:'SES_MISSING_RECEIPT'};
    }catch(error){
      const name=error&&typeof error==='object'&&'name'in error?error.name:'';
      if(['TooManyRequestsException','LimitExceededException','ThrottlingException'].includes(String(name)))return{kind:'retryable',code:'SES_THROTTLED'};
      if(['AccountSuspendedException','BadRequestException','MailFromDomainNotVerifiedException','MessageRejected','NotFoundException','SendingPausedException'].includes(String(name)))return{kind:'rejected',code:'SES_REJECTED'};
      return{kind:'unknown',code:'SES_OUTCOME_UNKNOWN'};
    }
  }
}
