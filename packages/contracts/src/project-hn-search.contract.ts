import {z} from 'zod';
/** Only explicit public query text is sent upstream. No project brief or history is sent. */
export const ProjectHnSearchSchema=z.object({query:z.string().trim().min(1).max(120).regex(/^[^\u0000-\u001f\u007f]+$/),postedAfter:z.string().datetime({offset:true}).optional(),sort:z.enum(['relevance','recent']).default('relevance')}).strict();
export type ProjectHnSearch=z.infer<typeof ProjectHnSearchSchema>;
export type ProjectHnSearchOptions=Pick<ProjectHnSearch,'postedAfter'|'sort'>;
