import {describe,it,expect,vi} from 'vitest';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {createApplication} from './main';
const key=randomBytes(32),workspaceId=randomUUID();
function token(role='member',exp=Math.floor(Date.now()/1000)+60){
 const payload=Buffer.from(JSON.stringify({sub:randomUUID(),workspaceId,role,exp})).toString('base64url');
 return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}
describe('Authenticated runtime route boundary',()=>{
 it('uses signed workspace context and denies absent/expired/read-only authorization',async()=>{
  const credentials={save:vi.fn(async()=>({maskedKey:'masked'} as any)),list:vi.fn(async()=>[]),delete:vi.fn(async()=>true)};
  const outbound={enqueue:vi.fn(async()=>randomUUID()),suppress:vi.fn(async()=>{})};
  const app=await createApplication({credentials,outbound,sessionKey:key});
  try{
   const server=app.getHttpAdapter().getInstance();
   expect((await server.inject({method:'GET',url:'/vault/credentials'})).statusCode).toBe(401);
   expect((await server.inject({method:'GET',url:'/vault/credentials',headers:{authorization:'Bearer '+token('member',1)}})).statusCode).toBe(401);
   expect((await server.inject({method:'POST',url:'/vault/credentials',headers:{authorization:'Bearer '+token('read_only')},payload:{}})).statusCode).toBe(403);
   const response=await server.inject({method:'GET',url:'/vault/credentials',headers:{authorization:'Bearer '+token()}});
   expect(response.statusCode).toBe(200);expect(credentials.list).toHaveBeenCalledWith(workspaceId);
   const spoof=await server.inject({method:'POST',url:'/outbound/jobs',headers:{authorization:'Bearer '+token()},payload:{workspaceId:randomUUID(),campaignId:randomUUID(),recipientEmail:'synthetic@example.invalid',idempotencyKey:'synthetic',stepNumber:1,scheduledAt:new Date().toISOString()}});
   expect(spoof.statusCode).toBe(400);expect(outbound.enqueue).not.toHaveBeenCalled();
   const body={campaignId:randomUUID(),recipientEmail:'synthetic@example.invalid',idempotencyKey:'synthetic',stepNumber:1,scheduledAt:new Date().toISOString()};
   const job=await server.inject({method:'POST',url:'/outbound/jobs',headers:{authorization:'Bearer '+token()},payload:body});
   expect(job.statusCode).toBe(202);expect(job.json().sendingEnabled).toBe(false);
   expect(outbound.enqueue.mock.calls[0][0].workspaceId).toBe(workspaceId);
  }finally{await app.close();}
 });
});
