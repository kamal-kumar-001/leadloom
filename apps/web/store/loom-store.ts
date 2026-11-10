import { create } from 'zustand';
import {
  TableMetadata,
  RowRecord,
  WaterfallCellPayload,
  MOCK_TABLE_METADATA,
  MOCK_PREFLIGHT_RESPONSE,
  PreFlightEstimateResponse,
} from '@leadloom/contracts';

export interface LoomState {
  table: TableMetadata;
  rowsById: Record<string, RowRecord>;
  rowOrder: string[];
  selectedRowIds: Set<string>;
  activeCell: { rowId: string; colId: string } | null;
  inspectorRowId: string | null;
  isSequencerOpen: boolean;
  preFlightEstimate: PreFlightEstimateResponse | null;
  
  // Actions
  toggleRowSelection: (rowId: string) => void;
  selectAllRows: (select: boolean) => void;
  setActiveCell: (cell: { rowId: string; colId: string } | null) => void;
  setInspectorRowId: (rowId: string | null) => void;
  toggleSequencer: (open?: boolean) => void;
  updateCell: (rowId: string, colId: string, value: any) => void;
  runWaterfallForSelected: () => void;
}

// Generate 50 initial mock rows for high-density testing
const INITIAL_ROWS_BY_ID: Record<string, RowRecord> = {};
const INITIAL_ROW_ORDER: string[] = [];

const MOCK_COMPANIES = [
  { name: 'Vercel', domain: 'vercel.com', signal: '[GH] +140 stars/wk', email: 'alex@vercel.com', prov: 'hunter', latency: 142 },
  { name: 'Supabase', domain: 'supabase.com', signal: '[Job] +3 Rust Eng', email: 'paul@supabase.co', prov: 'apollo', latency: 98 },
  { name: 'Railway', domain: 'railway.app', signal: '[Web] Pricing change', email: 'tito@railway.app', prov: 'dropcontact', latency: 210 },
  { name: 'Linear', domain: 'linear.app', signal: '[News] Series B', email: 'karri@linear.app', prov: 'hunter', latency: 120 },
  { name: 'Modal', domain: 'modal.com', signal: '[Job] ML Infra Staff', email: null, prov: null, latency: null },
  { name: 'Resend', domain: 'resend.com', signal: '[GH] v2 Released', email: 'zeno@resend.com', prov: 'hunter', latency: 115 },
  { name: 'PostHog', domain: 'posthog.com', signal: '[Job] +4 DevRel', email: 'james@posthog.com', prov: 'apollo', latency: 89 },
  { name: 'Fly.io', domain: 'fly.io', signal: '[Web] GPU cluster', email: 'kurt@fly.io', prov: 'hunter', latency: 130 },
  { name: 'Turso', domain: 'turso.tech', signal: '[GH] libSQL v0.5', email: 'glauber@turso.tech', prov: 'apollo', latency: 95 },
  { name: 'Render', domain: 'render.com', signal: '[News] Redis service', email: 'anurag@render.com', prov: 'dropcontact', latency: 180 },
];

for (let i = 0; i < 50; i++) {
  const id = `row-${i + 1}`;
  INITIAL_ROW_ORDER.push(id);
  const sample = MOCK_COMPANIES[i % MOCK_COMPANIES.length];
  
  const waterfallCell: WaterfallCellPayload = {
    value: sample.email,
    status: sample.email ? 'success' : 'running',
    confidence: sample.email ? 0.98 : 0.5,
    telemetry: sample.email
      ? {
          provider_attributed: sample.prov as any,
          tier: sample.prov === 'apollo' ? 1 : sample.prov === 'hunter' ? 2 : 3,
          latency_ms: sample.latency || 120,
          cost_microcents: sample.prov === 'apollo' ? 100 : 300,
        }
      : undefined,
    trace: sample.email
      ? [
          {
            step: 1,
            provider: 'apollo',
            status: sample.prov === 'apollo' ? 'hit' : 'miss',
            latency_ms: 85,
            cost_microcents: 100,
            verification: 'deliverable',
          },
          ...(sample.prov !== 'apollo'
            ? [
                {
                  step: 2,
                  provider: 'hunter' as const,
                  status: 'hit' as const,
                  latency_ms: 142,
                  cost_microcents: 300,
                  verification: 'deliverable' as const,
                },
              ]
            : []),
        ]
      : [],
  };

  INITIAL_ROWS_BY_ID[id] = {
    id,
    tableId: MOCK_TABLE_METADATA.id,
    orderIndex: i,
    cells: {
      'col-company': `${sample.name} ${i >= 10 ? `#${Math.floor(i / 10)}` : ''}`,
      'col-domain': sample.domain,
      'col-signal': sample.signal,
      'col-waterfall': waterfallCell,
    },
  };
}

export const useLoomStore = create<LoomState>((set, get) => ({
  table: MOCK_TABLE_METADATA,
  rowsById: INITIAL_ROWS_BY_ID,
  rowOrder: INITIAL_ROW_ORDER,
  selectedRowIds: new Set(['row-1', 'row-2', 'row-3']),
  activeCell: { rowId: 'row-1', colId: 'col-waterfall' },
  inspectorRowId: null,
  isSequencerOpen: false,
  preFlightEstimate: MOCK_PREFLIGHT_RESPONSE,

  toggleRowSelection: (rowId: string) => {
    set((state) => {
      const next = new Set(state.selectedRowIds);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return { selectedRowIds: next };
    });
  },

  selectAllRows: (select: boolean) => {
    set((state) => ({
      selectedRowIds: select ? new Set(state.rowOrder) : new Set(),
    }));
  },

  setActiveCell: (cell) => set({ activeCell: cell }),
  setInspectorRowId: (rowId) => set({ inspectorRowId: rowId }),
  toggleSequencer: (open) =>
    set((state) => ({ isSequencerOpen: open ?? !state.isSequencerOpen })),

  updateCell: (rowId: string, colId: string, value: any) => {
    set((state) => {
      const existingRow = state.rowsById[rowId];
      if (!existingRow) return state;
      return {
        rowsById: {
          ...state.rowsById,
          [rowId]: {
            ...existingRow,
            cells: {
              ...existingRow.cells,
              [colId]: value,
            },
          },
        },
      };
    });
  },

  runWaterfallForSelected: () => {
    const { selectedRowIds } = get();
    selectedRowIds.forEach((id) => {
      // Set to running
      get().updateCell(id, 'col-waterfall', {
        value: null,
        status: 'running',
        confidence: 0.5,
        trace: [],
      });

      // Simulate cascade success
      setTimeout(() => {
        get().updateCell(id, 'col-waterfall', {
          value: 'verified@loom-outreach.dev',
          status: 'success',
          confidence: 0.99,
          telemetry: {
            provider_attributed: 'hunter',
            tier: 2,
            latency_ms: 135,
            cost_microcents: 300,
          },
          trace: [
            { step: 1, provider: 'apollo', status: 'miss', latency_ms: 82, cost_microcents: 100 },
            { step: 2, provider: 'hunter', status: 'hit', latency_ms: 135, cost_microcents: 300, verification: 'deliverable' },
          ],
        });
      }, 800 + Math.random() * 600);
    });
  },
}));
