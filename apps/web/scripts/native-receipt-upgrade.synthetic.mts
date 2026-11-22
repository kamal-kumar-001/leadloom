import pg from 'pg';
import {mkdtempSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url).pathname,name='leadloom_receipt_upgrade_'+Date.now(),user=process.env.USER,socket='/tmp/leadloom-pg-race/socket';
const admin=new pg.Client({host:socket,port:56539,database:'postgres',user});await admin.connect();await admin.query('CREATE DATABASE '+name);
const url='postgresql://'+user+'@localhost:56539/'+name+'?host='+encodeURIComponent(socket),tmp=mkdtempSync('/tmp/leadloom-receipt-upgrade-');mkdirSync(tmp+'/migrations');
cpSync(root+'packages/database/prisma/schema.prisma',tmp+'/schema.prisma');cpSync(root+'packages/database/prisma/migrations/migration_lock.toml',tmp+'/migrations/migration_lock.toml');
for(const dir of readdirSync(root+'packages/database/prisma/migrations').filter(d=>/^\d{8}_/.test(d)&&d<'20261209_research_save_receipts'))cpSync(root+'packages/database/prisma/migrations/'+dir,tmp+'/migrations/'+dir,{recursive:true});
let db:pg.Client|undefined;
try{
 const baseline=execFileSync('sh',['scripts/bootstrap-fresh.sh'],{cwd:root+'packages/database',env:{...process.env,DATABASE_URL:url,SCHEMA:tmp+'/schema.prisma'},encoding:'utf8',timeout:90000});
 db=new pg.Client({connectionString:url});await db.connect();const ws=randomUUID(),table=randomUUID(),row=randomUUID(),column=randomUUID();
 await db.query('INSERT INTO workspaces(id,name,updated_at)VALUES($1,$2,now())',[ws,'Existing research fixture']);await db.query("INSERT INTO tables(id,workspace_id,name,row_count,updated_at)VALUES($1,$2,'Website research leads',1,now())",[table,ws]);await db.query("INSERT INTO columns(id,table_id,name,type,order_index)VALUES($1,$2,'Domain','text',0)",[column,table]);await db.query('INSERT INTO rows(id,table_id,order_index)VALUES($1,$2,0)',[row,table]);await db.query("INSERT INTO cells(id,table_id,row_id,column_id,value,updated_at)VALUES($1,$2,$3,$4,'\"existing.invalid\"',now())",[randomUUID(),table,row,column]);
 const snapshot=async()=>({tables:(await db!.query('SELECT row_to_json(t) AS data FROM tables t WHERE workspace_id=$1',[ws])).rows,rows:(await db!.query('SELECT row_to_json(r) AS data FROM rows r WHERE table_id=$1',[table])).rows,cells:(await db!.query('SELECT row_to_json(c) AS data FROM cells c WHERE table_id=$1',[table])).rows});const before=await snapshot();
 const migrated=execFileSync('npx',['prisma','migrate','deploy'],{cwd:root+'packages/database',env:{...process.env,DATABASE_URL:url},encoding:'utf8',timeout:90000});assert.deepEqual(await snapshot(),before);assert.equal((await db.query('SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].n,34);assert.equal((await db.query('SELECT count(*)::int AS n FROM research_save_receipts')).rows[0].n,0);
 await db.query('INSERT INTO research_save_receipts(workspace_id,request_id,payload_hash,table_id,row_id)VALUES($1,$2,$3,$4,$5)',[ws,randomUUID(),'a'.repeat(64),table,row]);await db.query('DELETE FROM tables WHERE id=$1',[table]);assert.equal((await db.query('SELECT count(*)::int AS n FROM research_save_receipts')).rows[0].n,1);await db.query('DELETE FROM workspaces WHERE id=$1',[ws]);assert.equal((await db.query('SELECT count(*)::int AS n FROM research_save_receipts')).rows[0].n,0);
 console.log(baseline.slice(-300));console.log(migrated);console.log('PASS actual 30-to-34 native Prisma upgrade preserves existing research tables, rows, cells, counts and timestamps unchanged; no historical receipts inferred. Table deletion retains receipt tombstone; workspace cascade removes it. Disposable DB removed.');
}finally{await db?.end();await admin.query('DROP DATABASE '+name);await admin.end();}
