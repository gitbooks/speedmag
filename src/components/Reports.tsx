import { useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { FileText, DollarSign, TrendingUp, Receipt, Download, Scale } from 'lucide-react';
import type { AppData, Profile, BalanceSheetEntry } from '../types';
import { BUSINESS_CATEGORIES } from '../types';
import logoUrl from '../assets/logo.png';
import BalanceSheet from './BalanceSheet';
import { computePeriodCOGS } from '../utils/inventory';

interface Props {
  data: AppData;
  activeProfile: Profile | null;
  selectedYear: string;
  onUpdateBalanceSheet: (entries: BalanceSheetEntry[], retainedEarnings: number) => void;
}

type ReportTab = 'pl' | 'cashflow' | 'expenses' | 'tax' | 'balance';

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
  { id: 'pl', label: 'P&L Statement', icon: <FileText size={14} /> },
  { id: 'balance', label: 'Balance Sheet', icon: <Scale size={14} /> },
  { id: 'cashflow', label: 'Cash Flow', icon: <TrendingUp size={14} /> },
  { id: 'expenses', label: 'Expense Breakdown', icon: <DollarSign size={14} /> },
  { id: 'tax', label: 'Tax Summary', icon: <Receipt size={14} /> },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PIE_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE',
  '#5AC8FA', '#FFCC00', '#FF2D55', '#4CD964', '#8E8E93',
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
type ElectronAPI = { exportPDF: (o: { html: string; filename: string }) => Promise<string | false> };
const el = () => (window as unknown as { electron?: ElectronAPI }).electron;

export default function Reports({ data, activeProfile, selectedYear, onUpdateBalanceSheet }: Props) {
  const [tab, setTab] = useState<ReportTab>('pl');
  const [exporting, setExporting] = useState(false);
  const { transactions } = data;

  const nonTransfer = useMemo(
    () => transactions.filter((t) => t.category !== 'Transfer'),
    [transactions]
  );

  // Monthly aggregation — tracks business + personal separately
  const monthly = useMemo(() => {
    const map = new Map<string, {
      income: number; expenses: number;
      bizIncome: number; bizExpenses: number;
      draws: number; contributions: number;
    }>();
    for (const t of nonTransfer) {
      const ym = t.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, { income: 0, expenses: 0, bizIncome: 0, bizExpenses: 0, draws: 0, contributions: 0 });
      const e = map.get(ym)!;
      if (t.type === 'deposit') {
        e.income += t.amount;
        if (t.category === 'Business') e.bizIncome += t.amount;
        if (t.category === 'Personal') e.contributions += t.amount;
      } else {
        e.expenses += t.amount;
        if (t.category === 'Business') e.bizExpenses += t.amount;
        if (t.category === 'Personal') e.draws += t.amount;
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => {
        const [y, m] = ym.split('-');
        return {
          ym, label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, ...v,
          net: v.income - v.expenses,
          bizNet: v.bizIncome - v.bizExpenses,
        };
      });
  }, [nonTransfer]);

  // Owner's equity activity (personal transactions)
  const ownerActivity = useMemo(() => {
    const personal = nonTransfer.filter((t) => t.category === 'Personal');
    const draws = personal.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
    const contributions = personal.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    return { draws, contributions };
  }, [nonTransfer]);

  // Business expenses by category
  const expenseByBizCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of nonTransfer) {
      if (t.category !== 'Business' || t.type !== 'withdrawal') continue;
      const k = t.businessCategory ?? 'Other Business';
      map.set(k, (map.get(k) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [nonTransfer]);

  // Tax summary
  const taxData = useMemo(() => {
    const bizTxns = nonTransfer.filter((t) => t.category === 'Business');
    const income = bizTxns.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = bizTxns.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
    const byCategory = BUSINESS_CATEGORIES.map((bc) => {
      const amount = bizTxns
        .filter((t) => t.type === 'withdrawal' && t.businessCategory === bc)
        .reduce((s, t) => s + t.amount, 0);
      return { category: bc, amount };
    }).filter((c) => c.amount > 0);
    return { income, totalExpenses, net: income - totalExpenses, byCategory };
  }, [nonTransfer]);

  // COGS from inventory module (avg cost method) for the selected year
  const inventoryCOGS = useMemo(() =>
    computePeriodCOGS(
      data.inventoryItems ?? [],
      data.inventoryTransactions ?? [],
      selectedYear,
    ),
    [data.inventoryItems, data.inventoryTransactions, selectedYear],
  );

  // P&L totals = business only, with COGS separated
  const totals = useMemo(() => {
    const biz = nonTransfer.filter((t) => t.category === 'Business');
    const income = biz.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    // Direct COGS-tagged transactions
    const directCOGS = biz
      .filter((t) => t.type === 'withdrawal' && t.businessCategory === 'Inventory / COGS')
      .reduce((s, t) => s + t.amount, 0);
    // Operating expenses = all business expenses EXCEPT direct COGS and Inventory Purchase (asset)
    const opEx = biz
      .filter((t) => t.type === 'withdrawal'
        && t.businessCategory !== 'Inventory / COGS'
        && t.businessCategory !== 'Inventory Purchase')
      .reduce((s, t) => s + t.amount, 0);
    const totalCOGS = directCOGS + inventoryCOGS;
    const grossProfit = income - totalCOGS;
    return { income, totalCOGS, directCOGS, inventoryCOGS, opEx, grossProfit, net: grossProfit - opEx };
  }, [nonTransfer, inventoryCOGS]);

  async function handleExportPDF() {
    const api = el();
    if (!api) return;
    setExporting(true);
    try {
      const businessName = activeProfile?.name ?? 'Business';
      const yearLabel = selectedYear === 'all' ? 'All Years' : selectedYear;
      const dateRange = selectedYear !== 'all'
        ? `Fiscal Year ${selectedYear}`
        : monthly.length > 0
          ? `${monthly[0].label} – ${monthly[monthly.length - 1].label}`
          : 'All Years';

      // Convert logo to base64 for embedding in PDF
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

      const monthRows = monthly.map((m) => `
        <tr>
          <td>${m.label}</td>
          <td class="num green">${fmt(m.bizIncome)}</td>
          <td class="num red">${fmt(m.bizExpenses)}</td>
          <td class="num ${m.bizNet >= 0 ? 'blue' : 'red'} bold">${fmt(m.bizNet)}</td>
          <td class="num gray">${m.bizIncome > 0 ? ((m.bizNet / m.bizIncome) * 100).toFixed(1) + '%' : '—'}</td>
        </tr>`).join('');

      const expRows = expenseByBizCat.map((r, i) => {
        const totalExp = expenseByBizCat.reduce((s, x) => s + x.value, 0);
        const colors = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#5AC8FA','#FFCC00','#FF2D55','#4CD964','#8E8E93'];
        return `<tr>
          <td><span class="dot" style="background:${colors[i % colors.length]}"></span>${r.name}</td>
          <td class="num red">${fmt(r.value)}</td>
          <td class="num gray">${((r.value / totalExp) * 100).toFixed(1)}%</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; padding: 32px; }
  .header { margin-bottom: 24px; border-bottom: 2px solid #007AFF; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .header-logo { width: 52px; height: 52px; object-fit: contain; }
  .header h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0; }
  .header .sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 10px; color: #9ca3af; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
  .card .label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; }
  .card .value { font-size: 18px; font-weight: 700; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #f3f4f6; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: #9ca3af; padding: 6px 10px; text-align: left; background: #f9fafb; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  tr:last-child td { border-bottom: none; }
  tfoot td { background: #f9fafb; font-weight: 600; border-top: 1px solid #e5e7eb; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .green { color: #059669; }
  .red { color: #dc2626; }
  .blue { color: #007AFF; }
  .gray { color: #9ca3af; }
  .bold { font-weight: 600; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .disclaimer { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; font-size: 10px; color: #92400e; margin-bottom: 24px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #d1d5db; text-align: center; }
</style></head><body>
  <div class="header">
    <div class="header-left">
      ${logoDataUrl ? `<img class="header-logo" src="${logoDataUrl}" alt="SpeedMag" />` : ''}
      <div>
        <div class="sub">SpeedMag Bookkeeping</div>
        <h1>Profit &amp; Loss Statement</h1>
        <div class="sub">${businessName} &nbsp;·&nbsp; ${dateRange}</div>
      </div>
    </div>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <div class="summary">
    <div class="card"><div class="label">Business Revenue</div><div class="value green">${fmt(totals.income)}</div></div>
    <div class="card"><div class="label">Business Expenses</div><div class="value red">${fmt(totals.expenses)}</div></div>
    <div class="card"><div class="label">Net Income</div><div class="value ${totals.net >= 0 ? 'blue' : 'red'}">${fmt(totals.net)}</div></div>
    <div class="card"><div class="label">Net Margin</div><div class="value ${totals.net >= 0 ? 'blue' : 'red'}">${totals.income > 0 ? ((totals.net / totals.income) * 100).toFixed(1) + '%' : '—'}</div></div>
  </div>

  <div class="section">
    <h2>Monthly Profit & Loss</h2>
    <table>
      <thead><tr><th>Month</th><th class="num">Revenue</th><th class="num">Expenses</th><th class="num">Net Income</th><th class="num">Margin</th></tr></thead>
      <tbody>${monthRows}</tbody>
      <tfoot><tr>
        <td>Total</td>
        <td class="num green">${fmt(totals.income)}</td>
        <td class="num red">${fmt(totals.expenses)}</td>
        <td class="num ${totals.net >= 0 ? 'blue' : 'red'}">${fmt(totals.net)}</td>
        <td class="num gray">${totals.income > 0 ? ((totals.net / totals.income) * 100).toFixed(1) + '%' : '—'}</td>
      </tr></tfoot>
    </table>
  </div>

  ${expenseByBizCat.length > 0 ? `<div class="section">
    <h2>Business Expenses by Category</h2>
    <table>
      <thead><tr><th>Category</th><th class="num">Amount</th><th class="num">% of Total</th></tr></thead>
      <tbody>${expRows}</tbody>
      <tfoot><tr>
        <td>Total</td>
        <td class="num red">${fmt(expenseByBizCat.reduce((s, r) => s + r.value, 0))}</td>
        <td class="num gray">100%</td>
      </tr></tfoot>
    </table>
  </div>` : ''}

  ${(ownerActivity.draws > 0 || ownerActivity.contributions > 0) ? `<div class="section">
    <h2>Owner's Equity Activity</h2>
    <p style="font-size:10px;color:#9ca3af;margin-bottom:8px;">Personal transactions — excluded from net income above</p>
    <table>
      <tbody>
        ${ownerActivity.contributions > 0 ? `<tr><td>Owner's Contributions</td><td class="num gray" style="font-size:10px">Personal deposits</td><td class="num green">${fmt(ownerActivity.contributions)}</td></tr>` : ''}
        ${ownerActivity.draws > 0 ? `<tr><td>Owner's Draws</td><td class="num gray" style="font-size:10px">Personal withdrawals</td><td class="num red">(${fmt(ownerActivity.draws)})</td></tr>` : ''}
      </tbody>
      <tfoot><tr>
        <td colspan="2">Net Personal Cash Flow</td>
        <td class="num ${ownerActivity.contributions - ownerActivity.draws >= 0 ? 'blue' : 'red'}">${fmt(ownerActivity.contributions - ownerActivity.draws)}</td>
      </tr></tfoot>
    </table>
  </div>` : ''}

  <div class="disclaimer">
    <strong>For reference only.</strong> This report is based on your transaction categorizations.
    Consult a qualified tax professional or CPA for accurate financial and tax advice.
  </div>

  <div class="footer">SpeedMag Bookkeeping &nbsp;·&nbsp; ${businessName} &nbsp;·&nbsp; Confidential</div>
</body></html>`;

      const slug = businessName.replace(/\s+/g, '-').toLowerCase();
      const filename = `${slug}-pl-${yearLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      await api.exportPDF({ html, filename });
    } finally {
      setExporting(false);
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 fade-up">
        <FileText size={40} className="text-gray-300" />
        <p className="text-gray-400 text-sm">Import statements to view reports</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col fade-up">
      {/* Tab bar */}
      <div className="flex items-end gap-1 px-6 pt-5 pb-0 border-b border-gray-100 bg-white">
        <h1 className="text-2xl font-bold text-gray-900 mr-6 pb-4">Reports</h1>
        <div className="flex gap-1 pb-0 flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab === 'pl' && el() && (
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 mb-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0"
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── Balance Sheet ─────────────────────────────────────────── */}
        {tab === 'balance' && (
          <BalanceSheet
            transactions={transactions}
            entries={data.balanceSheetEntries ?? []}
            retainedEarnings={data.retainedEarnings ?? 0}
            activeProfile={activeProfile}
            selectedYear={selectedYear}
            inventoryItems={data.inventoryItems ?? []}
            inventoryTransactions={data.inventoryTransactions ?? []}
            onUpdate={onUpdateBalanceSheet}
          />
        )}

        {/* ── P&L Statement ─────────────────────────────────────────── */}
        {tab === 'pl' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="card p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">{fmt(totals.income)}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">COGS</p>
                <p className="text-2xl font-bold text-orange-500">{fmt(totals.totalCOGS)}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Gross Profit</p>
                <p className={`text-2xl font-bold ${totals.grossProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {fmt(totals.grossProfit)}
                </p>
              </div>
              <div className="card p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Net Income</p>
                <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  {fmt(totals.net)}
                </p>
              </div>
            </div>

            {/* COGS breakdown (only show if COGS > 0) */}
            {totals.totalCOGS > 0 && (
              <div className="card px-5 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Cost of Goods Sold Breakdown</p>
                <div className="flex gap-6 text-sm">
                  {totals.inventoryCOGS > 0 && (
                    <span className="text-gray-600">
                      Inventory module: <span className="font-semibold text-orange-600">{fmt(totals.inventoryCOGS)}</span>
                    </span>
                  )}
                  {totals.directCOGS > 0 && (
                    <span className="text-gray-600">
                      Direct (tagged transactions): <span className="font-semibold text-orange-600">{fmt(totals.directCOGS)}</span>
                    </span>
                  )}
                  <span className="text-gray-600">
                    Operating expenses: <span className="font-semibold text-red-500">{fmt(totals.opEx)}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Monthly P&L table — business only */}
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Monthly Profit & Loss</h3>
                <p className="text-xs text-gray-400 mt-0.5">Business transactions only</p>
              </div>
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">COGS</th>
                    <th className="text-right">Gross Profit</th>
                    <th className="text-right">Op. Expenses</th>
                    <th className="text-right">Net Income</th>
                    <th className="text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => {
                    // Direct COGS from transactions (monthly)
                    const mDirectCOGS = 0; // monthly COGS breakdown requires monthly inv txns — shown in totals
                    const mGross = m.bizIncome - mDirectCOGS;
                    const mOpEx = m.bizExpenses - mDirectCOGS;
                    return (
                    <tr key={m.ym}>
                      <td className="font-medium">{m.label}</td>
                      <td className="text-right text-emerald-600 tabular-nums">{fmt(m.bizIncome)}</td>
                      <td className="text-right text-orange-500 tabular-nums">{fmt(mDirectCOGS) === fmt(0) ? '—' : fmt(mDirectCOGS)}</td>
                      <td className={`text-right tabular-nums ${mGross >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(mGross)}</td>
                      <td className="text-right text-red-500 tabular-nums">{fmt(mOpEx)}</td>
                      <td className={`text-right font-semibold tabular-nums ${m.bizNet >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {fmt(m.bizNet)}
                      </td>
                      <td className="text-right text-gray-400 tabular-nums">
                        {m.bizIncome > 0 ? ((m.bizNet / m.bizIncome) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  )})}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm">Total</td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-600 tabular-nums">{fmt(totals.income)}</td>
                    <td className="px-4 py-3 text-sm text-right text-orange-500 tabular-nums">{fmt(totals.totalCOGS)}</td>
                    <td className={`px-4 py-3 text-sm text-right tabular-nums ${totals.grossProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {fmt(totals.grossProfit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-500 tabular-nums">{fmt(totals.opEx)}</td>
                    <td className={`px-4 py-3 text-sm text-right tabular-nums ${totals.net >= 0 ? 'text-primary' : 'text-red-500'}`}>
                      {fmt(totals.net)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400">
                      {totals.income > 0 ? ((totals.net / totals.income) * 100).toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Owner's Equity Activity */}
            {(ownerActivity.draws > 0 || ownerActivity.contributions > 0) && (
              <div className="card">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Owner's Equity Activity</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Personal transactions — excluded from net income above</p>
                </div>
                <table className="w-full data-table">
                  <tbody>
                    {ownerActivity.contributions > 0 && (
                      <tr>
                        <td className="font-medium text-gray-700">Owner's Contributions</td>
                        <td className="text-xs text-gray-400">Personal deposits</td>
                        <td className="text-right text-emerald-600 tabular-nums font-semibold">{fmt(ownerActivity.contributions)}</td>
                      </tr>
                    )}
                    {ownerActivity.draws > 0 && (
                      <tr>
                        <td className="font-medium text-gray-700">Owner's Draws</td>
                        <td className="text-xs text-gray-400">Personal withdrawals</td>
                        <td className="text-right text-red-500 tabular-nums font-semibold">({fmt(ownerActivity.draws)})</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm" colSpan={2}>Net Personal Cash Flow</td>
                      <td className={`px-4 py-3 text-sm text-right tabular-nums ${
                        ownerActivity.contributions - ownerActivity.draws >= 0 ? 'text-primary' : 'text-red-500'
                      }`}>
                        {fmt(ownerActivity.contributions - ownerActivity.draws)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Cash Flow ─────────────────────────────────────────────── */}
        {tab === 'cashflow' && (
          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Cash Flow</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthly} barGap={4} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#34C759" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#FF3B30" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Cash Flow Detail</h3>
              </div>
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Cash In</th>
                    <th className="text-right">Cash Out</th>
                    <th className="text-right">Net Cash Flow</th>
                    <th className="text-right">Business In</th>
                    <th className="text-right">Business Out</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.ym}>
                      <td className="font-medium">{m.label}</td>
                      <td className="text-right text-emerald-600 tabular-nums">{fmt(m.income)}</td>
                      <td className="text-right text-red-500 tabular-nums">{fmt(m.expenses)}</td>
                      <td className={`text-right font-semibold tabular-nums ${m.net >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {fmt(m.net)}
                      </td>
                      <td className="text-right text-gray-500 tabular-nums">{fmt(m.bizIncome)}</td>
                      <td className="text-right text-gray-500 tabular-nums">{fmt(m.bizExpenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Expense Breakdown ─────────────────────────────────────── */}
        {tab === 'expenses' && (
          <div className="space-y-6">
            {expenseByBizCat.length === 0 ? (
              <div className="card p-8 text-center text-gray-400 text-sm">
                No business expenses categorized yet. Go to Transactions to categorize.
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-4">
                {/* Pie chart */}
                <div className="card p-5 col-span-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">By Category</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={expenseByBizCat} cx="50%" cy="50%" outerRadius={100}
                        dataKey="value" nameKey="name" label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        } labelLine={false}>
                        {expenseByBizCat.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Table */}
                <div className="card col-span-3">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">Business Expenses by Category</h3>
                  </div>
                  <table className="w-full data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseByBizCat.map((row, i) => {
                        const totalExp = expenseByBizCat.reduce((s, r) => s + r.value, 0);
                        return (
                          <tr key={row.name}>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                {row.name}
                              </div>
                            </td>
                            <td className="text-right text-red-500 tabular-nums font-medium">{fmt(row.value)}</td>
                            <td className="text-right text-gray-400 tabular-nums">
                              {((row.value / totalExp) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-3 text-sm">Total</td>
                        <td className="px-4 py-3 text-sm text-right text-red-500 tabular-nums">
                          {fmt(expenseByBizCat.reduce((s, r) => s + r.value, 0))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly expense bar */}
            {expenseByBizCat.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Business Expenses</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="bizExpenses" name="Business Expenses" fill="#FF3B30" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── Tax Summary ────────────────────────────────────────────── */}
        {tab === 'tax' && (
          <div className="space-y-6">
            {/* Summary boxes */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-5 border-l-4 border-emerald-400">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Gross Business Income</p>
                <p className="text-2xl font-bold text-emerald-600">{fmt(taxData.income)}</p>
                <p className="text-xs text-gray-400 mt-1">All business deposits</p>
              </div>
              <div className="card p-5 border-l-4 border-red-400">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Deductible Expenses</p>
                <p className="text-2xl font-bold text-red-500">{fmt(taxData.totalExpenses)}</p>
                <p className="text-xs text-gray-400 mt-1">All business withdrawals</p>
              </div>
              <div className="card p-5 border-l-4 border-primary">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Net Taxable Income</p>
                <p className={`text-2xl font-bold ${taxData.net >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  {fmt(taxData.net)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Income minus deductions</p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Receipt size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>For reference only.</strong> This summary is based on your transaction categorizations.
                Consult a qualified tax professional or CPA for accurate tax advice.
              </span>
            </div>

            {/* Expense breakdown for taxes */}
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Schedule C — Business Expense Categories</h3>
              </div>
              {taxData.byCategory.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">
                  No business expenses categorized. Categorize transactions to see tax summary.
                </p>
              ) : (
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>Expense Category</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxData.byCategory.map((row) => (
                      <tr key={row.category}>
                        <td>{row.category}</td>
                        <td className="text-right text-red-500 tabular-nums font-medium">{fmt(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm">Total Deductible Expenses</td>
                      <td className="px-4 py-3 text-sm text-right text-red-500 tabular-nums">{fmt(taxData.totalExpenses)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Income by category */}
            <div className="card">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Business Income Detail</h3>
              </div>
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Income Category</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const map = new Map<string, number>();
                    for (const t of nonTransfer) {
                      if (t.category !== 'Business' || t.type !== 'deposit') continue;
                      const k = t.businessCategory ?? 'Business Income';
                      map.set(k, (map.get(k) ?? 0) + t.amount);
                    }
                    return Array.from(map.entries())
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => (
                        <tr key={cat}>
                          <td>{cat}</td>
                          <td className="text-right text-emerald-600 tabular-nums font-medium">{fmt(amt)}</td>
                        </tr>
                      ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm">Total Business Income</td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-600 tabular-nums">{fmt(taxData.income)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
