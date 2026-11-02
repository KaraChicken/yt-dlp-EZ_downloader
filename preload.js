const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  if (typeof callback !== "function") throw new TypeError("callback must be a function");
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("ytDlp", Object.freeze({
  getInfo: (url, options = {}) => ipcRenderer.invoke("get-info", { url, options }),
  chooseFolder: () => ipcRenderer.invoke("choose-folder"),
  startDownload: job => ipcRenderer.invoke("start-download", job),
  cancelDownload: () => ipcRenderer.invoke("cancel-download"),
  checkTools: () => ipcRenderer.invoke("check-tools"),
  onProgress: callback => subscribe("download-progress", callback),
  onLog: callback => subscribe("download-log", callback),
  onComplete: callback => subscribe("download-complete", callback)
}));
