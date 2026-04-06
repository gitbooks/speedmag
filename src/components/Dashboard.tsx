import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Tag, AlertCircle, ArrowRight } from 'lucide-react';
import type { AppData, ActiveView, Transaction } from '../types';

interface Props {
  data: AppData;
  onNavigate: (view: ActiveView) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Dashboard({ data, onNavigate }: Props) {
  const { statements, transactions } = data;

  const stats = useMemo(() => {
    const nonTransfer = transactions.filter((t) => t.category !== 'Transfer');
    const deposits = nonTransfer.filter((t) => t.type === 'deposit');
    const withdrawals = nonTransfer.filter((t) => t.type === 'withdrawal');
    const bizTxns = nonTransfer.filter((t) => t.category === 'Business');
    const bizIncome = bizTxns.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
    const bizExpenses = bizTxns.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
    const totalIncome = deposits.reduce((s, t) => s + t.amount, 0);
    const totalExpenses = withdrawals.reduce((s, t) => s + t.amount, 0);
    const uncategorized = transactions.filter((t) => t.category === 'Uncategorized').length;
    return { totalIncome, totalExpenses, net: totalIncome - totalExpenses, bizIncome, bizExpenses, uncategorized };
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    for (const t of transactions) {
      if (t.category === 'Transfer') continue;
      const ym = t.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, { income: 0, expenses: 0 });
      const entry = map.get(ym)!;
      if (t.type === 'deposit') entry.income += t.amount;
      else entry.expenses += t.amount;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, vals]) => {
        const [y, m] = ym.split('-');
        return { label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, ...vals, net: vals.income - vals.expenses };
      });
  }, [transactions]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [transactions]
  );

  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 fade-up">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <DollarSign size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Welcome to SpeedMag</h2>
          <p className="text-gray-500 text-sm max-w-xs">
            Import your bank statements to get started. Your financial overview will appear here.
          </p>
        </div>
        <button
          onClick={() => onNavigate('upload')}
          className="mt-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          Import Statements
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {statements.length} statement{statements.length !== 1 ? 's' : ''} imported
            {transactions.length > 0 && ` · ${transactions.length} transactions`}
          </p>
        </div>
        {stats.uncategorized > 0 && (
          <button
            onClick={() => onNavigate('transactions')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <AlertCircle size={14} />
            {stats.uncategorized} uncategorized
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Income"
          value={fmt(stats.totalIncome)}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          color="emerald"
          sub="All deposits"
        />
        <StatCard
          label="Total Expenses"
          value={fmt(stats.totalExpenses)}
          icon={<TrendingDown size={18} className="text-red-500" />}
          color="red"
          sub="All withdrawals"
        />
        <StatCard
          label="Net Income"
          value={fmt(stats.net)}
          icon={<DollarSign size={18} className={stats.net >= 0 ? 'text-primary' : 'text-red-500'} />}
          color={stats.net >= 0 ? 'blue' : 'red'}
          sub="Income minus expenses"
        />
        <StatCard
          label="Business Expenses"
          value={fmt(stats.bizExpenses)}
          icon={<Briefcase size={18} className="text-violet-600" />}
          color="violet"
          sub="Tax-deductible"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* Monthly cash flow */}
        <div className="card p-5 col-span-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Cash Flow</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barGap={3} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#34C759" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#FF3B30" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Net income trend */}
        <div className="card p-5 col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Net Income Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#007AFF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Area type="monotone" dataKey="net" name="Net" stroke="#007AFF" strokeWidth={2}
                fill="url(#netGrad)" dot={{ r: 3, fill: '#007AFF' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Recent Transactions</h3>
          <button
            onClick={() => onNavigate('transactions')}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((t) => (
              <RecentRow key={t.id} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub: string }) {
  const bg: Record<string, string> = {
    emerald: 'bg-emerald-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
    violet: 'bg-violet-50',
  };
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${bg[color] ?? 'bg-gray-50'} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function RecentRow({ t }: { t: Transaction }) {
  const badge: Record<string, string> = {
    Business: 'badge-business',
    Personal: 'badge-personal',
    Transfer: 'badge-transfer',
    Uncategorized: 'badge-uncategorized',
  };
  return (
    <tr>
      <td className="whitespace-nowrap text-gray-500">{t.date}</td>
      <td className="max-w-xs truncate">{t.description}</td>
      <td>
        <span className={`badge ${badge[t.category] ?? 'badge-uncategorized'}`}>
          {t.businessCategory ?? t.category}
        </span>
      </td>
      <td className={`text-right whitespace-nowrap ${t.type === 'deposit' ? 'amount-deposit' : 'amount-withdrawal'}`}>
        {t.type === 'deposit' ? '+' : '-'}${t.amount.toFixed(2)}
      </td>
    </tr>
  );
}
