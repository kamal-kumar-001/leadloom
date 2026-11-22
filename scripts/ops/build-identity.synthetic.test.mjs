import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {sourceIdentity,prepare,generated} from './build-identity.mjs';
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'leadloom-identity-test-'));
 for(const d of ['apps/engine/src','apps/web/lib','packages','workers','skills','scripts','docker'])mkdirSync(path.join(root,d),{recursive:true});
 for(const p of ['package.json','package-lock.json','tsconfig.base.json','turbo.json','pnpm-workspace.yaml','docker-compose.yml','.dockerignore','update.sh'])writeFileSync(path.join(root,p),'synthetic '+p+'\n');
 writeFileSync(path.join(root,'apps/web/lib/example.ts'),'export const value=1;\n');return root;
}
test('source fingerprint is deterministic, path/content sensitive, covers scripts/schema/config, excludes env/build outputs and own generated identity',()=>{
 const root=fixture();try{
  const first=sourceIdentity(root);assert.match(first.buildId,/^[a-f0-9]{64}$/);assert.deepEqual(sourceIdentity(root),first);
  const prepared=prepare(root);assert.deepEqual(prepared,first);for(const p of generated)assert(readFileSync(path.join(root,p),'utf8').includes(first.buildId));assert.deepEqual(sourceIdentity(root),first);
  mkdirSync(path.join(root,'apps/web/.next'));writeFileSync(path.join(root,'apps/web/.next/ignored.js'),'ignored');writeFileSync(path.join(root,'apps/web/.env'),'synthetic-private-not-a-real-secret');writeFileSync(path.join(root,'apps/web/lib/cache.tsbuildinfo'),'ignored');assert.deepEqual(sourceIdentity(root),first);
  for(const p of ['scripts/check.mjs','packages/schema.prisma','docker/app.Dockerfile','skills/example.md']){writeFileSync(path.join(root,p),'source changes matter');assert.notEqual(sourceIdentity(root).buildId,first.buildId);rmSync(path.join(root,p));assert.deepEqual(sourceIdentity(root),first);}
  writeFileSync(path.join(root,'package-lock.json'),'changed locked dependency');assert.notEqual(sourceIdentity(root).buildId,first.buildId);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('included symbolic links and missing required build roots are refused, never followed into private paths',()=>{
 const root=fixture();try{symlinkSync('/not-a-real-private-path',path.join(root,'apps/web/lib/linked.ts'));assert.throws(()=>sourceIdentity(root),/symbolic links/);rmSync(path.join(root,'apps/web/lib/linked.ts'));rmSync(path.join(root,'package-lock.json'));assert.throws(()=>sourceIdentity(root));}finally{rmSync(root,{recursive:true,force:true});}
});
