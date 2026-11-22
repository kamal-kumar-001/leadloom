'use client';

import React, { useEffect } from 'react';
import { X, Sparkles, FolderGit2, Globe, Code2, Activity, Send, FlaskConical, Keyboard } from 'lucide-react';
import { Button } from '@leadloom/ui';
import Link from 'next/link';
import {CUSTOMER_WORKFLOW_STEPS,CUSTOMER_WORKFLOW_BOUNDARY} from '../../lib/customer-workflow-guide';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpGuideModal({ isOpen, onClose }: HelpGuideModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const icons={project:FolderGit2,research:Globe,build:Code2,validation:FlaskConical,outreach:Send,growth:Activity};
  const steps=CUSTOMER_WORKFLOW_STEPS.map((s,i)=>({...s,step:String(i+1),icon:icons[s.key]}));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="LeadLoom Quick Start Guide"
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border-subtle bg-canvas-surface shadow-2xl p-6 md:p-8 space-y-6 font-sans z-10 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-loom/15 border border-brand-loom/30 flex items-center justify-center text-brand-loom">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">
                LeadLoom Platform Guide
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Project-first preparation, your coding agent, and evidence-backed next steps.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors"
            aria-label="Close guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p data-testid="workflow-guide-boundary" className="text-xs text-text-secondary leading-relaxed rounded-lg border border-border-subtle p-3">{CUSTOMER_WORKFLOW_BOUNDARY}</p>

        {/* Setup Steps */}
        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Recommended Workflow Steps
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="p-3.5 rounded-xl border border-border-subtle bg-canvas-elevated flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-canvas-surface border border-border-subtle flex items-center justify-center text-brand-loom shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                      <span className="font-mono text-brand-loom">Step {s.step}:</span>
                      <span>{s.title}</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{s.description}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">{s.links.map(link=><Link key={link.href} href={link.href} onClick={onClose} className="text-xs text-brand-loom underline underline-offset-2">{link.label}</Link>)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="p-4 rounded-xl border border-border-subtle bg-canvas-elevated/40 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <Keyboard className="h-4 w-4 text-text-muted" />
            <span>Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-text-muted">
            <div><kbd className="px-1 py-0.5 rounded border border-border-subtle bg-canvas-surface text-text-primary">⌘K</kbd> Command search</div>
            <div><kbd className="px-1 py-0.5 rounded border border-border-subtle bg-canvas-surface text-text-primary">Esc</kbd> Close popover</div>
            <div><kbd className="px-1 py-0.5 rounded border border-border-subtle bg-canvas-surface text-text-primary">↑↓</kbd> Select result</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Got it, return to workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
