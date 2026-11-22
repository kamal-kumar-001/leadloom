import {z} from 'zod';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {TransactionalDatabase} from '../outbound/atomic-dispatch.repository';
import {DurableWaterfallService} from './durable-waterfall.service';
export const WaterfallInputMappingSchema=z.object({domain:z.string().uuid(),firstName:z.string().uuid(),lastName:z.string().uuid(),companyName:z.string().uuid().optional(),title:z.string().uuid().optional()}).strict().refine(v=>new Set(Object.values(v)).size===Object.values(v).length,'Use distinct input columns');
export const ConfigureSavedWaterfallSchema=z.object({columnId:z.string().uuid(),name:z.string().trim().min(1).max(100),inputColumns:WaterfallInputMappingSchema}).strict();
export const ReviseSavedWaterfallSchema=z.object({expectedRevision:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().trim().min(1).max(100),inputColumns:WaterfallInputMappingSchema}).strict();
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const revision=(c:any)=>createHash('sha256').update(canonical({name:c.name,config:c.config})).digest('hex');
const view=(c:any)=>({columnId:c.id,name:c.name,inputColumns:c.config.inputColumns,revision:revision(c)});
export class SavedWaterfallConflict extends Error{}
export class SavedWaterfallInvalid extends Error{}
/** Schema configuration only, never queues work, invokes a provider or grants a budget. */
export class SavedWaterfallService{
 constructor(private readonly db:TransactionalDatabase){}
 async configure(workspaceId:string,tableId:string,raw:z.infer<typeof ConfigureSavedWaterfallSchema>){const input=ConfigureSavedWaterfallSchema.parse(raw);return this.db.transaction(async tx=>{
  if(!(await tx.query('SELECT id FROM tables WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',[tableId,workspaceId])).length)return null;
  const columns=await tx.query<any>('SELECT id,table_id,name,type,config,order_index FROM columns WHERE table_id=$1::uuid ORDER BY order_index,id',[tableId]),config={inputColumns:input.inputColumns},existing=columns.find(c=>c.id===input.columnId);
  if(existing){if(existing.type!=='waterfall'||existing.name!==input.name||!isDeepStrictEqual(existing.config,config))throw new SavedWaterfallConflict('Column ID already used for different saved configuration');return{columnId:existing.id,name:existing.name,created:false};}
  if(columns.length>=30)throw new SavedWaterfallInvalid('Saved configuration supports up to30columns');if(columns.some(c=>c.name.toLowerCase()===input.name.toLowerCase()))throw new SavedWaterfallConflict('A column with this name already exists');
  for(const id of Object.values(input.inputColumns))if(!columns.some(c=>c.id===id&&['text','email','url'].includes(c.type)))throw new SavedWaterfallInvalid('Inputs must be distinct saved text, URL or email columns in this table');
  // The UUID is the retry receipt. Global PK collision remains a conflict, never overwrite.
  const found=await tx.query('SELECT id FROM columns WHERE id=$1::uuid',[input.columnId]);if(found.length)throw new SavedWaterfallConflict('Column ID unavailable');
  await tx.query("INSERT INTO columns(id,table_id,name,type,order_index,config)VALUES($1::uuid,$2::uuid,$3,'waterfall',$4,$5::jsonb)RETURNING id",[input.columnId,tableId,input.name,Math.max(-1,...columns.map(c=>c.order_index))+1,JSON.stringify(config)]);await tx.query('UPDATE tables SET updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING id',[tableId]);return{columnId:input.columnId,name:input.name,created:true};
 });}
 async read(workspaceId:string,tableId:string,columnId:string){return this.db.transaction(async tx=>{
  const c=(await tx.query<any>("SELECT c.id,c.name,c.config FROM columns c JOIN tables t ON t.id=c.table_id WHERE t.workspace_id=$1::uuid AND t.id=$2::uuid AND c.id=$3::uuid AND c.type='waterfall'",[workspaceId,tableId,columnId]))[0];if(!c)return null;
  if(!WaterfallInputMappingSchema.safeParse(c.config?.inputColumns).success||Object.keys(c.config).some(k=>k!=='inputColumns'))throw new SavedWaterfallInvalid('This saved configuration cannot be edited by the mapping form');return view(c);
 });}
 async revise(workspaceId:string,tableId:string,columnId:string,raw:z.infer<typeof ReviseSavedWaterfallSchema>){const input=ReviseSavedWaterfallSchema.parse(raw);return this.db.transaction(async tx=>{
  if(!(await tx.query('SELECT id FROM tables WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',[tableId,workspaceId])).length)return null;
  const columns=await tx.query<any>('SELECT id,name,type,config FROM columns WHERE table_id=$1::uuid ORDER BY id FOR UPDATE',[tableId]),c=columns.find(c=>c.id===columnId&&c.type==='waterfall');if(!c)return null;
  if(!WaterfallInputMappingSchema.safeParse(c.config?.inputColumns).success||Object.keys(c.config).some(k=>k!=='inputColumns'))throw new SavedWaterfallInvalid('This saved configuration cannot be edited by the mapping form');
  // Desired-state retry is safe even if the original acknowledgement was lost.
  const config={inputColumns:input.inputColumns};if(c.name===input.name&&isDeepStrictEqual(c.config,config))return{...view(c),changed:false};
  if(revision(c)!==input.expectedRevision)throw new SavedWaterfallConflict('Saved mapping changed. Reload its current configuration before editing.');
  if(columns.some(other=>other.id!==c.id&&other.name.toLowerCase()===input.name.toLowerCase()))throw new SavedWaterfallConflict('A column with this name already exists');
  for(const id of Object.values(input.inputColumns))if(!columns.some(other=>other.id===id&&['text','email','url'].includes(other.type)))throw new SavedWaterfallInvalid('Inputs must be distinct saved text, URL or email columns in this table');
  await tx.query('UPDATE columns SET name=$2,config=$3::jsonb WHERE id=$1::uuid RETURNING id',[c.id,input.name,JSON.stringify(config)]);await tx.query('UPDATE tables SET updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING id',[tableId]);
  return{...view({...c,name:input.name,config}),changed:true};
 });}
 async preview(workspaceId:string,tableId:string,columnId:string,rowIds:string[]){return new DurableWaterfallService(this.db).preview(workspaceId,tableId,columnId,rowIds);}
}
