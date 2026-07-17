import {
  AlertTriangle,
  Braces,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  PanelTop,
  Pin,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Video,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_OPTIONS, retargetTranslationRatio, translateScriptToSeedance, translateScriptWithAgentDraft } from "@shared/seedanceTranslator";
import { buildPromptAgentRequest, parsePromptAgentDraft } from "@shared/promptAgent";
import type { AudioPolicy, ComplianceResult, ModelPreset, PromptAgentPreset, PromptAgentProtocol, PromptAgentSettings, TranslationResult, TranslatorOptions } from "@shared/types";

const sampleScript = "";

const STORAGE_KEY = "see2p-transfer-state";
const STORAGE_VERSION = 3;

interface PersistedState {
  version?: number;
  script: string;
  options: TranslatorOptions;
}

export default function App() {
  const [script, setScript] = useState(sampleScript);
  const [options, setOptions] = useState<TranslatorOptions>(DEFAULT_OPTIONS);
  const [activeTab, setActiveTab] = useState<"prompt" | "json" | "shots">("prompt");
  const [copied, setCopied] = useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [agentSettings, setAgentSettings] = useState<PromptAgentSettings>({
    preset: "gpt-5.6-terra",
    model: "gpt-5.6-terra",
    baseUrl: "https://api.openai.com/v1",
    protocol: "auto",
    hasApiKey: false
  });
  const [agentResult, setAgentResult] = useState<TranslationResult | null>(null);
  const [agentGenerationReady, setAgentGenerationReady] = useState(false);
  const [agentAttempt, setAgentAttempt] = useState(0);
  const [agentStatus, setAgentStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [agentError, setAgentError] = useState("");
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [connectionTest, setConnectionTest] = useState<{ status: "idle" | "testing" | "success" | "warning" | "error"; message: string; detail?: string }>({ status: "idle", message: "" });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PersistedState;
        if (parsed.version === STORAGE_VERSION || parsed.version === 2) {
          setScript(parsed.script || sampleScript);
          setOptions({ ...DEFAULT_OPTIONS, ...(parsed.options || {}) });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    window.see2p?.readSettings().then((settings) => {
      setAlwaysOnTop(settings.alwaysOnTop);
    });
    window.see2p?.readPromptAgentSettings().then(setAgentSettings);
  }, []);

  useEffect(() => {
    const openSettings = () => setShowAgentSettings(true);
    const unsubscribeOpen = window.see2p?.onOpenPromptAgentSettings(openSettings);
    const unsubscribeSettings = window.see2p?.onPromptAgentSettingsChanged(setAgentSettings);
    window.see2p?.consumePromptAgentSettingsRequest().then((requested) => {
      if (requested) openSettings();
    });
    return () => {
      unsubscribeOpen?.();
      unsubscribeSettings?.();
    };
  }, []);

  useEffect(() => {
    const payload: PersistedState = { version: STORAGE_VERSION, script, options };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [script, options]);

  const localResult = useMemo(() => translateScriptToSeedance(script, [], options), [script, options]);
  const result = agentResult || localResult;
  const hasInput = Boolean(script.trim());

  useEffect(() => {
    let canceled = false;
    if (!agentGenerationReady || !script.trim() || agentSettings.preset === "local" || !agentSettings.hasApiKey) {
      setAgentResult(null);
      setAgentStatus("idle");
      setAgentError("");
      return () => { canceled = true; };
    }
    setAgentStatus("loading");
    setAgentResult(null);
    setAgentError("");
    const timer = window.setTimeout(async () => {
      try {
        const request = buildPromptAgentRequest(script, localResult.detectedAssets, options);
        const response = await window.see2p?.generateWithPromptAgent({
          system: request.system,
          user: request.user,
          schema: request.schema as unknown as Record<string, unknown>
        });
        if (!response || canceled) return;
        const draft = parsePromptAgentDraft(response.draft);
        const next = translateScriptWithAgentDraft(script, localResult.detectedAssets, options, draft, {
          model: response.model,
          retrievedCases: request.retrievedCases
        });
        if (!canceled) {
          setAgentResult(next);
          setAgentStatus("ready");
        }
      } catch (error) {
        if (!canceled) {
          setAgentResult(null);
          setAgentStatus("error");
          setAgentError(friendlyError(error));
        }
      }
    }, 900);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [script, options, agentSettings, localResult, agentGenerationReady, agentAttempt]);

  const apiJson = useMemo(() => JSON.stringify(result.apiRequest, null, 2), [result.apiRequest]);
  const outputText = activeTab === "json" ? apiJson : activeTab === "shots" ? result.shots.map((shot) => `镜头${shot.id}：${shot.camera}，${shot.action}`).join("\n") : result.compactPrompt;

  async function copyText(label: string, text: string) {
    if (!text.trim()) return;
    await window.see2p?.writeClipboard(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1200);
  }

  async function saveOutput() {
    if (!outputText.trim()) return;
    const extension = activeTab === "json" ? "json" : "txt";
    await window.see2p?.saveText({
      defaultPath: `seedance-${activeTab}.${extension}`,
      text: outputText
    });
  }

  function requestAgentGeneration() {
    setAgentGenerationReady(true);
    setAgentAttempt((current) => current + 1);
  }

  function updateOption<K extends keyof TranslatorOptions>(key: K, value: TranslatorOptions[K]) {
    if (key === "ratio") {
      const ratio = value as TranslatorOptions["ratio"];
      setAgentResult((current) => current ? retargetTranslationRatio(current, ratio) : current);
      setOptions((current) => ({ ...current, ratio }));
      return;
    }
    setAgentGenerationReady(true);
    setAgentResult(null);
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function updateAgentPreset(preset: PromptAgentPreset) {
    const defaults: Record<Exclude<PromptAgentPreset, "custom">, { model: string; baseUrl: string }> = {
      "gpt-5.6-terra": { model: "gpt-5.6-terra", baseUrl: "https://api.openai.com/v1" },
      "gpt-5.6-luna": { model: "gpt-5.6-luna", baseUrl: "https://api.openai.com/v1" },
      local: { model: "", baseUrl: "" }
    };
    setAgentSettings((current) => ({
      ...current,
      preset,
      ...(preset === "custom" ? {} : defaults[preset])
    }));
  }

  async function saveAgentSettings() {
    const settings = await window.see2p?.configurePromptAgent({
      settings: {
        preset: agentSettings.preset,
        model: agentSettings.model,
        baseUrl: agentSettings.baseUrl,
        protocol: agentSettings.protocol
      },
      ...(apiKeyDraft.trim() ? { apiKey: apiKeyDraft.trim() } : {})
    });
    if (settings) setAgentSettings(settings);
    setAgentGenerationReady(true);
    setApiKeyDraft("");
    setShowAgentSettings(false);
  }

  async function clearAgentKey() {
    const settings = await window.see2p?.configurePromptAgent({
      settings: {
        preset: agentSettings.preset,
        model: agentSettings.model,
        baseUrl: agentSettings.baseUrl,
        protocol: agentSettings.protocol
      },
      apiKey: ""
    });
    if (settings) setAgentSettings(settings);
    setApiKeyDraft("");
    setConnectionTest({ status: "idle", message: "" });
  }

  async function testAgentConnection() {
    setConnectionTest({ status: "testing", message: "正在检查接口和模型…" });
    try {
      const response = await window.see2p?.testPromptAgent({
        settings: {
          preset: agentSettings.preset,
          model: agentSettings.model,
          baseUrl: agentSettings.baseUrl,
          protocol: agentSettings.protocol
        },
        ...(apiKeyDraft.trim() ? { apiKey: apiKeyDraft.trim() } : {})
      });
      if (!response) throw new Error("未收到连接结果");
      setConnectionTest({
        status: response.exactMatch ? "success" : "warning",
        message: response.message,
        detail: `实际 API：${response.endpoint}；协议：${response.protocol === "responses" ? "Responses" : "Chat Completions"}${response.latencyMs ? `；耗时：${(response.latencyMs / 1000).toFixed(1)} 秒` : ""}${response.related.length ? `；相关模型：${response.related.join("、")}` : ""}`
      });
    } catch (error) {
      setConnectionTest({ status: "error", message: friendlyError(error) });
    }
  }

  return (
    <div className={`appShell ${window.see2p?.platform === "darwin" ? "platformMac" : "platformWindows"}`}>
      <header className="topbar">
        <div className="brand">
          <img src="./app-icon.png" alt="" />
          <span>SENM</span>
        </div>
        <div className="topActions">
          <button className="iconButton" title="Prompt Agent 设置" onClick={() => setShowAgentSettings(true)}>
            <Settings size={16} />
          </button>
          <button
            className={`iconButton ${alwaysOnTop ? "active" : ""}`}
            title="悬浮置顶"
            onClick={async () => {
              const settings = await window.see2p?.toggleAlwaysOnTop();
              if (settings) setAlwaysOnTop(settings.alwaysOnTop);
            }}
          >
            <Pin size={16} />
          </button>
          <button className="button primary" disabled={!hasInput || !result.compactPrompt} onClick={() => copyText("prompt", result.compactPrompt)}>
            {copied === "prompt" ? <Check size={16} /> : <Clipboard size={16} />}
            Prompt
          </button>
          <button className="button" disabled={!hasInput || !outputText.trim()} onClick={saveOutput}>
            <Download size={16} />
            导出
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="inputPane">
          <div className="paneHeader">
            <h1>剧本输入</h1>
            <span>{script.length} 字</span>
          </div>
          <textarea
            className="scriptInput"
            value={script}
            onChange={(event) => {
              setAgentResult(null);
              setScript(event.target.value);
              setAgentGenerationReady(true);
            }}
            placeholder="粘贴完整剧情、分镜或粗糙脚本。直接写 @图片1、@视频1、@音频1，工具会保留引用并自动补全结构化 Prompt。"
            spellCheck={false}
          />

          <div className="controlsBand">
            <ControlGroup label="视频模型">
              <select value={options.modelPreset} onChange={(event) => updateOption("modelPreset", event.target.value as ModelPreset)}>
                <option value="seedance-2.0">Seedance 2.0</option>
                <option value="seedance-2.0-fast">Seedance 2.0 Fast</option>
                <option value="custom">自定义 Endpoint</option>
              </select>
            </ControlGroup>
            {options.modelPreset === "custom" && (
              <ControlGroup label="Endpoint">
                <input value={options.customModelId} onChange={(event) => updateOption("customModelId", event.target.value)} placeholder="endpoint 或 model id" />
              </ControlGroup>
            )}
            <ControlGroup label="比例">
              <Segmented
                value={options.ratio}
                values={["9:16", "16:9", "adaptive", "1:1"]}
                onChange={(value) => updateOption("ratio", value as TranslatorOptions["ratio"])}
              />
            </ControlGroup>
            <ControlGroup label="时长">
              <div className="sliderLine">
                <input type="range" min="4" max="15" value={options.duration} onChange={(event) => updateOption("duration", Number(event.target.value))} />
                <span>{options.duration}s</span>
              </div>
            </ControlGroup>
            <ControlGroup label="音频">
              <select value={options.audioPolicy} onChange={(event) => updateOption("audioPolicy", event.target.value as AudioPolicy)}>
                <option value="dialogue_effects">台词+音效</option>
                <option value="silent">无声</option>
                <option value="full_audio">完整声音</option>
              </select>
            </ControlGroup>
            <ControlGroup label="风格">
              <input value={options.styleHint} onChange={(event) => updateOption("styleHint", event.target.value)} placeholder="留空自动判断" />
            </ControlGroup>
          </div>
        </section>

        <section className="resultPane">
          <div className="paneHeader">
            <h2>Seedance 输出</h2>
            <div className="headerBadges">
              <AgentBadge status={agentStatus} settings={agentSettings} onClick={() => {
                if (agentSettings.hasApiKey && agentSettings.preset !== "local") requestAgentGeneration();
                else setShowAgentSettings(true);
              }} />
              {hasInput && <>
                <ComplianceBadge compliance={result.compliance} />
                <TimingBadge status={result.timing.status} seconds={result.timing.estimatedSeconds} />
                <TaskBadge taskType={result.taskType} />
                <span className="promptLength">{result.compactPrompt.length} 字</span>
              </>}
            </div>
          </div>
          {result.compliance.status !== "pass" && <CompliancePanel compliance={result.compliance} />}
          {agentStatus === "error" && (
            <div className="agentNotice error retryNotice">
              <AlertTriangle size={15} />
              <span>模型连接失败，当前结果仅作临时预览：{agentError}</span>
              <div className="agentNoticeActions">
                <button onClick={requestAgentGeneration}>重新连接并优化</button>
                <button onClick={() => setShowAgentSettings(true)}>接口设置</button>
              </div>
            </div>
          )}
          {!agentSettings.hasApiKey && agentSettings.preset !== "local" && (
            <button className="agentNotice" onClick={() => setShowAgentSettings(true)}>
              <Sparkles size={15} />
              <span>配置 API Key 后启用模型 + 本地短剧知识库检索</span>
            </button>
          )}
          {result.timing.status !== "balanced" && (
            <div className={`timingNotice ${result.timing.status}`}>
              <AlertTriangle size={16} />
              <span>{result.timing.suggestions[0]}</span>
            </div>
          )}
          {hasInput && <div className="tabbar">
            <button className={activeTab === "prompt" ? "selected" : ""} onClick={() => setActiveTab("prompt")}>
              <PanelTop size={15} />
              Prompt
            </button>
            <button className={activeTab === "json" ? "selected" : ""} onClick={() => setActiveTab("json")}>
              <Braces size={15} />
              API JSON
            </button>
            <button className={activeTab === "shots" ? "selected" : ""} onClick={() => setActiveTab("shots")}>
              <Video size={15} />
              分镜
            </button>
          </div>}
          {hasInput
            ? <pre className="outputBox">{outputText}</pre>
            : <div className="outputBox complianceEmpty">输入一段剧情后，会生成只包含可执行画面、动作、镜头和声音的 Prompt。</div>}
          <div className="resultActions">
            <button className="button primary" disabled={!hasInput || !outputText.trim()} onClick={() => copyText(activeTab, outputText)}>
              {copied === activeTab ? <Check size={16} /> : <Clipboard size={16} />}
              复制当前
            </button>
            <button className="button" disabled={!hasInput || !result.compactPrompt} onClick={() => copyText("json", apiJson)}>
              <Braces size={16} />
              复制 JSON
            </button>
          </div>
        </section>

      </main>
      {showAgentSettings && (
        <div className="modalBackdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowAgentSettings(false);
        }}>
          <section className="agentModal" role="dialog" aria-modal="true" aria-label="Prompt Agent 设置">
            <div className="modalHeader">
              <div>
                <h2>Prompt Agent</h2>
                <p>模型理解剧情，本地知识库检索同类桥段，规则层负责 Seedance 格式校验。</p>
              </div>
              <button className="iconButton quiet" title="关闭" onClick={() => setShowAgentSettings(false)}><X size={16} /></button>
            </div>
            <div className="modalBody">
              <ControlGroup label="优化模型">
                <select value={agentSettings.preset} onChange={(event) => updateAgentPreset(event.target.value as PromptAgentPreset)}>
                  <option value="gpt-5.6-terra">GPT-5.6 Terra · 推荐</option>
                  <option value="gpt-5.6-luna">GPT-5.6 Luna · 省成本</option>
                  <option value="custom">OpenAI 兼容接口</option>
                  <option value="local">仅本地规则</option>
                </select>
              </ControlGroup>
              {agentSettings.preset !== "local" && (
                <>
                  {agentSettings.preset === "custom" && (
                    <>
                      <div className="modalGrid">
                        <ControlGroup label="API Base URL">
                          <input value={agentSettings.baseUrl} onChange={(event) => {
                            setAgentSettings((current) => ({ ...current, baseUrl: event.target.value }));
                            setConnectionTest({ status: "idle", message: "" });
                          }} placeholder="https://api.example.com/v1" />
                        </ControlGroup>
                        <ControlGroup label="Model ID">
                          <input value={agentSettings.model} onChange={(event) => {
                            setAgentSettings((current) => ({ ...current, model: event.target.value }));
                            setConnectionTest({ status: "idle", message: "" });
                          }} placeholder="model-id" />
                        </ControlGroup>
                      </div>
                      <ControlGroup label="接口协议">
                        <select value={agentSettings.protocol} onChange={(event) => {
                          setAgentSettings((current) => ({ ...current, protocol: event.target.value as PromptAgentProtocol }));
                          setConnectionTest({ status: "idle", message: "" });
                        }}>
                          <option value="auto">自动 · GPT-5 优先 Responses</option>
                          <option value="responses">Responses API</option>
                          <option value="chat">Chat Completions</option>
                        </select>
                      </ControlGroup>
                    </>
                  )}
                  <ControlGroup label={`API Key${agentSettings.hasApiKey ? "（已安全保存，留空不修改）" : ""}`}>
                    <input type="password" value={apiKeyDraft} onChange={(event) => {
                      setApiKeyDraft(event.target.value);
                      setConnectionTest({ status: "idle", message: "" });
                    }} placeholder={agentSettings.hasApiKey ? "••••••••••••" : "sk-..."} autoComplete="off" />
                  </ControlGroup>
                  <p className="keyHint">密钥保存在仅当前 macOS 用户可读的本机加密文件中，生成时使用内存缓存，不访问系统钥匙串。测试连接会执行一次极短推理确认模型可用。</p>
                  {connectionTest.status !== "idle" && (
                    <div className={`connectionResult ${connectionTest.status}`}>
                      <strong>{connectionTest.message}</strong>
                      {connectionTest.detail && <span>{connectionTest.detail}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modalActions">
              {agentSettings.hasApiKey && agentSettings.preset !== "local" && <button className="button danger" onClick={clearAgentKey}>清除密钥</button>}
              <span />
              {agentSettings.preset !== "local" && <button className="button" disabled={connectionTest.status === "testing"} onClick={testAgentConnection}>{connectionTest.status === "testing" ? "测试中…" : "测试连接"}</button>}
              <button className="button" onClick={() => setShowAgentSettings(false)}>取消</button>
              <button className="button primary" onClick={saveAgentSettings}>保存</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="controlGroup">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Segmented({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  const labels: Record<string, string> = { adaptive: "自动" };
  return (
    <div className="segmented">
      {values.map((item) => (
        <button key={item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}>
          {labels[item] || item}
        </button>
      ))}
    </div>
  );
}

function TaskBadge({ taskType }: { taskType: string }) {
  const labels: Record<string, string> = {
    text_to_video: "文生视频",
    multimodal_reference: "多模态参考",
    video_edit: "视频编辑",
    video_extend: "视频延长",
    track_fill: "轨道补齐"
  };
  return <span className="taskBadge">{labels[taskType] || taskType}</span>;
}

function TimingBadge({ status, seconds }: { status: string; seconds: number }) {
  const label = status === "too_long" ? `约${seconds}s / 需拆段` : status === "too_sparse" ? `约${seconds}s / 内容偏少` : status === "too_dense" ? `约${seconds}s / 偏密` : `约${seconds}s`;
  return <span className={`timingBadge ${status}`}>{label}</span>;
}

function ComplianceBadge({ compliance }: { compliance: ComplianceResult }) {
  const label = compliance.status === "pass" ? "公约通过" : compliance.status === "review" ? "有风险" : "高风险";
  const Icon = compliance.status === "pass" ? ShieldCheck : ShieldAlert;
  return <span className={`complianceBadge ${compliance.status}`}><Icon size={12} />{label}</span>;
}

function CompliancePanel({ compliance }: { compliance: ComplianceResult }) {
  return (
    <section className={`compliancePanel ${compliance.status}`}>
      <div className="compliancePanelHeader">
        <ShieldAlert size={17} />
        <div><strong>{compliance.status === "block" ? "检测到高风险题材" : "题材可能无法通过即梦审核"}</strong><span>{compliance.summary}</span></div>
        <button onClick={() => window.see2p?.openExternal(compliance.guidelineUrl)}>查看公约<ExternalLink size={12} /></button>
      </div>
      <div className="complianceIssues">
        {compliance.issues.map((issue) => (
          <article key={issue.code}>
            <strong>{issue.category}</strong>
            <em>{issue.guideline}</em>
            <span>{issue.reason}</span>
            <small>建议：{issue.suggestion}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function AgentBadge({ status, settings, onClick }: { status: string; settings: PromptAgentSettings; onClick: () => void }) {
  const label = settings.preset === "local" || !settings.hasApiKey
    ? "本地规则"
    : status === "loading"
      ? "AI 优化中"
      : status === "ready"
        ? "模型 + RAG"
        : status === "error"
          ? "重新连接 AI"
          : "运行 AI 优化";
  return <button className={`agentBadge ${status}`} onClick={onClick}><Sparkles size={12} />{label}</button>;
}

function friendlyError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
}
