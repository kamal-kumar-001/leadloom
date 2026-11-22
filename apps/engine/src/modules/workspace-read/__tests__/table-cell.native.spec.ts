import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { TableImportService } from '../table-import.service';
import { TableCellService, CellEditConflict } from '../table-cell.service';
import { PrismaDispatchDatabase } from '../../outbound/prisma-database';
it.skipIf(process.env.LEADLOOM_INTEGRATION!=='1'||!process.env.LEADLOOM_TEST_DATABASE_URL)('actual Prisma/native PostgreSQL serializes conflicting text-cell edits with one winner',async()=>{
 const db=new PrismaClient({datasources:{db:{url:process.env.LEADLOOM_TEST_DATABASE_URL}}}),ws=randomUUID();
 try{
  await db.workspace.create({data:{id:ws,name:'Synthetic cell conflict'}});
  const imported=await new TableImportService(db).import(ws,{requestId:randomUUID(),name:'Synthetic edit',columns:['Code'],rows:[['00001']]});
  const row=await db.row.findFirstOrThrow({where:{tableId:imported.tableId}}),column=await db.column.findFirstOrThrow({where:{tableId:imported.tableId}});
  const service=new TableCellService(new PrismaDispatchDatabase(db));
  const attempts=await Promise.allSettled(['00002','00003'].map(value=>service.edit(ws,imported.tableId,{rowId:row.id,columnId:column.id,expectedValue:'00001',value})));
  expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(1);const failure=attempts.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(failure.reason).toBeInstanceOf(CellEditConflict);
  const current=await db.cell.findFirstOrThrow({where:{rowId:row.id,columnId:column.id}});expect(['00002','00003']).toContain(current.value);
  expect((await db.table.findUniqueOrThrow({where:{id:imported.tableId}})).rowCount).toBe(1);
  await db.cell.deleteMany({where:{rowId:row.id,columnId:column.id}});
  const native=new PrismaDispatchDatabase(db);let inserted=false;
  const racing=new TableCellService({transaction:(fn:any)=>native.transaction(async tx=>fn({query:async(sql:string,p:any[])=>{
   const result=await tx.query(sql,p);
   if(!inserted&&sql.startsWith('SELECT value FROM cells')){inserted=true;await db.cell.create({data:{tableId:imported.tableId,rowId:row.id,columnId:column.id,value:'Background writer'}});}
   return result;
  }}))} as any);
  await expect(racing.edit(ws,imported.tableId,{rowId:row.id,columnId:column.id,expectedValue:null,value:'Do not replace background'})).rejects.toBeInstanceOf(CellEditConflict);
  expect((await db.cell.findFirstOrThrow({where:{rowId:row.id,columnId:column.id}})).value).toBe('Background writer');
 }finally{await db.workspace.deleteMany({where:{id:ws}});await db.$disconnect();}
});
