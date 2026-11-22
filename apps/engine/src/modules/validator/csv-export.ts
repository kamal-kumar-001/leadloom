/**
 * Safely escapes a cell value for CSV export according to RFC 4180
 * and mitigates CSV formula injection (DDE injection).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', it is prefixed with a single quote.
 */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return '""';
  let str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // Formula injection defense: prefix formula triggers with a single quote
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: wrap in quotes and escape internal quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export interface LeadCsvRow {
  id: string;
  email: string;
  name?: string | null;
  company?: string | null;
  surveyResponses?: Record<string, string> | null;
  createdAt: string | Date;
}

/**
 * Generates an RFC 4180 compliant CSV string from waitlist leads.
 * Includes defensive escaping against spreadsheet formula execution.
 */
export function formatLeadsCsv(leads: LeadCsvRow[]): string {
  const headers = ['id', 'email', 'name', 'company', 'survey_responses', 'created_at'];
  const headerRow = headers.map(escapeCsvCell).join(',');

  const dataRows = leads.map((lead) => {
    const surveyText = lead.surveyResponses && typeof lead.surveyResponses === 'object'
      ? Object.entries(lead.surveyResponses).map(([k, v]) => `${k}: ${v}`).join('; ')
      : '';

    const created = lead.createdAt instanceof Date
      ? lead.createdAt.toISOString()
      : String(lead.createdAt);

    return [
      escapeCsvCell(lead.id),
      escapeCsvCell(lead.email),
      escapeCsvCell(lead.name ?? ''),
      escapeCsvCell(lead.company ?? ''),
      escapeCsvCell(surveyText),
      escapeCsvCell(created),
    ].join(',');
  });

  return [headerRow, ...dataRows].join('\r\n');
}
