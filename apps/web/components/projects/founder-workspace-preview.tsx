import React from 'react';
import {FounderWorkspaceSchema,type ProjectAssetDetail} from '@leadloom/contracts';
export function FounderWorkspacePreview({asset}:{asset:ProjectAssetDetail|null}){
 if(!asset)return null;let value:unknown;try{value=JSON.parse(asset.body);}catch{return null;}const parsed=FounderWorkspaceSchema.safeParse(value);if(!parsed.success)return null;const w=parsed.data;
 return <section data-testid="founder-workspace-preview" className="rounded-lg border border-border-subtle p-4 space-y-3">
  <h3 className="text-sm font-semibold">Founder workspace: {w.brief.name} · saved version {asset.version}</h3>
  <p className="text-xs text-text-secondary">Saved coordination, not unsaved editor changes. The customer coding agent does the work. Leadloom does not start or control workers. Completion below is caller-reported, not independently verified.</p>
  <p className="text-sm whitespace-pre-wrap break-words">{w.brief.problem}</p>
  <ol className="grid sm:grid-cols-2 gap-2 text-xs">{w.tasks.map(t=><li key={t.id} className="border border-border-subtle rounded p-2"><span className="font-medium">{t.id}</span>: {t.state.replaceAll('_',' ')}{t.workerId?' · '+t.workerId:''}</li>)}</ol>
  <p className="text-xs text-text-secondary">Read the latest workspace with the downloaded CLI to get validated ready tasks. Exact-version repo export creates a private document scaffold, not a built app, simulation, permission or launch.</p>
  {!!w.reports?.length&&<div className="text-xs text-text-secondary"><p>Exact linked report references. Source/result digests are checked during linking/export, not this coordination view. Caller judgments are not verified demand or execution.</p><ul className="mt-1 space-y-1">{w.reports.map(r=><li key={r.kind+':'+r.assetId+':'+r.version} className="break-all">{r.kind} · {r.assetId} · version {r.version}</li>)}</ul></div>}
  <code className="block text-xs break-all">node cli.mjs founder get {asset.id}</code>
  <p className="text-xs text-text-muted">Public-source intake: {w.brief.evidence.filter(e=>e.provenance==='caller_reported_public').length} caller-reported observations, not fetched or verified here. Synthetic entries are not customers or demand. Other-project state is never inferred from this view.</p>
 </section>;
}
