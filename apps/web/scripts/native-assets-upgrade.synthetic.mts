import pg from 'pg';
import {mkdtempSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url).pathname,name='leadloom_assets_upgrade_'+Date.now(),user=process.env.USER,socket='/tmp/leadloom-pg-race/socket';
const admin=new pg.Client({host:socket,port:56539,database:'postgres',user});await admin.connect();await admin.query('CREATE DATABASE '+name);
const url='postgresql://'+user+'@localhost:56539/'+name+'?host='+encodeURIComponent(socket),tmp=mkdtempSync('/tmp/leadloom-assets-upgrade-');mkdirSync(tmp+'/migrations');
cpSync(root+'packages/database/prisma/schema.prisma',tmp+'/schema.prisma');cpSync(root+'packages/database/prisma/migrations/migration_lock.toml',tmp+'/migrations/migration_lock.toml');
for(const dir of readdirSync(root+'packages/database/prisma/migrations').filter(d=>/^\d{8}_/.test(d)&&d<'20261210_project_assets'))cpSync(root+'packages/database/prisma/migrations/'+dir,tmp+'/migrations/'+dir,{recursive:true});
let db:pg.Client|undefined;
try{
 execFileSync('sh',['scripts/bootstrap-fresh.sh'],{cwd:root+'packages/database',env:{...process.env,DATABASE_URL:url,SCHEMA:tmp+'/schema.prisma'},encoding:'utf8',timeout:90000});
 db=new pg.Client({connectionString:url});await db.connect();const ws=randomUUID(),project=randomUUID(),entry=randomUUID(),receipt=randomUUID();
 await db.query('INSERT INTO workspaces(id,name,updated_at)VALUES($1,$2,now())',[ws,'Existing project fixture']);await db.query("INSERT INTO projects(id,workspace_id,slug,name)VALUES($1,$2,'old-project','Old project')",[project,ws]);await db.query("INSERT INTO project_entries(id,workspace_id,project_id,kind,title,body,request_id)VALUES($1,$2,$3,'decision','Keep old decisions','Previously stored text',$4)",[entry,ws,project,randomUUID()]);
 await db.query('INSERT INTO research_save_receipts(workspace_id,request_id,payload_hash,table_id,row_id)VALUES($1,$2,$3,$4,$5)',[ws,receipt,'a'.repeat(64),randomUUID(),randomUUID()]);
 const snapshot=async()=>({projects:(await db!.query('SELECT row_to_json(t) AS data FROM projects t WHERE workspace_id=$1',[ws])).rows,entries:(await db!.query('SELECT row_to_json(t) AS data FROM project_entries t WHERE workspace_id=$1',[ws])).rows,receipts:(await db!.query('SELECT row_to_json(t) AS data FROM research_save_receipts t WHERE workspace_id=$1',[ws])).rows});const before=await snapshot();assert.equal((await db.query('SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].n,31);
 const migrated=execFileSync('npx',['prisma','migrate','deploy'],{cwd:root+'packages/database',env:{...process.env,DATABASE_URL:url},encoding:'utf8',timeout:90000});assert.deepEqual(await snapshot(),before);assert.equal((await db.query('SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].n,34);assert.equal((await db.query('SELECT count(*)::int AS n FROM project_assets')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int AS n FROM project_asset_versions')).rows[0].n,0);
 console.log(migrated);console.log('PASS actual native 31-to-34 upgrade preserves project/entry/research receipt IDs, content and timestamps unchanged. No draft ownership or versions inferred. Disposable database removed.');
}finally{await db?.end();await admin.query('DROP DATABASE '+name);await admin.end();}
