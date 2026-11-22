'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  X,
  FileSpreadsheet,
  SendHorizontal,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  fetchWorkspaceCampaigns,fetchWorkspaceTables,fetchSavedTableSchema,
  type WorkspaceTableRow,
  importCapturedLeads,
  type WaitlistLeadItem,
  type WorkspaceCampaignRow,
} from '../../lib/engine-client';
import { notify } from '../../lib/notify';
import {capturedTableField,type SavedTableSchema,type ImportCapturedLeadsResponse} from '@leadloom/contracts';

export interface ImportLeadsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  experimentId: string;
  leads: WaitlistLeadItem[];
  onImportSuccess?: (res: ImportCapturedLeadsResponse) => void;
}

export function ImportLeadsDialog({
  isOpen,
  onClose,
  experimentId,
  leads,
  onImportSuccess,
}: ImportLeadsDialogProps) {
  const [schemaReload,setSchemaReload]=useState(0);
  const [targetType,setTargetType]=useState<'campaign'|'table'>('campaign'),[tables,setTables]=useState<WorkspaceTableRow[]>([]),[tableId,setTableId]=useState(''),[schema,setSchema]=useState<SavedTableSchema|null>(null),[schemaLoading,setSchemaLoading]=useState(false);
  const [campaigns, setCampaigns] = useState<WorkspaceCampaignRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitting=useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Load existing draft campaigns on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingDestinations(true);
    setError(null);

    setSelectedCampaignId('');setTableId('');setSchema(null);
    Promise.all([fetchWorkspaceCampaigns(),fetchWorkspaceTables()])
      .then(([campRes,tableRes]) => {
        if (!isMounted) return;
        if(campRes.error||tableRes.error)setError([campRes.error,tableRes.error].filter(Boolean).join(' '));
        setTables(tableRes.data||[]);
        const draftCamps = (campRes.data || []).filter((c) => c.status === 'draft');
        setCampaigns(draftCamps);
        setSelectedCampaignId('');
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load destinations');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingDestinations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(()=>{let active=true;setSchema(null);if(!isOpen||targetType!=='table'||!tableId){setSchemaLoading(false);return;}setSchemaLoading(true);fetchSavedTableSchema(tableId).then(r=>{if(!active)return;if(r.data&&r.data.table.id===tableId)setSchema(r.data);else setError(r.error||'Table mapping could not be loaded');}).catch(()=>{if(active)setError('Table mapping could not be loaded');}).finally(()=>{if(active)setSchemaLoading(false);});return()=>{active=false;};},[isOpen,targetType,tableId,schemaReload]);
  const currentSchema=schema?.table.id===tableId?schema:null;
  const mapping=currentSchema?.columns.map(c=>({...c,field:c.type==='text'?capturedTableField(c.name):null}))??[];
  const canMap=mapping.some(c=>c.field==='email');
  // Keyboard navigation: Escape to close, focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape'&&!isSubmitting) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose,isSubmitting]);

  if (!isOpen) return null;

  const handleConfirmImport = async () => {
    if(submitting.current)return;
    if (targetType==='campaign'?!selectedCampaignId:!tableId||!currentSchema||!canMap) {
      setError('Choose a destination and a valid text email mapping');
      return;
    }

    submitting.current=true;setIsSubmitting(true);
    setError(null);

    try {
      const res = await importCapturedLeads(experimentId, {
        targetType,...targetType==='table'?{expectedTableRevision:currentSchema!.revision}:{},
        targetId: targetType==='campaign'?selectedCampaignId:tableId,
      });

      if (res.error || !res.data) {
        setError(res.error || 'Failed to import captured leads');
        return;
      }

      notify.success(
        targetType==='table'?`Appended ${res.data.importedCount} lead(s) to saved table "${res.data.targetName}". No sends.`:`Imported ${res.data.importedCount} lead(s) into campaign draft "${res.data.targetName}". No sends.`
      );
      if (onImportSuccess) onImportSuccess(res.data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to complete lead import');
    } finally {
      submitting.current=false;setIsSubmitting(false);
    }
  };



  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-leads-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas-overlay backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-border-subtle bg-canvas-surface shadow-lg text-text-primary overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-loom/10 border border-brand-loom/30 flex items-center justify-center text-brand-loom shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 id="import-leads-title" className="text-sm sm:text-base font-semibold">
                Import Captured Leads
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Preview and manually import {leads.length} waitlist signup(s) into your workflow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-canvas-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-signal-failed/10 border border-signal-failed/30 flex items-start gap-2.5 text-xs text-signal-failed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Destination Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-primary">
                {targetType==='campaign'?'Destination campaign draft':'Destination saved table'}
              </label>
              <Badge variant="subtle" className="text-[10px] font-mono border-brand-loom/30 text-brand-loom">
                Zero-Send Safe
              </Badge>
            </div>
            <select aria-label="Captured lead destination type" disabled={isSubmitting} value={targetType} onChange={e=>{setTargetType(e.target.value as 'campaign'|'table');setError(null);}} className="w-full p-2 rounded border border-border-subtle bg-canvas-elevated text-xs"><option value="campaign">Campaign draft</option><option value="table">Saved table (append rows)</option></select>
            {isLoadingDestinations?<p className="text-xs">Loading saved destinations...</p>:<select aria-label="Captured lead destination" disabled={isSubmitting} value={targetType==='campaign'?selectedCampaignId:tableId} onChange={e=>{targetType==='campaign'?setSelectedCampaignId(e.target.value):setTableId(e.target.value);setError(null);}} className="w-full p-2 rounded border border-border-subtle bg-canvas-elevated text-xs"><option value="">Choose an existing destination</option>{(targetType==='campaign'?campaigns:tables).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}
            <p className="text-xs text-text-muted">Lists show up to100recent saved destinations. Choose deliberately. Current experiment submissions are re-read when you confirm; the preview is not a frozen batch.</p>
            {targetType==='table'&&<section aria-label="Captured table mapping" className="text-xs border border-border-subtle rounded p-3 space-y-2"><p>Appends new rows, including duplicates on repeated imports. After an unconfirmed result, inspect the table before any deliberate retry. No automatic retry.</p>{schemaLoading?<p>Loading column mapping...</p>:currentSchema?<><p>{currentSchema.table.name}: exact destination mapping</p><ul>{mapping.map(c=><li key={c.id}>{c.name} ({c.type}): {c.field?'captured '+c.field:'left empty in new rows'}</li>)}</ul>{!canMap&&<p role="alert" className="text-signal-failed">A text Email, Email Address or Work Email column is required. No rows can be imported.</p>}</>:<p>Select a saved table to review its columns.</p>}<Button type="button" size="sm" variant="outline" disabled={isSubmitting||schemaLoading||!tableId} onClick={()=>{setError(null);setSchemaReload(n=>n+1);}}>Reload destination mapping</Button><p>Only exact documented text-column aliases map. Name means the complete stored name; Company Name maps company, never a person. Other/typed fields stay empty. Existing rows and survey answers are not changed.</p></section>}

          </div>

          {/* Import Preview Table */}
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-text-primary">Captured submission preview</span>
              <Badge variant="subtle" className="text-[10px]">
                {leads.length} stored record(s)
              </Badge>
            </div>

            <div className="max-h-36 overflow-y-auto rounded-lg border border-border-subtle text-xs">
              <table className="w-full text-left">
                <thead className="bg-canvas-elevated/80 text-text-muted font-mono text-[11px] border-b border-border-subtle sticky top-0">
                  <tr>
                    <th className="py-1.5 px-2.5 font-medium">Email</th>
                    <th className="py-1.5 px-2.5 font-medium">Name</th>
                    <th className="py-1.5 px-2.5 font-medium">Company</th>
                    <th className="py-1.5 px-2.5 font-medium">{targetType==='table'?'Survey (not imported)':'Custom fields'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-[11px]">
                  {leads.slice(0, 5).map((l, i) => (
                    <tr key={l.id || i} className="hover:bg-canvas-elevated/30">
                      <td className="py-1.5 px-2.5 font-mono text-text-primary truncate max-w-[130px]">
                        {l.email}
                      </td>
                      <td className="py-1.5 px-2.5 text-text-secondary truncate max-w-[90px]">
                        {l.name || '—'}
                      </td>
                      <td className="py-1.5 px-2.5 text-text-secondary truncate max-w-[90px]">
                        {l.company || '—'}
                      </td>
                      <td className="py-1.5 px-2.5 text-text-muted font-mono truncate max-w-[120px]">
                        {Object.keys(l.surveyResponses || {}).length > 0
                          ? JSON.stringify(l.surveyResponses)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {leads.length > 5 && (
                    <tr>
                      <td colSpan={4} className="py-1.5 px-2.5 text-center text-text-muted text-[10px]">
                        ... and {leads.length - 5} more lead(s)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Safety Notice: Zero Sends */}
          <div className="p-3 rounded-lg bg-brand-loom/10 border border-brand-loom/30 flex items-start gap-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-brand-loom shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold text-text-primary">Explicit Confirmation Required</p>
              <p className="text-text-secondary text-[11px]">
                {targetType==='table'?'This appends saved table rows only.':'This prepares campaign recipient records in draft state.'} No outbound emails, jobs, or campaigns will be dispatched or activated.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-border-subtle bg-canvas-elevated/40 shrink-0">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmImport}
            disabled={
              isSubmitting ||
              isLoadingDestinations ||
              (targetType==='campaign'?!selectedCampaignId:!tableId||schemaLoading||!currentSchema||!canMap) ||
              leads.length === 0
            }
            className="text-xs gap-1.5"
          >
            {isSubmitting ? (
              <span>Importing...</span>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Import (No Sends)</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
