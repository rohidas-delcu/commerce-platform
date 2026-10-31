import {mkdir,writeFile,readFile,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import type {NotificationTransportPort} from '../application/notifications.port.js';
import type {MailMessage,DeliveryOutcome} from '../domain/notifications.js';
export class DevelopmentMailer implements NotificationTransportPort {
  readonly provider='development';readonly idempotent=true;
  constructor(private root=process.env.DEV_MAIL_DIR??fileURLToPath(new URL('../../../../../.data/mail/',import.meta.url))){if(process.env.NODE_ENV==='production')throw new Error('Development mailbox is forbidden in production.');}
  async send(message:MailMessage):Promise<DeliveryOutcome>{
    if(!/^(identity|order|payment)_[a-f0-9-]{36}$/.test(message.id))return{kind:'rejected',code:'INVALID_MESSAGE_ID'};
    const path=join(this.root,message.id+'.json');let temp:string|undefined;
    try{
      await mkdir(this.root,{recursive:true,mode:0o700});temp=join(this.root,'.mail-'+randomUUID());await writeFile(temp,JSON.stringify(message,null,2)+'\n',{mode:0o600,flag:'wx'});
      try{await link(temp,path);}catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='EEXIST')throw error;const previous:unknown=JSON.parse(await readFile(path,'utf8'));if(!previous||typeof previous!=='object'||!('id'in previous)||previous.id!==message.id||!('to'in previous)||previous.to!==message.to)return{kind:'rejected',code:'MAILBOX_CONFLICT'};}
      return{kind:'accepted',providerMessageId:message.id};
    }catch{return{kind:'retryable',code:'LOCAL_MAIL_IO'};}finally{if(temp)try{await unlink(temp);}catch{}}
  }
}
