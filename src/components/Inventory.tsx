import { useState, useMemo } from 'react';
import {
  Package, Plus, Pencil, Trash2, Check, X,
  ShoppingCart, TrendingDown, SlidersHorizontal, AlertTriangle,
} from 'lucide-react';
import type { InventoryItem, InventoryTransaction } from '../types';
import { computeItemStats } from '../utils/inventory';

interface Props {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  onUpdate: (items: InventoryItem[], transactions: InventoryTransaction[]) => void;
}

type Tab = 'items' | 'history';
type TxType = 'purchase' | 'sale' | 'adjustment';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Item form state ──────────────────────────────────────────────────────────
interface ItemForm {
  name: string; sku: string; description: string;
  salePrice: string; reorderPoint: string;
}
const EMPTY_ITEM: ItemForm = { name: '', sku: '', description: '', salePrice: '', reorderPoint: '0' };

// ── Transaction form state ────────────────────────────────────────────────────
interface TxForm {
  type: TxType; itemId: string;
  date: string; quantity: string; unitCost: string; note: string;
}
function emptyTx(itemId = '', type: TxType = 'purchase'): TxForm {
  return { type, itemId, date: today(), quantity: '', unitCost: '', note: '' };
}

export default function Inventory({ items, transactions, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('items');

  // Item CRUD modal
  const [itemModal, setItemModal] = useState<{ mode: 'add' | 'edit'; form: ItemForm; id?: string } | null>(null);
  const [itemError, setItemError] = useState('');

  // Transaction record modal
  const [txModal, setTxModal] = useState<TxForm | null>(null);
  const [txError, setTxError] = useState('');

  // ── Per-item stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeItemStats>>();
    for (const item of items) map.set(item.id, computeItemStats(item.id, transactions));
    return map;
  }, [items, transactions]);

  const totalValue = useMemo(
    () => Array.from(stats.values()).reduce((s, st) => s + st.totalValue, 0),
    [stats],
  );
  const lowStockCount = items.filter((i) => {
    const st = stats.get(i.id);
    return st && st.qty > 0 && st.qty <= i.reorderPoint;
  }).length;
  const outOfStockCount = items.filter((i) => (stats.get(i.id)?.qty ?? 0) === 0).length;

  // ── Item CRUD ──────────────────────────────────────────────────────────────
  function openAddItem() {
    setItemModal({ mode: 'add', form: { ...EMPTY_ITEM } });
    setItemError('');
  }
  function openEditItem(item: InventoryItem) {
    setItemModal({
      mode: 'edit', id: item.id,
      form: {
        name: item.name, sku: item.sku ?? '', description: item.description ?? '',
        salePrice: String(item.salePrice), reorderPoint: String(item.reorderPoint),
      },
    });
    setItemError('');
  }
  function saveItem() {
    if (!itemModal) return;
    const { form, mode, id } = itemModal;
    if (!form.name.trim()) { setItemError('Name is required.'); return; }
    const salePrice = parseFloat(form.salePrice) || 0;
    const reorderPoint = parseInt(form.reorderPoint) || 0;
    if (mode === 'add') {
      const newItem: InventoryItem = {
        id: crypto.randomUUID(), name: form.name.trim(),
        sku: form.sku.trim() || undefined, description: form.description.trim() || undefined,
        salePrice, reorderPoint, createdAt: new Date().toISOString(),
      };
      onUpdate([...items, newItem], transactions);
    } else if (id) {
      onUpdate(
        items.map((i) => i.id === id
          ? { ...i, name: form.name.trim(), sku: form.sku.trim() || undefined,
              description: form.description.trim() || undefined, salePrice, reorderPoint }
          : i),
        transactions,
      );
    }
    setItemModal(null);
  }
  function deleteItem(id: string) {
    if (!confirm('Delete this item and all its transaction history?')) return;
    onUpdate(items.filter((i) => i.id !== id), transactions.filter((t) => t.itemId !== id));
  }

  // ── Transaction record ─────────────────────────────────────────────────────
  function openTx(itemId: string, type: TxType) {
    const st = stats.get(itemId);
    const avgCost = st ? st.avgCost : 0;
    setTxModal({ ...emptyTx(itemId, type), unitCost: type === 'purchase' ? '' : avgCost.toFixed(2) });
    setTxError('');
  }
  function saveTx() {
    if (!txModal) return;
    const qty = parseFloat(txModal.quantity);
    const cost = parseFloat(txModal.unitCost);
    if (!txModal.date) { setTxError('Date is required.'); return; }
    if (isNaN(qty) || qty <= 0) { setTxError('Enter a valid quantity > 0.'); return; }
    if (txModal.type !== 'adjustment' && (isNaN(cost) || cost < 0)) { setTxError('Enter a valid unit cost.'); return; }

    // Warn on oversell
    if (txModal.type === 'sale') {
      const onHand = stats.get(txModal.itemId)?.qty ?? 0;
      if (qty > onHand) {
        if (!confirm(`Selling ${qty} units but only ${onHand} on hand. Continue?`)) return;
      }
    }

    const newTx: InventoryTransaction = {
      id: crypto.randomUUID(), itemId: txModal.itemId, type: txModal.type,
      quantity: qty, unitCost: isNaN(cost) ? 0 : cost,
      date: txModal.date, note: txModal.note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onUpdate(items, [...transactions, newTx]);
    setTxModal(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function stockStatus(item: InventoryItem) {
    const qty = stats.get(item.id)?.qty ?? 0;
    if (qty === 0) return { label: 'Out of Stock', color: 'text-red-500 bg-red-50' };
    if (qty <= item.reorderPoint) return { label: 'Low Stock', color: 'text-amber-600 bg-amber-50' };
    return { label: 'In Stock', color: 'text-emerald-600 bg-emerald-50' };
  }

  const historyTxns = useMemo(() =>
    [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [transactions],
  );
  function itemName(id: string) {
    return items.find((i) => i.id === id)?.name ?? 'Unknown Item';
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-hidden flex flex-col fade-up">
      {/* Header */}
      <div className="flex items-end gap-1 px-6 pt-5 pb-0 border-b border-gray-100 bg-white">
        <h1 className="text-2xl font-bold text-gray-900 mr-6 pb-4">Inventory</h1>
        <div className="flex gap-1 pb-0 flex-1">
          {(['items', 'history'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize
                ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'items' ? 'Items' : 'Transaction History'}
            </button>
          ))}
        </div>
        <button onClick={openAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 mb-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors shrink-0">
          <Plus size={13} /> Add Item
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── Summary cards ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Inventory Value</p>
            <p className="text-2xl font-bold text-primary">{fmt(totalValue)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Low Stock</p>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-500' : 'text-gray-400'}`}>{lowStockCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Out of Stock</p>
            <p className={`text-2xl font-bold ${outOfStockCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{outOfStockCount}</p>
          </div>
        </div>

        {/* ── Items tab ── */}
        {tab === 'items' && (
          <>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Package size={40} className="text-gray-200" />
                <p className="text-gray-400 text-sm">No inventory items yet</p>
                <button onClick={openAddItem}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                  <Plus size={14} /> Add your first item
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>SKU</th>
                      <th className="text-right">On Hand</th>
                      <th className="text-right">Avg Cost</th>
                      <th className="text-right">Total Value</th>
                      <th className="text-right">Sale Price</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const st = stats.get(item.id)!;
                      const status = stockStatus(item);
                      return (
                        <tr key={item.id} className="group">
                          <td>
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-48">{item.description}</p>}
                            </div>
                          </td>
                          <td className="text-gray-500 font-mono text-xs">{item.sku ?? '—'}</td>
                          <td className="text-right tabular-nums font-semibold">
                            <span className={st.qty === 0 ? 'text-red-500' : st.qty <= item.reorderPoint ? 'text-amber-600' : 'text-gray-900'}>
                              {st.qty}
                            </span>
                            {item.reorderPoint > 0 && (
                              <span className="text-gray-300 text-xs ml-1">/ {item.reorderPoint}</span>
                            )}
                          </td>
                          <td className="text-right tabular-nums text-gray-600">{fmt(st.avgCost)}</td>
                          <td className="text-right tabular-nums font-semibold text-primary">{fmt(st.totalValue)}</td>
                          <td className="text-right tabular-nums text-gray-600">{fmt(item.salePrice)}</td>
                          <td>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openTx(item.id, 'purchase')} title="Record Purchase"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                                <ShoppingCart size={13} />
                              </button>
                              <button onClick={() => openTx(item.id, 'sale')} title="Record Sale"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                <TrendingDown size={13} />
                              </button>
                              <button onClick={() => openTx(item.id, 'adjustment')} title="Adjust Count"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors">
                                <SlidersHorizontal size={13} />
                              </button>
                              <button onClick={() => openEditItem(item)} title="Edit"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deleteItem(item.id)} title="Delete"
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm" colSpan={4}>Total Inventory Value</td>
                      <td className="px-4 py-3 text-sm text-right tabular-nums text-primary">{fmt(totalValue)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Low stock alert */}
            {lowStockCount > 0 && (
              <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{lowStockCount} item{lowStockCount > 1 ? 's' : ''}</strong> at or below reorder point.
                  Consider recording a new purchase.
                </span>
              </div>
            )}
          </>
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <>
            {historyTxns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-gray-400 text-sm">No transactions recorded yet</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit Cost</th>
                      <th className="text-right">Total</th>
                      <th>Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyTxns.map((tx) => {
                      const typeStyle = tx.type === 'purchase'
                        ? 'text-emerald-700 bg-emerald-50'
                        : tx.type === 'sale'
                          ? 'text-blue-700 bg-blue-50'
                          : 'text-gray-600 bg-gray-100';
                      const typeLabel = tx.type === 'purchase' ? 'Purchase' : tx.type === 'sale' ? 'Sale' : 'Adjustment';
                      const total = tx.type === 'adjustment' ? 0 : tx.quantity * tx.unitCost;
                      return (
                        <tr key={tx.id} className="group">
                          <td className="tabular-nums text-gray-600">{tx.date}</td>
                          <td className="font-medium">{itemName(tx.itemId)}</td>
                          <td>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="text-right tabular-nums">
                            {tx.type === 'adjustment' ? (
                              <span className="text-gray-500">→ {tx.quantity}</span>
                            ) : (
                              <span className={tx.type === 'purchase' ? 'text-emerald-600' : 'text-blue-600'}>
                                {tx.type === 'sale' ? '-' : '+'}{tx.quantity}
                              </span>
                            )}
                          </td>
                          <td className="text-right tabular-nums text-gray-600">{fmt(tx.unitCost)}</td>
                          <td className="text-right tabular-nums font-medium">
                            {tx.type === 'adjustment' ? '—' : fmt(total)}
                          </td>
                          <td className="text-gray-400 text-xs max-w-40 truncate">{tx.note ?? ''}</td>
                          <td className="text-right">
                            <button
                              onClick={() => {
                                if (!confirm('Delete this transaction? Inventory counts will be recalculated.')) return;
                                onUpdate(items, transactions.filter((t) => t.id !== tx.id));
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                            ><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add/Edit Item Modal ── */}
      {itemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {itemModal.mode === 'add' ? 'Add Inventory Item' : 'Edit Item'}
              </h2>
              <button onClick={() => setItemModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label>
                <input
                  autoFocus value={itemModal.form.name}
                  onChange={(e) => setItemModal((m) => m && { ...m, form: { ...m.form, name: e.target.value } })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g. Widget Pro 500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SKU / Part #</label>
                  <input value={itemModal.form.sku}
                    onChange={(e) => setItemModal((m) => m && { ...m, form: { ...m.form, sku: e.target.value } })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="WP-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Point</label>
                  <input type="number" min="0" value={itemModal.form.reorderPoint}
                    onChange={(e) => setItemModal((m) => m && { ...m, form: { ...m.form, reorderPoint: e.target.value } })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sale Price</label>
                <input type="number" min="0" step="0.01" value={itemModal.form.salePrice}
                  onChange={(e) => setItemModal((m) => m && { ...m, form: { ...m.form, salePrice: e.target.value } })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={itemModal.form.description}
                  onChange={(e) => setItemModal((m) => m && { ...m, form: { ...m.form, description: e.target.value } })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="Optional description..." />
              </div>
              {itemError && <p className="text-xs text-red-500">{itemError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setItemModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveItem}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors">
                <Check size={14} /> {itemModal.mode === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Transaction Modal ── */}
      {txModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {txModal.type === 'purchase' ? 'Record Purchase' : txModal.type === 'sale' ? 'Record Sale' : 'Adjust Count'}
              </h2>
              <button onClick={() => setTxModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Item */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
                <select value={txModal.itemId}
                  onChange={(e) => setTxModal((t) => t && { ...t, itemId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <div className="flex gap-2">
                  {(['purchase', 'sale', 'adjustment'] as TxType[]).map((t) => (
                    <button key={t} onClick={() => setTxModal((tx) => tx && { ...tx, type: t })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        txModal.type === t
                          ? t === 'purchase' ? 'bg-emerald-600 text-white border-emerald-600'
                            : t === 'sale' ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-600 text-white border-gray-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {t === 'purchase' ? 'Purchase' : t === 'sale' ? 'Sale' : 'Adjust'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={txModal.date}
                  onChange={(e) => setTxModal((t) => t && { ...t, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {/* Quantity */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {txModal.type === 'adjustment' ? 'New Count (absolute)' : 'Quantity'}
                </label>
                <input type="number" min="0" step="1" value={txModal.quantity}
                  onChange={(e) => setTxModal((t) => t && { ...t, quantity: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={txModal.type === 'adjustment'
                    ? `Current: ${stats.get(txModal.itemId)?.qty ?? 0}`
                    : '0'} />
              </div>
              {/* Unit Cost */}
              {txModal.type !== 'adjustment' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Unit Cost {txModal.type === 'sale' && <span className="text-gray-400">(auto avg)</span>}
                  </label>
                  <input type="number" min="0" step="0.01" value={txModal.unitCost}
                    onChange={(e) => setTxModal((t) => t && { ...t, unitCost: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0.00" />
                  {txModal.type === 'purchase' && txModal.quantity && txModal.unitCost && (
                    <p className="text-xs text-gray-400 mt-1">
                      Total: {fmt(parseFloat(txModal.quantity) * parseFloat(txModal.unitCost))}
                    </p>
                  )}
                </div>
              )}
              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                <input value={txModal.note}
                  onChange={(e) => setTxModal((t) => t && { ...t, note: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. Invoice #123, order from supplier..." />
              </div>
              {txError && <p className="text-xs text-red-500">{txError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setTxModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveTx}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors">
                <Check size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
