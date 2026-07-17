import { Check, Clipboard, ExternalLink, Pin, Settings, ShieldAlert, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildPromptAgentRequest, parsePromptAgentDraft } from "@shared/promptAgent";
import { DEFAULT_OPTIONS, retargetTranslationRatio, translateScriptToSeedance, translateScriptWithAgentDraft } from "@shared/seedanceTranslator";
import type { PromptAgentSettings, TranslationResult, TranslatorOptions } from "@shared/types";

const QUICK_STORAGE_KEY = "see2p-quick-panel";

export default function QuickPanel() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [idea, setIdea] = useState(() => localStorage.getItem(QUICK_STORAGE_KEY) || "");
  const [options, setOptions] = useState<TranslatorOptions>({ ...DEFAULT_OPTIONS, duration: 8, ratio: "9:16" });
  const [settings, setSettings] = useState<PromptAgentSettings | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);
  const localResult = useMemo(() => translateScriptToSeedance(idea, [], options), [idea, options]);

  useEffect(() => {
    document.body.classList.add("quickMode");
    window.see2p?.readPromptAgentSettings().then(setSettings);
    window.see2p?.readQuickPinned().then(setPinned);
    const unsubscribe = window.see2p?.onQuickFocusInput(() => inputRef.current?.focus());
    const unsubscribeSettings = window.see2p?.onPromptAgentSettingsChanged(setSettings);
    window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      document.body.classList.remove("quickMode");
      unsubscribe?.();
      unsubscribeSettings?.();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(QUICK_STORAGE_KEY, idea);
    setResult(null);
    setStatus("idle");
    setMessage("");
  }, [idea, options.duration]);

  async function generate() {
    if (!idea.trim() || status === "loading") return;
    setStatus("loading");
    setResult(null);
    setMessage("");
    try {
      const latestSettings = await window.see2p?.readPromptAgentSettings() || settings;
      if (latestSettings) setSettings(latestSettings);
      if (latestSettings?.hasApiKey && latestSettings.preset !== "local") {
        const request = buildPromptAgentRequest(idea, localResult.detectedAssets, options);
        const response = await window.see2p?.generateWithPromptAgent({
          system: request.system,
          user: request.user,
          schema: request.schema as unknown as Record<string, unknown>
        });
        if (!response) throw new Error("模型没有返回结果");
        const draft = parsePromptAgentDraft(response.draft);
        setResult(translateScriptWithAgentDraft(idea, localResult.detectedAssets, options, draft, {
          model: response.model,
          retrievedCases: request.retrievedCases
        }));
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        setResult(localResult);
      }
      setStatus("ready");
    } catch (error) {
      setResult(localResult);
      setStatus("error");
      setMessage(friendlyError(error));
    }
  }

  async function pasteIdea() {
    const text = await window.see2p?.readClipboard();
    if (text?.trim()) updateIdea(text.trim());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function updateIdea(value: string) {
    setResult(null);
    setStatus("idle");
    setMessage("");
    setIdea(value);
  }

  function updateQuickOption(next: Partial<TranslatorOptions>) {
    setResult(null);
    setStatus("idle");
    setMessage("");
    setOptions((current) => ({ ...current, ...next }));
  }

  function updateRatio(ratio: "9:16" | "16:9" | "1:1") {
    setOptions((current) => ({ ...current, ratio }));
    setResult((current) => current ? retargetTranslationRatio(current, ratio) : current);
  }

  async function copyPrompt() {
    const output = (result || localResult).compactPrompt;
    if (!output) return;
    await window.see2p?.writeClipboard(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function togglePinned() {
    const next = await window.see2p?.toggleQuickPinned();
    if (typeof next === "boolean") setPinned(next);
  }

  const visibleResult = result;
  const output = visibleResult?.compactPrompt || "";
  const timing = visibleResult?.timing || localResult.timing;
  const compliance = visibleResult?.compliance || localResult.compliance;
  const modelEnabled = Boolean(settings?.hasApiKey && settings.preset !== "local");

  return (
    <div className="quickShell" onKeyDown={(event) => {
      if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        void generate();
      }
    }}>
      <header className="quickHeader">
        <div className="quickTitle">
          <img src="./app-icon.png" alt="" />
          <div><strong>快速 Prompt</strong><span>{modelEnabled ? `AI · ${settings?.model}` : "本地转译 · 未连接 AI"}</span></div>
        </div>
        <div className="quickWindowActions">
          <button title="模型设置" onClick={() => window.see2p?.openPromptAgentSettings()}><Settings size={15} /></button>
          <button className={pinned ? "active" : ""} title={pinned ? "取消固定悬浮" : "固定悬浮"} onClick={togglePinned}><Pin size={15} /></button>
          <button title="打开完整工作台" onClick={() => window.see2p?.openMainWindow()}><ExternalLink size={15} /></button>
          <button title="关闭" onClick={() => window.see2p?.hideQuickWindow()}><X size={16} /></button>
        </div>
      </header>

      <section className="quickCompose">
        <div className="quickComposeLabel"><span>灵感或剧情</span><button onClick={pasteIdea}>从剪贴板填入</button></div>
        <textarea
          ref={inputRef}
          value={idea}
          onChange={(event) => updateIdea(event.target.value)}
          placeholder="写下一句灵感、一个桥段或完整剧情…"
          spellCheck={false}
        />
      </section>

      <section className="quickControls">
        <div className="quickControlGroup"><span>画幅</span><div className="quickSegments">
          {(["9:16", "16:9", "1:1"] as const).map((ratio) => <button key={ratio} className={options.ratio === ratio ? "selected" : ""} onClick={() => updateRatio(ratio)}>{ratio}</button>)}
        </div></div>
        <div className="quickControlGroup"><span>时长</span><div className="quickSegments duration">
          {[5, 8, 10, 15].map((duration) => <button key={duration} className={options.duration === duration ? "selected" : ""} onClick={() => updateQuickOption({ duration })}>{duration}s</button>)}
        </div></div>
      </section>

      {compliance.status !== "pass" && idea.trim() && (
        <div className={`quickCompliance ${compliance.status}`}>
          <ShieldAlert size={14} />
          <div>
            <strong>{compliance.status === "block" ? "检测到高风险题材" : "题材可能无法通过即梦审核"}</strong>
            <em>{compliance.issues[0]?.category} · {compliance.issues[0]?.guideline}</em>
            <span>{compliance.issues[0]?.reason}</span>
            <small>建议：{compliance.issues[0]?.suggestion}</small>
          </div>
        </div>
      )}

      {timing.status !== "balanced" && idea.trim() && (
        <div className={`quickTiming ${timing.status}`}>{timing.suggestions[0]}</div>
      )}

      <button className="quickGenerate" disabled={!idea.trim() || status === "loading"} onClick={generate}>
        <Sparkles size={16} />
        {status === "loading"
          ? modelEnabled ? "AI 正在理解剧情与设计镜头…" : "正在生成本地 Prompt…"
          : status === "error"
            ? "重新连接 AI 并生成"
            : visibleResult
              ? modelEnabled ? "重新生成 AI Prompt" : "重新生成本地 Prompt"
              : modelEnabled ? "AI 生成 Seedance Prompt" : "本地生成 Seedance Prompt"}
      </button>

      <section className={`quickResult ${visibleResult ? "hasResult" : ""} ${status === "error" ? "error" : ""}`}>
        <div className="quickResultHeader">
          <span>{visibleResult ? "生成结果" : status === "loading" ? "正在生成" : "Prompt 将显示在这里"}</span>
          {visibleResult && <span className="quickReady"><Check size={11} />已生成 · {output.length} 字</span>}
        </div>
        {status === "error" && <div className="quickError">模型连接失败，当前仅显示临时本地结果。再次点击上方按钮会重新请求模型：{message}</div>}
        {visibleResult ? <pre>{output}</pre> : <div className="quickEmpty">完整保留可执行镜头信息，风险提示不会限制生成。</div>}
      </section>

      <footer className="quickFooter">
        <span>{status === "loading" ? "正在生成，请稍候" : visibleResult?.agent?.mode === "model-rag" ? `已用 ${visibleResult.agent.model}` : visibleResult ? "本地规则已刷新" : compliance.status !== "pass" ? "已提示平台审核风险，可继续生成" : modelEnabled ? "AI 已连接" : "未连接 AI，可使用本地生成"}</span>
        <button disabled={!visibleResult} onClick={copyPrompt}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? "已复制" : "复制 Prompt"}</button>
      </footer>
    </div>
  );
}

function friendlyError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
}
