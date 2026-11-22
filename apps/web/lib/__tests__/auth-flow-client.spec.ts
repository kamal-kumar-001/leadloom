import {afterEach,it,expect,vi} from 'vitest';
import {callAuthFlow} from '../../components/auth/auth-flow-client';
afterEach(()=>vi.unstubAllGlobals());
it.each(['register','forgot-password','reset-password'] as const)('temporary503 during %s is not called unavailable signup functionality',async action=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Email sending is not available'}),{status:503,headers:{'content-type':'application/json'}})));
 const result=await callAuthFlow(action,{email:'synthetic@example.invalid'});expect(result.ok).toBe(false);expect(result.status).toBe(503);expect(result.error).toBe('Authentication service is temporarily unavailable. Try again shortly.');expect(result.error).not.toContain('sign-up');
});
it('wrong-code rejection and rate limit retain their actionable status instead of becoming a verified login',async()=>{
 for(const status of [400,429]){vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Synthetic rejection'}),{status})));const result=await callAuthFlow('verify-email',{email:'synthetic@example.invalid',code:'000000'});expect(result.ok).toBe(false);expect(result.status).toBe(status);expect(result.error).toBe('Synthetic rejection');}
});
