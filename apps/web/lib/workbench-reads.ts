import {z} from 'zod';
import {ProjectAssetKindSchema} from '@leadloom/contracts';
import {checkedHistoryDetail} from './work-activity';

export interface WorkbenchReadTicket {generation:number;query:string;kind:string}
/** A save callback reads the current scope, not its render's old search/filter closure. */
export class WorkbenchReadEpoch {
  private generation=0;
  private alive=true;
  private query='';
  private kind='';
  mount(){this.alive=true;this.generation++;}
  unmount(){this.alive=false;this.generation++;}
  setScope(scope:{query?:string;kind?:string}){
    const query=scope.query??this.query,kind=scope.kind??this.kind;
    if(query!==this.query||kind!==this.kind){this.query=query;this.kind=kind;this.generation++;}
  }
  begin():WorkbenchReadTicket{return{generation:++this.generation,query:this.query,kind:this.kind};}
  accepts(ticket:WorkbenchReadTicket){return this.alive&&ticket.generation===this.generation&&ticket.query===this.query&&ticket.kind===this.kind;}
  isMounted(){return this.alive;}
}

/** An expired acknowledgement is not cancellation of server-side work. */
export async function boundedWorkbenchOperation<T>(promise:Promise<T>,milliseconds=15000):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workbench operation timed out')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}

const Version=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const Summary=z.object({id:z.string().uuid(),projectId:z.string().uuid(),kind:ProjectAssetKindSchema,title:z.string().min(1).max(160),version:Version,excerpt:z.string().max(240),updatedAt:z.string().datetime()}).strict();
const Detail=Summary.extend({body:z.string().min(1).max(40000),createdAt:z.string().datetime(),currentVersion:Version});
const Saved=Detail.extend({replayed:z.boolean()});
const Page=z.object({items:Summary.array().max(10),nextOffset:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable()}).strict();
export type CheckedAssetSummary=z.infer<typeof Summary>;
export function checkedAssetPage(value:unknown,projectId:string,offset:number){
  const result=Page.safeParse(value);if(!result.success)return null;const page=result.data;
  if(page.items.some(row=>row.projectId!==projectId)||new Set(page.items.map(row=>row.id)).size!==page.items.length)return null;
  if(page.nextOffset!==null&&(page.items.length!==10||page.nextOffset!==offset+10))return null;
  return page;
}
export function appendAssetPage(current:CheckedAssetSummary[],incoming:CheckedAssetSummary[]){const ids=new Set(current.map(row=>row.id));return incoming.some(row=>ids.has(row.id))?null:[...current,...incoming];}
export function checkedAssetDetail(value:unknown,projectId:string,id:string,version?:number){
  const result=Detail.safeParse(value);if(!result.success)return null;const detail=result.data;
  return detail.projectId===projectId&&detail.id===id&&detail.version<=detail.currentVersion&&(version===undefined?detail.version===detail.currentVersion:detail.version===version)?detail:null;
}
export function checkedAssetSave(value:unknown,projectId:string,input:{title:string;body:string;kind?:string;id?:string;expectedVersion?:number}){
  const result=Saved.safeParse(value);if(!result.success)return null;const saved=result.data;
  return saved.projectId===projectId&&saved.title===input.title.trim()&&saved.body===input.body&&saved.version<=saved.currentVersion&&(!input.kind||saved.kind===input.kind)&&(input.id?saved.id===input.id&&saved.version===input.expectedVersion!+1:saved.version===1)?saved:null;
}

export function checkedEntrySave(value:unknown,projectId:string,input:{kind:string;title:string;body:string}){
  if(!value||typeof value!=='object'||!('id' in value)||typeof value.id!=='string')return null;
  const entry=checkedHistoryDetail(value,projectId,value.id);
  return entry&&entry.kind===input.kind&&entry.title===input.title.trim()&&entry.body===input.body.trim()?entry:null;
}
