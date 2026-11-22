import {randomUUID} from 'node:crypto';
import type {CreateProjectAsset,ReviseProjectAsset,ProjectAssetDetail,ProjectAssetSummary,ProjectAssetPage} from '@leadloom/contracts';
export class AssetConflict extends Error{}
const select=`SELECT a.id,a.project_id,a.kind,a.current_version,v.version,v.title,v.body,v.created_at,a.updated_at FROM project_assets a JOIN project_asset_versions v ON v.asset_id=a.id`;
const detail=(r:any):ProjectAssetDetail=>({id:r.id,projectId:r.project_id,kind:r.kind,title:r.title,version:r.version,currentVersion:r.current_version,body:r.body,excerpt:r.body.slice(0,240),createdAt:new Date(r.created_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString()});
const summary=(r:any):ProjectAssetSummary=>{const{body,createdAt,currentVersion,...rest}=detail(r);return rest;};
/** Structured private draft storage only. No model call, upload, publication or send. */
export class ProjectAssetService{
 constructor(private readonly db:any){}
 private async previous(tx:any,workspaceId:string,projectId:string,requestId:string){return(await tx.$queryRawUnsafe(select+' WHERE a.workspace_id=$1::uuid AND a.project_id=$2::uuid AND v.request_id=$3::uuid',workspaceId,projectId,requestId))[0];}
 async create(workspaceId:string,projectId:string,userId:string,input:CreateProjectAsset){
  return this.db.$transaction(async(tx:any)=>{
   const owner=await tx.$queryRawUnsafe('SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',projectId,workspaceId);if(!owner[0])return null;
   const old=await this.previous(tx,workspaceId,projectId,input.requestId);
   if(old){if(old.version!==1||old.kind!==input.kind||old.title!==input.title||old.body!==input.body)throw new AssetConflict('Request ID already used for different asset content');return{...detail(old),replayed:true};}
   const id=randomUUID();await tx.$queryRawUnsafe('INSERT INTO project_assets(id,workspace_id,project_id,kind)VALUES($1::uuid,$2::uuid,$3::uuid,$4) RETURNING id',id,workspaceId,projectId,input.kind);
   await tx.$queryRawUnsafe('INSERT INTO project_asset_versions(asset_id,workspace_id,project_id,version,request_id,title,body,created_by_user_id)VALUES($1::uuid,$2::uuid,$3::uuid,1,$4::uuid,$5,$6,$7::uuid) RETURNING asset_id',id,workspaceId,projectId,input.requestId,input.title,input.body,userId);
   const row=(await tx.$queryRawUnsafe(select+' WHERE a.id=$1::uuid AND v.version=1',id))[0];return{...detail(row),replayed:false};
  });
 }
 async revise(workspaceId:string,projectId:string,userId:string,id:string,input:ReviseProjectAsset){
  return this.db.$transaction(async(tx:any)=>{
   const owner=await tx.$queryRawUnsafe('SELECT id FROM projects WHERE id=$1::uuid AND workspace_id=$2::uuid FOR UPDATE',projectId,workspaceId);if(!owner[0])return null;
   const assets=await tx.$queryRawUnsafe('SELECT id,current_version FROM project_assets WHERE id=$1::uuid AND workspace_id=$2::uuid AND project_id=$3::uuid FOR UPDATE',id,workspaceId,projectId);const asset=assets[0];if(!asset)return null;
   const old=await this.previous(tx,workspaceId,projectId,input.requestId);
   if(old){if(old.id!==id||old.version!==input.expectedVersion+1||old.title!==input.title||old.body!==input.body)throw new AssetConflict('Request ID already used for different asset revision');return{...detail(old),replayed:true};}
   if(asset.current_version!==input.expectedVersion)throw new AssetConflict('Asset has a newer version. Read it and reconcile before saving; your draft was not applied');
   const version=asset.current_version+1;
   await tx.$queryRawUnsafe('INSERT INTO project_asset_versions(asset_id,workspace_id,project_id,version,request_id,title,body,created_by_user_id)VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7,$8::uuid) RETURNING asset_id',id,workspaceId,projectId,version,input.requestId,input.title,input.body,userId);
   await tx.$queryRawUnsafe('UPDATE project_assets SET current_version=$2,updated_at=clock_timestamp() WHERE id=$1::uuid RETURNING id',id,version);
   const row=(await tx.$queryRawUnsafe(select+' WHERE a.id=$1::uuid AND v.version=$2',id,version))[0];return{...detail(row),replayed:false};
  });
 }
 async get(workspaceId:string,projectId:string,id:string,version?:number):Promise<ProjectAssetDetail|null>{
  const rows=await this.db.$queryRawUnsafe(select+' WHERE a.workspace_id=$1::uuid AND a.project_id=$2::uuid AND a.id=$3::uuid AND v.version=COALESCE($4::int,a.current_version)',workspaceId,projectId,id,version??null);return rows[0]?detail(rows[0]):null;
 }
 async list(workspaceId:string,projectId:string,query:{q?:string;kind?:string;limit:number;offset:number}):Promise<ProjectAssetPage>{
  const rows=await this.db.$queryRawUnsafe(`SELECT a.id,a.project_id,a.kind,v.version,v.title,left(v.body,240) AS body,a.updated_at,v.created_at FROM project_assets a JOIN project_asset_versions v ON v.asset_id=a.id AND v.version=a.current_version WHERE a.workspace_id=$1::uuid AND a.project_id=$2::uuid AND ($3::text IS NULL OR a.kind=$3) AND ($4::text='' OR strpos(lower(v.title || ' ' || v.body),lower($4))>0) ORDER BY a.updated_at DESC,a.id DESC LIMIT $5 OFFSET $6`,workspaceId,projectId,query.kind??null,query.q??'',query.limit+1,query.offset);
  return{items:rows.slice(0,query.limit).map(summary),nextOffset:rows.length>query.limit?query.offset+query.limit:null};
 }
}
