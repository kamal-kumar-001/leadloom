import {z} from 'zod';
export const ProjectEntryKindSchema=z.enum(['decision','progress','blocker','next_step','research','note']);
export const CreateProjectEntrySchema=z.object({requestId:z.string().uuid(),kind:ProjectEntryKindSchema,title:z.string().trim().min(1).max(160),body:z.string().trim().min(1).max(6000)}).strict();
export type CreateProjectEntry=z.infer<typeof CreateProjectEntrySchema>;
export const ProjectEntryQuerySchema=z.object({q:z.string().trim().max(200).optional(),kind:ProjectEntryKindSchema.optional(),limit:z.coerce.number().int().min(1).max(50).default(20),cursor:z.string().max(400).optional()}).strict();
export type ProjectEntryKind=z.infer<typeof ProjectEntryKindSchema>;
export interface ProjectEntrySummary {id:string;projectId:string;kind:ProjectEntryKind;title:string;excerpt:string;createdAt:string}
export interface ProjectEntryDetail extends ProjectEntrySummary {body:string}
export interface ProjectEntryPage {items:ProjectEntrySummary[];nextCursor:string|null}
