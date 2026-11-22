import {z} from 'zod';
export const ProjectResearchKindSchema=z.enum(['website','intent-fixture']);
export const ProjectResearchIndexQuerySchema=z.object({kind:ProjectResearchKindSchema,q:z.string().trim().max(200).default(''),limit:z.coerce.number().int().min(1).max(20).default(10),cursor:z.string().regex(/^[A-Za-z0-9_-]+$/).max(1000).optional()}).strict();
export const ProjectResearchDetailQuerySchema=z.object({kind:ProjectResearchKindSchema}).strict();
export type ProjectResearchKind=z.infer<typeof ProjectResearchKindSchema>;
export type ProjectResearchIndexQuery=z.infer<typeof ProjectResearchIndexQuerySchema>;
export interface ProjectResearchSummary {rowId:string;projectId:string;kind:ProjectResearchKind;title:string;source:string|null;excerpt:string;savedAt:string}
export interface ProjectResearchPage {items:ProjectResearchSummary[];nextCursor:string|null;note:string}
export interface ProjectResearchDetail extends ProjectResearchSummary {values:Record<string,unknown>;note:string}
