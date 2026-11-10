import { createHmac,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
const Claims=z.object({sub:z.string().uuid(),workspaceId:z.string().uuid(),role:z.enum(['admin','member','read_only']),exp:z.number().int().positive(),iat:z.number().int().positive().optional(),ver:z.number().int().min(0).optional()}).strict();
export type SessionClaims=z.infer<typeof Claims>;
/** Verification primitive only. An authenticated login/issuer must create tokens. */
export function verifySession(token:string,key:Buffer,now=Date.now()):SessionClaims {
 if(key.length<32) throw new Error('Session signing key must have at least 32 bytes');
 const parts=token.split('.');
 if(parts.length!==2||parts.some(p=>p.length>4096)) throw new Error('Invalid session');
 const [body,signature]=parts,expected=createHmac('sha256',key).update(body).digest();
 const actual=Buffer.from(signature,'base64url');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) throw new Error('Invalid session');
 const claims=Claims.parse(JSON.parse(Buffer.from(body,'base64url').toString('utf8')));
 if(claims.exp*1000<=now) throw new Error('Session expired');
 return claims;
}
