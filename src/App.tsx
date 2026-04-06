import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import Upload from './components/Upload';
import Settings from './components/Settings';
import ProfileManager from './components/ProfileManager';
import Inventory from './components/Inventory';
import type { AppData, ActiveView, Transaction, Profile, BalanceSheetEntry, InventoryItem, InventoryTransaction } from './types';

const emptyData: AppData = { statements: [], transactions: [] };

type ElectronAPI = {
  loadProfiles: () => Promise<{ profiles: Profile[]; activeProfileId: string | null }>;
  createProfile: (o: { name: string; color: string }) => Promise<{ profiles: Profile[]; activeProfileId: string; data: AppData }>;
  updateProfile: (o: { id: string; name: string; color: string }) => Promise<Profile[]>;
  deleteProfile: (id: string) => Promise<{ profiles: Profile[]; activeProfileId: string | null; data: AppData }>;
  switchProfile: (id: string) => Promise<{ activeProfileId: string; data: AppData }>;
  loadData: () => Promise<AppData>;
  saveData: (d: AppData) => Promise<void>;
  openFileDialog: () => Promise<string[]>;
  importStatements: (paths: string[]) => Promise<{ results: unknown[]; data: AppData }>;
  deleteStatement: (id: string) => Promise<AppData>;
  updateTransactions: (u: Pick<Transaction, 'id' | 'category' | 'businessCategory'>[]) => Promise<void>;
  exportCSV: (t: Transaction[]) => Promise<void>;
  exportPDF: (o: { html: string; filename: string }) => Promise<string | false>;
};

const el = () => (window as unknown as { electron?: ElectronAPI }).electron;

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [view, setView] = useState<ActiveView>('dashboard');
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

  // ── Startup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const api = el();
    if (api) {
      api.loadProfiles().then(({ profiles: profs, activeProfileId: activeId }) => {
        setProfiles(profs);
        setActiveProfileId(activeId);
        if (activeId) {
          api.loadData().then((d) => { setData(d || emptyData); setLoading(false); });
        } else {
          // No profiles yet — show profile manager
          setLoading(false);
          setView('profiles');
        }
      });
    } else {
      // Browser dev fallback
      try { const s = localStorage.getItem('speedmag-data'); if (s) setData(JSON.parse(s)); } catch {}
      setLoading(false);
    }
  }, []);

  // Browser fallback persistence
  useEffect(() => {
    if (loading || el()) return;
    localStorage.setItem('speedmag-data', JSON.stringify(data));
  }, [data, loading]);

  // ── Profile handlers ─────────────────────────────────────────────────────────
  const handleCreateProfile = useCallback(async (name: string, color: string) => {
    const api = el();
    if (!api) return;
    const res = await api.createProfile({ name, color });
    setProfiles(res.profiles);
    setActiveProfileId(res.activeProfileId);
    setData(res.data);
    setView('dashboard');
  }, []);

  const handleSwitchProfile = useCallback(async (id: string) => {
    const api = el();
    if (!api) return;
    const res = await api.switchProfile(id);
    setActiveProfileId(res.activeProfileId);
    setData(res.data);
    setView('dashboard');
  }, []);

  const handleUpdateProfile = useCallback(async (id: string, name: string, color: string) => {
    const api = el();
    if (!api) return;
    const updated = await api.updateProfile({ id, name, color });
    setProfiles(updated);
  }, []);

  const handleDeleteProfile = useCallback(async (id: string) => {
    const api = el();
    if (!api) return;
    const res = await api.deleteProfile(id);
    setProfiles(res.profiles);
    setActiveProfileId(res.activeProfileId);
    setData(res.data || emptyData);
    if (!res.activeProfileId) setView('profiles');
  }, []);

  // ── Data handlers ────────────────────────────────────────────────────────────
  const handleImport = useCallback((newData: AppData) => {
    setData(newData);
    setView('transactions');
  }, []);

  const handleUpdateTransactions = useCallback((updated: Transaction[]) => {
    setData((prev) => {
      const map = new Map(updated.map((t) => [t.id, t]));
      return { ...prev, transactions: prev.transactions.map((t) => map.get(t.id) ?? t) };
    });
    el()?.updateTransactions(
      updated.map((t) => ({ id: t.id, category: t.category, businessCategory: t.businessCategory }))
    );
  }, []);

  const handleUpdateInventory = useCallback((inventoryItems: InventoryItem[], inventoryTransactions: InventoryTransaction[]) => {
    setData((prev) => {
      const next = { ...prev, inventoryItems, inventoryTransactions };
      el()?.saveData(next);
      return next;
    });
  }, []);

  const handleUpdateBalanceSheet = useCallback((balanceSheetEntries: BalanceSheetEntry[], retainedEarnings: number) => {
    setData((prev) => {
      const next = { ...prev, balanceSheetEntries, retainedEarnings };
      el()?.saveData(next);
      return next;
    });
  }, []);

  const handleUpdateCustomCategories = useCallback((customBusinessCategories: string[]) => {
    setData((prev) => {
      const next = { ...prev, customBusinessCategories };
      el()?.saveData(next);
      return next;
    });
  }, []);

  const handleDeleteStatement = useCallback(async (statementId: string) => {
    const api = el();
    if (api) {
      const newData = await api.deleteStatement(statementId);
      setData(newData);
    } else {
      setData((prev) => ({
        statements: prev.statements.filter((s) => s.id !== statementId),
        transactions: prev.transactions.filter((t) => t.statementId !== statementId),
      }));
    }
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  // ── Year filter ──────────────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set(data.transactions.map((t) => t.date.slice(0, 4)));
    return [...years].sort().reverse();
  }, [data.transactions]);

  const filteredData = useMemo(() => {
    if (selectedYear === 'all') return data;
    return { ...data, transactions: data.transactions.filter((t) => t.date.startsWith(selectedYear)) };
  }, [data, selectedYear]);

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F2F2F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner w-8 h-8" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F2F7]">
      <Sidebar
        activeView={view}
        onNavigate={setView}
        transactionCount={filteredData.transactions.length}
        activeProfile={activeProfile}
        profiles={profiles}
        onSwitchProfile={handleSwitchProfile}
        selectedYear={selectedYear}
        availableYears={availableYears}
        onYearChange={setSelectedYear}
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {view === 'profiles' && (
          <ProfileManager
            profiles={profiles}
            activeProfileId={activeProfileId}
            onCreateProfile={handleCreateProfile}
            onSwitchProfile={handleSwitchProfile}
            onUpdateProfile={handleUpdateProfile}
            onDeleteProfile={handleDeleteProfile}
          />
        )}
        {view === 'dashboard' && <Dashboard data={filteredData} onNavigate={setView} activeProfile={activeProfile} />}
        {view === 'transactions' && (
          <Transactions data={filteredData} onUpdateTransactions={handleUpdateTransactions} />
        )}
        {view === 'reports' && <Reports data={filteredData} activeProfile={activeProfile} selectedYear={selectedYear} onUpdateBalanceSheet={handleUpdateBalanceSheet} />}
        {view === 'inventory' && (
          <Inventory
            items={data.inventoryItems ?? []}
            transactions={data.inventoryTransactions ?? []}
            onUpdate={handleUpdateInventory}
          />
        )}
        {view === 'upload' && <Upload data={data} onImport={handleImport} onNavigate={setView} />}
        {view === 'settings' && (
          <Settings data={data} onDeleteStatement={handleDeleteStatement} onUpdateCustomCategories={handleUpdateCustomCategories} />
        )}
      </main>
    </div>
  );
}
