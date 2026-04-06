import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Check, X, Download, Scale } from 'lucide-react';
import type { Transaction, BalanceSheetEntry, Profile, InventoryItem, InventoryTransaction } from '../types';
import logoUrl from '../assets/logo.png';
import { computeInventoryAssetValue } from '../utils/inventory';

type Subtype = BalanceSheetEntry['subtype'];

type ElectronAPI = { exportPDF: (o: { html: string; filename: string }) => Promise<string | false> };
const el = () => (window as unknown as { electron?: ElectronAPI }).electron;

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtSigned(n: number) {
  return (n < 0 ? '(' : '') + fmt(Math.abs(n)) + (n < 0 ? ')' : '');
}

interface Props {
  transactions: Transaction[];
  entries: BalanceSheetEntry[];
  retainedEarnings: number;
  activeProfile: Profile | null;
  selectedYear: string;
  inventoryItems: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  onUpdate: (entries: BalanceSheetEntry[], retainedEarnings: number) => void;
}

interface InlineFormState {
  name: string;
  amount: string;
}

const EMPTY_FORM: InlineFormState = { name: '', amount: '' };

export default function BalanceSheet({ transactions, entries, retainedEarnings, onUpdate, activeProfile, selectedYear, inventoryItems, inventoryTransactions }: Props) {
  const [addingSubtype, setAddingSubtype] = useState<Subtype | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InlineFormState>(EMPTY_FORM);
  const [editingRetained, setEditingRetained] = useState(false);
  const [retainedDraft, setRetainedDraft] = useState('');
  const [exporting, setExporting] = useState(false);

  // ── Derived calculations ────────────────────────────────────────────────────

  // Latest balance per account from filtered transactions
  const cashAccounts = useMemo(() => {
    const map = new Map<string, { balance: number; date: string }>();
    for (const t of transactions) {
      const ex = map.get(t.accountNumber);
      if (!ex || t.date > ex.date) map.set(t.accountNumber, { balance: t.balance, date: t.date });
    }
    return Array.from(map.entries())
      .map(([acct, v]) => ({ acct, balance: v.balance, date: v.date }))
      .sort((a, b) => b.balance - a.balance);
  }, [transactions]);

  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0);

  // Inventory asset value (from inventory module — all time, point-in-time)
  const inventoryValue = useMemo(
    () => computeInventoryAssetValue(inventoryItems, inventoryTransactions),
    [inventoryItems, inventoryTransactions],
  );

  const asOfDate = useMemo(() => {
    if (transactions.length === 0) return null;
    const latest = [...transactions].sort((a, b) => b.date.localeCompare(a.date))[0];
    return new Date(latest.date + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }, [transactions]);

  // Net income from business transactions
  const netIncome = useMemo(() => {
    const biz = transactions.filter((t) => t.category === 'Business' && t.category !== 'Transfer' as string);
    const inc = biz.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const exp = biz.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
    return inc - exp;
  }, [transactions]);

  // Owner activity from personal transactions
  const ownerActivity = useMemo(() => {
    const personal = transactions.filter((t) => t.category === 'Personal');
    const draws = personal.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
    const contributions = personal.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    return { draws, contributions };
  }, [transactions]);

  // Grouped entries
  const currentAssets = entries.filter((e) => e.subtype === 'current_asset');
  const fixedAssets = entries.filter((e) => e.subtype === 'fixed_asset');
  const currentLiabilities = entries.filter((e) => e.subtype === 'current_liability');
  const longTermLiabilities = entries.filter((e) => e.subtype === 'long_term_liability');

  const totalCurrentAssets = totalCash + inventoryValue + currentAssets.reduce((s, e) => s + e.amount, 0);
  const totalFixedAssets = fixedAssets.reduce((s, e) => s + e.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalCurrentLiab = currentLiabilities.reduce((s, e) => s + e.amount, 0);
  const totalLongTermLiab = longTermLiabilities.reduce((s, e) => s + e.amount, 0);
  const totalLiabilities = totalCurrentLiab + totalLongTermLiab;

  const totalEquity = retainedEarnings + netIncome + ownerActivity.contributions - ownerActivity.draws;
  const totalLiabAndEquity = totalLiabilities + totalEquity;
  const diff = totalAssets - totalLiabAndEquity;
  const isBalanced = Math.abs(diff) < 0.005;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function startAdd(subtype: Subtype) {
    setAddingSubtype(subtype);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(entry: BalanceSheetEntry) {
    setEditingId(entry.id);
    setAddingSubtype(null);
    setForm({ name: entry.name, amount: String(entry.amount) });
  }

  function cancelForms() {
    setAddingSubtype(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function saveAdd() {
    if (!addingSubtype || !form.name.trim() || !form.amount) return;
    const amt = parseFloat(form.amount.replace(/[^0-9.-]/g, ''));
    if (isNaN(amt)) return;
    const newEntry: BalanceSheetEntry = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      amount: amt,
      type: addingSubtype.includes('asset') ? 'asset' : 'liability',
      subtype: addingSubtype,
      updatedAt: new Date().toISOString(),
    };
    onUpdate([...entries, newEntry], retainedEarnings);
    setAddingSubtype(null);
    setForm(EMPTY_FORM);
  }

  function saveEdit() {
    if (!editingId || !form.name.trim() || !form.amount) return;
    const amt = parseFloat(form.amount.replace(/[^0-9.-]/g, ''));
    if (isNaN(amt)) return;
    onUpdate(
      entries.map((e) =>
        e.id === editingId ? { ...e, name: form.name.trim(), amount: amt, updatedAt: new Date().toISOString() } : e
      ),
      retainedEarnings
    );
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function deleteEntry(id: string) {
    onUpdate(entries.filter((e) => e.id !== id), retainedEarnings);
  }

  function saveRetained() {
    const amt = parseFloat(retainedDraft.replace(/[^0-9.-]/g, ''));
    if (!isNaN(amt)) onUpdate(entries, amt);
    setEditingRetained(false);
  }

  // ── PDF Export ───────────────────────────────────────────────────────────────

  async function handleExportPDF() {
    const api = el();
    if (!api) return;
    setExporting(true);
    try {
      const businessName = activeProfile?.name ?? 'Business';
      const yearLabel = selectedYear === 'all' ? 'All Years' : selectedYear;

      let logoDataUrl = '';
      try {
        const resp = await fetch(logoUrl);
        const blob = await resp.blob();
        logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* logo optional */ }

      const fmtN = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

      const assetRows = [
        `<tr><td style="padding-left:16px;color:#374151">Cash &amp; Bank Accounts</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#059669">${fmtN(totalCash)}</td></tr>`,
        ...currentAssets.map((e) => `<tr><td style="padding-left:16px;color:#374151">${e.name}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtN(e.amount)}</td></tr>`),
        `<tr style="background:#f9fafb;font-weight:600"><td style="padding-left:8px">Total Current Assets</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtN(totalCurrentAssets)}</td></tr>`,
        ...fixedAssets.map((e) => `<tr><td style="padding-left:16px;color:#374151">${e.name}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtN(e.amount)}</td></tr>`),
        fixedAssets.length > 0 ? `<tr style="background:#f9fafb;font-weight:600"><td style="padding-left:8px">Total Fixed Assets</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtN(totalFixedAssets)}</td></tr>` : '',
      ].join('');

      const liabRows = [
        ...currentLiabilities.map((e) => `<tr><td style="padding-left:16px;color:#374151">${e.name}</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">${fmtN(e.amount)}</td></tr>`),
        currentLiabilities.length > 0 ? `<tr style="background:#f9fafb;font-weight:600"><td style="padding-left:8px">Total Current Liabilities</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">${fmtN(totalCurrentLiab)}</td></tr>` : '',
        ...longTermLiabilities.map((e) => `<tr><td style="padding-left:16px;color:#374151">${e.name}</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">${fmtN(e.amount)}</td></tr>`),
        longTermLiabilities.length > 0 ? `<tr style="background:#f9fafb;font-weight:600"><td style="padding-left:8px">Total Long-term Liabilities</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">${fmtN(totalLongTermLiab)}</td></tr>` : '',
        `<tr style="background:#fef2f2;font-weight:700"><td>TOTAL LIABILITIES</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">${fmtN(totalLiabilities)}</td></tr>`,
      ].join('');

      const eqRows = [
        `<tr><td style="padding-left:16px;color:#374151">Retained Earnings (Prior Periods)</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtN(retainedEarnings)}</td></tr>`,
        `<tr><td style="padding-left:16px;color:#374151">Net Income (Current Period)</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#059669">${fmtN(netIncome)}</td></tr>`,
        `<tr><td style="padding-left:16px;color:#374151">Owner's Contributions</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#059669">${fmtN(ownerActivity.contributions)}</td></tr>`,
        `<tr><td style="padding-left:16px;color:#374151">Less: Owner's Draws</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">(${fmtN(ownerActivity.draws)})</td></tr>`,
        `<tr style="background:#eff6ff;font-weight:700"><td>TOTAL OWNER'S EQUITY</td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#007AFF">${fmtN(totalEquity)}</td></tr>`,
      ].join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin:0;padding:0;box-sizing:border-box }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#1a1a1a;padding:32px }
  .header { margin-bottom:24px;border-bottom:2px solid #007AFF;padding-bottom:16px;display:flex;justify-content:space-between;align-items:center }
  .header-left { display:flex;align-items:center;gap:14px }
  .header-logo { width:52px;height:52px;object-fit:contain }
  .header h1 { font-size:22px;font-weight:700;color:#1a1a1a;margin:0 }
  .header .sub { font-size:12px;color:#6b7280;margin-top:2px }
  .header .meta { text-align:right;font-size:10px;color:#9ca3af }
  .summary { display:flex;gap:16px;margin-bottom:24px }
  .card { flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px }
  .card .label { font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:4px }
  .card .value { font-size:18px;font-weight:700 }
  .section { margin-bottom:20px }
  .section-title { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#374151;padding:8px 10px;background:#f3f4f6;border-bottom:1px solid #e5e7eb }
  table { width:100%;border-collapse:collapse }
  td { padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px }
  .total-row { background:#f9fafb;font-weight:700;border-top:2px solid #e5e7eb }
  .balance-status { margin-top:16px;padding:10px 14px;border-radius:6px;font-size:10px;font-weight:600 }
  .balanced { background:#f0fdf4;color:#166534;border:1px solid #bbf7d0 }
  .unbalanced { background:#fef2f2;color:#991b1b;border:1px solid #fecaca }
  .footer { margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:9px;color:#d1d5db;text-align:center }
</style></head><body>
  <div class="header">
    <div class="header-left">
      ${logoDataUrl ? `<img class="header-logo" src="${logoDataUrl}" alt="SpeedMag" />` : ''}
      <div>
        <div class="sub">SpeedMag Financial Planner</div>
        <h1>Balance Sheet</h1>
        <div class="sub">${businessName} &nbsp;·&nbsp; ${yearLabel}${asOfDate ? ` &nbsp;·&nbsp; As of ${asOfDate}` : ''}</div>
      </div>
    </div>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <div class="summary">
    <div class="card"><div class="label">Total Assets</div><div class="value" style="color:#007AFF">${fmtN(totalAssets)}</div></div>
    <div class="card"><div class="label">Total Liabilities</div><div class="value" style="color:#dc2626">${fmtN(totalLiabilities)}</div></div>
    <div class="card"><div class="label">Owner's Equity</div><div class="value" style="color:#059669">${fmtN(totalEquity)}</div></div>
  </div>

  <div class="section">
    <div class="section-title">ASSETS</div>
    <table>${assetRows}
      <tr class="total-row"><td><strong>TOTAL ASSETS</strong></td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#007AFF"><strong>${fmtN(totalAssets)}</strong></td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">LIABILITIES</div>
    <table>${liabRows}</table>
  </div>

  <div class="section">
    <div class="section-title">OWNER'S EQUITY</div>
    <table>${eqRows}
      <tr class="total-row"><td><strong>TOTAL LIABILITIES + EQUITY</strong></td><td style="text-align:right;font-variant-numeric:tabular-nums;color:#007AFF"><strong>${fmtN(totalLiabAndEquity)}</strong></td></tr>
    </table>
  </div>

  <div class="balance-status ${isBalanced ? 'balanced' : 'unbalanced'}">
    ${isBalanced
      ? '✓ Balanced — Total Assets equals Total Liabilities + Owner\'s Equity'
      : `⚠ Off by ${fmtN(Math.abs(diff))} — Review manually entered values or add missing entries`}
  </div>

  <div class="footer">SpeedMag Financial Planner &nbsp;·&nbsp; ${businessName} &nbsp;·&nbsp; Confidential</div>
</body></html>`;

      const slug = businessName.replace(/\s+/g, '-').toLowerCase();
      await api.exportPDF({ html, filename: `${slug}-balance-sheet-${yearLabel.toLowerCase()}.pdf` });
    } finally {
      setExporting(false);
    }
  }

  // ── UI Helpers ───────────────────────────────────────────────────────────────

  function InlineForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-2">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
            placeholder="Name (e.g. Business Loan)"
            className="w-full text-sm border border-blue-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-2 justify-end">
            <input
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
              placeholder="0.00"
              className="w-32 text-sm border border-blue-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary text-right tabular-nums"
            />
            <button onClick={onSave} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={14} /></button>
            <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
          </div>
        </td>
      </tr>
    );
  }

  function EntryRow({ entry }: { entry: BalanceSheetEntry }) {
    const isEditing = editingId === entry.id;
    const isAsset = entry.type === 'asset';
    if (isEditing) {
      return <InlineForm onSave={saveEdit} onCancel={cancelForms} />;
    }
    return (
      <tr className="group hover:bg-gray-50">
        <td className="px-4 py-2.5 text-sm text-gray-700 pl-8">{entry.name}</td>
        <td className="px-4 py-2.5 text-sm text-right tabular-nums">
          <div className="flex items-center justify-end gap-1">
            <span className={isAsset ? 'text-gray-800' : 'text-red-500'}>{fmt(entry.amount)}</span>
            <button
              onClick={() => startEdit(entry)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary rounded transition-opacity"
            ><Pencil size={11} /></button>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity"
            ><Trash2 size={11} /></button>
          </div>
        </td>
      </tr>
    );
  }

  function AddButton({ subtype, label }: { subtype: Subtype; label: string }) {
    return (
      <tr>
        <td colSpan={2} className="px-4 py-1.5">
          <button
            onClick={() => startAdd(subtype)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
          >
            <Plus size={11} /> {label}
          </button>
        </td>
      </tr>
    );
  }

  function SectionSubtotal({ label, amount, color }: { label: string; amount: number; color: string }) {
    return (
      <tr className="bg-gray-50">
        <td className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</td>
        <td className={`px-4 py-2.5 text-sm font-semibold text-right tabular-nums ${color}`}>{fmt(amount)}</td>
      </tr>
    );
  }

  function SectionTotal({ label, amount, color }: { label: string; amount: number; color: string }) {
    return (
      <tr className="border-t-2 border-gray-200">
        <td className="px-4 py-3 text-sm font-bold text-gray-900 uppercase tracking-wide">{label}</td>
        <td className={`px-4 py-3 text-base font-bold text-right tabular-nums ${color}`}>{fmt(amount)}</td>
      </tr>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mt-0.5">
            {asOfDate ? `As of ${asOfDate}` : 'No transactions imported yet'}
            {selectedYear !== 'all' && ` · Fiscal Year ${selectedYear}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Balance indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            <Scale size={12} />
            {isBalanced ? 'Balanced' : `Off by ${fmt(Math.abs(diff))}`}
          </div>
          {el() && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-primary">{fmt(totalAssets)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-500">{fmt(totalLiabilities)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Owner's Equity</p>
          <p className={`text-2xl font-bold ${totalEquity >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(totalEquity)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* ── ASSETS ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Assets</h3>
          </div>
          <table className="w-full">
            <tbody>
              {/* Current Assets */}
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Assets</td>
              </tr>
              {/* Cash rows */}
              {cashAccounts.length > 0 ? cashAccounts.map((a) => (
                <tr key={a.acct} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700 pl-8">
                    Cash — ···{a.acct.slice(-4)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right tabular-nums text-gray-800">{fmt(a.balance)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={2} className="px-4 py-2 pl-8 text-xs text-gray-400 italic">No accounts imported</td>
                </tr>
              )}
              {/* Inventory (auto from inventory module) */}
              {inventoryValue > 0 && (
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm text-gray-700 pl-8">
                    Inventory — On Hand
                    <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">auto</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-gray-800">{fmt(inventoryValue)}</td>
                </tr>
              )}
              {currentAssets.map((e) => <EntryRow key={e.id} entry={e} />)}
              {addingSubtype === 'current_asset' && (
                <InlineForm onSave={saveAdd} onCancel={cancelForms} />
              )}
              <AddButton subtype="current_asset" label="Add current asset" />
              <SectionSubtotal label="Total Current Assets" amount={totalCurrentAssets} color="text-emerald-600" />

              {/* Fixed Assets */}
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fixed Assets</td>
              </tr>
              {fixedAssets.length === 0 && addingSubtype !== 'fixed_asset' && (
                <tr><td colSpan={2} className="px-4 py-1.5 pl-8 text-xs text-gray-300 italic">None added</td></tr>
              )}
              {fixedAssets.map((e) => <EntryRow key={e.id} entry={e} />)}
              {addingSubtype === 'fixed_asset' && (
                <InlineForm onSave={saveAdd} onCancel={cancelForms} />
              )}
              <AddButton subtype="fixed_asset" label="Add fixed asset" />
              {fixedAssets.length > 0 && (
                <SectionSubtotal label="Total Fixed Assets" amount={totalFixedAssets} color="text-emerald-600" />
              )}

              <SectionTotal label="Total Assets" amount={totalAssets} color="text-primary" />
            </tbody>
          </table>
        </div>

        {/* ── LIABILITIES + EQUITY ── */}
        <div className="space-y-5">
          {/* Liabilities */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100">
              <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider">Liabilities</h3>
            </div>
            <table className="w-full">
              <tbody>
                {/* Current Liabilities */}
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Liabilities</td>
                </tr>
                {currentLiabilities.length === 0 && addingSubtype !== 'current_liability' && (
                  <tr><td colSpan={2} className="px-4 py-1.5 pl-8 text-xs text-gray-300 italic">None added</td></tr>
                )}
                {currentLiabilities.map((e) => <EntryRow key={e.id} entry={e} />)}
                {addingSubtype === 'current_liability' && (
                  <InlineForm onSave={saveAdd} onCancel={cancelForms} />
                )}
                <AddButton subtype="current_liability" label="Add current liability" />
                {currentLiabilities.length > 0 && (
                  <SectionSubtotal label="Total Current" amount={totalCurrentLiab} color="text-red-500" />
                )}

                {/* Long-term Liabilities */}
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Long-term Liabilities</td>
                </tr>
                {longTermLiabilities.length === 0 && addingSubtype !== 'long_term_liability' && (
                  <tr><td colSpan={2} className="px-4 py-1.5 pl-8 text-xs text-gray-300 italic">None added</td></tr>
                )}
                {longTermLiabilities.map((e) => <EntryRow key={e.id} entry={e} />)}
                {addingSubtype === 'long_term_liability' && (
                  <InlineForm onSave={saveAdd} onCancel={cancelForms} />
                )}
                <AddButton subtype="long_term_liability" label="Add long-term liability" />
                {longTermLiabilities.length > 0 && (
                  <SectionSubtotal label="Total Long-term" amount={totalLongTermLiab} color="text-red-500" />
                )}

                <SectionTotal label="Total Liabilities" amount={totalLiabilities} color="text-red-500" />
              </tbody>
            </table>
          </div>

          {/* Owner's Equity */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
              <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Owner's Equity</h3>
            </div>
            <table className="w-full">
              <tbody>
                {/* Retained Earnings — editable */}
                <tr className="group hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm text-gray-700 pl-8">Retained Earnings (Prior Periods)</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                    {editingRetained ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          autoFocus
                          value={retainedDraft}
                          onChange={(e) => setRetainedDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRetained(); if (e.key === 'Escape') setEditingRetained(false); }}
                          className="w-28 text-sm border border-blue-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary text-right tabular-nums"
                        />
                        <button onClick={saveRetained} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13} /></button>
                        <button onClick={() => setEditingRetained(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-gray-800">{fmt(retainedEarnings)}</span>
                        <button
                          onClick={() => { setEditingRetained(true); setRetainedDraft(String(retainedEarnings)); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary rounded transition-opacity"
                        ><Pencil size={11} /></button>
                      </div>
                    )}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm text-gray-700 pl-8">Net Income (Current Period)</td>
                  <td className={`px-4 py-2.5 text-sm text-right tabular-nums ${netIncome >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtSigned(netIncome)}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm text-gray-700 pl-8">Owner's Contributions</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-emerald-600">{fmt(ownerActivity.contributions)}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm text-gray-700 pl-8">Less: Owner's Draws</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-red-500">({fmt(ownerActivity.draws)})</td>
                </tr>
                <SectionTotal label="Total Owner's Equity" amount={totalEquity} color={totalEquity >= 0 ? 'text-primary' : 'text-red-500'} />
                <SectionTotal label="Total Liab. + Equity" amount={totalLiabAndEquity} color="text-gray-700" />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Balance note */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
        <strong className="text-gray-500">Retained Earnings</strong> is your accumulated profit from prior periods (before this app started tracking). Click the pencil icon next to it to set the opening balance. All other equity figures are calculated automatically from your transactions.
      </div>
    </div>
  );
}
