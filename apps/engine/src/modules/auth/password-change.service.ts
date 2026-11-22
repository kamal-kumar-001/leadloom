import {hashPassword,verifyPassword} from './password';
export interface PasswordStore {
 $executeRawUnsafe(sql:string,...params:unknown[]):Promise<number>;
 user:{findUnique(args:unknown):Promise<{email:string;passwordHash:string|null;disabledAt:Date|null;sessionVersion:number}|null>;
 updateMany(args:unknown):Promise<{count:number}>};
}
export type PasswordChangeResult={ok:true}|{ok:false;status:number;error:string};
/** Persistence must be present; prove current password, CAS the credential/version,
 * and let the caller require sign-in again. No false success in missing-store mode.
 */
export async function changeExistingPassword(store:PasswordStore|undefined,userId:string,currentPassword:string,newPassword:string):Promise<PasswordChangeResult>{
 if(!store)return{ok:false,status:503,error:'Password service unavailable'};
 if(!newPassword||newPassword.length<10||newPassword.length>256)return{ok:false,status:400,error:'Password must be between 10 and 256 characters'};
 const user=await store.user.findUnique({where:{id:userId},select:{email:true,passwordHash:true,disabledAt:true,sessionVersion:true}});
 if(!user)return{ok:false,status:404,error:'User not found'};
 if(user.disabledAt!==null)return{ok:false,status:403,error:'Account is disabled'};
 // Provider-only identities must use the existing emailed reset-code flow to add a password.
 // A long-lived provider session alone is not fresh proof for a credential change.
 if(!user.passwordHash)return{ok:false,status:409,error:'Use Forgot password to verify your email before setting an initial password'};
 if(!currentPassword)return{ok:false,status:400,error:'Current password is required to update credentials'};
 if(!await verifyPassword(currentPassword,user.passwordHash))return{ok:false,status:401,error:'Current password is incorrect'};
 const local=user.email.split('@')[0];
 if(newPassword.toLowerCase().includes(user.email.toLowerCase())||(local.length>=4&&newPassword.toLowerCase()===local.toLowerCase()))return{ok:false,status:400,error:'Password must not contain your email'};
 const hash=await hashPassword(newPassword);
 const changed=await store.$executeRawUnsafe('UPDATE users SET password_hash=$2, session_version=session_version+1, credentials_revoked_at=clock_timestamp(), updated_at=clock_timestamp() WHERE id=$1::uuid AND password_hash=$3 AND session_version=$4 AND disabled_at IS NULL',userId,hash,user.passwordHash,user.sessionVersion);
 if(changed!==1)return{ok:false,status:409,error:'Credentials changed during this request. Sign in again before retrying'};
 return{ok:true};
}
