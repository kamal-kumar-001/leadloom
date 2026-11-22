import {z} from 'zod';
export const ProjectAssetKindSchema=z.enum(['product_brief','research','launch_copy','outreach_draft','investor_pitch']);
export const ProjectAssetCopySchema=z.object({title:z.string().trim().min(1).max(160),body:z.string().min(1).max(40000)}).strict();
export const CreateProjectAssetSchema=ProjectAssetCopySchema.extend({requestId:z.string().uuid(),kind:ProjectAssetKindSchema}).strict();
export const ReviseProjectAssetSchema=ProjectAssetCopySchema.extend({requestId:z.string().uuid(),expectedVersion:z.number().int().min(1).max(1000000)}).strict();
export const ProjectAssetQuerySchema=z.object({q:z.string().trim().max(200).optional(),kind:ProjectAssetKindSchema.optional(),limit:z.coerce.number().int().min(1).max(50).default(20),offset:z.coerce.number().int().min(0).max(10000).default(0)}).strict();
export type CreateProjectAsset=z.infer<typeof CreateProjectAssetSchema>;
export type ReviseProjectAsset=z.infer<typeof ReviseProjectAssetSchema>;
export interface ProjectAssetSummary {id:string;projectId:string;kind:z.infer<typeof ProjectAssetKindSchema>;title:string;version:number;excerpt:string;updatedAt:string}
export interface ProjectAssetDetail extends ProjectAssetSummary {body:string;createdAt:string;currentVersion:number}
export interface ProjectAssetPage {items:ProjectAssetSummary[];nextOffset:number|null}
