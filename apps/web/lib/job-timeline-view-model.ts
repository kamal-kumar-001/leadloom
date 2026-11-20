import type { JobTimelineEvent } from './engine-client';

/**
 * Display mapping for delivery-event timeline rows. Honesty constraints:
 * - 'scheduled' is a PLANNED send time, never a delivery ("Sent") claim.
 * - 'status_recorded' is a last record update; transition times are not
 *   separately recorded, and its note must survive to the UI.
 * - No event kind maps to a success label or tone: the current status lives
 *   on the job summary, not on any timestamped event.
 */
export interface JobTimelineEventView {
  label: string;
  tone: 'neutral' | 'active' | 'muted' | 'reply';
  detail: string | null;
}

export function jobTimelineEventView(event: JobTimelineEvent): JobTimelineEventView {
  switch (event.kind) {
    case 'queued':
      return { label: 'Queued', tone: 'neutral', detail: event.note ?? null };
    case 'scheduled':
      return { label: 'Planned send', tone: 'neutral', detail: event.note ?? 'planned time, not a delivery' };
    case 'dispatch_started':
      return { label: 'Dispatch started', tone: 'active', detail: event.note ?? null };
    case 'status_recorded':
      return { label: 'Record updated', tone: 'muted', detail: event.note ?? 'last record update' };
    case 'reply':
      return {
        label: 'Reply received',
        tone: 'reply',
        detail: event.classification ? `classified: ${event.classification}` : event.note ?? null,
      };
  }
}
