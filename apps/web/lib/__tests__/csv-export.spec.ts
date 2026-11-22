import { describe, it, expect } from 'vitest';
import { escapeCsvCell, generateLeadsCsv } from '../csv-export';
import type { WaitlistLeadItem } from '../engine-client';

describe('CSV Export & Safe Cell Escaping', () => {
  describe('escapeCsvCell', () => {
    it('escapes regular strings with double quotes', () => {
      expect(escapeCsvCell('simple')).toBe('"simple"');
      expect(escapeCsvCell('hello world')).toBe('"hello world"');
    });

    it('handles null and undefined safely as empty quoted string', () => {
      expect(escapeCsvCell(null)).toBe('""');
      expect(escapeCsvCell(undefined)).toBe('""');
    });

    it('escapes internal double quotes by doubling them per RFC 4180', () => {
      expect(escapeCsvCell('Founder & "CEO"')).toBe('"Founder & ""CEO"""');
      expect(escapeCsvCell('He said: "Hello, World!"')).toBe('"He said: ""Hello, World!"""');
    });

    it('safely wraps commas and newlines', () => {
      expect(escapeCsvCell('ScaleUp, Inc.')).toBe('"ScaleUp, Inc."');
      expect(escapeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('mitigates formula injection (DDE) by prepending a single quote for =, +, -, @, \\t, \\r', () => {
      expect(escapeCsvCell('=1+2')).toBe("\"'=1+2\"");
      expect(escapeCsvCell('=cmd|"/C calc"!A0')).toBe("\"'=cmd|\"\"/C calc\"\"!A0\"");
      expect(escapeCsvCell('@SUM(1,2)')).toBe("\"'@SUM(1,2)\"");
      expect(escapeCsvCell('+447123456789')).toBe("\"'+447123456789\"");
      expect(escapeCsvCell('-250')).toBe("\"'-250\"");
      expect(escapeCsvCell('\ttab_prefixed')).toBe("\"'\ttab_prefixed\"");
      expect(escapeCsvCell('\rcr_prefixed')).toBe("\"'\rcr_prefixed\"");
    });
  });

  describe('generateLeadsCsv', () => {
    it('generates headers even for empty lead list', () => {
      const csv = generateLeadsCsv([]);
      expect(csv).toBe('"ID","Email","Name","Company","Survey Responses","Joined At"');
    });

    it('formats lead rows with sanitized cells and formatted survey responses', () => {
      const leads: WaitlistLeadItem[] = [
        {
          id: 'lead-1',
          email: 'founder@acme.com',
          name: 'Jane Doe',
          company: 'Acme, Corp',
          surveyResponses: { budget: '$2,500/mo', timeline: 'Immediate' },
          createdAt: '2026-11-21T01:00:00.000Z',
        },
        {
          id: 'lead-2',
          email: '-malicious@domain.com',
          name: '=cmd|calc',
          company: null,
          surveyResponses: {},
          createdAt: '2026-11-21T02:00:00.000Z',
        },
      ];

      const csv = generateLeadsCsv(leads);
      const rows = csv.split('\r\n');
      expect(rows).toHaveLength(3);

      // Header row
      expect(rows[0]).toBe('"ID","Email","Name","Company","Survey Responses","Joined At"');

      // First data row
      expect(rows[1]).toContain('"lead-1"');
      expect(rows[1]).toContain('"founder@acme.com"');
      expect(rows[1]).toContain('"Jane Doe"');
      expect(rows[1]).toContain('"Acme, Corp"');
      expect(rows[1]).toContain('"budget: $2,500/mo; timeline: Immediate"');
      expect(rows[1]).toContain('"2026-11-21T01:00:00.000Z"');

      // Second data row (formula injection test)
      expect(rows[2]).toContain('"lead-2"');
      expect(rows[2]).toContain("\"'-malicious@domain.com\"");
      expect(rows[2]).toContain("\"'=cmd|calc\"");
      expect(rows[2]).toContain('""'); // null company
    });
  });
});
