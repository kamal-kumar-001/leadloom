import {PlatformOverviewCursorSchema,PlatformOverviewSchema,type PlatformOverview,type PlatformOverviewQuery} from '@leadloom/contracts';
export class InvalidPlatformCursor extends Error{}
export function platformCursor(input:PlatformOverviewQuery){
 const q=input.q??'';if(!input.cursor)return{q,after:null};
 try{
  if(!/^[A-Za-z0-9_-]+$/.test(input.cursor))throw Error('encoding');
  const bytes=Buffer.from(input.cursor,'base64url');if(bytes.toString('base64url')!==input.cursor)throw Error('canonical encoding');
  const after=PlatformOverviewCursorSchema.parse(JSON.parse(bytes.toString('utf8')));
  if(after.q!==q)throw Error('search changed');
  return{q,after};
 }catch{throw new InvalidPlatformCursor('Invalid workspace cursor. Start a new search.');}
}
const safeCount=(value:unknown)=>{if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))throw Error('Invalid platform count');const count=Number(value);if(!Number.isSafeInteger(count)||count<0)throw Error('Unsafe platform count');return count;};
/** Read-only platform metadata, never tenant bodies, credentials or a health verdict. */
export class PlatformOverviewService{
 constructor(private readonly db:any){}
 async get(input:PlatformOverviewQuery):Promise<PlatformOverview>{
  const {q,after}=platformCursor(input);
  return this.db.$transaction(async(tx:any)=>{
   const totals=(await tx.$queryRawUnsafe(`SELECT (SELECT count(*)::text FROM workspaces) AS workspaces,(SELECT count(*)::text FROM workspaces WHERE is_active) AS active_workspaces,(SELECT count(*)::text FROM users) AS users,(SELECT count(*)::text FROM projects) AS projects,(SELECT count(*)::text FROM campaigns) AS campaigns,(SELECT count(*)::text FROM outbound_jobs) AS outbound_jobs,transaction_timestamp() AS as_of`))[0];
   const rows=await tx.$queryRawUnsafe(`SELECT w.id,w.name,w.plan,w.is_active,w.created_at,to_char(w.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,(SELECT count(*)::text FROM users u WHERE u.workspace_id=w.id) AS members,(SELECT count(*)::text FROM projects p WHERE p.workspace_id=w.id) AS projects,(SELECT count(*)::text FROM campaigns c WHERE c.workspace_id=w.id) AS campaigns FROM workspaces w WHERE ($1::text='' OR strpos(lower(w.name),lower($1::text))>0) AND ($2::timestamptz IS NULL OR (w.created_at,w.id)<($2::timestamptz,$3::uuid)) ORDER BY w.created_at DESC,w.id DESC LIMIT 26`,q,after?.createdAt??null,after?.id??null);
   const page=rows.slice(0,25),last=page.at(-1);
   const nextCursor=rows.length>25&&last?Buffer.from(JSON.stringify({createdAt:last.cursor_time,id:last.id,q})).toString('base64url'):null;
   return PlatformOverviewSchema.parse({asOf:new Date(totals.as_of).toISOString(),search:q,counts:{workspaces:safeCount(totals.workspaces),activeWorkspaces:safeCount(totals.active_workspaces),users:safeCount(totals.users),projects:safeCount(totals.projects),campaigns:safeCount(totals.campaigns),outboundJobs:safeCount(totals.outbound_jobs)},workspaces:page.map((w:any)=>({id:w.id,name:w.name,storedPlan:w.plan,active:w.is_active,createdAt:new Date(w.created_at).toISOString(),members:safeCount(w.members),projects:safeCount(w.projects),campaigns:safeCount(w.campaigns)})),nextCursor,limits:[
    'Current stored metadata only, not readiness, revenue, demand, account consent, provider health or delivery.',
    'Totals cover all stored workspaces, not only the current name search. Workspace rows are a separate bounded page of up to 25.',
    'Search matches workspace names literally and case-insensitively. Cursor follows exact creation time and ID, not a frozen multi-page snapshot. New records or edits can change later pages.',
    'Stored plan is a database label, not a paid subscription or billing receipt. Active means the stored workspace access flag, not service uptime.',
    'No user emails, project bodies, credentials, contacts, recipient addresses, audit events or job message content are returned.',
    'Read-only. No tenant changes, billing action, key rotation, publication, approval or send follows this read.',
   ]});
  },{isolationLevel:'RepeatableRead'});
 }
}
