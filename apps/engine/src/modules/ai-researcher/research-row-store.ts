import {createHash} from 'node:crypto';
export interface ResearchSaveIdentity {requestId:string;payloadHash:string}
export const researchSaveIdentity=(requestId:string|undefined,payload:unknown):ResearchSaveIdentity|undefined=>requestId?{requestId,payloadHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')}:undefined;
export class ResearchTableConflict extends Error {}
export class ResearchProjectNotFound extends Error {}
export interface ResearchColumn {name:string;type:string}
/** One transaction owns table discovery, schema validation and a complete row.
 * Workspace-first locking matches import writers and prevents duplicate first-save tables.
 * Table locking orders this append with other supported row/cell writers.
 */
export async function appendResearchRow(db:any,workspaceId:string,name:string,columns:ReadonlyArray<ResearchColumn>,values:Record<string,unknown>,identity?:ResearchSaveIdentity,ownership?:{projectId:string;kind:'website'|'intent-fixture'}):Promise<{tableId:string;rowId:string;replayed:boolean}>{
 return db.$transaction(async(tx:any)=>{
  const workspace=await tx.$queryRawUnsafe('SELECT id FROM workspaces WHERE id=$1::uuid FOR UPDATE',workspaceId);
  if(!workspace[0])throw new Error('Research workspace not found');
  if(ownership){
   const project=await tx.$queryRawUnsafe('SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR KEY SHARE',ownership.projectId,workspaceId);
   if(!project[0])throw new ResearchProjectNotFound('Project not found');
  }
  if(identity){
   const receipts=await tx.$queryRawUnsafe('SELECT payload_hash,table_id,row_id FROM research_save_receipts WHERE workspace_id=$1::uuid AND request_id=$2::uuid',workspaceId,identity.requestId);
   const receipt=receipts[0];
   if(receipt){
    if(receipt.payload_hash!==identity.payloadHash)throw new ResearchTableConflict('This research request ID was already used for different input. Keep the original input for retries or start a new analysis');
    const existing=await tx.$queryRawUnsafe('SELECT r.id FROM rows r JOIN tables t ON t.id=r.table_id WHERE r.id=$1::uuid AND t.id=$2::uuid AND t.workspace_id=$3::uuid',receipt.row_id,receipt.table_id,workspaceId);
    if(!existing[0])throw new ResearchTableConflict('The original saved research row was removed. This request ID cannot recreate it; start a new analysis deliberately');
    return{tableId:receipt.table_id,rowId:receipt.row_id,replayed:true};
   }
  }
  const candidates=await tx.table.findMany({where:{workspaceId,name},take:2});
  if(candidates.length>1)throw new ResearchTableConflict('Multiple research tables share this name; resolve the duplicate before saving');
  let table=candidates[0];
  if(!table){
   table=await tx.table.create({data:{workspaceId,name}});
   for(const [i,col]of columns.entries())await tx.column.create({data:{tableId:table.id,name:col.name,type:col.type,orderIndex:i}});
  }
  const locked=await tx.$queryRawUnsafe('SELECT id FROM tables WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',table.id,workspaceId);
  if(!locked[0])throw new Error('Research table is unavailable');
  const stored=await tx.column.findMany({where:{tableId:table.id}});
  const columnIds=new Map<string,string>();
  for(const expected of columns){
   const matches=stored.filter((c:any)=>c.name===expected.name&&c.type===expected.type);
   if(matches.length!==1||stored.filter((c:any)=>c.name===expected.name).length!==1)throw new ResearchTableConflict('Research table columns changed; reload and repair before saving');
   columnIds.set(expected.name,matches[0].id);
  }
  const last=await tx.$queryRawUnsafe('SELECT COALESCE(MAX(order_index),-1)::int AS last FROM rows WHERE table_id=$1::uuid',table.id);
  const row=await tx.row.create({data:{tableId:table.id,orderIndex:Number(last[0].last)+1}});
  for(const expected of columns){
   if(!Object.hasOwn(values,expected.name))throw new Error('Computed research value is missing');
   await tx.cell.create({data:{tableId:table.id,rowId:row.id,columnId:columnIds.get(expected.name),value:values[expected.name]}});
  }
  const count=await tx.row.count({where:{tableId:table.id}});
  await tx.table.update({where:{id:table.id},data:{rowCount:count}});
  if(ownership)await tx.$queryRawUnsafe('INSERT INTO research_row_projects(row_id,workspace_id,project_id,kind)VALUES($1::uuid,$2::uuid,$3::uuid,$4) RETURNING row_id',row.id,workspaceId,ownership.projectId,ownership.kind);
  if(identity)await tx.$queryRawUnsafe('INSERT INTO research_save_receipts(workspace_id,request_id,payload_hash,table_id,row_id)VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid) RETURNING row_id',workspaceId,identity.requestId,identity.payloadHash,table.id,row.id);
  return{tableId:table.id,rowId:row.id,replayed:false};
 },{maxWait:15000,timeout:15000});
}

export async function findResearchTable(db:any,workspaceId:string,name:string):Promise<any|null>{
 const tables=await db.table.findMany({where:{workspaceId,name},take:2});
 if(tables.length>1)throw new ResearchTableConflict('Multiple research tables share this name; resolve the duplicate before reading');
 return tables[0]??null;
}

/** Bounded project retrieval joins actual table workspace and row identity, not names alone. */
export async function listProjectResearch(db:any,workspaceId:string,projectId:string,kind:'website'|'intent-fixture',name:string):Promise<{rowId:string;projectId:string;values:Record<string,unknown>}[]>{
 const table=await findResearchTable(db,workspaceId,name);if(!table)return[];
 const rows=await db.$queryRawUnsafe('SELECT r.id FROM rows r JOIN research_row_projects p ON p.row_id=r.id JOIN tables t ON t.id=r.table_id WHERE p.workspace_id=$1::uuid AND p.project_id=$2::uuid AND p.kind=$3 AND t.workspace_id=$1::uuid AND t.id=$4::uuid ORDER BY r.order_index DESC,r.id DESC LIMIT 50',workspaceId,projectId,kind,table.id);
 if(!rows.length)return[];
 const cols=await db.column.findMany({where:{tableId:table.id}}),names=new Map(cols.map((c:any)=>[c.id,c.name]));
 const cells=await db.cell.findMany({where:{tableId:table.id,rowId:{in:rows.map((r:any)=>r.id)}}});
 return rows.map((r:any)=>{const values:Record<string,unknown>=Object.create(null);for(const cell of cells)if(cell.rowId===r.id){const name=names.get(cell.columnId);if(typeof name==='string')values[name]=cell.value;}return{rowId:r.id,projectId,values};});
}
