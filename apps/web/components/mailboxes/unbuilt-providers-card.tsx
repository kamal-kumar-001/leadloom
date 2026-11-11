'use client';

import React from 'react';
import { Card, Badge } from '@leadloom/ui';
import { Mail, ExternalLink, Info } from 'lucide-react';

interface UnbuiltProvider {
  id: string;
  name: string;
  category: string;
  status: string;
  description: string;
  documentationUrl?: string;
}

const UNBUILT_PROVIDERS: UnbuiltProvider[] = [
  {
    id: 'gmail-oauth',
    name: 'Gmail sign-in (OAuth)',
    category: 'Email Authentication',
    status: 'Planned',
    description:
      "Not built. Needs a Google Cloud OAuth app; Google's verification rules apply.",
    documentationUrl: 'https://support.google.com/cloud/answer/15549945',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Direct Messages',
    category: 'Social Outreach',
    status: 'Not Planned',
    description:
      'No official route for automated messages. Standard platform terms prohibit unofficial headless or automation extensions.',
    documentationUrl:
      'https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages',
  },
  {
    id: 'x-dm',
    name: 'X (formerly Twitter)',
    category: 'Social Outreach',
    status: 'Not Built',
    description:
      'Not built; access and price not verified. Provider API tiers and automation rate limits are subject to direct platform agreements.',
  },
];

export function UnbuiltProvidersCard() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">
            Alternative Channels & OAuth Status
          </h2>
          <Info className="w-3.5 h-3.5 text-text-muted" />
        </div>
        <Badge variant="subtle" className="text-[10px] font-mono">
          Honest Roadmap
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {UNBUILT_PROVIDERS.map((provider) => (
          <Card
            key={provider.id}
            className="p-4 flex flex-col justify-between space-y-3 bg-canvas-surface border-border-subtle hover:border-border-muted transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-canvas-elevated border border-border-subtle flex items-center justify-center shrink-0">
                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <span className="text-xs font-semibold text-text-primary truncate">
                    {provider.name}
                  </span>
                </div>
                <Badge variant="subtle" className="text-[10px] font-mono shrink-0">
                  {provider.status}
                </Badge>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">
                {provider.description}
              </p>
            </div>

            {provider.documentationUrl && (
              <div className="pt-2 border-t border-border-subtle/60">
                <a
                  href={provider.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-brand-loom hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-loom rounded"
                >
                  <span>Verification reference</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
