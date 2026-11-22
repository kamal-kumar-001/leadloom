import {createHash,randomUUID} from 'node:crypto';
import type {ImportTable,ImportTableResult} from '@leadloom/contracts';
export class TableImportTargetDeleted extends Error{}
export class TableImportConflict extends Error{}
export class TableImportLimit extends Error{}
export class TableImportProjectMissing extends Error{}
export class TableImportService{
 constructor(private readonly prisma:any,private readonly canCreate?:(workspaceId:string,transaction?:any)=>Promise<boolean>){}
 async import(workspaceId:string,input:ImportTable,projectId?:string):Promise<ImportTableResult>{
  const hash=createHash('sha256').update(JSON.stringify({...projectId?{projectId}:{},name:input.name,columns:input.columns,rows:input.rows})).digest('hex');
  return this.prisma.$transaction(async(tx:any)=>{
   // Serializes imports for one workspace, including limit checks and retry receipts.
   const owner=await tx.$queryRawUnsafe('SELECT id FROM workspaces WHERE id=$1::uuid FOR UPDATE',workspaceId);if(!owner.length)throw new Error('Workspace unavailable');
   if(projectId){const p=await tx.$queryRawUnsafe('SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR KEY SHARE',projectId,workspaceId);if(!p.length)throw new TableImportProjectMissing();}
   const previous=(await tx.$queryRawUnsafe('SELECT r.*,t.id AS existing_table_id,t.name,t.project_id AS current_project_id FROM table_import_receipts r LEFT JOIN tables t ON t.id=r.table_id AND t.workspace_id=r.workspace_id WHERE r.workspace_id=$1::uuid AND r.request_id=$2::uuid',workspaceId,input.requestId))[0];
   if(previous){if(previous.project_id!==(projectId??null)||previous.payload_hash!==hash)throw new TableImportConflict();if(!previous.existing_table_id)throw new TableImportTargetDeleted();if(previous.current_project_id!==(projectId??null))throw new TableImportConflict();return{tableId:previous.table_id,name:previous.name,importedCount:previous.imported_count,columnCount:previous.column_count,created:false};}
   if(this.canCreate&&!await this.canCreate(workspaceId,tx))throw new TableImportLimit();
   const tableId=randomUUID();await tx.$queryRawUnsafe('INSERT INTO tables(id,workspace_id,name,row_count,project_id,updated_at)VALUES($1::uuid,$2::uuid,$3,$4,$5::uuid,now()) RETURNING id',tableId,workspaceId,input.name,input.rows.length,projectId??null);
   const columns=input.columns.map((name,i)=>({id:randomUUID(),name,idx:i}));
   await tx.$queryRawUnsafe("INSERT INTO columns(id,table_id,name,type,order_index)SELECT x.id,$1::uuid,x.name,'text',x.idx FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,name text,idx int) RETURNING id",tableId,JSON.stringify(columns));
   const rows=input.rows.map((values,i)=>({id:randomUUID(),idx:i,values}));
   await tx.$queryRawUnsafe('INSERT INTO rows(id,table_id,order_index)SELECT x.id,$1::uuid,x.idx FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,idx int) RETURNING id',tableId,JSON.stringify(rows.map(({values,...r})=>r)));
   const cells=rows.flatMap(r=>r.values.map((value,i)=>({id:randomUUID(),row_id:r.id,column_id:columns[i].id,value})));
   await tx.$queryRawUnsafe('INSERT INTO cells(id,table_id,row_id,column_id,value,updated_at)SELECT x.id,$1::uuid,x.row_id,x.column_id,x.value,now() FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,row_id uuid,column_id uuid,value jsonb) RETURNING id',tableId,JSON.stringify(cells));
   await tx.$queryRawUnsafe('INSERT INTO table_import_receipts(workspace_id,request_id,table_id,payload_hash,imported_count,column_count,project_id)VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::uuid) RETURNING table_id',workspaceId,input.requestId,tableId,hash,rows.length,columns.length,projectId??null);
   return{tableId,name:input.name,importedCount:rows.length,columnCount:columns.length,created:true};
  },{timeout:20000});
 }
}
