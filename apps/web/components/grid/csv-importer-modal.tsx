'use client';

import React, { useState, useRef } from 'react';
import { Button, Badge } from '@leadloom/ui';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Database,
  Sparkles,
} from 'lucide-react';
import { notify } from '../../lib/notify';

interface CsvImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: Array<{ company: string; domain: string; signal?: string }>) => void;
}

export function CsvImporterModal({
  isOpen,
  onClose,
  onImport,
}: CsvImporterModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [companyCol, setCompanyCol] = useState<string>('');
  const [domainCol, setDomainCol] = useState<string>('');
  const [signalCol, setSignalCol] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parseCsvText = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      notify.error('CSV file must have at least a header row and one data row.');
      return;
    }

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const parsedHeaders = lines[0]
      .split(delimiter)
      .map((h) => h.replace(/^["']|["']$/g, '').trim());

    const parsedData: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim());
      if (row.length === parsedHeaders.length || row.some((c) => c.length > 0)) {
        parsedData.push(row);
      }
    }

    setHeaders(parsedHeaders);
    setRawRows(parsedData);

    // Smart header auto-detection
    parsedHeaders.forEach((h) => {
      const lower = h.toLowerCase();
      if (!companyCol && (lower.includes('company') || lower.includes('organization') || lower.includes('name'))) {
        setCompanyCol(h);
      }
      if (!domainCol && (lower.includes('domain') || lower.includes('website') || lower.includes('url') || lower.includes('site'))) {
        setDomainCol(h);
      }
      if (!signalCol && (lower.includes('signal') || lower.includes('note') || lower.includes('source') || lower.includes('trigger'))) {
        setSignalCol(h);
      }
    });

    setStep('mapping');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    setFile(uploaded);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(uploaded);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    setFile(dropped);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(dropped);
  };

  const getMappedRows = () => {
    const companyIdx = headers.indexOf(companyCol);
    const domainIdx = headers.indexOf(domainCol);
    const signalIdx = headers.indexOf(signalCol);

    return rawRows.map((row) => ({
      company: companyIdx >= 0 ? row[companyIdx] || 'Unknown Company' : 'Unknown Company',
      domain: domainIdx >= 0 ? row[domainIdx] || 'example.com' : 'example.com',
      signal: signalIdx >= 0 ? row[signalIdx] : '[CSV] Custom Target',
    }));
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyCol || !domainCol) {
      notify.error('Please map both Company and Domain columns.');
      return;
    }
    setStep('preview');
  };

  const handleExecuteImport = () => {
    const mapped = getMappedRows();
    onImport(mapped);
    notify.success(`Successfully imported ${mapped.length} targets into virtual grid.`);
    onClose();
  };

  const mappedPreview = getMappedRows().slice(0, 5);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-importer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in font-sans"
    >
      <div className="bg-canvas-surface border border-border-strong rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-canvas-muted/40">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-brand-loom/10 border border-brand-loom/20 flex items-center justify-center text-brand-loom">
              <UploadCloud className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-text-primary text-sm">
                Import CSV Target Accounts
              </h3>
              <p className="text-[11px] text-text-muted">
                Add target accounts directly into the 50,000-row virtual grid
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-canvas-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Steps */}
        <div className="p-6">
          {step === 'upload' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border-subtle hover:border-brand-loom/50 rounded-xl p-8 text-center cursor-pointer transition-colors bg-canvas-muted/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 text-brand-loom mx-auto mb-3 opacity-80" />
              <h4 className="font-semibold text-sm text-text-primary mb-1">
                Drop your CSV or Click to Browse
              </h4>
              <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
                Supports CSV or TSV files with columns for Company, Domain, or Intent signals.
              </p>
              <Badge variant="subtle" className="text-[11px] font-mono">
                50,000 max rows per batch
              </Badge>
            </div>
          )}

          {step === 'mapping' && (
            <form onSubmit={handleProceedToPreview} className="space-y-4" noValidate>
              <div className="flex items-center justify-between text-xs text-text-muted pb-2 border-b border-border-subtle">
                <span>File: <strong className="text-text-primary font-mono">{file?.name}</strong></span>
                <span>Detected: <strong className="text-text-primary font-mono">{rawRows.length} rows</strong></span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Company Name Column <span className="text-signal-catchall">*</span>
                  </label>
                  <select
                    value={companyCol}
                    onChange={(e) => setCompanyCol(e.target.value)}
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
                  >
                    <option value="">-- Select Header --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Domain / Website Column <span className="text-signal-catchall">*</span>
                  </label>
                  <select
                    value={domainCol}
                    onChange={(e) => setDomainCol(e.target.value)}
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
                  >
                    <option value="">-- Select Header --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Intent Signal or Notes Column <span className="text-text-muted">(Optional)</span>
                  </label>
                  <select
                    value={signalCol}
                    onChange={(e) => setSignalCol(e.target.value)}
                    className="w-full bg-canvas border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-loom"
                  >
                    <option value="">-- None (Default Signal) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('upload')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className=" gap-1.5"
                >
                  Preview Mapping
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </form>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border-subtle">
                <span className="text-text-muted">
                  First 5 rows mapped preview ({rawRows.length} total rows)
                </span>
                <Badge variant="matrix" className="text-[10px]">
                  Ready to ingest
                </Badge>
              </div>

              <div className="border border-border-subtle rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-canvas-muted text-text-muted border-b border-border-subtle font-mono text-[11px]">
                    <tr>
                      <th className="p-2.5">Company</th>
                      <th className="p-2.5">Domain</th>
                      <th className="p-2.5">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {mappedPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-canvas-muted/40">
                        <td className="p-2.5 font-medium text-text-primary">{row.company}</td>
                        <td className="p-2.5 font-mono text-text-muted">{row.domain}</td>
                        <td className="p-2.5 text-text-muted">{row.signal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('mapping')}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteImport}
                  className=" gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  Import {rawRows.length} Rows
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
