import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { TableImportService } from '../table-import.service';
import { TableExportService } from '../table-export.service';
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!process.env.LEADLOOM_TEST_DATABASE_URL)('actual PostgreSQL/Prisma export includes every page and remains one snapshot under concurrent edits',async()=>{
 const db=new PrismaClient({datasources:{db:{url:process.env.LEADLOOM_TEST_DATABASE_URL}}}),ws=randomUUID();
 try{
  await db.workspace.create({data:{id:ws,name:'Synthetic export snapshot'}});
  const imported=await new TableImportService(db).import(ws,{requestId:randomUUID(),name:'Synthetic export',columns:['Code','Notes'],rows:Array.from({length:205},(_,i)=>[String(i+1).padStart(5,'0'),i===0?'Initial text':'Synthetic'])});
  const exported=await new TableExportService(db).export(ws,imported.tableId);expect(exported!.rowCount).toBe(205);expect(exported!.csv.split('\r\n')).toHaveLength(206);expect(exported!.csv).toContain('"00205"');
  const row=await db.row.findFirstOrThrow({where:{tableId:imported.tableId},orderBy:{orderIndex:'asc'}}),column=await db.column.findFirstOrThrow({where:{tableId:imported.tableId,name:'Notes'}});
  let changed=false;
  const intercepted={$transaction:(fn:any,opts:any)=>db.$transaction(async tx=>fn({...tx,table:tx.table,column:tx.column,row:tx.row,cell:{findMany:async(args:any)=>{
   if(!changed){changed=true;await db.cell.updateMany({where:{rowId:row.id,columnId:column.id},data:{value:'Changed after snapshot'}});}
   return tx.cell.findMany(args);
  }},$queryRawUnsafe:(...args:any[])=>(tx.$queryRawUnsafe as any)(...args)}),opts)};
  const snapshot=await new TableExportService(intercepted).export(ws,imported.tableId);expect(changed).toBe(true);expect(snapshot!.csv).toContain('Initial text');expect(snapshot!.csv).not.toContain('Changed after snapshot');
  expect((await new TableExportService(db).export(ws,imported.tableId))!.csv).toContain('Changed after snapshot');
  expect(await new TableExportService(db).export(randomUUID(),imported.tableId)).toBeNull();
 }finally{await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
});
