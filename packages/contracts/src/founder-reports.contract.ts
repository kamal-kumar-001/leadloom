import {z} from 'zod';
export const FounderReportLinkSchema=z.object({kind:z.enum(['review','synthetic_stress']),assetId:z.string().uuid(),version:z.number().int().min(2).max(1000000)}).strict();
export const FounderLinkReportsSchema=z.object({requestId:z.string().uuid(),expectedVersion:z.number().int().min(1).max(1000000),reports:z.array(FounderReportLinkSchema).min(1).max(6)}).strict().refine(v=>new Set(v.reports.map(r=>r.kind+':'+r.assetId+':'+r.version)).size===v.reports.length,'Report references must be distinct');
export type FounderReportLink=z.infer<typeof FounderReportLinkSchema>;
export type FounderLinkReports=z.infer<typeof FounderLinkReportsSchema>;
