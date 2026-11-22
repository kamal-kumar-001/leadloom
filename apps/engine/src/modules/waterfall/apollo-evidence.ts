import {validEmail,validInput} from './adapters/provider-transport';

export type ApolloMatchConfidence='high'|'medium'|'low'|'none'|'unknown';
export type ApolloEmailStatus='verified'|'extrapolated'|'catchall'|'unknown'|null;

/** These opt-ins are never supplied by an HTTP caller or enabled by provider defaults. */
export const APOLLO_BASIC_LOOKUP_OPTIONS=Object.freeze({
 reveal_personal_emails:false,reveal_phone_number:false,run_waterfall_email:false,run_waterfall_phone:false,
});

const text=(value:unknown,max=255):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);

/** Avoid charged, ambiguous company-only lookups. An exact email or names plus employer is required. */
export function validApolloLookup(input:any):boolean{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 if(['domain','firstName','lastName','organizationName','email'].some(k=>input[k]!==undefined&&!text(input[k])))return false;
 if(input.email!==undefined&&!validEmail(input.email))return false;
 if(input.domain!==undefined&&!validInput({domain:input.domain}))return false;
 return Boolean(input.email)||(text(input.firstName)&&text(input.lastName)&&(Boolean(input.domain)||text(input.organizationName)));
}

export interface ApolloPersonEvidence{
 email:string|null;emailStatus:ApolloEmailStatus;matchConfidence:ApolloMatchConfidence;
 /** Local acceptance policy score, not an Apollo probability or guarantee. */
 confidence:number;
 firstName?:string;lastName?:string;title?:string;organizationName?:string;linkedinUrl?:string;
}

/** Current official response places match_confidence on person. Missing/unknown evidence stays unknown. */
export function parseApolloEvidence(raw:unknown):ApolloPersonEvidence|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Object.hasOwn(raw,'person'))return null;
 const person=(raw as any).person;
 if(person!==null&&(!person||typeof person!=='object'||Array.isArray(person)))return null;
 if(person?.email!=null&&!validEmail(person.email))return null;
 const email=person?.email??null;
 const matchConfidence:ApolloMatchConfidence=['high','medium','low','none'].includes(person?.match_confidence)?person.match_confidence:'unknown';
 const emailStatus:ApolloEmailStatus=!email?null:['verified','extrapolated','catchall'].includes(person.email_status)?person.email_status:'unknown';
 const identityScore=matchConfidence==='high'?0.95:matchConfidence==='medium'?0.7:matchConfidence==='low'?0.4:0;
 const emailScore=emailStatus==='verified'?0.95:emailStatus==='extrapolated'?0.7:emailStatus==='catchall'?0.4:0;
 const optional=(value:unknown,max=255)=>text(value,max)?value:undefined;
 return{email,emailStatus,matchConfidence,confidence:email?Math.min(identityScore,emailScore):0,
  firstName:optional(person?.first_name),lastName:optional(person?.last_name),title:optional(person?.title,512),
  organizationName:optional(person?.organization?.name),linkedinUrl:optional(person?.linkedin_url,2048)};
}
