import { z } from 'zod';
import { WaterfallCellPayloadSchema } from './waterfall.contract';

export const ColumnTypeEnum = z.enum([
  'text',
  'number',
  'url',
  'email',
  'boolean',
  'waterfall',
  'ai_prompt',
  'formula',
  'intent_signal',
]);
export type ColumnType = z.infer<typeof ColumnTypeEnum>;

export const ColumnDefinitionSchema = z.object({
  id: z.string().uuid(),
  tableId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: ColumnTypeEnum,
  orderIndex: z.number().int().nonnegative(),
  width: z.number().int().min(60).max(800).default(200),
  isVisible: z.boolean().default(true),
  config: z.record(z.string(), z.any()).default({}),
});
export type ColumnDefinition = z.infer<typeof ColumnDefinitionSchema>;

export const RowRecordSchema = z.object({
  id: z.string().uuid(),
  tableId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  cells: z.record(z.string().uuid(), z.union([z.string(), z.number(), z.boolean(), WaterfallCellPayloadSchema, z.null()])),
});
export type RowRecord = z.infer<typeof RowRecordSchema>;

export const TableMetadataSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(ColumnDefinitionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TableMetadata = z.infer<typeof TableMetadataSchema>;
