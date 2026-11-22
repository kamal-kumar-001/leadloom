import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {ProjectResearchKind,ProjectResearchIndexQuery,ProjectResearchSummary,ProjectResearchPage,ProjectResearchDetail} from '@leadloom/contracts';
import {ResearchTableConflict} from './research-row-store';
import type {ResearchColumn} from './research-row-store';
export class ResearchCursorInvalid extends Error{}
const cursorSchema=z.object({v:z.literal(1),workspaceId:z.string().uuid(),projectId:z.string().uuid(),kind:z.enum(['website','intent-fixture']),search:z.string().regex(/^[a-f0-9]{64}$/),at:z.string().datetime(),id:z.string().uuid()}).strict();
const searchHash=(q:string)=>createHash('sha256').update(q.toLowerCase()).digest('hex');
const note='Current editable cells of explicitly project-owned saved research, not immutable source snapshots, live feeds, verified demand or permission for any action. Indexes contain bounded excerpts; open a row for its computed-schema fields only. savedAt is the ownership-record save time, not a source event date. Pagination is a live traversal, not a frozen export.';
const clip=(v:unknown,n:number)=>typeof v==='string'?Array.from(v).slice(0,n).join(''):'';
type OwnedRow={row_id:string;project_id:string;kind:ProjectResearchKind;created_at:Date;table_id:string};
/** Read-only index/detail over existing explicit ownership. Never infers ownership from a table name. */
export class ProjectResearchArchive{
 constructor(private readonly db:any,private readonly kind:ProjectResearchKind,private readonly columns:ReadonlyArray<ResearchColumn>){}
 private async values(tx:any,rows:OwnedRow[],full:boolean):Promise<Map<string,Record<string,unknown>>>{
  const result=new Map<string,Record<string,unknown>>();if(!rows.length)return result;
  const tableIds=[...new Set(rows.map(r=>r.table_id))];
  const stored=await tx.column.findMany({where:{tableId:{in:tableIds}}});
  const expectedIds:string[]=[];const nameById=new Map<string,string>();
  const summaryNames=this.kind==='website'?['Domain','Source','Relevance reasons']:['Company','Source','Sample titles'];
  for(const tableId of tableIds)for(const expected of this.columns){
   const found=stored.filter((c:any)=>c.tableId===tableId&&c.name===expected.name);
   if(found.length!==1||found[0].type!==expected.type)throw new ResearchTableConflict('Saved research schema changed. Restore its unique computed-field names/types before reading this archive.');
   if(full||summaryNames.includes(expected.name)){expectedIds.push(found[0].id);nameById.set(found[0].id,expected.name);}
  }
  for(const row of rows)result.set(row.row_id,Object.create(null));
  if(full){
   const cells=await tx.cell.findMany({where:{tableId:{in:tableIds},rowId:{in:rows.map(r=>r.row_id)},columnId:{in:expectedIds}}});
   for(const cell of cells){const name=nameById.get(cell.columnId);if(name&&result.has(cell.rowId))result.get(cell.rowId)![name]=cell.value;}
   for(const value of result.values())if(Buffer.byteLength(JSON.stringify(value),'utf8')>65536)throw new ResearchTableConflict('Saved research detail exceeds the 64KB field-value bound. Inspect and repair that row in Tables.');
  }else{
   // Bound text before crossing the database port. Custom columns never enter either response.
   const cells=await tx.$queryRawUnsafe('SELECT row_id,column_id,left(value #>> $4::text[],240) AS text_value FROM cells WHERE table_id=ANY($1::uuid[]) AND row_id=ANY($2::uuid[]) AND column_id=ANY($3::uuid[])',tableIds,rows.map(r=>r.row_id),expectedIds,[]);
   for(const cell of cells){const name=nameById.get(cell.column_id);if(name&&result.has(cell.row_id))result.get(cell.row_id)![name]=cell.text_value;}
  }
  return result;
 }
 private summary(row:OwnedRow,values:Record<string,unknown>):ProjectResearchSummary{
  return{rowId:row.row_id,projectId:row.project_id,kind:this.kind,title:clip(values[this.kind==='website'?'Domain':'Company'],200)||'Untitled saved research',source:clip(values.Source,160)||null,excerpt:clip(values[this.kind==='website'?'Relevance reasons':'Sample titles'],240),savedAt:new Date(row.created_at).toISOString()};
 }
 async search(workspaceId:string,projectId:string,query:ProjectResearchIndexQuery):Promise<ProjectResearchPage>{
  let cursor:z.infer<typeof cursorSchema>|null=null;
  if(query.kind!==this.kind)throw new ResearchCursorInvalid();
  if(query.cursor){try{cursor=cursorSchema.parse(JSON.parse(Buffer.from(query.cursor,'base64url').toString('utf8')));}catch{throw new ResearchCursorInvalid();}
   if(cursor.workspaceId!==workspaceId||cursor.projectId!==projectId||cursor.kind!==this.kind||cursor.search!==searchHash(query.q))throw new ResearchCursorInvalid();}
  return this.db.$transaction(async(tx:any)=>{
   const rows:OwnedRow[]=await tx.$queryRawUnsafe(`SELECT p.row_id,p.project_id,p.kind,p.created_at,r.table_id
    FROM research_row_projects p JOIN rows r ON r.id=p.row_id JOIN tables t ON t.id=r.table_id
    WHERE p.workspace_id=$1::uuid AND p.project_id=$2::uuid AND p.kind=$3 AND t.workspace_id=$1::uuid
      AND ($4::text='' OR EXISTS(SELECT 1 FROM cells c JOIN columns col ON col.id=c.column_id AND col.table_id=c.table_id
        WHERE c.row_id=r.id AND c.table_id=r.table_id AND col.name=ANY($5::text[]) AND strpos(lower(coalesce(c.value #>> '{}'::text[],'')),lower($4))>0))
      AND ($6::timestamptz IS NULL OR (p.created_at,p.row_id)<($6::timestamptz,$7::uuid))
    ORDER BY p.created_at DESC,p.row_id DESC LIMIT $8`,workspaceId,projectId,this.kind,query.q,this.columns.map(c=>c.name),cursor?.at??null,cursor?.id??null,query.limit+1);
   const more=rows.length>query.limit,page=rows.slice(0,query.limit),values=await this.values(tx,page,false),last=page.at(-1);
   return{items:page.map(r=>this.summary(r,values.get(r.row_id)!)),nextCursor:more&&last?Buffer.from(JSON.stringify({v:1,workspaceId,projectId,kind:this.kind,search:searchHash(query.q),at:new Date(last.created_at).toISOString(),id:last.row_id})).toString('base64url'):null,note};
  },{isolationLevel:'RepeatableRead'});
 }
 async get(workspaceId:string,projectId:string,rowId:string):Promise<ProjectResearchDetail|null>{
  return this.db.$transaction(async(tx:any)=>{
   const rows:OwnedRow[]=await tx.$queryRawUnsafe(`SELECT p.row_id,p.project_id,p.kind,p.created_at,r.table_id FROM research_row_projects p
    JOIN rows r ON r.id=p.row_id JOIN tables t ON t.id=r.table_id
    WHERE p.workspace_id=$1::uuid AND p.project_id=$2::uuid AND p.kind=$3 AND p.row_id=$4::uuid AND t.workspace_id=$1::uuid`,workspaceId,projectId,this.kind,rowId);
   if(!rows[0])return null;const values=(await this.values(tx,rows,true)).get(rowId)!;
   return{...this.summary(rows[0],values),values,note};
  },{isolationLevel:'RepeatableRead'});
 }
}
