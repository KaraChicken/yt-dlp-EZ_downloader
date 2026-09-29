const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ytDlp', {
  getInfo: (url, options = {}) => ipcRenderer.invoke('get-info', { url, options }),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  startDownload: (job) => ipcRenderer.invoke('start-download', job),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  checkTools: () => ipcRenderer.invoke('check-tools'),
  onProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('download-log', (_, data) => callback(data)),
  onComplete: (callback) => ipcRenderer.on('download-complete', (_, data) => callback(data))
});
