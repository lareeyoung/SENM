const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("see2p", {
  platform: process.platform,
  writeClipboard: (text) => ipcRenderer.invoke("clipboard:write", text),
  readClipboard: () => ipcRenderer.invoke("clipboard:read"),
  openMainWindow: () => ipcRenderer.invoke("window:openMain"),
  openPromptAgentSettings: () => ipcRenderer.invoke("window:openAgentSettings"),
  consumePromptAgentSettingsRequest: () => ipcRenderer.invoke("promptAgent:consumeSettingsRequest"),
  onOpenPromptAgentSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("promptAgent:openSettings", listener);
    return () => ipcRenderer.removeListener("promptAgent:openSettings", listener);
  },
  hideQuickWindow: () => ipcRenderer.invoke("window:hideQuick"),
  readQuickPinned: () => ipcRenderer.invoke("window:quickPinned"),
  toggleQuickPinned: () => ipcRenderer.invoke("window:toggleQuickPinned"),
  onQuickFocusInput: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("quick:focusInput", listener);
    return () => ipcRenderer.removeListener("quick:focusInput", listener);
  },
  readSettings: () => ipcRenderer.invoke("settings:read"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggleAlwaysOnTop"),
  saveText: (payload) => ipcRenderer.invoke("file:saveText", payload),
  scanMedia: (folder) => ipcRenderer.invoke("media:scan", folder),
  chooseMediaFolder: () => ipcRenderer.invoke("media:chooseFolder"),
  chooseMediaFiles: () => ipcRenderer.invoke("media:chooseFiles"),
  revealMedia: (path) => ipcRenderer.invoke("media:reveal", path),
  openMedia: (path) => ipcRenderer.invoke("media:open", path),
  readPromptAgentSettings: () => ipcRenderer.invoke("promptAgent:settings"),
  onPromptAgentSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("promptAgent:settingsChanged", listener);
    return () => ipcRenderer.removeListener("promptAgent:settingsChanged", listener);
  },
  configurePromptAgent: (payload) => ipcRenderer.invoke("promptAgent:configure", payload),
  testPromptAgent: (payload) => ipcRenderer.invoke("promptAgent:test", payload),
  generateWithPromptAgent: (payload) => ipcRenderer.invoke("promptAgent:generate", payload),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url)
});
