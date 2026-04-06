import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  Upload,
  Settings,
  ChevronDown,
  Building2,
  Package,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { ActiveView, Profile } from '../types';
import logoUrl from '../assets/logo.png';

interface Props {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  transactionCount: number;
  activeProfile: Profile | null;
  profiles: Profile[];
  onSwitchProfile: (id: string) => void;
  selectedYear: string;
  availableYears: string[];
  onYearChange: (year: string) => void;
}

const NAV = [
  { id: 'dashboard' as ActiveView, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions' as ActiveView, label: 'Transactions', icon: ArrowLeftRight },
  { id: 'reports' as ActiveView, label: 'Reports', icon: BarChart3 },
  { id: 'inventory' as ActiveView, label: 'Inventory', icon: Package },
  { id: 'upload' as ActiveView, label: 'Import Statements', icon: Upload },
  { id: 'settings' as ActiveView, label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeView, onNavigate, transactionCount, activeProfile, profiles, onSwitchProfile, selectedYear, availableYears, onYearChange }: Props) {
  const [showSwitcher, setShowSwitcher] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSwitcher(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-full"
      style={{ background: '#1C1C1E' }}
    >
      {/* Traffic lights spacer + logo */}
      <div className="titlebar-drag pt-9 px-4 pb-4">
        <div className="titlebar-no-drag flex items-center gap-2 mt-1">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden">
            <img src={logoUrl} alt="SpeedMag" className="w-5 h-5 object-contain" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">SpeedMag</p>
            <p className="text-white/40 text-[10px] leading-tight">Financial Planner</p>
          </div>
        </div>
      </div>

      {/* Active profile switcher */}
      <div className="px-2 mb-2" ref={ref}>
        <div className="relative">
          <button
            onClick={() => profiles.length > 1 ? setShowSwitcher((v) => !v) : onNavigate('profiles')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-white/10 group"
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: activeProfile ? activeProfile.color + '33' : '#ffffff22' }}
            >
              <Building2 size={12} style={{ color: activeProfile?.color ?? '#9CA3AF' }} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white/80 text-xs font-medium truncate leading-tight">
                {activeProfile?.name ?? 'No profile'}
              </p>
              <p className="text-white/30 text-[10px] leading-tight">
                {profiles.length > 1 ? `${profiles.length} businesses` : 'Active business'}
              </p>
            </div>
            <ChevronDown size={12} className="text-white/30 group-hover:text-white/60 shrink-0" />
          </button>

          {showSwitcher && profiles.length > 1 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-50 shadow-xl"
              style={{ background: '#2C2C2E', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSwitchProfile(p.id); setShowSwitcher(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-colors"
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ background: p.color + '33' }}
                  >
                    <Building2 size={10} style={{ color: p.color }} />
                  </div>
                  <span className="text-white/80 text-xs truncate flex-1 text-left">{p.name}</span>
                  {p.id === activeProfile?.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => { onNavigate('profiles'); setShowSwitcher(false); }}
                  className="w-full px-3 py-2 text-left text-white/40 text-xs hover:bg-white/10 transition-colors"
                >
                  Manage businesses…
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Year filter */}
      <div className="px-3 mb-3">
        <p className="text-white/30 text-[10px] font-medium uppercase tracking-wide mb-1.5">Tax Year</p>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => onYearChange('all')}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
              selectedYear === 'all'
                ? 'bg-primary text-white'
                : 'text-white/50 hover:text-white/80 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => onYearChange(y)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                selectedYear === y
                  ? 'bg-primary text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/10'
              }`}
            >
              {y}
            </button>
          ))}
          {availableYears.length === 0 && (
            <span className="text-white/20 text-xs italic">No data yet</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`sidebar-item w-full ${activeView === id ? 'active' : ''}`}
          >
            <Icon size={16} strokeWidth={activeView === id ? 2.5 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 pb-6">
        <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-wide mb-0.5">
            Total Transactions
          </p>
          <p className="text-white text-base font-semibold">
            {transactionCount.toLocaleString()}
          </p>
        </div>
      </div>
    </aside>
  );
}
