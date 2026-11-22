import {z} from 'zod';
// Local aggregate observations only. This is not a social/email schedule or a send grant.
export const GrowthWatchIntervalSchema=z.number().int().min(60).max(10080);
export const CreateProjectGrowthWatchSchema=z.object({requestId:z.string().uuid(),experimentId:z.string().uuid(),intervalMinutes:GrowthWatchIntervalSchema}).strict();
export const UpdateProjectGrowthWatchSchema=z.object({expectedRevision:z.number().int().positive().safe(),state:z.enum(['active','paused']),intervalMinutes:GrowthWatchIntervalSchema.optional()}).strict();
export const ProjectGrowthWatchSchema=z.object({id:z.string().uuid(),projectId:z.string().uuid(),experimentId:z.string().uuid(),intervalMinutes:GrowthWatchIntervalSchema,state:z.enum(['active','paused','blocked']),revision:z.number().int().positive().safe(),nextDueAt:z.string().datetime(),lastCheckedAt:z.string().datetime().nullable(),lastEntryId:z.string().uuid().nullable(),blockedReason:z.enum(['access_changed','experiment_unavailable','invalid_results']).nullable(),createdAt:z.string().datetime(),updatedAt:z.string().datetime()}).strict().refine(w=>(w.state==='blocked')===(w.blockedReason!==null),'Blocked state and reason must agree');
export type CreateProjectGrowthWatch=z.infer<typeof CreateProjectGrowthWatchSchema>;
export type UpdateProjectGrowthWatch=z.infer<typeof UpdateProjectGrowthWatchSchema>;
export type ProjectGrowthWatch=z.infer<typeof ProjectGrowthWatchSchema>;
export const ProjectGrowthWatchListSchema=z.object({items:z.array(ProjectGrowthWatchSchema).max(20),workerAvailable:z.boolean()}).strict();
