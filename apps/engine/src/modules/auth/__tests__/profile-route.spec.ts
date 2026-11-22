import {describe,it,expect} from 'vitest';
import {randomBytes,randomUUID} from 'node:crypto';
import {createApplication} from '../../../main';
import {issueSession} from '../issuer';
const key=randomBytes(32),userId=randomUUID(),workspaceId=randomUUID();
const token=issueSession({userId,workspaceId,role:'admin'},key,3600).token;
const boot=async(prisma?:any)=>{const app=await createApplication({sessionKey:key,prisma} as any);return app.getHttpAdapter().getInstance();};
const patch=(s:any,payload:any={name:'New Name'},auth=true)=>s.inject({method:'PATCH',url:'/auth/profile',headers:auth?{authorization:'Bearer '+token}:{},payload});
describe('durable profile routes',()=>{
 it('requires authentication',async()=>{const s=await boot();try{expect((await patch(s,{},false)).statusCode).toBe(401);}finally{await s.close();}});
 it('never claims success without persistence',async()=>{const s=await boot();try{expect((await patch(s)).statusCode).toBe(503);}finally{await s.close();}});
 it('rejects storage failure and zero-row writes',async()=>{for(const query of [async()=>{throw Error('fixture')},async()=>[]]){const s=await boot({$queryRawUnsafe:query});try{expect([409,503]).toContain((await patch(s)).statusCode);}finally{await s.close();}}});
 it('binds user, workspace and sanitized name, returning stored value',async()=>{let args:any[]=[];const s=await boot({$queryRawUnsafe:async(...x:any[])=>{args=x;return[{name:'New Name'}]}});try{const r=await patch(s,{name:' New Name '});expect(r.statusCode).toBe(200);expect(r.json()).toEqual({ok:true,name:'New Name'});expect(args.slice(1)).toEqual([userId,workspaceId,'New Name']);expect(args[0]).toContain('disabled_at IS NULL');}finally{await s.close();}});
 it('auth/me reads the stored profile and fails closed on read error',async()=>{for(const fail of [false,true]){const s=await boot({user:{findUnique:async()=>{if(fail)throw Error('fixture');return{name:'Persisted Name'}}}});try{const r=await s.inject({method:'GET',url:'/auth/me',headers:{authorization:'Bearer '+token}});expect(r.statusCode).toBe(fail?503:200);if(!fail)expect(r.json().name).toBe('Persisted Name');}finally{await s.close();}}});
});
