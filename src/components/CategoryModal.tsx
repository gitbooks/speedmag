import { useState, useEffect } from 'react';
import { X, ChevronDown, Eye, CheckSquare, Square } from 'lucide-react';
import type { Transaction, TransactionCategory } from '../types';

interface Props {
  transaction: Transaction;
  similarTransactions: Transaction[]; // other transactions with similar descriptions (excludes current)
  uncategorizedRemaining: number;
  allBusinessCategories: string[];
  onSave: (
    updates: { category: TransactionCategory; businessCategory: string | null },
    applyToIds: string[]  // IDs to apply to beyond the current transaction
  ) => void;
  onSaveAndNext: (
    updates: { category: TransactionCategory; businessCategory: string | null },
    applyToIds: string[]
  ) => void;
  onClose: () => void;
}

const CATEGORIES: { value: TransactionCategory; label: string; desc: string }[] = [
  { value: 'Business',      label: 'Business',      desc: 'Tax-deductible business transaction' },
  { value: 'Personal',      label: 'Personal',      desc: 'Personal, non-business expense or income' },
  { value: 'Transfer',      label: 'Transfer',      desc: 'Internal account transfer — excluded from reports' },
  { value: 'Uncategorized', label: 'Uncategorized', desc: 'Review later' },
];

export default function CategoryModal({
  transaction: t,
  similarTransactions,
  uncategorizedRemaining,
  allBusinessCategories,
  onSave,
  onSaveAndNext,
  onClose,
}: Props) {
  const [category, setCategory]         = useState<TransactionCategory>(t.category);
  const [bizCat, setBizCat]             = useState<string | null>(t.businessCategory);
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // Reset everything when transaction changes (Save & Next)
  useEffect(() => {
    setCategory(t.category);
    setBizCat(t.businessCategory);
    setApplyToSimilar(false);
    setShowPreview(false);
    setSelectedIds(new Set(similarTransactions.map((s) => s.id)));
  }, [t.id]);

  // When similar list changes, reset selection to all
  useEffect(() => {
    setSelectedIds(new Set(similarTransactions.map((s) => s.id)));
  }, [similarTransactions.length]);

  const updates = { category, businessCategory: category === 'Business' ? bizCat : null };
  const isValid = category !== 'Business' || !!bizCat;
  const applyToIds = applyToSimilar ? Array.from(selectedIds) : [];

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll()   { setSelectedIds(new Set(similarTransactions.map((s) => s.id))); }
  function deselectAll() { setSelectedIds(new Set()); }

  const catColors: Record<string, string> = {
    Business:      'border-blue-500 bg-blue-50',
    Personal:      'border-purple-500 bg-purple-50',
    Transfer:      'border-amber-500 bg-amber-50',
    Uncategorized: 'border-gray-300 bg-gray-50',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full mx-4 fade-up flex gap-0 overflow-hidden
        ${showPreview ? 'max-w-3xl' : 'max-w-md'}`}
        style={{ maxHeight: '90vh' }}
      >

        {/* ── Left panel: categorize ─────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Categorize Transaction</h2>
              {uncategorizedRemaining > 0 && (
                <p className="text-xs text-amber-600 font-medium mt-0.5">
                  {uncategorizedRemaining} uncategorized remaining
                </p>
              )}
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Transaction info */}
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 shrink-0">
            <p className="text-sm font-medium text-gray-800 break-words mb-1">{t.description}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{t.date} · Account {t.accountNumber}</p>
              <p className={`text-sm font-semibold whitespace-nowrap ml-4 ${t.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                {t.type === 'deposit' ? '+' : '-'}${t.amount.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Category selection */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</p>
              <div className="space-y-2">
                {CATEGORIES.map((c) => (
                  <label key={c.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio" name="category" value={c.value}
                      checked={category === c.value}
                      onChange={() => setCategory(c.value)}
                      className="mt-0.5 accent-blue-500"
                    />
                    <div className={`flex-1 rounded-lg border px-3 py-2 ${category === c.value ? catColors[c.value] : 'border-transparent'} transition-all`}>
                      <p className="text-sm font-medium text-gray-800">{c.label}</p>
                      <p className="text-xs text-gray-400">{c.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Business sub-category */}
            {category === 'Business' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Category</p>
                <div className="relative">
                  <select
                    value={bizCat ?? ''}
                    onChange={(e) => setBizCat(e.target.value || null)}
                    className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                  >
                    <option value="">— Select a category —</option>
                    {allBusinessCategories.map((bc) => (
                      <option key={bc} value={bc}>{bc}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Apply to similar */}
            {similarTransactions.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                <label className="flex items-center gap-3 cursor-pointer px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={applyToSimilar}
                    onChange={(e) => {
                      setApplyToSimilar(e.target.checked);
                      if (e.target.checked) setShowPreview(false);
                    }}
                    className="accent-amber-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Apply to similar transactions</p>
                    <p className="text-xs text-amber-600">
                      {similarTransactions.length} other transaction{similarTransactions.length > 1 ? 's' : ''} with similar descriptions
                      {applyToSimilar && selectedIds.size !== similarTransactions.length && (
                        <span className="font-semibold"> · {selectedIds.size} selected</span>
                      )}
                    </p>
                  </div>
                  {applyToSimilar && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowPreview((v) => !v); }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                        ${showPreview ? 'bg-amber-200 text-amber-900' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                    >
                      <Eye size={11} />
                      Preview
                    </button>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-4 border-t border-gray-100 mt-auto shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSave(updates, applyToIds); onClose(); }}
              disabled={!isValid}
              className="flex-1 px-4 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
            {uncategorizedRemaining > 0 && (
              <button
                onClick={() => onSaveAndNext(updates, applyToIds)}
                disabled={!isValid}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save & Next →
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel: similar transactions preview ──────────────── */}
        {showPreview && (
          <div className="w-80 shrink-0 border-l border-gray-100 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700">Similar Transactions</p>
                <span className="text-xs text-gray-400">{selectedIds.size} / {similarTransactions.length} selected</span>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAll} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <CheckSquare size={11} /> All
                </button>
                <button onClick={deselectAll} className="flex items-center gap-1 text-xs text-gray-400 hover:underline">
                  <Square size={11} /> None
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {similarTransactions.map((s) => (
                <label key={s.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleId(s.id)}
                    className="mt-0.5 accent-blue-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 break-words">{s.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.date}</p>
                  </div>
                  <p className={`text-xs font-semibold whitespace-nowrap shrink-0 ml-1 ${s.type === 'deposit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.type === 'deposit' ? '+' : '-'}${s.amount.toFixed(2)}
                  </p>
                </label>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
              <p className="text-xs text-gray-400">
                Uncheck any transactions you don't want this category applied to.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
