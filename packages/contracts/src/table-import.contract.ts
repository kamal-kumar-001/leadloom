import {z} from 'zod';
export const ImportTableSchema=z.object({requestId:z.string().uuid(),name:z.string().trim().min(1).max(160),columns:z.array(z.string().trim().min(1).max(100)).min(1).max(30),rows:z.array(z.array(z.string().max(1000)).min(1).max(30)).min(1).max(500)}).strict().superRefine((v,ctx)=>{if(new Set(v.columns.map(c=>c.toLowerCase())).size!==v.columns.length)ctx.addIssue({code:'custom',message:'Column names must be unique',path:['columns']});if(v.rows.some(r=>r.length!==v.columns.length))ctx.addIssue({code:'custom',message:'Every row must match the header width',path:['rows']});});
export type ImportTable=z.infer<typeof ImportTableSchema>;
export interface ImportTableResult {tableId:string;name:string;importedCount:number;columnCount:number;created:boolean}
