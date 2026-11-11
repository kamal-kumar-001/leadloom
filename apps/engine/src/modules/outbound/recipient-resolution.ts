/**
 * Per-recipient message resolution (G9-corrected contract prerequisite).
 *
 * A reviewer must approve the message a specific person will receive, not a
 * template with variables. Resolution is STRICT: an unknown variable or a
 * missing/empty value is an error, never a silent blank or a leftover {{tag}}.
 */

export interface RecipientFields {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  title?: string | null;
  customFields?: Record<string, unknown>;
}

/** Variables a template may use, mapped from recipient fields. 'name' and 'company' are documented aliases. */
export const SUPPORTED_VARIABLES = ['email', 'first_name', 'last_name', 'company_name', 'title', 'name', 'company'] as const;

export type ResolutionResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; errors: string[] };

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function valueFor(variable: string, fields: RecipientFields): string | null {
  switch (variable) {
    case 'email':
      return fields.email;
    case 'first_name':
    case 'name':
      return fields.firstName?.trim() || null;
    case 'last_name':
      return fields.lastName?.trim() || null;
    case 'company_name':
    case 'company':
      return fields.companyName?.trim() || null;
    case 'title':
      return fields.title?.trim() || null;
    default: {
      const custom = fields.customFields ?? {};
      if (Object.prototype.hasOwnProperty.call(custom, variable)) {
        const v = custom[variable];
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number' && Number.isFinite(v)) return String(v);
      }
      return null;
    }
  }
}

function resolveOne(template: string, fields: RecipientFields, errors: string[], label: string): string {
  return template.replace(VARIABLE_RE, (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    const value = valueFor(name, fields);
    if (value === null) {
      const known = (SUPPORTED_VARIABLES as readonly string[]).includes(name) || Object.prototype.hasOwnProperty.call(fields.customFields ?? {}, name);
      errors.push(known ? `${label}: variable '{{${name}}}' has no value for this recipient` : `${label}: unknown variable '{{${name}}}'`);
      return _match;
    }
    return value;
  });
}

/** Resolve subject + body templates for one recipient. Fails closed on any unresolved variable. */
export function resolveRecipientMessage(
  step: { subject: string; bodyTemplate: string },
  fields: RecipientFields,
): ResolutionResult {
  const errors: string[] = [];
  const subject = resolveOne(step.subject ?? '', fields, errors, 'subject');
  const body = resolveOne(step.bodyTemplate ?? '', fields, errors, 'body');
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, subject, body };
}
