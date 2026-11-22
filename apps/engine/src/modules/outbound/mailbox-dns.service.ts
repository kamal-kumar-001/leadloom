import {z} from 'zod';
import {DeliverabilityService,NodeTxtResolver,type TxtResolver} from './deliverability.service';
export const MailboxDnsInputSchema=z.object({dkimSelectors:z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,63}$/)).max(5).default([]).refine(v=>new Set(v).size===v.length,'Duplicate selectors')}).strict();
/** Saved domain only. Does not accept a URL/resolver, expose records or change send eligibility. */
export class MailboxDnsService{
 private readonly services=new Map<string,DeliverabilityService>();
 constructor(private readonly db:any,private readonly resolver?:TxtResolver){}
 async inspect(workspaceId:string,mailboxId:string,selectors:string[]){
  const parsed=MailboxDnsInputSchema.parse({dkimSelectors:selectors}),mailbox=await this.db.mailbox.findFirst({where:{id:mailboxId,workspaceId},select:{email:true}});if(!mailbox)return null;
  const domain=mailbox.email.slice(mailbox.email.lastIndexOf('@')+1);const key=[...parsed.dkimSelectors].sort().join(',');let service=this.services.get(key);if(!service){service=new DeliverabilityService({resolveTxtRecords:async(host)=>{let timer:any;try{return await Promise.race([(this.resolver??new NodeTxtResolver()).resolveTxtRecords(host),new Promise<string[]>((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS timeout')),3000);})]);}finally{clearTimeout(timer);}}},300_000,[...parsed.dkimSelectors].sort(),Date.now,100);if(this.services.size>=20)this.services.delete(this.services.keys().next().value!);this.services.set(key,service);}
  const health=await service.checkDomain(domain);return{mailboxId,domain:health.domain,checkedAt:health.checkedAt.toISOString(),scope:health.scope,checks:[{kind:'SPF',status:health.spfStatus},{kind:'DKIM',status:health.dkimStatus},{kind:'DMARC',status:health.dmarcStatus}],selectors:parsed.dkimSelectors,mailboxStateChanged:false,notes:['DNS record diagnostics only. A verified status means a record passed basic checks, not sender-IP authorization, a valid message signature, alignment, inbox placement or sending permission.','Use DKIM selectors supplied by your mailbox provider. Without a selector, DKIM stays pending. No guessed records or DNS changes are generated.','Results can be cached for up to five minutes; temporary lookup failures remain unknown and may be cached briefly. No mailbox health, pause, approval or send state is changed.']};
 }
}
