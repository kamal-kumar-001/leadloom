import {capturedTableField} from '@leadloom/contracts';
import {capturedTableSchemaRevision} from './captured-table-schema';
export class CapturedTableMappingConflict extends Error{}
export class CapturedTableMappingInvalid extends Error{}
import {randomUUID} from 'node:crypto';
import type {TransactionalDatabase} from '../outbound/atomic-dispatch.repository';
export interface CapturedTableLead {email:string;name?:string|null;company?:string|null}
/** Append semantics are intentional: repeated table imports create new rows.
 * A table row lock serializes importers; all rows/cells/count commit together.
 */
export async function importCapturedLeadsToTable(database:TransactionalDatabase,workspaceId:string,tableId:string,leads:CapturedTableLead[],expectedRevision?:string):Promise<{name:string;importedCount:number}|null>{
 return database.transaction(async tx=>{
  const tables=await tx.query<{name:string;row_count:number}>('SELECT name,row_count FROM tables WHERE workspace_id=$1::uuid AND id=$2::uuid FOR UPDATE',[workspaceId,tableId]);
  if(!tables[0])return null;
  const columns=await tx.query<{id:string;name:string;type:string}>('SELECT id,name,type FROM columns WHERE table_id=$1::uuid ORDER BY order_index,id LIMIT 101',[tableId]);
  if(columns.length>100)throw new CapturedTableMappingInvalid('Table import supports at most100columns. No rows were added.');
  if(expectedRevision&&capturedTableSchemaRevision(columns)!==expectedRevision)throw new CapturedTableMappingConflict('Destination columns changed since the preview. Reload the destination and review its mapping. No rows were added.');
  const mapped=columns.flatMap(column=>{const field=capturedTableField(column.name);return field&&column.type==='text'?[{...column,field}]:[];});
  if(!mapped.some(c=>c.field==='email'))throw new CapturedTableMappingInvalid('Choose a table with a text Email, Email Address or Work Email column. No rows were added.');
  const max=await tx.query<{next_index:number}>('SELECT COALESCE(MAX(order_index)+1,0)::int AS next_index FROM rows WHERE table_id=$1::uuid',[tableId]);
  const start=Math.max(tables[0].row_count,max[0]?.next_index??0);
  for(let i=0;i<leads.length;i++){
   const lead=leads[i],rowId=randomUUID();
   await tx.query('INSERT INTO rows(id,table_id,order_index) VALUES($1::uuid,$2::uuid,$3)',[rowId,tableId,start+i]);
   for(const column of mapped){
    const value=lead[column.field];
    if(value)await tx.query('INSERT INTO cells(id,table_id,row_id,column_id,value,updated_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,clock_timestamp())',[randomUUID(),tableId,rowId,column.id,JSON.stringify(value)]);
   }
  }
  await tx.query('UPDATE tables SET row_count=(SELECT count(*)::int FROM rows WHERE table_id=$1::uuid),updated_at=clock_timestamp() WHERE id=$1::uuid AND workspace_id=$2::uuid',[tableId,workspaceId]);
  return{name:tables[0].name,importedCount:leads.length};
 });
}
