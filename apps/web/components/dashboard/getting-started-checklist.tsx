'use client';
import React from 'react';
import Link from 'next/link';
import {Card,Button,Badge} from '@leadloom/ui';
import {Check,ArrowRight} from 'lucide-react';
import {setupRecordProgress,type RecordStatus} from '../../lib/dashboard-record-status';
interface Props{projectStatus:RecordStatus;providerKeyStatus:RecordStatus;mailboxStatus:RecordStatus;tableStatus:RecordStatus;}
export function GettingStartedChecklist({projectStatus,providerKeyStatus,mailboxStatus,tableStatus}:Props){
 const steps=[
  {id:'projects',title:'Create a project',description:'Save a project for persistent context. Issue and review a scoped agent token separately on Projects. This check confirms only a project record, not agent access.',href:'/app/projects',action:'Open projects',status:projectStatus},
  {id:'keys',title:'Add a provider key, if needed',description:'A saved key does not verify a connection, confirm credits or current pricing, or enable execution.',href:'/app/settings',action:'Open settings',status:providerKeyStatus},
  {id:'mailboxes',title:'Add a mailbox, if needed',description:'A stored mailbox does not confirm connection, DNS, deliverability or permission to send.',href:'/app/mailboxes',action:'Open mailboxes',status:mailboxStatus},
  {id:'tables',title:'Create a table, if needed',description:'Import into a saved workspace table. A sample canvas is not persistent.',href:'/app/tables',action:'Open tables',status:tableStatus},
 ];
 const progress=setupRecordProgress(steps.map(s=>s.status));
 const labels:Record<RecordStatus,string>={loading:'Loading',unavailable:'Unavailable',present:'Saved record',absent:'No saved record'};
 return <Card className="p-5 sm:p-6 space-y-5" data-testid="workspace-record-checklist">
  <header className="space-y-2"><h2 className="text-base font-semibold text-text-primary">Workspace setup records</h2><p className="text-xs text-text-secondary">Stored records, not a readiness score. Provider keys, mailboxes and tables are optional for projects that do not need them.</p><p data-testid="setup-record-progress" className="text-xs text-text-muted">{progress.present} of {progress.total} record types present.{progress.unknown>0?' '+progress.unknown+' unconfirmed; no completion percentage.':' All record checks loaded.'}</p>{progress.percent!==null&&<div role="progressbar" aria-label="Stored setup record types" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 bg-canvas-elevated rounded-full overflow-hidden"><div className="h-full bg-brand-loom" style={{width:progress.percent+'%'}}/></div>}</header>
  <div className="divide-y divide-border-subtle border-t border-border-subtle">{steps.map(step=><div key={step.id} data-testid={'setup-'+step.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-text-primary">{step.title}</span><Badge variant={step.status==='present'?'verified':'subtle'} className="text-[10px]">{step.status==='present'&&<Check className="w-3 h-3 inline mr-1"/>}{labels[step.status]}</Badge></div><p className="text-xs text-text-muted mt-1 max-w-xl leading-relaxed">{step.description}</p></div><Link href={step.href} className="self-end sm:self-center shrink-0"><Button variant="outline" size="sm" className="text-xs gap-1.5">{step.action}<ArrowRight className="w-3 h-3"/></Button></Link></div>)}</div>
 </Card>;
}
