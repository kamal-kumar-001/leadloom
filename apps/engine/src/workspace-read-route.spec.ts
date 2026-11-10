import {describe,it,expect,vi} from 'vitest';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {createApplication} from './main';
const key=randomBytes(32),workspaceId=randomUUID();
function token(){
 const payload=Buffer.from(JSON.stringify({sub:randomUUID(),workspaceId,role:'member',exp:Math.floor(Date.now()/1000)+60})).toString('base64url');
 return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}
describe('workspace read routes',()=>{
 it('require a session and use only the session workspace id',async()=>{
  const credentials={save:vi.fn(),list:vi.fn(async()=>[]),delete:vi.fn()} as any;
  const outbound={enqueue:vi.fn(),suppress:vi.fn()} as any;
  const reads={summary:vi.fn(async()=>({tables:1,mailboxes:0,campaigns:0,suppressions:0,experiments:0,providerKeys:0})),listTables:vi.fn(async()=>[]),listMailboxes:vi.fn(async()=>[]),listCampaigns:vi.fn(async()=>[])};
  const app=await createApplication({credentials,outbound,sessionKey:key,reads});
  try{
   const s=app.getHttpAdapter().getInstance();
   for(const u of ['summary','tables','mailboxes','campaigns']){
    expect((await s.inject({method:'GET',url:'/workspace/'+u})).statusCode).toBe(401);
   }
   const r=await s.inject({method:'GET',url:'/workspace/summary?workspaceId='+randomUUID(),headers:{authorization:'Bearer '+token()}});
   expect(r.statusCode).toBe(200);
   expect(reads.summary).toHaveBeenCalledWith(workspaceId);
  }finally{await app.close();}
 });
 it('routes are absent when reads are not configured',async()=>{
  const app=await createApplication({credentials:{list:vi.fn()} as any,outbound:{} as any,sessionKey:key});
  try{expect((await app.getHttpAdapter().getInstance().inject({method:'GET',url:'/workspace/summary',headers:{authorization:'Bearer '+token()}})).statusCode).toBe(404);}finally{await app.close();}
 });
});
