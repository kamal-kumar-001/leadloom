import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { TableCellService } from '../table-cell.service';
import { createApplication } from '../../../main';
import { issueSession } from '../../auth/issuer';
const pg = new PGlite({ extensions: { vector } });
const ws=randomUUID(), other=randomUUID(), user=randomUUID(), table=randomUUID(), row=randomUUID(), column=randomUUID(), key=Buffer.alloc(32,8);
let app:any, server:any, fail=false;
const database:any={transaction:(fn:any)=>pg.transaction(tx=>fn({query:async(sql:string,p:any[]=[])=>{if(fail&&sql.startsWith('UPDATE tables'))throw Error('Synthetic failure');return(await tx.query(sql,p)).rows;}}))};
const token=(role:any='admin',workspaceId=ws)=>issueSession({userId:user,workspaceId,role},key,3600).token;
const input=(value='New value',expectedValue:any='Original')=>({rowId:row,columnId:column,expectedValue,value});
const call=(body:any,role='admin',workspaceId=ws,tableId=table)=>server.inject({method:'PATCH',url:'/workspace/tables/'+tableId+'/cells',headers:{authorization:'Bearer '+token(role,workspaceId)},payload:body});
beforeAll(async()=>{
 for(const m of ['20261110_init_v2','20261110_integrity'])await pg.exec(readFileSync(new URL('../../../../../../packages/database/prisma/migrations/'+m+'/migration.sql',import.meta.url),'utf8'));
 for(const id of [ws,other])await pg.query('INSERT INTO workspaces(id,name,updated_at)VALUES($1,$2,now())',[id,'Synthetic']);
 await pg.query('INSERT INTO tables(id,workspace_id,name,row_count,updated_at)VALUES($1,$2,$3,1,now())',[table,ws,'Synthetic']);
 await pg.query("INSERT INTO columns(id,table_id,name,type,order_index)VALUES($1,$2,'Company','text',0)",[column,table]);
 await pg.query('INSERT INTO rows(id,table_id,order_index)VALUES($1,$2,0)',[row,table]);
 await pg.query('INSERT INTO cells(id,table_id,row_id,column_id,value,updated_at)VALUES($1,$2,$3,$4,$5::jsonb,now())',[randomUUID(),table,row,column,JSON.stringify('Original')]);
 app=await createApplication({sessionKey:key,tableCells:new TableCellService(database)} as any);server=app.getHttpAdapter().getInstance();
},30000);
afterAll(async()=>{await app?.close();await pg.close();});
it('persists exact text, keeps row counts, accepts an identical retry without changing timestamps and rejects stale edits',async()=>{
 expect((await call(input('00012\nQuoted "value"'))).statusCode).toBe(200);
 const before=(await pg.query('SELECT value,updated_at FROM cells WHERE column_id=$1',[column])).rows[0];expect(before.value).toBe('00012\nQuoted "value"');
 const retry=await call(input('00012\nQuoted "value"'));expect(retry.statusCode).toBe(200);expect(retry.json().changed).toBe(false);
 expect((await pg.query('SELECT updated_at FROM cells WHERE column_id=$1',[column])).rows[0].updated_at).toEqual(before.updated_at);
 expect((await call(input('Stale overwrite'))).statusCode).toBe(409);
 expect((await pg.query('SELECT row_count FROM tables WHERE id=$1',[table])).rows[0].row_count).toBe(1);
});
it('enforces tenant, role, membership and strict bounded input without changing other data',async()=>{
 expect((await call(input(), 'read_only')).statusCode).toBe(403);
 expect((await call(input(), 'admin',other)).statusCode).toBe(404);
 expect((await call({...input(),rowId:randomUUID()})).statusCode).toBe(404);
 expect((await call({...input(),columnId:randomUUID()})).statusCode).toBe(404);
 expect((await call({...input(),extra:'not allowed'})).statusCode).toBe(400);
 expect((await call(input('x'.repeat(10001)))).statusCode).toBe(400);
 expect((await server.inject({method:'PATCH',url:'/workspace/tables/'+table+'/cells',payload:input()})).statusCode).toBe(401);
});
it('refuses typed columns and structured enrichment payloads, and can fill an absent text cell',async()=>{
 await pg.query("UPDATE columns SET type='waterfall' WHERE id=$1",[column]);expect((await call(input())).statusCode).toBe(400);
 await pg.query("UPDATE columns SET type='text' WHERE id=$1",[column]);await pg.query('UPDATE cells SET value=$1::jsonb WHERE column_id=$2',[JSON.stringify({status:'verified',value:'Protected'}),column]);expect((await call(input())).statusCode).toBe(400);
 await pg.query('DELETE FROM cells WHERE column_id=$1',[column]);expect((await call(input('Filled',null))).statusCode).toBe(200);
});
it('rolls back cell update when the table metadata write fails and never reports success',async()=>{
 fail=true;try{expect((await call(input('Must roll back','Filled'))).statusCode).toBe(503);}finally{fail=false;}
 expect((await pg.query('SELECT value FROM cells WHERE column_id=$1',[column])).rows[0].value).toBe('Filled');
});
