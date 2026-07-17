export {};

import type { PromptAgentSettings } from "../shared/types";

declare global {
  interface Window {
    see2p?: {
      platform: string;
      writeClipboard: (text: string) => Promise<boolean>;
      readClipboard: () => Promise<string>;
      openMainWindow: () => Promise<boolean>;
      openPromptAgentSettings: () => Promise<boolean>;
      consumePromptAgentSettingsRequest: () => Promise<boolean>;
      onOpenPromptAgentSettings: (callback: () => void) => () => void;
      hideQuickWindow: () => Promise<boolean>;
      readQuickPinned: () => Promise<boolean>;
      toggleQuickPinned: () => Promise<boolean>;
      onQuickFocusInput: (callback: () => void) => () => void;
      readSettings: () => Promise<{ alwaysOnTop: boolean; quickPinned: boolean; shortcut: string }>;
      updateSettings: (patch: Record<string, unknown>) => Promise<{ alwaysOnTop: boolean; quickPinned: boolean; shortcut: string }>;
      toggleAlwaysOnTop: () => Promise<{ alwaysOnTop: boolean; quickPinned: boolean; shortcut: string }>;
      saveText: (payload: { defaultPath: string; text: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      scanMedia: (folder?: string) => Promise<{ folder: string; files: Array<{ type: "image" | "video" | "audio"; path: string; url: string; previewUrl: string; name: string }> }>;
      chooseMediaFolder: () => Promise<{ canceled: boolean; folder?: string; files?: Array<{ type: "image" | "video" | "audio"; path: string; url: string; previewUrl: string; name: string }> }>;
      chooseMediaFiles: () => Promise<{ canceled: boolean; files: Array<{ type: "image" | "video" | "audio"; path: string; url: string; previewUrl: string; name: string }> }>;
      revealMedia: (path: string) => Promise<boolean>;
      openMedia: (path: string) => Promise<boolean>;
      readPromptAgentSettings: () => Promise<PromptAgentSettings>;
      onPromptAgentSettingsChanged: (callback: (settings: PromptAgentSettings) => void) => () => void;
      configurePromptAgent: (payload: { settings: Omit<PromptAgentSettings, "hasApiKey">; apiKey?: string }) => Promise<PromptAgentSettings>;
      testPromptAgent: (payload: { settings: Omit<PromptAgentSettings, "hasApiKey">; apiKey?: string }) => Promise<{ ok: boolean; endpoint: string; exactMatch: boolean; protocol: "responses" | "chat"; latencyMs?: number; message: string; related: string[] }>;
      generateWithPromptAgent: (payload: { system: string; user: string; schema: Record<string, unknown> }) => Promise<{ draft: unknown; model: string }>;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}
