'use client';

import React, { useState } from 'react';
import { SpotlightCard, Badge } from '@leadloom/ui';
import { DollarSign, ArrowRight, ShieldCheck } from 'lucide-react';

export function SavingsCalculator() {
  const [contacts, setContacts] = useState(25000);

  // Proprietary SaaS credits calculate around $0.05/credit with markups + subscription tier
  const proprietaryCost = Math.round(350 + contacts * 0.04);

  // LeadLoom BYOK raw wholesale API cost (Apollo ~$0.001, Hunter ~$0.003, with cache savings)
  const leadloomCost = Math.round(contacts * 0.0028);

  const annualSavings = (proprietaryCost - leadloomCost) * 12;

  return (
    <section className="py-14 sm:py-20 border-t border-border-subtle relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="matrix" className="mb-3">
            Wholesale Data Transparency
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            Why pay a middleman markup on your own data?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-text-secondary">
            Credit-based platforms resell provider data at their own prices. This estimator is illustrative, not a quote - adjust the volume and check each provider's current pricing.
          </p>
        </div>

        {/* Range Slider Container */}
        <div className="mb-10 max-w-xl mx-auto p-6 mcard border border-border-muted bg-canvas-surface/60 backdrop-blur-sm text-center">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              Monthly Leads Enriched & Contacted
            </span>
            <span className="text-lg font-mono font-bold text-brand-loom">
              {contacts.toLocaleString()} leads
            </span>
          </div>
          <input
            type="range"
            min="2000"
            max="150000"
            step="1000"
            value={contacts}
            onChange={(e) => setContacts(Number(e.target.value))}
            className="w-full h-2 bg-canvas-elevated rounded-lg appearance-none cursor-pointer accent-brand-loom focus:outline-none"
          />
          <div className="flex justify-between text-[11px] font-mono text-text-muted mt-2">
            <span>2,000</span>
            <span>50,000</span>
            <span>100,000</span>
            <span>150,000+</span>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Card A: Proprietary SaaS */}
          <div className="p-8 rounded-xl border border-signal-failed/20 bg-canvas-surface/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-text-secondary">Credit-based platforms</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-signal-failed/10 text-signal-failed border border-signal-failed/20">
                  Marked-up credits
                </span>
              </div>
              <div className="my-6">
                <div className="text-4xl font-bold font-mono text-text-primary">
                  ${proprietaryCost.toLocaleString()}
                  <span className="text-sm font-normal text-text-muted">/month</span>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Illustrative assumption: ~$350/mo platform fee plus ~$0.04 per credit.
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-signal-failed pt-4 border-t border-border-subtle">
              ✕ Credits can run out mid-campaign
            </div>
          </div>

          {/* Card B: LeadLoom BYOK */}
          <SpotlightCard
            spotlightColor="rgba(16, 185, 129, 0.18)"
            className="border-signal-verified/40 bg-canvas-surface/80 flex flex-col justify-between shadow-2xl shadow-signal-verified/5"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-signal-verified" />
                  LeadLoom (your own keys)
                </span>
                <Badge variant="verified">Provider-direct pricing</Badge>
              </div>
              <div className="my-6">
                <div className="text-4xl font-bold font-mono text-signal-verified">
                  ${leadloomCost.toLocaleString()}
                  <span className="text-sm font-normal text-text-muted">/month</span>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Pay providers like Apollo and Hunter directly through your own keys. Illustrative assumption: ~$0.0028 per contact.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <span className="text-xs font-mono text-signal-verified flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Illustrative annual difference: ${annualSavings.toLocaleString()}
              </span>

            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
