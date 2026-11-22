import type { WaitlistLeadItem } from './engine-client';

/**
 * Safely escapes a cell value for CSV export according to RFC 4180
 * and mitigates CSV formula injection (DDE injection).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', it is prefixed with a single quote.
 */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return '""';
  let str = String(value);

  // Formula injection defense: prefix formula triggers with a single quote
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: wrap in quotes and escape internal quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates an RFC 4180 compliant CSV string from captured waitlist leads.
 * Includes defensive escaping against spreadsheet formula execution.
 */
export function generateLeadsCsv(leads: WaitlistLeadItem[]): string {
  const headers = ['ID', 'Email', 'Name', 'Company', 'Survey Responses', 'Joined At'];
  const headerRow = headers.map(escapeCsvCell).join(',');

  const dataRows = leads.map((lead) => {
    const surveyText = Object.entries(lead.surveyResponses || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');

    return [
      escapeCsvCell(lead.id),
      escapeCsvCell(lead.email),
      escapeCsvCell(lead.name ?? ''),
      escapeCsvCell(lead.company ?? ''),
      escapeCsvCell(surveyText),
      escapeCsvCell(lead.createdAt),
    ].join(',');
  });

  return [headerRow, ...dataRows].join('\r\n');
}

/**
 * Initiates client-side CSV download in the browser without server roundtrip.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
