import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Building2, AlertTriangle, X } from 'lucide-react';
import type { Profile } from '../types';
import { PROFILE_COLORS } from '../types';

interface Props {
  profiles: Profile[];
  activeProfileId: string | null;
  onCreateProfile: (name: string, color: string) => void;
  onSwitchProfile: (id: string) => void;
  onUpdateProfile: (id: string, name: string, color: string) => void;
  onDeleteProfile: (id: string) => void;
}

export default function ProfileManager({
  profiles, activeProfileId,
  onCreateProfile, onSwitchProfile, onUpdateProfile, onDeleteProfile,
}: Props) {
  const [showCreate, setShowCreate] = useState(profiles.length === 0);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PROFILE_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    onCreateProfile(newName.trim(), newColor);
    setNewName('');
    setNewColor(PROFILE_COLORS[0]);
    setShowCreate(false);
  }

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    onUpdateProfile(editingId, editName.trim(), editColor);
    setEditingId(null);
  }

  const isFirst = profiles.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 fade-up">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Profiles</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Each profile has its own statements, transactions, and reports
            </p>
          </div>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              <Plus size={15} /> New Business
            </button>
          )}
        </div>

        {/* First-run message */}
        {isFirst && !showCreate && (
          <div className="card p-10 text-center">
            <Building2 size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No businesses yet. Create your first one to get started.</p>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="card p-5 mb-4 border-2 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">New Business Profile</h3>
              {!isFirst && (
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Business name (e.g. Rader LLC)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div>
                <p className="text-xs text-gray-400 mb-2">Color</p>
                <div className="flex gap-2">
                  {PROFILE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      style={{ background: c }}
                      className={`w-7 h-7 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
              >
                Create Profile
              </button>
            </div>
          </div>
        )}

        {/* Profile list */}
        <div className="space-y-3">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            const isEditing = editingId === p.id;
            const isConfirming = confirmDeleteId === p.id;

            return (
              <div
                key={p.id}
                className={`card p-4 transition-all ${isActive ? 'border-2 border-primary/40' : ''}`}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      {PROFILE_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          style={{ background: c }}
                          className={`w-6 h-6 rounded-full transition-transform ${editColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={saveEdit} disabled={!editName.trim()}
                        className="flex-1 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-40">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-3">
                    {/* Color dot + name */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: p.color + '22' }}
                    >
                      <Building2 size={18} style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                        {isActive && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Created {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && !isConfirming && (
                        <button
                          onClick={() => onSwitchProfile(p.id)}
                          className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                        >
                          Open
                        </button>
                      )}
                      {!isConfirming && (
                        <>
                          <button onClick={() => startEdit(p)}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                            <Pencil size={13} className="text-gray-400" />
                          </button>
                          {profiles.length > 1 && (
                            <button onClick={() => setConfirmDeleteId(p.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors group">
                              <Trash2 size={13} className="text-gray-300 group-hover:text-red-400 transition-colors" />
                            </button>
                          )}
                        </>
                      )}
                      {isConfirming && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle size={12} />
                            <span>Delete all data?</span>
                          </div>
                          <button onClick={() => { onDeleteProfile(p.id); setConfirmDeleteId(null); }}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600">
                            Yes, Delete
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-50">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tip */}
        {profiles.length > 0 && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Each business profile stores its own statements, transactions, and categorizations separately.
          </p>
        )}
      </div>
    </div>
  );
}
