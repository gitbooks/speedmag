import { useState } from 'react';
import { Trash2, FileText, AlertTriangle, CheckCircle, Plus, X, Tag } from 'lucide-react';
import type { AppData, Statement } from '../types';
import { BUSINESS_CATEGORIES } from '../types';

interface Props {
  data: AppData;
  onDeleteStatement: (id: string) => void;
  onUpdateCustomCategories: (cats: string[]) => void;
}

export default function Settings({ data, onDeleteStatement, onUpdateCustomCategories }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [catError, setCatError] = useState('');

  const customCats = data.customBusinessCategories ?? [];
  const allCats = [...BUSINESS_CATEGORIES, ...customCats];

  function handleAddCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (allCats.map((c) => c.toLowerCase()).includes(name.toLowerCase())) {
      setCatError('Category already exists');
      return;
    }
    onUpdateCustomCategories([...customCats, name]);
    setNewCategory('');
    setCatError('');
  }

  function handleRemoveCustom(cat: string) {
    onUpdateCustomCategories(customCats.filter((c) => c !== cat));
  }

  const stats = {
    total: data.transactions.length,
    business: data.transactions.filter((t) => t.category === 'Business').length,
    personal: data.transactions.filter((t) => t.category === 'Personal').length,
    transfer: data.transactions.filter((t) => t.category === 'Transfer').length,
    uncategorized: data.transactions.filter((t) => t.category === 'Uncategorized').length,
  };

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      onDeleteStatement(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your imported statements and app data</p>
      </div>

      {/* Categorization progress */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Categorization Progress</h3>
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Business', value: stats.business, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Personal', value: stats.personal, color: 'text-purple-600', bg: 'bg-purple-100' },
            { label: 'Transfer', value: stats.transfer, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Uncategorized', value: stats.uncategorized, color: 'text-gray-600', bg: 'bg-gray-100' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {stats.total > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Categorized</span>
              <span>{Math.round(((stats.total - stats.uncategorized) / stats.total) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${((stats.total - stats.uncategorized) / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Imported statements */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Imported Statements ({data.statements.length})
          </h3>
        </div>

        {data.statements.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No statements imported yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.statements.map((s: Statement) => {
              const txCount = data.transactions.filter((t) => t.statementId === s.id).length;
              const isConfirming = confirmDelete === s.id;
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText size={16} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{s.filename}</p>
                    <p className="text-xs text-gray-400">
                      {txCount} transactions · Imported {new Date(s.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />

                  {isConfirming ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle size={12} />
                        <span>Confirm?</span>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors"
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(s.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors group"
                      title="Delete statement"
                    >
                      <Trash2 size={14} className="text-gray-300 group-hover:text-red-400 transition-colors" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Business Categories */}
      <div className="card mt-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Business Categories</h3>
          <p className="text-xs text-gray-400 mt-0.5">Add custom categories for your transactions</p>
        </div>

        {/* Built-in categories */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Built-in</p>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_CATEGORIES.map((cat) => (
              <span key={cat} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                <Tag size={10} />
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Custom categories */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Custom</p>
          {customCats.length === 0 ? (
            <p className="text-xs text-gray-400">No custom categories yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customCats.map((cat) => (
                <span key={cat} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  <Tag size={10} />
                  {cat}
                  <button
                    onClick={() => handleRemoveCustom(cat)}
                    className="ml-0.5 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add New Category</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => { setNewCategory(e.target.value); setCatError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="e.g. Insurance, Tools & Hardware…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {catError && <p className="text-xs text-red-500 mt-1">{catError}</p>}
            </div>
            <button
              onClick={handleAddCategory}
              disabled={!newCategory.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* App info */}
      <div className="mt-6 card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">About</h3>
        <div className="space-y-1 text-xs text-gray-400">
          <p><span className="font-medium text-gray-600">App:</span> SpeedMag</p>
          <p><span className="font-medium text-gray-600">Version:</span> 1.0.0</p>
          <p><span className="font-medium text-gray-600">Supported:</span> Navy Federal Credit Union (STMSSCM) statements</p>
          <p><span className="font-medium text-gray-600">Data stored:</span> Locally on your Mac — never uploaded</p>
        </div>
      </div>
    </div>
  );
}
