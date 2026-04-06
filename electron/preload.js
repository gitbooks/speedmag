const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Profiles
  loadProfiles:   ()              => ipcRenderer.invoke('profiles:load'),
  createProfile:  (opts)          => ipcRenderer.invoke('profiles:create', opts),
  updateProfile:  (opts)          => ipcRenderer.invoke('profiles:update', opts),
  deleteProfile:  (id)            => ipcRenderer.invoke('profiles:delete', id),
  switchProfile:  (id)            => ipcRenderer.invoke('profiles:switch', id),

  // Data
  loadData:       ()              => ipcRenderer.invoke('data:load'),
  saveData:       (data)          => ipcRenderer.invoke('data:save', data),

  // File dialog
  openFileDialog: ()              => ipcRenderer.invoke('dialog:openFiles'),

  // Statements
  importStatements: (paths)       => ipcRenderer.invoke('statements:import', paths),
  deleteStatement:  (id)          => ipcRenderer.invoke('statements:delete', id),

  // Transactions
  updateTransactions: (updates)   => ipcRenderer.invoke('transactions:update', updates),

  // Export
  exportCSV: (transactions)       => ipcRenderer.invoke('export:csv', transactions),
  exportPDF: (opts)               => ipcRenderer.invoke('export:pdf', opts),

  // License
  checkLicense:      ()           => ipcRenderer.invoke('license:check'),
  activateLicense:   (key)        => ipcRenderer.invoke('license:activate', key),
  deactivateLicense: ()           => ipcRenderer.invoke('license:deactivate'),
});
