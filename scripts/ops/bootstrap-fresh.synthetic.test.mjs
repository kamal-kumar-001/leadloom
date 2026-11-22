import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(run){
 const dir=mkdtempSync(path.join(tmpdir(),'leadloom-bootstrap-contract-'));
 const trace=path.join(dir,'trace');
 writeFileSync(path.join(dir,'npx'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "$BOOTSTRAP_TRACE"\ncase "$*" in\n *assert-fresh-database.sql*) exit "${GUARD_CODE:-0}" ;;\n *) exit "${BASELINE_CODE:-0}" ;;\nesac\n',{mode:0o755});
 try{
  return run((extra={},omitUrl=false)=>{
   const env={...process.env,PATH:dir+path.delimiter+process.env.PATH,BOOTSTRAP_TRACE:trace,DATABASE_URL:'postgresql://synthetic:synthetic@localhost:1/not-used-by-fixture',...extra};
   if(omitUrl)delete env.DATABASE_URL;
   return spawnSync('sh',[path.join(root,'packages/database/scripts/bootstrap-fresh.sh')],{cwd:path.join(root,'packages/database'),env,encoding:'utf8'});
  },()=>existsSync(trace)?readFileSync(trace,'utf8').trim().split('\n'):[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
}

test('connection/catalog preflight failure never reaches baseline or migration history writes',()=>{
 for(const code of ['1','2'])fixture((run,calls)=>{
  assert.equal(run({GUARD_CODE:code}).status,2);
  assert.equal(calls().length,1);
  assert.match(calls()[0],/db execute --file .*assert-fresh-database\.sql/);
  assert(!calls().some(c=>c.includes('migrate resolve')||c.includes('migrate deploy')||c.includes('init_v2')));
 });
});

test('first baseline failure stops before declaring that migration applied',()=>fixture((run,calls)=>{
 assert.equal(run({BASELINE_CODE:'3'}).status,3);
 assert.equal(calls().length,2);
 assert.match(calls()[1],/20261110_init_v2\/migration\.sql/);
 assert(!calls().some(c=>c.includes('migrate resolve')||c.includes('migrate deploy')));
}));

test('verified-empty success preserves guarded baseline/resolve/deploy ordering',()=>fixture((run,calls)=>{
 assert.equal(run().status,0);
 const commands=calls();assert.equal(commands.length,6);
 assert.match(commands[0],/assert-fresh-database\.sql/);
 assert.match(commands[1],/20261110_init_v2\/migration\.sql/);
 assert.match(commands[2],/migrate resolve --applied 20261110_init_v2/);
 assert.match(commands[3],/20261110_integrity\/migration\.sql/);
 assert.match(commands[4],/migrate resolve --applied 20261110_integrity/);
 assert.match(commands[5],/migrate deploy/);
}));

test('missing database URL invokes no database command',()=>fixture((run,calls)=>{
 assert.notEqual(run({},true).status,0);assert.deepEqual(calls(),[]);
}));

test('guard is explicitly read-only and checks schemas plus user relation kinds',()=>{
 const sql=readFileSync(path.join(root,'packages/database/scripts/assert-fresh-database.sql'),'utf8');
 assert.match(sql,/BEGIN READ ONLY/);assert.match(sql,/statement_timeout/);
 assert.match(sql,/pg_namespace/);assert.match(sql,/pg_class/);
 assert.match(sql,/RAISE EXCEPTION/);
 assert(!/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(sql.replace(/^--.*$/gm,'')));
});
