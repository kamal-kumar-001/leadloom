import pg from 'pg';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

assert.equal(process.env.LEADLOOM_SYNTHETIC_BOOTSTRAP,'1','Explicit disposable-bootstrap-test opt-in required');
const root=new URL('../../../',import.meta.url).pathname;
const url=new URL(process.env.LEADLOOM_SYNTHETIC_ADMIN_URL??'');
assert.equal(url.protocol,'postgresql:');assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
assert.equal(url.pathname,'/postgres');assert.equal(url.searchParams.getAll('host').length,1);
assert([...url.searchParams.keys()].every(k=>k==='host'));
const socket=url.searchParams.get('host')!;
assert(/^\/tmp\/leadloom-[a-zA-Z0-9_/-]+$/.test(socket)&&!socket.includes('/../')&&!socket.includes('//'));
const admin=new pg.Client({connectionString:url.href});await admin.connect();
const prefix='leadloom_bootstrap_guard_'+randomUUID().replaceAll('-','');
const created:string[]=[];
const cases=[
 {name:'public-data',setup:"CREATE TABLE unrelated_fixture(value text); INSERT INTO unrelated_fixture VALUES ('retained synthetic sentinel')",accepted:false},
 {name:'private-data',setup:"CREATE SCHEMA unrelated_fixture; CREATE TABLE unrelated_fixture.saved(value text); INSERT INTO unrelated_fixture.saved VALUES ('retained synthetic sentinel')",accepted:false},
 {name:'empty-schema',setup:'CREATE SCHEMA unrelated_fixture',accepted:false},
 {name:'view-and-sequence',setup:'CREATE VIEW unrelated_fixture AS SELECT 7 AS value; CREATE SEQUENCE unrelated_sequence',accepted:false},
 {name:'migration-history',setup:'CREATE TABLE _prisma_migrations(id text)',accepted:false},
 {name:'empty',setup:'',accepted:true},
 {name:'extension-only',setup:'CREATE EXTENSION vector',accepted:true},
];
async function snapshot(client:pg.Client){
 const objects=(await client.query("SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' ORDER BY 1,2")).rows;
 const schemas=(await client.query("SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' ORDER BY 1")).rows;
 const extensions=(await client.query('SELECT extname,extversion FROM pg_extension ORDER BY 1')).rows;
 const sentinel=objects.some(o=>o.nspname==='public'&&o.relname==='unrelated_fixture'&&o.relkind==='r')?(await client.query('SELECT value FROM unrelated_fixture ORDER BY value')).rows:objects.some(o=>o.nspname==='unrelated_fixture'&&o.relname==='saved')?(await client.query('SELECT value FROM unrelated_fixture.saved ORDER BY value')).rows:[];
 return{objects,schemas,extensions,sentinel};
}
try{
 assert.equal(Number((await admin.query("SELECT current_setting('server_version_num')::int AS version")).rows[0].version)/10000|0,16,'Disposable PostgreSQL16 required');
 for(const [index,test]of cases.entries()){
  const name=prefix+'_'+index;assert(/^[a-z0-9_]+$/.test(name));await admin.query('CREATE DATABASE '+name);created.push(name);
  const target=new URL(url);target.pathname='/'+name;
  const client=new pg.Client({connectionString:target.href});await client.connect();
  try{
   if(test.setup)await client.query(test.setup);
   const before=await snapshot(client);
   const result=spawnSync('sh',['scripts/bootstrap-fresh.sh'],{cwd:root+'packages/database',env:{...process.env,DATABASE_URL:target.href},encoding:'utf8',timeout:90000});
   const after=await snapshot(client);
   if(!test.accepted){
    console.log(JSON.stringify({case:test.name,exitStatus:result.status,relationsBefore:before.objects.length,relationsAfter:after.objects.length}));
    assert.equal(result.status,2,'Nonempty target must be refused before baseline: '+test.name);
    assert.deepEqual(after,before,'Rejected target must retain exact objects/extensions/sentinel: '+test.name);
   }else{
    assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
    assert.equal(Number((await client.query('SELECT count(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count),40);
    console.log('PASS '+test.name+': all40migrations on a new disposable database');
   }
  }finally{await client.end();}
 }
 console.log('PASS five existing-target refusals preserve schema/extensions/sentinel, two valid fresh installs reach schema40. No production or existing user database was targeted.');
}finally{
 for(const name of created)await admin.query('DROP DATABASE '+name);
 await admin.end();
}
