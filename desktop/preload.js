/**
 * Preload: expõe uma API mínima e segura ao painel (contextIsolation).
 * Só o necessário para configurar credenciais e reagir ao menu.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('edugestao', {
  lerConfig: () => ipcRenderer.invoke('config:ler'),
  salvarConfig: (c) => ipcRenderer.invoke('config:salvar', c),
  aoAbrirConfig: (cb) => ipcRenderer.on('abrir-config', cb),
});
