import { useState, useRef } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, XCircle, Loader2, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { AppData, ActiveView } from '../types';

interface Props {
  data: AppData;
  onImport: (newData: AppData) => void;
  onNavigate: (view: ActiveView) => void;
}

interface ImportResult {
  filename: string;
  success?: boolean;
  skipped?: boolean;
  count?: number;
  error?: string;
  reason?: string;
  format?: string;
}

export default function Upload({ data, onImport, onNavigate }: Props) {
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const el = window as unknown as {
    electron?: {
      openFileDialog: () => Promise<string[]>;
      importStatements: (paths: string[]) => Promise<{ results: ImportResult[]; data: AppData }>;
    };
  };

  async function handlePaths(filePaths: string[]) {
    if (!filePaths.length) return;
    setImporting(true);
    setResults([]);
    try {
      if (el.electron) {
        const res = await el.electron.importStatements(filePaths);
        setResults(res.results);
        onImport(res.data);
      } else {
        // Browser fallback: show simulated result
        setResults(filePaths.map((p) => ({
          filename: p.split('/').pop() ?? p,
          success: false,
          error: 'Electron not available — run in desktop app to import PDFs',
        })));
      }
    } catch (e) {
      setResults([{ filename: 'Import failed', success: false, error: String(e) }]);
    } finally {
      setImporting(false);
    }
  }

  async function openDialog() {
    if (!el.electron) return;
    const paths = await el.electron.openFileDialog();
    handlePaths(paths);
  }

  // Drag & drop (desktop only — paths available via electron IPC after drop)
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() { setDragOver(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    // In Electron, files have a path property
    const paths: string[] = [];
    for (const f of Array.from(e.dataTransfer.files)) {
      const p = (f as { path?: string }).path;
      if (p) paths.push(p);
    }
    if (paths.length) handlePaths(paths);
  }

  const successCount = results.filter((r) => r.success).length;
  const totalNew = results.filter((r) => r.success).reduce((s, r) => s + (r.count ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Statements</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload bank statements — PDF (Navy Federal) or CSV (any bank)
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openDialog}
        className={`card flex flex-col items-center justify-center gap-4 p-12 cursor-pointer transition-all duration-200 mb-6
          ${dragOver ? 'border-2 border-primary bg-blue-50' : 'border-2 border-dashed border-gray-200 hover:border-primary hover:bg-blue-50/30'}`}
      >
        {importing ? (
          <>
            <Loader2 size={40} className="text-primary animate-spin" />
            <div className="text-center">
              <p className="text-gray-700 font-medium">Parsing statements…</p>
              <p className="text-gray-400 text-sm">Extracting and categorizing transactions</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <UploadIcon size={26} className="text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-semibold">Drop files here or click to browse</p>
              <p className="text-gray-400 text-sm mt-1">PDF and CSV statements supported</p>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                <FileText size={11} /> PDF — Navy Federal
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                <FileSpreadsheet size={11} /> CSV — Chase, BofA, Capital One, Citi &amp; more
              </span>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.csv" multiple className="hidden" />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Import Results</h3>
            {successCount > 0 && (
              <span className="text-xs text-emerald-600 font-medium">
                {successCount} imported · {totalNew} new transactions
              </span>
            )}
          </div>
          <ul className="divide-y divide-gray-50">
            {results.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{r.filename}</p>
                  {r.success && (
                    <p className="text-xs text-gray-400">
                      {r.count} transactions · {r.format?.startsWith('csv') ? `CSV (${r.format.replace('csv-', '')})` : 'PDF'}
                    </p>
                  )}
                  {r.skipped && (
                    <p className="text-xs text-amber-500">{r.reason}</p>
                  )}
                  {r.error && (
                    <p className="text-xs text-red-500">{r.error}</p>
                  )}
                </div>
                {r.success && <CheckCircle size={16} className="text-emerald-500 shrink-0" />}
                {r.skipped && <span className="text-xs text-amber-500 shrink-0">Skipped</span>}
                {r.error && <XCircle size={16} className="text-red-400 shrink-0" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Already imported statements */}
      {data.statements.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              Previously Imported ({data.statements.length})
            </h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.statements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{s.filename}</p>
                  <p className="text-xs text-gray-400">
                    {s.transactionCount} transactions · Imported {new Date(s.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* After import CTA */}
      {successCount > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => onNavigate('transactions')}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Categorize Transactions <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
