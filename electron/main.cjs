const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, Tray, clipboard, globalShortcut, ipcMain, dialog, shell, nativeImage, screen } = require("electron");
const { createCredentialStore } = require("./credential-store.cjs");

// Preserve existing settings, local history and encrypted credentials after the SENM rename.
app.setPath("userData", path.join(app.getPath("appData"), "see2p-transfer"));

const isMac = process.platform === "darwin";
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const legacyCredentialsPath = () => path.join(app.getPath("userData"), "credentials.bin");
let credentialStore = null;

function getCredentialStore() {
  if (!credentialStore) credentialStore = createCredentialStore(app.getPath("userData"));
  return credentialStore;
}

function getDefaultSettings() {
  return {
    alwaysOnTop: true,
    quickPinned: false,
    shortcut: "CommandOrControl+Shift+Space",
    mediaFolder: path.join(app.getPath("documents"), "SENM"),
    promptAgent: {
      preset: "gpt-5.6-terra",
      model: "gpt-5.6-terra",
      baseUrl: "https://api.openai.com/v1",
      protocol: "auto"
    }
  };
}

let mainWindow = null;
let quickWindow = null;
let tray = null;
let shouldOpenAgentSettings = false;

function broadcastPromptAgentSettings(settings) {
  for (const window of [mainWindow, quickWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isLoadingMainFrame()) {
      window.webContents.send("promptAgent:settingsChanged", settings);
    }
  }
}

function readSettings() {
  try {
    const defaults = getDefaultSettings();
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    return {
      ...defaults,
      ...saved,
      promptAgent: { ...defaults.promptAgent, ...(saved.promptAgent || {}), hasApiKey: getCredentialStore().has() }
    };
  } catch {
    return { ...getDefaultSettings(), promptAgent: { ...getDefaultSettings().promptAgent, hasApiKey: getCredentialStore().has() } };
  }
}

function writeSettings(nextSettings) {
  const current = readSettings();
  const settings = {
    ...current,
    ...nextSettings,
    promptAgent: { ...current.promptAgent, ...(nextSettings.promptAgent || {}) }
  };
  delete settings.promptAgent.hasApiKey;
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  return readSettings();
}

function readApiKey() {
  return getCredentialStore().read();
}

function writeApiKey(value) {
  getCredentialStore().write(value);
}

function applyFloatingBehavior(window, enabled) {
  window.setAlwaysOnTop(Boolean(enabled), enabled ? "floating" : "normal");
  if (isMac) {
    window.setVisibleOnAllWorkspaces(Boolean(enabled), { visibleOnFullScreen: Boolean(enabled) });
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const settings = readSettings();
  mainWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    show: false,
    title: "SENM",
    backgroundColor: isMac ? "#00000000" : "#161617",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isMac ? {
      vibrancy: "under-window",
      visualEffectState: "active",
      trafficLightPosition: { x: 14, y: 16 }
    } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  applyFloatingBehavior(mainWindow, settings.alwaysOnTop);

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function createQuickWindow() {
  if (quickWindow && !quickWindow.isDestroyed()) return quickWindow;
  quickWindow = new BrowserWindow({
    width: 430,
    height: 620,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: "#00000000",
    vibrancy: isMac ? "popover" : undefined,
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (isMac) quickWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (isDev) {
    const url = new URL(process.env.VITE_DEV_SERVER_URL);
    url.searchParams.set("mode", "quick");
    quickWindow.loadURL(url.toString());
  } else {
    quickWindow.loadFile(path.join(__dirname, "../dist/renderer/index.html"), { query: { mode: "quick" } });
  }
  quickWindow.on("blur", () => {
    if (
      quickWindow
      && !quickWindow.isDestroyed()
      && !quickWindow.webContents.isDevToolsOpened()
      && !readSettings().quickPinned
    ) quickWindow.hide();
  });
  quickWindow.on("closed", () => {
    quickWindow = null;
  });
  return quickWindow;
}

function positionQuickWindow() {
  const window = createQuickWindow();
  const windowBounds = window.getBounds();
  const trayBounds = tray ? tray.getBounds() : { x: 0, y: 0, width: 0, height: 0 };
  const display = tray
    ? screen.getDisplayNearestPoint({ x: Math.round(trayBounds.x), y: Math.round(trayBounds.y) })
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  const centeredX = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const x = Math.max(area.x + 8, Math.min(centeredX, area.x + area.width - windowBounds.width - 8));
  const y = isMac
    ? Math.max(display.bounds.y + trayBounds.height + 6, trayBounds.y + trayBounds.height + 6)
    : Math.max(area.y + 8, trayBounds.y - windowBounds.height - 8);
  window.setPosition(x, y, false);
}

function showQuickWindow() {
  const window = createQuickWindow();
  positionQuickWindow();
  window.show();
  window.focus();
  window.webContents.send("quick:focusInput");
  window.webContents.send("promptAgent:settingsChanged", readSettings().promptAgent);
}

function toggleQuickWindow() {
  const window = createQuickWindow();
  if (window.isVisible()) {
    window.hide();
    return;
  }
  showQuickWindow();
}

function createTray() {
  if (tray) return tray;
  const iconPath = path.join(__dirname, "../dist/renderer/app-icon.png");
  let icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 }) : nativeImage.createEmpty();
  if (icon.isEmpty() && isMac) {
    icon = nativeImage.createFromNamedImage("NSImageNameTouchBarComposeTemplate");
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  if (isMac) tray.setTitle("SENM");
  tray.setToolTip("SENM 快速 Prompt");
  tray.on("click", toggleQuickWindow);
  tray.on("right-click", () => {
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: "快速生成 Prompt", click: showQuickWindow },
      {
        label: "固定悬浮小窗",
        type: "checkbox",
        checked: Boolean(readSettings().quickPinned),
        click: (item) => {
          writeSettings({ quickPinned: item.checked });
          if (item.checked) showQuickWindow();
        }
      },
      { label: "打开完整工作台", click: () => { if (quickWindow) quickWindow.hide(); toggleWindow(); } },
      { type: "separator" },
      { label: "退出 SENM", click: () => app.quit() }
    ]));
  });
  return tray;
}

function registerShortcut() {
  const settings = readSettings();
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(settings.shortcut, toggleQuickWindow);
  if (!ok) {
    globalShortcut.register(getDefaultSettings().shortcut, toggleQuickWindow);
    writeSettings({ shortcut: getDefaultSettings().shortcut });
  }
}

app.whenReady().then(() => {
  getCredentialStore().archiveLegacy(legacyCredentialsPath());
  if (isMac) {
    app.dock.hide();
    if (typeof app.setActivationPolicy === "function") app.setActivationPolicy("accessory");
  }
  createQuickWindow();
  createTray();
  registerShortcut();
  showQuickWindow();

  app.on("activate", () => {
    showQuickWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

ipcMain.handle("clipboard:write", (_event, text) => {
  clipboard.writeText(String(text ?? ""));
  return true;
});

ipcMain.handle("clipboard:read", () => clipboard.readText());

ipcMain.handle("window:openMain", () => {
  if (quickWindow) quickWindow.hide();
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
});

ipcMain.handle("window:openAgentSettings", () => {
  shouldOpenAgentSettings = true;
  if (quickWindow) quickWindow.hide();
  const window = createWindow();
  window.show();
  window.focus();
  if (!window.webContents.isLoadingMainFrame()) window.webContents.send("promptAgent:openSettings");
  return true;
});

ipcMain.handle("window:hideQuick", () => {
  if (quickWindow) quickWindow.hide();
  return true;
});

ipcMain.handle("window:quickPinned", () => Boolean(readSettings().quickPinned));

ipcMain.handle("window:toggleQuickPinned", () => {
  const quickPinned = !readSettings().quickPinned;
  writeSettings({ quickPinned });
  if (quickPinned) showQuickWindow();
  return quickPinned;
});

ipcMain.handle("settings:read", () => readSettings());

ipcMain.handle("settings:update", (_event, patch) => {
  const settings = writeSettings(patch || {});
  if (mainWindow && Object.prototype.hasOwnProperty.call(patch || {}, "alwaysOnTop")) {
    applyFloatingBehavior(mainWindow, settings.alwaysOnTop);
  }
  if (Object.prototype.hasOwnProperty.call(patch || {}, "shortcut")) {
    registerShortcut();
  }
  return settings;
});

ipcMain.handle("promptAgent:settings", () => readSettings().promptAgent);
ipcMain.handle("promptAgent:consumeSettingsRequest", () => {
  const requested = shouldOpenAgentSettings;
  shouldOpenAgentSettings = false;
  return requested;
});

ipcMain.handle("promptAgent:configure", (_event, payload) => {
  const promptAgent = payload && payload.settings ? payload.settings : {};
  if (payload && Object.prototype.hasOwnProperty.call(payload, "apiKey")) writeApiKey(payload.apiKey);
  const settings = writeSettings({ promptAgent }).promptAgent;
  broadcastPromptAgentSettings(settings);
  return settings;
});

ipcMain.handle("promptAgent:test", async (_event, payload) => {
  const current = readSettings().promptAgent;
  const settings = { ...current, ...((payload && payload.settings) || {}) };
  const apiKey = String(payload && payload.apiKey || readApiKey()).trim();
  if (!apiKey) throw new Error("请先填写 API Key");
  if (settings.preset === "local") throw new Error("当前选择的是仅本地规则");
  const baseUrl = normalizeApiBaseUrl(settings.baseUrl, settings.preset === "custom");
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const data = await readJsonResponse(response, `${baseUrl}/models`);
  if (!response.ok) throw new Error(formatApiError(response, data));
  const modelIds = Array.isArray(data && data.data)
    ? data.data.map((item) => String(item && item.id || "")).filter(Boolean)
    : [];
  const model = String(settings.model || "");
  const exactMatch = !model || modelIds.length === 0 || modelIds.includes(model);
  const related = modelIds.filter((id) => id.toLowerCase().includes("5.6") || id.toLowerCase().includes("gpt-5")).slice(0, 6);
  if (!exactMatch) {
    return {
      ok: true,
      endpoint: baseUrl,
      exactMatch: false,
      protocol: resolveAgentProtocol(settings),
      message: `接口鉴权成功，但模型列表中没有 ${model}`,
      related
    };
  }
  const protocol = resolveAgentProtocol(settings);
  const startedAt = Date.now();
  await probeModelGeneration({ baseUrl, model, protocol, apiKey });
  return {
    ok: true,
    endpoint: baseUrl,
    exactMatch: true,
    protocol,
    latencyMs: Date.now() - startedAt,
    message: `真实推理成功，模型 ${model || "默认模型"} 可用`,
    related
  };
});

ipcMain.handle("promptAgent:generate", async (_event, payload) => {
  const settings = readSettings().promptAgent;
  const apiKey = readApiKey();
  if (settings.preset === "local") throw new Error("Prompt Agent 当前设为仅本地规则");
  if (!apiKey) throw new Error("请先在 Prompt Agent 设置中填写 API Key");
  const system = String(payload && payload.system || "");
  const user = String(payload && payload.user || "");
  if (!system || !user || system.length + user.length > 50000) throw new Error("Prompt Agent 请求内容无效");
  const custom = settings.preset === "custom";
  const baseUrl = normalizeApiBaseUrl(settings.baseUrl, custom);
  const model = String(settings.model || settings.preset || "gpt-5.6-terra");
  const protocol = custom ? resolveAgentProtocol(settings) : "responses";
  const url = protocol === "chat" ? `${baseUrl}/chat/completions` : `${baseUrl}/responses`;
  const body = protocol === "chat" ? {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    response_format: { type: "json_object" },
    reasoning_effort: "low",
    max_completion_tokens: 5000,
    stream: false
  } : {
    model,
    instructions: system,
    input: user,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "short_drama_prompt",
        strict: true,
        schema: payload.schema
      }
    }
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await readJsonResponse(response, url);
    if (!response.ok) {
      throw new Error(`模型请求失败：${formatApiError(response, data)}`);
    }
    const rawText = protocol === "chat"
      ? data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      : extractResponseText(data);
    if (!rawText) throw new Error("模型没有返回可解析内容");
    return { draft: parseJsonText(rawText), model };
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("模型响应超过 180 秒，第三方线路当前过慢或拥堵");
    throw error;
  } finally {
    clearTimeout(timer);
  }
});

function resolveAgentProtocol(settings) {
  if (settings.protocol === "responses" || settings.protocol === "chat") return settings.protocol;
  return /^gpt-5(?:\.|$)/i.test(String(settings.model || "")) ? "responses" : "chat";
}

async function probeModelGeneration({ baseUrl, model, protocol, apiKey }) {
  const url = protocol === "chat" ? `${baseUrl}/chat/completions` : `${baseUrl}/responses`;
  const body = protocol === "chat" ? {
    model,
    messages: [{ role: "user", content: "只回复OK" }],
    reasoning_effort: "none",
    max_completion_tokens: 16,
    stream: false
  } : {
    model,
    input: "只回复OK",
    reasoning: { effort: "none" },
    max_output_tokens: 16
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await readJsonResponse(response, url);
    if (!response.ok) throw new Error(`真实推理失败（${protocol}）：${formatApiError(response, data)}`);
    const output = protocol === "chat"
      ? data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      : extractResponseText(data);
    if (!String(output || "").trim()) throw new Error(`真实推理没有返回文本（${protocol}）`);
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error(`真实推理测试超过 45 秒（${protocol}），线路无法正常生成`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeApiBaseUrl(value, custom) {
  const fallback = "https://api.openai.com/v1";
  const raw = String(value || fallback).trim().replace(/\/+$/, "");
  if (!custom) return raw;
  try {
    const parsed = new URL(raw);
    if (!parsed.pathname || parsed.pathname === "/") parsed.pathname = "/v1";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}

async function readJsonResponse(response, url) {
  const contentType = String(response.headers.get("content-type") || "");
  const text = await response.text();
  if (/json/i.test(contentType)) {
    try { return text ? JSON.parse(text) : {}; } catch { throw new Error(`接口 ${url} 返回了损坏的 JSON`); }
  }
  if (/^\s*</.test(text) || /text\/html/i.test(contentType)) {
    throw new Error(`接口返回了网页而不是 JSON：${url}。Base URL 应指向 API 根路径，通常以 /v1 结尾`);
  }
  try { return text ? JSON.parse(text) : {}; } catch {
    throw new Error(`接口返回格式不受支持（${contentType || "未知类型"}）：${url}`);
  }
}

function formatApiError(response, data) {
  const detail = data && data.error && data.error.message
    ? data.error.message
    : data && data.message
      ? data.message
      : "未返回错误详情";
  return `HTTP ${response.status}：${detail}`;
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  for (const item of Array.isArray(data.output) ? data.output : []) {
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function parseJsonText(value) {
  const text = String(value).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
}

ipcMain.handle("window:toggleAlwaysOnTop", () => {
  const next = !readSettings().alwaysOnTop;
  const settings = writeSettings({ alwaysOnTop: next });
  if (mainWindow) applyFloatingBehavior(mainWindow, next);
  return settings;
});

ipcMain.handle("file:saveText", async (_event, { defaultPath, text }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [
      { name: "Text", extensions: ["txt", "md", "json"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, String(text ?? ""), "utf8");
  return { canceled: false, filePath: result.filePath };
});

const mediaExtensions = {
  image: new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".tiff", ".gif"]),
  video: new Set([".mp4", ".mov"]),
  audio: new Set([".mp3", ".wav"])
};

function mediaTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (mediaExtensions.image.has(ext)) return "image";
  if (mediaExtensions.video.has(ext)) return "video";
  if (mediaExtensions.audio.has(ext)) return "audio";
  return null;
}

function scanMedia(folder, maxFiles = 80) {
  const found = [];
  const root = folder && fs.existsSync(folder) ? folder : app.getPath("documents");
  const ignoredDirs = new Set(["node_modules", "dist", "release", "build", "src", "electron", "tests", ".git"]);
  function walk(dir, depth) {
    if (depth > 3 || found.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || found.length >= maxFiles) continue;
      const itemPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue;
        walk(itemPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const type = mediaTypeForPath(itemPath);
      if (!type) continue;
      found.push({
        type,
        path: itemPath,
        url: itemPath,
        previewUrl: pathToFileURL(itemPath).href,
        name: path.basename(itemPath)
      });
    }
  }
  walk(root, 0);
  return { folder: root, files: found };
}

ipcMain.handle("media:scan", (_event, folder) => scanMedia(folder || readSettings().mediaFolder));

ipcMain.handle("media:chooseFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const settings = writeSettings({ mediaFolder: result.filePaths[0] });
  return { canceled: false, settings, ...scanMedia(settings.mediaFolder) };
});

ipcMain.handle("media:chooseFiles", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Media", extensions: ["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "tiff", "gif", "mp4", "mov", "mp3", "wav"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (result.canceled) return { canceled: true, files: [] };
  return {
    canceled: false,
    files: result.filePaths.map((filePath) => ({
      type: mediaTypeForPath(filePath),
      path: filePath,
      url: filePath,
      previewUrl: pathToFileURL(filePath).href,
      name: path.basename(filePath)
    })).filter((item) => item.type)
  };
});

ipcMain.handle("media:reveal", (_event, filePath) => {
  if (filePath) shell.showItemInFolder(String(filePath));
  return true;
});

ipcMain.handle("media:open", async (_event, filePath) => {
  if (!filePath) return false;
  const error = await shell.openPath(String(filePath));
  if (error) throw new Error(error);
  return true;
});

ipcMain.handle("shell:openExternal", (_event, url) => {
  shell.openExternal(url);
  return true;
});
