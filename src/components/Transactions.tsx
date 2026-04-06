import { useState, useMemo, useCallback } from 'react';
import { Search, Filter, Download, Tag, ChevronUp, ChevronDown, X } from 'lucide-react';
import CategoryModal from './CategoryModal';
import type { AppData, Transaction, TransactionCategory } from '../types';
import { BUSINESS_CATEGORIES } from '../types';

interface Props {
  data: AppData;
  onUpdateTransactions: (updated: Transaction[]) => void;
}

type SortField = 'date' | 'description' | 'amount' | 'category';
type SortDir = 'asc' | 'desc';

const CATEGORY_OPTIONS: TransactionCategory[] = ['Business', 'Personal', 'Transfer', 'Uncategorized'];

export default function Transactions({ data, onUpdateTransactions }: Props) {
  const { transactions } = data;

  // Filters
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<TransactionCategory | ''>('');
  const [filterType, setFilterType] = useState<'deposit' | 'withdrawal' | ''>('');
  const [filterBizCat, setFilterBizCat] = useState<BusinessCategory | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal
  const [modalTxn, setModalTxn] = useState<Transaction | null>(null);

  // Bulk categorization state
  const [bulkCategory, setBulkCategory] = useState<TransactionCategory>('Business');
  const [bulkBizCat, setBulkBizCat] = useState<BusinessCategory | ''>('');
  const [showBulkBar, setShowBulkBar] = useState(false);

  const el = window as unknown as { electron?: { exportCSV: (t: Transaction[]) => void } };

  const allBusinessCategories = useMemo(
    () => [...BUSINESS_CATEGORIES, ...(data.customBusinessCategories ?? [])],
    [data.customBusinessCategories]
  );

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat && t.category !== filterCat) return false;
      if (filterType && t.type !== filterType) return false;
      if (filterBizCat && t.businessCategory !== filterBizCat) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
  }, [transactions, search, filterCat, filterType, filterBizCat, dateFrom, dateTo]);

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'description') cmp = a.description.localeCompare(b.description);
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'category') cmp = a.category.localeCompare(b.category);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(sorted.map((t) => t.id)));
  }
  function deselectAll() { setSelected(new Set()); }

  // ── Single transaction save ───────────────────────────────────────────────
  const handleModalSave = useCallback(
    (
      txn: Transaction,
      { category, businessCategory }: { category: TransactionCategory; businessCategory: string | null },
      applyToIds: string[]
    ) => {
      const idSet = new Set([txn.id, ...applyToIds]);
      const toUpdate = transactions.filter((t) => idSet.has(t.id));
      onUpdateTransactions(toUpdate.map((t) => ({ ...t, category, businessCategory })));
    },
    [transactions, onUpdateTransactions]
  );

  // ── Bulk save ─────────────────────────────────────────────────────────────
  function applyBulk() {
    const ids = Array.from(selected);
    const updated = transactions
      .filter((t) => ids.includes(t.id))
      .map((t) => ({
        ...t,
        category: bulkCategory,
        businessCategory: bulkCategory === 'Business' ? (bulkBizCat || null) : null,
      }));
    onUpdateTransactions(updated);
    deselectAll();
    setShowBulkBar(false);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    if (el.electron) el.electron.exportCSV(sorted);
  }

  // ── Similar transactions for modal ───────────────────────────────────────
  function getSimilarTransactions(t: Transaction): Transaction[] {
    const keyword = t.description.slice(0, 20).toLowerCase();
    return transactions.filter((tx) => tx.id !== t.id && tx.description.toLowerCase().includes(keyword));
  }

  // ── Uncategorized queue for Save & Next ──────────────────────────────────
  const uncategorizedQueue = useMemo(
    () => transactions.filter((t) => t.category === 'Uncategorized'),
    [transactions]
  );

  function getNextUncategorized(currentId: string): Transaction | null {
    const queue = transactions.filter((t) => t.category === 'Uncategorized' && t.id !== currentId);
    return queue[0] ?? null;
  }

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const deps = filtered.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const wds = filtered.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
    return { deps, wds, count: filtered.length };
  }, [filtered]);

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
    ) : null;

  const badgeCls: Record<string, string> = {
    Business: 'badge-business', Personal: 'badge-personal',
    Transfer: 'badge-transfer', Uncategorized: 'badge-uncategorized',
  };

  const hasFilters = search || filterCat || filterType || filterBizCat || dateFrom || dateTo;

  return (
    <div className="flex-1 overflow-hidden flex flex-col fade-up">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {stats.count} transactions · <span className="text-emerald-600">${stats.deps.toFixed(2)} in</span>{' '}
              · <span className="text-red-500">${stats.wds.toFixed(2)} out</span>
            </p>
          </div>
          <div className="flex gap-2">
            {el.electron && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download size={13} /> Export CSV
              </button>
            )}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors
                ${showFilters || hasFilters ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter size={13} /> Filters {hasFilters ? '·' : ''}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as TransactionCategory | '')}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as '' | 'deposit' | 'withdrawal')}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
            </select>
            <select value={filterBizCat} onChange={(e) => setFilterBizCat(e.target.value as BusinessCategory | '')}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Business Cats</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-primary/5 border-b border-primary/20">
          <Tag size={14} className="text-primary" />
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value as TransactionCategory)}
              className="border border-primary/30 rounded px-2 py-1 text-xs focus:outline-none">
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {bulkCategory === 'Business' && (
              <select value={bulkBizCat} onChange={(e) => setBulkBizCat(e.target.value as BusinessCategory)}
                className="border border-primary/30 rounded px-2 py-1 text-xs focus:outline-none">
                <option value="">— Sub-category —</option>
                {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <button onClick={applyBulk}
              disabled={bulkCategory === 'Business' && !bulkBizCat}
              className="px-3 py-1 bg-primary text-white rounded text-xs font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">
              Apply
            </button>
          </div>
          <button onClick={deselectAll} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      {/* Selection header */}
      <div className="flex items-center gap-3 px-6 py-2 bg-gray-50 border-b border-gray-100">
        <input type="checkbox"
          checked={selected.size === sorted.length && sorted.length > 0}
          onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
          className="accent-blue-500" />
        <span className="text-xs text-gray-400">
          {selected.size > 0 ? `${selected.size} of ${sorted.length} selected` : `${sorted.length} transactions`}
        </span>
        {selected.size > 0 && !showBulkBar && (
          <button onClick={() => setShowBulkBar(true)} className="text-xs text-primary hover:underline">
            Bulk categorize
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-gray-400 text-sm">No transactions match your filters</p>
            {hasFilters && (
              <button onClick={() => { setSearch(''); setFilterCat(''); setFilterType(''); setFilterBizCat(''); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <table className="w-full data-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-8"><span className="sr-only">Select</span></th>
                <th className="cursor-pointer" onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
                </th>
                <th className="cursor-pointer" onClick={() => toggleSort('description')}>
                  <span className="flex items-center gap-1">Description <SortIcon field="description" /></span>
                </th>
                <th>Account</th>
                <th className="cursor-pointer" onClick={() => toggleSort('category')}>
                  <span className="flex items-center gap-1">Category <SortIcon field="category" /></span>
                </th>
                <th>Type</th>
                <th className="text-right cursor-pointer" onClick={() => toggleSort('amount')}>
                  <span className="flex items-center justify-end gap-1">Amount <SortIcon field="amount" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setModalTxn(t)}
                  className="cursor-pointer"
                >
                  <td onClick={(e) => { e.stopPropagation(); toggleSelect(t.id); }} className="w-8">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => {}}
                      className="accent-blue-500" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="whitespace-nowrap text-gray-500 tabular-nums">{t.date}</td>
                  <td>
                    <p className="break-words whitespace-normal">{t.description}</p>
                  </td>
                  <td className="text-gray-400 tabular-nums text-xs">{t.accountNumber}</td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className={`badge ${badgeCls[t.category] ?? 'badge-uncategorized'}`}>
                        {t.category}
                      </span>
                      {t.businessCategory && (
                        <span className="text-[10px] text-gray-400 pl-0.5">{t.businessCategory}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${t.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`text-right whitespace-nowrap tabular-nums font-medium
                    ${t.type === 'deposit' ? 'amount-deposit' : 'amount-withdrawal'}`}>
                    {t.type === 'deposit' ? '+' : '-'}${t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Category modal */}
      {modalTxn && (
        <CategoryModal
          transaction={modalTxn}
          similarTransactions={getSimilarTransactions(modalTxn)}
          uncategorizedRemaining={uncategorizedQueue.filter((t) => t.id !== modalTxn.id).length}
          allBusinessCategories={allBusinessCategories}
          onSave={(updates, applyToIds) => handleModalSave(modalTxn, updates, applyToIds)}
          onSaveAndNext={(updates, applyToIds) => {
            const next = getNextUncategorized(modalTxn.id);
            handleModalSave(modalTxn, updates, applyToIds);
            setModalTxn(next);
          }}
          onClose={() => setModalTxn(null)}
        />
      )}
    </div>
  );
}
