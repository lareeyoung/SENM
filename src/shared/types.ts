export type AssetType = "image" | "video" | "audio";

export type TaskType = "text_to_video" | "multimodal_reference" | "video_edit" | "video_extend" | "track_fill";

export type ModelPreset = "seedance-2.0" | "seedance-2.0-fast" | "custom";

export type AudioPolicy = "dialogue_effects" | "silent" | "full_audio";

export type PromptAgentPreset = "gpt-5.6-terra" | "gpt-5.6-luna" | "custom" | "local";
export type PromptAgentProtocol = "auto" | "responses" | "chat";
export type ComplianceStatus = "pass" | "review" | "block";

export interface ComplianceIssue {
  code: string;
  level: "review" | "block";
  category: string;
  guideline: string;
  reason: string;
  suggestion: string;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  canGenerate: boolean;
  summary: string;
  issues: ComplianceIssue[];
  guidelineUrl: string;
}

export interface PromptAgentSettings {
  preset: PromptAgentPreset;
  model: string;
  baseUrl: string;
  protocol: PromptAgentProtocol;
  hasApiKey: boolean;
}

export interface ReferenceAsset {
  id: string;
  type: AssetType;
  label: string;
  url: string;
  path?: string;
  previewUrl?: string;
  name?: string;
  note?: string;
  enabled: boolean;
}

export interface TranslatorOptions {
  modelPreset: ModelPreset;
  customModelId: string;
  ratio: "adaptive" | "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  resolution: "480p" | "720p" | "1080p" | "4k";
  duration: number;
  audioPolicy: AudioPolicy;
  watermark: boolean;
  styleHint: string;
  maxShots: number;
}

export interface Shot {
  id: number;
  source: string;
  camera: string;
  action: string;
  dialogue: string[];
  audio: string[];
}

export interface TimingAnalysis {
  estimatedSeconds: number;
  selectedSeconds: number;
  status: "balanced" | "too_long" | "too_sparse" | "too_dense";
  recommendedSegments: number;
  suggestions: string[];
}

export interface TranslationResult {
  taskType: TaskType;
  prompt: string;
  compactPrompt: string;
  apiRequest: Record<string, unknown>;
  shots: Shot[];
  detectedAssets: ReferenceAsset[];
  timing: TimingAnalysis;
  warnings: string[];
  checks: string[];
  sourceLinks: Array<{ title: string; url: string }>;
  compliance: ComplianceResult;
  agent?: {
    mode: "model-rag" | "local-fallback";
    model?: string;
    retrievedCases?: string[];
    relationshipRead?: string;
  };
}

export interface PromptAgentShot {
  camera: string;
  action: string;
  dialogue: string[];
  audio: string[];
}

export interface PromptAgentComplianceIssue {
  category: string;
  guideline: string;
  reason: string;
  suggestion: string;
}

export interface PromptAgentCompliance {
  status: ComplianceStatus;
  issues: PromptAgentComplianceIssue[];
}

export interface PromptAgentDraft {
  compliance: PromptAgentCompliance;
  estimatedSeconds: number;
  relationshipRead: string;
  dramaticEngine: string;
  hook: string;
  characters: string;
  scene: string;
  details: string[];
  style: string;
  shots: PromptAgentShot[];
  audio: string;
}
