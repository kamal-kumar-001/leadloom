import {z} from 'zod';
const count=z.number().int().nonnegative().safe();
export const PlatformOverviewQuerySchema=z.object({q:z.string().trim().max(100).regex(/^[^\0]*$/).optional(),cursor:z.string().max(1024).optional()}).strict();
export type PlatformOverviewQuery=z.infer<typeof PlatformOverviewQuerySchema>;
export const PlatformOverviewCursorSchema=z.object({createdAt:z.string().datetime(),id:z.string().uuid(),q:z.string().max(100)}).strict();
export const PlatformOverviewSchema=z.object({
 asOf:z.string().datetime(),
 counts:z.object({workspaces:count,activeWorkspaces:count,users:count,projects:count,campaigns:count,outboundJobs:count}).strict(),
 search:z.string().max(100),
 workspaces:z.array(z.object({id:z.string().uuid(),name:z.string().max(255),storedPlan:z.string().max(32),active:z.boolean(),createdAt:z.string().datetime(),members:count,projects:count,campaigns:count}).strict()).max(25),
 nextCursor:z.string().max(1024).nullable(),
 limits:z.array(z.string()).max(10),
}).strict();
export type PlatformOverview=z.infer<typeof PlatformOverviewSchema>;
