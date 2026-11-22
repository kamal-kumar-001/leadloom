export interface ProviderSessionProof { authTime?: number }
/** Original provider sign-in time, never bridge mint time or rolling JWT iat.
 * Missing proof is accepted only before any credential revocation exists.
 */
export function providerSessionAfterCutoff(proof:ProviderSessionProof,cutoff:Date|null,now=Date.now()):boolean{
 if(!cutoff)return true;
 const seconds=proof.authTime;
 if(typeof seconds!=='number'||!Number.isSafeInteger(seconds)||seconds<=0||seconds*1000>now+30_000)return false;
 // NextAuth/provider sign-in is second-granularity. Equality fails closed.
 return seconds*1000>cutoff.getTime();
}
