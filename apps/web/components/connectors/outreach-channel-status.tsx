'use client';

import React, { useEffect, useState } from 'react';
import { Badge, Card } from '@leadloom/ui';
import { fetchConnectorStatus, ConnectorStatusItem } from '../../lib/engine-client';

const STATE_LABEL: Record<ConnectorStatusItem['state'], string> = {
  login_verify_only: 'Login check only',
  not_built: 'Not built',
  partner_limited: 'Partner-limited',
  unverified: 'Unverified',
};

/** Outreach channels as reported by the engine at request time. Sending is off for all of them. */
export function OutreachChannelStatus() {
  const [items, setItems] = useState<ConnectorStatusItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchConnectorStatus().then((r) => {
      if (!mounted) return;
      if (r.error) setError(r.error);
      else setItems(r.connectors);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section aria-labelledby="outreach-status-heading" className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 id="outreach-status-heading" className="text-sm font-semibold text-text-primary">
          Outreach channels
        </h2>
        <Badge variant="subtle" className="text-[10px] font-mono">Live from engine. Sending not enabled.</Badge>
      </div>
      {error && <p className="text-xs text-text-muted">Could not load channel status: {error}</p>}
      {!items && !error && <p className="text-xs text-text-muted">Loading channel status...</p>}
      {items && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {items.map((c) => (
            <Card key={c.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-text-primary">{c.name}</span>
                <Badge variant="muted" className="text-[10px] font-mono shrink-0">{STATE_LABEL[c.state]}</Badge>
              </div>
              <p className="text-[11px] text-text-muted">{c.note}</p>
              {c.id === 'smtp_imap' && (
                <p className="text-[11px] text-text-secondary">
                  {c.enabled ? 'Connecting is enabled on this server.' : 'Connecting is disabled on this server.'}
                </p>
              )}
              {c.reference && (
                <a href={c.reference} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-loom underline">
                  Source
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
