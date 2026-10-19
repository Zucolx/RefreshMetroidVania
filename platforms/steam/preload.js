// Expone window.electronAPI, que es lo que detecta src/platform.js para activar el objetivo "steam".
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  storage: {
    get: (k) => ipcRenderer.sendSync('storage-get', k),
    set: (k, v) => ipcRenderer.sendSync('storage-set', k, v),
    remove: (k) => ipcRenderer.sendSync('storage-remove', k),
  },
  setFullscreen: (v) => ipcRenderer.send('set-fullscreen', v),
  quit: () => ipcRenderer.send('quit'),
  achievement: (id) => ipcRenderer.invoke('steam-achievement', id),
});
