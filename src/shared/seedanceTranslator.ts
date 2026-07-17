import type {
  AssetType,
  AudioPolicy,
  ComplianceResult,
  ComplianceStatus,
  ModelPreset,
  PromptAgentDraft,
  ReferenceAsset,
  Shot,
  TimingAnalysis,
  TaskType,
  TranslatorOptions,
  TranslationResult
} from "./types";
import {
  buildDirectorBeats,
  compactDirectorCharacters,
  compactDirectorScene,
  compactDirectorShotAction,
  estimateDirectorMinimumSeconds,
  runShortDramaDirectorAgent,
  type CharacterProfile,
  type DramaContext
} from "./shortDramaDirectorAgent";
import { assessJimengCompliance, JIMENG_GUIDELINES_URL } from "./jimengCompliance";

export const DEFAULT_OPTIONS: TranslatorOptions = {
  modelPreset: "seedance-2.0",
  customModelId: "",
  ratio: "9:16",
  resolution: "720p",
  duration: 8,
  audioPolicy: "dialogue_effects",
  watermark: false,
  styleHint: "",
  maxShots: 4
};

const MODEL_IDS: Record<ModelPreset, string> = {
  "seedance-2.0": "doubao-seedance-2-0-260128",
  "seedance-2.0-fast": "doubao-seedance-2-0-fast-260128",
  custom: ""
};

const SOURCE_LINKS = [
  {
    title: "Doubao Seedance 2.0 系列提示词指南",
    url: "https://www.volcengine.com/docs/82379/2222480"
  },
  {
    title: "创建视频生成任务 API",
    url: "https://www.volcengine.com/docs/82379/1520757"
  },
  {
    title: "Doubao Seedance 2.0 系列视频生成教程",
    url: "https://www.volcengine.com/docs/82379/2291680"
  }
];

const CHINESE_NUMBERS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
};

const LOCATION_HINTS = [
  "办公室",
  "客厅",
  "卧室",
  "医院",
  "走廊",
  "街头",
  "餐厅",
  "咖啡店",
  "车内",
  "雨夜",
  "天台",
  "电梯",
  "会议室",
  "古宅",
  "宫殿",
  "校园",
  "仓库",
  "审讯室"
];

const SOUND_HINTS = [
  ["雨", "雨声"],
  ["门", "门响"],
  ["脚步", "脚步声"],
  ["手机", "手机震动或铃声"],
  ["杯", "杯子轻碰声"],
  ["车", "远处车流声"],
  ["玻璃", "玻璃轻响"],
  ["呼吸", "急促呼吸声"],
  ["掌声", "掌声"],
  ["枪", "低沉枪响"],
  ["刀", "金属摩擦声"]
] as const;

export function translateScriptToSeedance(
  script: string,
  assets: ReferenceAsset[] = [],
  options: Partial<TranslatorOptions> = {}
): TranslationResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const normalized = normalizeScript(script);
  const compliance = assessJimengCompliance(normalized);
  const crossGenderRelationshipLock = shouldLockCrossGenderEncounter(normalized);
  const neutralizeRelationshipLabels = hasRelationshipEthicsRisk(compliance) || crossGenderRelationshipLock;
  const detectedAssets = mergeAssets(detectAssets(normalized), assets);
  const taskType = inferTaskType(normalized, detectedAssets);
  const characters = detectCharacters(normalized);
  const locations = detectLocations(normalized);
  const style = inferStyle(normalized, mergedOptions.styleHint);
  const drama = buildDramaContext(normalized, characters, locations, detectedAssets, mergedOptions);
  const chunks = buildStoryChunks(normalized, drama, mergedOptions.duration);
  const shots = buildShotsFromChunks(chunks, mergedOptions.maxShots, drama);
  const timing = analyzeTiming(normalized, shots, chunks.length, mergedOptions.duration, drama);
  const generatedPrompt = normalized ? buildPrompt({
    normalized,
    taskType,
    characters,
    locations,
    style,
    shots,
    detectedAssets,
    audioPolicy: mergedOptions.audioPolicy,
    options: mergedOptions,
    timing,
    drama,
    neutralizeRelationshipLabels,
    crossGenderRelationshipLock
  }) : "";
  const prompt = generatedPrompt;
  const compactPrompt = compactForSeedance(prompt);
  const apiRequest = buildApiRequest(compactPrompt, detectedAssets, mergedOptions);
  const warnings = buildWarnings(normalized, compactPrompt, detectedAssets, mergedOptions, taskType, timing);
  const checks = buildChecks(taskType, mergedOptions.audioPolicy, detectedAssets, timing);

  return {
    taskType,
    prompt,
    compactPrompt,
    apiRequest,
    shots,
    detectedAssets,
    timing,
    warnings,
    checks,
    sourceLinks: SOURCE_LINKS,
    compliance
  };
}

export function translateScriptWithAgentDraft(
  script: string,
  assets: ReferenceAsset[],
  options: Partial<TranslatorOptions>,
  draft: PromptAgentDraft,
  agentMeta: { model: string; retrievedCases: string[] }
): TranslationResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const base = translateScriptToSeedance(script, assets, mergedOptions);
  const semanticCompliance = complianceFromAgentDraft(draft);
  const crossGenderRelationshipLock = shouldLockCrossGenderEncounter(script);
  const neutralizeRelationshipLabels = hasRelationshipEthicsRisk(base.compliance, semanticCompliance) || crossGenderRelationshipLock;
  const detectedAssets = base.detectedAssets;
  const useRelationshipGuardShots = crossGenderRelationshipLock && isSparseStory(script);
  const sourceShots = useRelationshipGuardShots
    ? buildCrossGenderEncounterGuardShots(base.shots)
    : draft.shots;
  const shots: Shot[] = sourceShots.slice(0, mergedOptions.maxShots).map((shot, index) => ({
    id: index + 1,
    source: script,
    camera: cleanPromptField(shot.camera || "中景固定"),
    action: withAtLabels(productionField(shot.action, neutralizeRelationshipLabels, crossGenderRelationshipLock), detectedAssets),
    dialogue: shot.dialogue.map(cleanDialogue).filter(Boolean).slice(0, 2),
    audio: shot.audio.map((item) => productionField(item, neutralizeRelationshipLabels, crossGenderRelationshipLock)).filter(Boolean).slice(0, 3)
  }));
  const timing = timingFromAgent(draft.estimatedSeconds, mergedOptions.duration);
  const hasDialogue = shots.some((shot) => shot.dialogue.length > 0);
  const modelAudio = mergedOptions.audioPolicy === "dialogue_effects"
    ? compactAudioLine(mergedOptions.audioPolicy, detectedAssets, hasDialogue)
    : `声音：${productionField(draft.audio, neutralizeRelationshipLabels, crossGenderRelationshipLock)}。`;
  const actionText = shots.map((shot) => shot.action).join("；");
  const visualDetails = useRelationshipGuardShots ? [] : draft.details
    .map((detail) => productionField(detail, neutralizeRelationshipLabels, crossGenderRelationshipLock))
    .filter(Boolean)
    .filter((detail) => !detailAlreadyVisible(detail, actionText));
  const characterField = useRelationshipGuardShots
    ? crossGenderEncounterCharacters()
    : productionField(draft.characters, neutralizeRelationshipLabels, crossGenderRelationshipLock);
  const sceneField = useRelationshipGuardShots
    ? crossGenderEncounterScene(draft.scene)
    : productionField(draft.scene, neutralizeRelationshipLabels, crossGenderRelationshipLock);
  const generatedPrompt = fitPromptToOfficialLimit([
    executionHeader(base.taskType, mergedOptions, productionField(draft.style || mergedOptions.styleHint || "写实短剧", neutralizeRelationshipLabels, crossGenderRelationshipLock)),
    taskOperationLine(base.taskType),
    compactAssetLead(detectedAssets, base.taskType),
    `人物：${characterField}。`,
    crossGenderRelationshipLock ? relationshipLockLine() : "",
    `场景：${sceneField}。`,
    ...timedShotLines(shots, mergedOptions.duration),
    visualDetails.length ? `表演细节：${visualDetails.join("；")}。` : "",
    directingConstraintLine(script, crossGenderRelationshipLock),
    modelAudio,
    "约束：人物身份、外貌和服装连续一致，动作自然连贯；画面内不生成字幕、文字或Logo。"
  ].filter(Boolean).join("\n"));
  const compliance = mergeComplianceResults(base.compliance, semanticCompliance, assessJimengCompliance(generatedPrompt));
  const prompt = generatedPrompt;
  const compactPrompt = compactForSeedance(prompt);
  const warnings = buildWarnings(script, compactPrompt, detectedAssets, mergedOptions, base.taskType, timing);
  const checks = [
    "已由模型结合本地同类桥段检索结果完成关系、潜台词与镜头设计。",
    ...(neutralizeRelationshipLabels ? ["已将风险分析与生产指令分离，最终 Prompt 使用中性角色称谓和可见动作表达原剧情。"] : []),
    ...(crossGenderRelationshipLock ? ["已锁定两组成年男女同行关系，旧识男女跨组认出，人物全程不交换分组。"] : []),
    ...(useRelationshipGuardShots ? ["已用四段可读分镜锁定两组身份、匹配视线、同行者无感和擦肩后的情绪余波。"] : []),
    ...buildChecks(base.taskType, mergedOptions.audioPolicy, detectedAssets, timing)
  ];

  return {
    ...base,
    prompt,
    compactPrompt,
    apiRequest: buildApiRequest(compactPrompt, detectedAssets, mergedOptions),
    shots,
    timing,
    warnings,
    checks,
    compliance,
    agent: {
      mode: "model-rag",
      model: agentMeta.model,
      retrievedCases: agentMeta.retrievedCases,
      relationshipRead: draft.relationshipRead
    }
  };
}

export function retargetTranslationRatio(
  result: TranslationResult,
  ratio: TranslatorOptions["ratio"]
): TranslationResult {
  const prompt = retargetPromptRatio(result.prompt, ratio);
  const compactPrompt = retargetPromptRatio(result.compactPrompt, ratio);
  const content = Array.isArray(result.apiRequest.content)
    ? result.apiRequest.content.map((item) => {
      if (!item || typeof item !== "object") return item;
      const entry = item as Record<string, unknown>;
      return entry.type === "text" && typeof entry.text === "string"
        ? { ...entry, text: retargetPromptRatio(entry.text, ratio) }
        : item;
    })
    : result.apiRequest.content;

  return {
    ...result,
    prompt,
    compactPrompt,
    apiRequest: {
      ...result.apiRequest,
      ratio,
      ...(content ? { content } : {})
    }
  };
}

function retargetPromptRatio(text: string, ratio: TranslatorOptions["ratio"]) {
  const ratioLabel = ratio === "adaptive" ? "自动画幅" : ratio;
  const orientation = ratio === "adaptive"
    ? "自适应"
    : ratio === "9:16" || ratio === "3:4"
      ? "竖屏"
      : ratio === "1:1"
        ? "方形"
        : "横屏";
  return String(text || "")
    .replace(/(?:9:16|16:9|1:1|4:3|3:4|21:9|自动画幅)\s*(?:竖屏|横屏|方形|自适应)/g, `${ratioLabel}${orientation}`)
    .replace(/(?:竖屏|横屏|方形|自适应)(?=\s*(?:9:16|16:9|1:1|4:3|3:4|21:9|自动画幅|构图|画幅|画面))/g, orientation)
    .replace(/(?:9:16|16:9|1:1|4:3|3:4|21:9|自动画幅)/g, ratioLabel);
}

function complianceFromAgentDraft(draft: PromptAgentDraft): ComplianceResult {
  const status = draft.compliance.status;
  const issues = draft.compliance.issues.map((issue, index) => ({
    code: `model-semantic-${index + 1}`,
    level: status === "block" ? "block" as const : "review" as const,
    category: issue.category,
    guideline: issue.guideline,
    reason: issue.reason,
    suggestion: issue.suggestion
  }));
  return {
    status,
    canGenerate: true,
    summary: status === "pass"
      ? "模型语义审核未发现公约风险。"
      : status === "review"
        ? `模型语义审核发现 ${issues.length} 项平台风险，已提醒；你仍可继续生成。`
        : `模型语义审核发现 ${issues.length} 项高风险内容，已提醒；本工具不会限制生成。`,
    issues,
    guidelineUrl: JIMENG_GUIDELINES_URL
  };
}

function mergeComplianceResults(...results: ComplianceResult[]): ComplianceResult {
  const issues = results.flatMap((result) => result.issues).filter((issue, index, all) =>
    all.findIndex((candidate) => candidate.code === issue.code || (
      candidate.category === issue.category && candidate.guideline === issue.guideline
    )) === index
  );
  const status: ComplianceStatus = results.some((result) => result.status === "block")
    ? "block"
    : results.some((result) => result.status === "review")
      ? "review"
      : "pass";
  return {
    status,
    canGenerate: true,
    summary: status === "pass"
      ? "未发现《即梦AI社区自律公约》中的明确风险，可进入 Prompt 生成。"
      : status === "review"
        ? `发现 ${issues.length} 项平台审核风险，已提醒；你仍可继续生成。`
        : `发现 ${issues.length} 项高风险内容，已提醒；本工具不会限制生成。`,
    issues,
    guidelineUrl: JIMENG_GUIDELINES_URL
  };
}

function hasRelationshipEthicsRisk(...results: ComplianceResult[]) {
  return results.some((result) => result.issues.some((issue) =>
    issue.code === "relationship-ethics" || /婚恋伦理|不良价值导向/.test(issue.category)
  ));
}

function shouldLockCrossGenderEncounter(text: string) {
  const normalized = normalizeScript(text);
  if (hasExplicitAlternativeCouple(normalized)) return false;
  const hasRelationship = /(异地恋|前任|旧爱|旧恋人|恋人|情侣)/.test(normalized);
  const hasCompanions = /(各自|双方|分别|都).{0,20}(伴侣|现任|同行者|对象)|(伴侣|现任|同行者|对象).{0,20}(各自|双方|分别|都)/.test(normalized);
  const hasEncounter = /(偶遇|撞见|重逢|碰见|遇见|迎面)/.test(normalized);
  return hasRelationship && hasCompanions && hasEncounter;
}

function hasExplicitAlternativeCouple(text: string) {
  return /(?:男男|女女|同性|两个男人|两名男子|两个女人|两名女子).{0,18}(?:情侣|恋人|相爱|伴侣)|(?:情侣|恋人|伴侣).{0,18}(?:男男|女女|同性)/.test(text);
}

function relationshipLockLine() {
  return "关系锁定：旧识男与女同行者同组并从左向右，旧识女与男同行者同组并从右向左；仅旧识男女跨组互相认出。两位同行者对相遇完全无感，保持原话题、步速和视线；四人身份、服装、配对和行进方向全程不交换。";
}

function crossGenderEncounterCharacters() {
  return "四名成年人且外貌服装可区分：旧识男看向画外旧识女约一秒，随步伐摆动的手停半拍；旧识女反向回望约一秒，原本的浅笑停一拍后收住；男同行者只陪旧识女并示意前方店铺，女同行者只陪旧识男并继续看橱窗，两位同行者毫无感知";
}

function crossGenderEncounterScene(scene: string) {
  const atmosphere = productionField(scene, true, true)
    .split(/[。；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/(旧识男|旧识女|男同行者|女同行者).{0,40}(?:左|右|方向|前行|入画)|(?:左|右).{0,40}(旧识男|旧识女|男同行者|女同行者)/.test(part))
    .join("，");
  const location = atmosphere || "真实城市步行街";
  return `${location}；两组沿相反屏幕方向接近，人物脸和视线清楚；路人只在转场与擦肩瞬间形成前景遮挡，不在空场中轴对称站位`;
}

function buildCrossGenderEncounterGuardShots(shots: Shot[]) {
  const actions = [
    "侧向跟随旧识男与女同行者从左向右自然前行；旧识女与男同行者从右向左进入环境纵深。两组配对、服装轮廓和行进方向清楚，四人不停步，也不并排面向镜头摆拍",
    "先拍旧识男位于画面左侧看向画外右侧约一秒，随步伐摆动的手停半拍；切旧识女位于画面右侧看向画外左侧约一秒，原本的浅笑停一拍后收住。两人的视线方向准确相接，观众明确知道他们互相认出",
    "侧面跟拍两组自然擦肩，旧识男女看回各自前方，保持原步速且不回头；男同行者仍示意前方店铺，女同行者继续看橱窗，两人对相遇毫无感知，不观察伴侣或另一组",
    "继续跟随旧识女与男同行者前行；男同行者再次抬手示意前方店铺，旧识女迟半拍才点头回应，随后恢复日常。旧识男一组按原方向自然出画，镜头不切回，无人回头或加速"
  ];
  const cameras = ["侧向中远景平稳跟拍", "中近景匹配视线剪辑", "侧面中景平稳跟拍", "单组中景平稳跟拍"];
  return actions.map((action, index) => ({
    camera: cameras[index],
    action,
    dialogue: [],
    audio: shots[index]?.audio || []
  }));
}

function directingConstraintLine(text: string, crossGenderRelationshipLock: boolean) {
  const publicScene = crossGenderRelationshipLock || /(街|路口|商场|车站|机场|医院|餐厅|咖啡|校园|广场|大厅|走廊)/.test(text);
  const parts = [
    "表演真实克制但关键反应必须可读，同一人物只保留一个主证据；不用瞪眼、明显皱眉、张口愣住、身体僵住或长时间凝视替观众解释剧情",
    "结尾预留完整动作时间，保持原步速，不突然加速或集体回头"
  ];
  if (publicScene) parts.push("公共场景保持自然人流，但只在转场和擦肩时遮挡，关键人物的脸与视线必须清楚；避免主要角色对称摆在空场中轴");
  if (crossGenderRelationshipLock) parts.push("用方向相反的男女中近景组成匹配视线，让观众看懂而同行者无感；收尾保留迟半拍恢复日常的情绪余波");
  return `导演约束：${parts.join("；")}。`;
}

function productionField(text: string, neutralizeRelationshipLabels: boolean, crossGenderRelationshipLock = false) {
  const cleaned = cleanPromptField(text);
  return neutralizeRelationshipLabels ? neutralizeRelationshipProductionText(cleaned, crossGenderRelationshipLock) : cleaned;
}

function neutralizeRelationshipProductionText(text: string, crossGenderRelationshipLock: boolean) {
  let normalized = String(text || "")
    .replace(/两部手机(?:同时|先后)?震动并亮起同一张(?:双人|情侣)合照/g, "两部手机先后震动，冷光短暂照亮两人的停顿")
    .replace(/情侣备注/g, "旧联系人提示")
    .replace(/(?:情侣|双人)合照/g, "旧照片");

  normalized = crossGenderRelationshipLock
    ? normalized
      .replace(/(?:男异地恋人|异地恋人男|前任男|男性前任|旧恋人男|旧识A|异地恋人A|旧恋人A|前任A|旧爱A)/g, "旧识男")
      .replace(/(?:女异地恋人|异地恋人女|前任女|女性前任|旧恋人女|旧识B|异地恋人B|旧恋人B|前任B|旧爱B)/g, "旧识女")
      .replace(/(?:男方现任|现任女友|现任伴侣A|同行者A)/g, "女同行者")
      .replace(/(?:女方现任|现任男友|现任伴侣B|同行者B)/g, "男同行者")
      .replace(/双方现任(?:伴侣)?/g, "男同行者和女同行者")
    : normalized
      .replace(/(?:男异地恋人|异地恋人男|前任男|男性前任|旧恋人男)/g, "旧识A")
      .replace(/(?:女异地恋人|异地恋人女|前任女|女性前任|旧恋人女)/g, "旧识B")
      .replace(/(?:男方现任|现任男友|现任伴侣A)/g, "同行者A")
      .replace(/(?:女方现任|现任女友|现任伴侣B)/g, "同行者B")
      .replace(/(?:异地恋人|旧恋人|前任|旧爱)A/g, "旧识A")
      .replace(/(?:异地恋人|旧恋人|前任|旧爱)B/g, "旧识B")
      .replace(/双方现任(?:伴侣)?/g, "两位同行者");

  return normalized
    .replace(/各自现任(?:伴侣)?/g, "各自身旁同行者")
    .replace(/现任伴侣/g, "同行者")
    .replace(/(?:异地恋人|旧恋人|前任|旧爱)/g, "旧识")
    .replace(/(?:双向背叛|脚踏两条船|双重恋爱)/g, "关系隐情")
    .replace(/(?:婚内出轨|婚外情|偷情|劈腿|出轨|背叛)/g, "未公开的关系隐情")
    .replace(/(?:小三|情人)/g, "同行者")
    .replace(/(?:情侣|恋人|现任)/g, "同行者")
    .replace(/(?:婚恋伦理|不良价值导向)/g, "都市情感")
    .replace(/双方同行者不知情/g, "两位同行者未察觉二人已经认出彼此")
    .replace(/不知道真实关系/g, "未察觉两人的停顿")
    .replace(/不知情/g, "未察觉异样")
    .replace(/心虚/g, "短暂慌乱")
    .replace(/封口/g, "保持沉默")
    .replace(/有鬼/g, "露出破绽")
    .replace(/旧情/g, "过去的熟悉感")
    .replace(/新关系/g, "当前生活")
    .replace(/关系悬在沉默里/g, "情绪停在沉默里");
}

function timingFromAgent(estimatedSeconds: number, selectedSeconds: number): TimingAnalysis {
  const estimated = Math.max(4, Math.round(estimatedSeconds));
  let status: TimingAnalysis["status"] = "balanced";
  if (estimated > 15) status = "too_long";
  else if (estimated > selectedSeconds + 1) status = "too_dense";
  else if (selectedSeconds - estimated >= 5) status = "too_sparse";
  const suggestions: string[] = [];
  if (status === "too_long") suggestions.push(`完整表达最低约 ${estimated} 秒，超过单次 15 秒上限；建议拆成 ${Math.ceil(estimated / 15)} 段，每段只保留一个转折。`);
  if (status === "too_dense") suggestions.push(`这段戏最低约需 ${estimated} 秒，当前 ${selectedSeconds} 秒会损失关系铺垫；建议改为 ${Math.min(15, estimated)} 秒，或只保留“触发动作+关键反应”。`);
  if (status === "too_sparse") suggestions.push(`当前内容约 ${estimated} 秒，选择 ${selectedSeconds} 秒可能拖沓；建议缩短时长，或补一个有因果的反应镜头。`);
  return {
    estimatedSeconds: estimated,
    selectedSeconds,
    status,
    recommendedSegments: Math.max(1, Math.ceil(estimated / 15)),
    suggestions
  };
}

function normalizeScript(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/＠/g, "@")
    .replace(/“([^”]+)”/g, "“$1”")
    .trim();
}

function detectAssets(text: string): ReferenceAsset[] {
  const assets = new Map<string, ReferenceAsset>();
  const pattern = /@?\s*(图片|图像|图|image|视频|video|音频|audio)\s*([0-9一二三四五六七八九十]+)/gi;
  for (const match of text.matchAll(pattern)) {
    const rawType = match[1].toLowerCase();
    const index = numberFromToken(match[2]);
    const type: AssetType = rawType.includes("视频") || rawType === "video" ? "video" : rawType.includes("音频") || rawType === "audio" ? "audio" : "image";
    const label = `${assetTypeName(type)}${index}`;
    if (!assets.has(`${type}-${index}`)) {
      assets.set(`${type}-${index}`, {
        id: `${type}-${index}`,
        type,
        label,
        url: "",
        enabled: true
      });
    }
  }
  return [...assets.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

function mergeAssets(detected: ReferenceAsset[], userAssets: ReferenceAsset[]) {
  const merged = new Map<string, ReferenceAsset>();
  for (const asset of detected) merged.set(assetMergeKey(asset), asset);
  for (const asset of userAssets) {
    const key = assetMergeKey(asset);
    if (!asset.enabled) {
      merged.delete(key);
      continue;
    }
    merged.set(key, { ...merged.get(key), ...asset, enabled: true });
  }
  return [...merged.values()].sort((a, b) => {
    const byType = assetTypeOrder(a.type) - assetTypeOrder(b.type);
    return byType || a.label.localeCompare(b.label, "zh-Hans-CN");
  });
}

function assetMergeKey(asset: ReferenceAsset) {
  return `${asset.type}:${asset.label}`;
}

function inferTaskType(text: string, assets: ReferenceAsset[]): TaskType {
  const hasVideo = assets.some((asset) => asset.type === "video");
  const hasMedia = assets.length > 0;
  if (/轨道|补齐|补全|接\s*视频|连接视频|串联/.test(text) && assets.filter((asset) => asset.type === "video").length >= 2) return "track_fill";
  if (hasVideo && /向前延长|向后延长|延长|续写|接着|后续/.test(text)) return "video_extend";
  if (hasVideo && /编辑|替换|删除|去掉|清除|修改|改成|添加|增加|抹除|修复/.test(text)) return "video_edit";
  if (hasMedia) return "multimodal_reference";
  return "text_to_video";
}

function detectCharacters(text: string): string[] {
  const speakers = new Set<string>();
  const dialoguePattern = /(?:^|\n)\s*([\u4e00-\u9fa5A-Za-z0-9_·]{1,10})\s*[：:]\s*([^\n]+)/g;
  for (const match of text.matchAll(dialoguePattern)) {
    const name = match[1].trim();
    if (!/^(场景|镜头|旁白|内心|时间|地点)$/.test(name)) speakers.add(name);
  }
  const rolePattern = /(女主|男主|妻子|丈夫|老板|医生|护士|警察|小偷|父亲|母亲|姐姐|妹妹|哥哥|弟弟|女孩|男孩|女人|男人)/g;
  for (const match of text.matchAll(rolePattern)) speakers.add(match[1]);
  return [...speakers].slice(0, 6);
}

function detectLocations(text: string): string[] {
  return LOCATION_HINTS.filter((location) => text.includes(location)).slice(0, 3);
}

function inferStyle(text: string, explicitStyle: string) {
  if (explicitStyle.trim()) return explicitStyle.trim();
  if (/古风|王爷|皇上|宫殿|将军|公主|世子/.test(text)) return "古风短剧，东方古典美术，服化道统一，柔和电影光";
  if (/悬疑|跟踪|真相|尸体|审讯|案件|杀/.test(text)) return "悬疑短剧，低饱和电影质感，冷暖对比光，紧张但克制";
  if (/异地恋|前任|旧爱|偶遇|重逢|心照不宣|恋人/.test(text)) return "都市情感短剧，写实电影感，低饱和霓虹，情绪克制";
  if (/甜宠|告白|恋爱|婚礼|心动|拥抱/.test(text)) return "都市情感短剧，自然肤色，柔和窗光，真实生活质感";
  if (/玄幻|仙侠|妖|魔|法术|灵力/.test(text)) return "东方玄幻短剧，写实电影级特效，光影层次清晰";
  if (/职场|总裁|会议|合同|公司|办公室/.test(text)) return "现代都市短剧，写实电影感，干净商业空间，自然对比度";
  return "写实短剧，电影质感，色彩自然，光影柔和";
}

function buildDramaContext(
  text: string,
  detectedCharacters: string[],
  detectedLocations: string[],
  assets: ReferenceAsset[],
  options: TranslatorOptions
): DramaContext {
  return runShortDramaDirectorAgent({ text, detectedCharacters, detectedLocations, assets, options });
}

function inferDramaTheme(text: string) {
  if (/异地恋|前任|旧爱|旧恋人|偶遇|重逢|心照不宣|陌生城市/.test(text)) return "旧爱重逢";
  if (/背叛|出轨|小三|离婚|复仇|报复/.test(text)) return "情感摊牌";
  if (/悬疑|跟踪|真相|尸体|审讯|案件|杀/.test(text)) return "悬疑发现";
  if (/总裁|合同|会议|公司|职场|老板/.test(text)) return "职场压迫";
  if (/古风|王爷|皇上|宫殿|将军|公主|世子/.test(text)) return "古风冲突";
  return "关系反转";
}

function isSparseStory(text: string) {
  if (!text.trim()) return true;
  const sentenceCount = text.split(/(?<=[。！？!?])\s*/).filter(Boolean).length;
  const hasDialogue = /[：:]\s*[^，。！？!?]{2,}|[“"][^”"]+[”"]/.test(text);
  const hasExplicitShots = /(?:镜头|分镜|shot)\s*[0-9一二三四五六七八九十]+/i.test(text);
  return text.length < 90 && sentenceCount <= 2 && !hasDialogue && !hasExplicitShots;
}

function inferProductionLocation(text: string, detectedLocations: string[], theme: string) {
  if (detectedLocations.length) return detectedLocations.join("、");
  if (/陌生城市/.test(text)) return "陌生城市夜晚的繁华街口，路面有微湿反光，行人和车流形成遮挡层次";
  if (/医院/.test(text)) return "医院走廊，冷白顶灯，墙面和地面干净但压抑";
  if (/电梯/.test(text)) return "写字楼电梯口，金属门反光，空间狭窄";
  if (/餐厅|咖啡/.test(text)) return "安静餐厅或咖啡店靠窗位置，玻璃反射出城市灯光";
  if (theme === "旧爱重逢") return "城市商业街路口，玻璃橱窗和人群制造偶遇感";
  if (theme === "悬疑发现") return "低照度室内空间，局部光源照出关键线索";
  if (theme === "职场压迫") return "现代办公室或会议室，冷静整洁，桌面有文件和屏幕光";
  return "真实可拍的城市生活场景，前景、中景、背景层次清晰";
}

function inferTimeAndLight(text: string, theme: string) {
  if (/雨夜/.test(text)) return "雨夜冷色环境光，地面反光明显";
  if (/夜|霓虹|陌生城市|街/.test(text)) return "夜晚路灯与橱窗暖光混合，人物面部有柔和侧光";
  if (/清晨|早晨/.test(text)) return "清晨自然光，空气干净";
  if (/黄昏|傍晚/.test(text)) return "黄昏暖光，阴影拉长";
  if (theme === "旧爱重逢") return "傍晚到夜晚的城市光，克制、微冷、带少量暖色反差";
  return "自然写实光线，人物面部清晰";
}

function inferAtmosphere(text: string, theme: string) {
  if (/心照不宣|假装没看到|沉默|尴尬/.test(text)) return "空气安静紧绷，表面礼貌，情绪藏在眼神和细小动作里";
  if (/争吵|摊牌|崩溃/.test(text)) return "情绪压迫逐步升高，但表演克制真实";
  if (theme === "旧爱重逢") return "人群热闹与两人沉默形成反差，旧情被压在一秒眼神里";
  if (theme === "悬疑发现") return "紧张、克制、留有悬念";
  return "真实、克制、有短剧冲突张力";
}

function buildCharacterProfiles(text: string, detectedCharacters: string[], theme: string, assets: ReferenceAsset[]) {
  const imageRefs = assets.filter((asset) => asset.type === "image").map(assetMention);
  if (theme === "旧爱重逢") {
    return [
      { name: "旧恋人A", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}克制敏感，认出对方时笑容短暂停住，立刻假装平静` },
      { name: "旧恋人B", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}表面礼貌疏离，眼神先失守又迅速移开` },
      { name: "现任伴侣A", description: "陪在旧恋人A身边，不抢戏，只通过挽手或并肩暗示关系" },
      { name: "现任伴侣B", description: "陪在旧恋人B身边，保持自然交谈，作为对照关系存在" }
    ];
  }
  if (detectedCharacters.length) {
    return detectedCharacters.slice(0, 5).map((name, index) => ({
      name,
      description: `${imageRefs[index] ? `外貌可参考${imageRefs[index]}，` : ""}保持外貌、服装、身份和情绪连续一致`
    }));
  }
  return [
    { name: "主角A", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}承担主要情绪变化，动作克制真实` },
    { name: "关系人物B", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}推动关系冲突，反应自然，不夸张表演` }
  ];
}

function inferMotifs(text: string, theme: string) {
  if (theme === "旧爱重逢") return ["眼神短暂停住", "手指攥紧又松开", "人群从两人中间穿过", "擦肩后一秒迟疑"];
  if (/手机|短信|电话/.test(text)) return ["手机屏幕冷光", "手指停在未发送的信息上", "人物呼吸变轻"];
  if (/合同|文件/.test(text)) return ["文件特写", "签字笔停顿", "对方压低视线"];
  if (/照片|戒指/.test(text)) return ["道具特写", "眼神闪躲", "手部微颤"];
  return ["关键表情变化", "手部小动作", "短暂停顿", "空间遮挡"];
}

function inferProps(text: string, theme: string) {
  const props = new Set<string>();
  if (/手机|电话|短信|导航/.test(text) || theme === "旧爱重逢") props.add("手机");
  if (/雨|雨夜|伞/.test(text)) props.add("雨伞");
  if (/合同|文件|办公室|职场/.test(text)) props.add("文件或签字笔");
  if (/照片/.test(text)) props.add("照片");
  if (/戒指|婚礼/.test(text)) props.add("戒指");
  if (theme === "旧爱重逢") props.add("纸袋或手提包");
  return [...props].slice(0, 3);
}

function inferConflict(text: string, theme: string) {
  if (theme === "旧爱重逢") return "曾经亲密的两个人在新关系面前不能相认，只能把旧情压进沉默";
  if (/背叛|出轨/.test(text)) return "亲密关系里的背叛被撞破，人物必须在体面和崩溃之间选择";
  if (theme === "悬疑发现") return "主角发现异常线索，但暂时不能声张";
  if (theme === "职场压迫") return "上位者施压与主角隐忍反击形成对抗";
  return "人物关系出现反转，情绪通过动作和眼神推进";
}

function inferEmotionalArc(text: string, theme: string, duration: number) {
  if (theme === "旧爱重逢") return duration <= 6 ? "认出彼此 -> 迅速伪装 -> 擦肩离开" : "意外看见 -> 眼神失守 -> 各自伪装 -> 擦肩后压住回头冲动";
  if (/摊牌|争吵/.test(text)) return "压抑开场 -> 情绪抬升 -> 关键反应收束";
  if (theme === "悬疑发现") return "发现异常 -> 确认线索 -> 克制隐藏";
  return "建立关系 -> 触发冲突 -> 表情或动作收束";
}

function inferPremise(text: string, theme: string, conflict: string) {
  if (!text.trim()) return "把空白输入转译为一个可执行的短剧镜头：人物在真实场景中完成一个明确动作，并用表情和环境声形成情绪。";
  if (theme === "旧爱重逢") return "旧恋人在陌生城市意外碰面，彼此身边已有新的伴侣；两人只用一秒眼神承认过去，又立刻假装陌生。";
  if (text.length < 120) return `${text.replace(/[。！？!?]+$/g, "")}；转译重点是：${conflict}。`;
  return `围绕原剧情提炼一个单段短剧镜头，重点表现：${conflict}。`;
}

function inferEndingBeat(text: string, theme: string) {
  if (theme === "旧爱重逢") return "四人向不同方向离开，旧恋人A和旧恋人B都没有真正回头，只在玻璃反光里留下短暂迟疑。";
  if (/摊牌|争吵/.test(text)) return "人物停在情绪转折点，留出下一段剧情钩子。";
  if (theme === "悬疑发现") return "主角把线索藏起，画面在未说出口的紧张里结束。";
  return "用一个明确表情、手部动作或道具特写收束镜头。";
}

function buildStoryChunks(text: string, drama: DramaContext, duration: number) {
  if (!text.trim()) return ["角色在清晰场景中完成一个自然、连续的小动作，镜头保持稳定，保留必要环境声。"];
  const explicit = splitExplicitShots(text);
  if (explicit.length > 0) return explicit;
  if (drama.sourceSparse) return buildOptimizedBeats(text, drama, duration);
  return splitIntoStoryChunks(text);
}

function buildOptimizedBeats(text: string, drama: DramaContext, duration: number) {
  return buildDirectorBeats(text, drama, duration);
}

function buildShotsFromChunks(chunks: string[], maxShots: number, drama: DramaContext): Shot[] {
  return chunks.slice(0, maxShots).map((chunk, index) => {
    const dialogue = extractDialogue(chunk);
    const action = actionize(chunk, dialogue, drama, index);
    return {
      id: index + 1,
      source: chunk,
      camera: chooseCamera(chunk, index, dialogue.length > 0, drama),
      action,
      dialogue,
      audio: inferAudio(chunk, dialogue, drama)
    };
  });
}

function splitExplicitShots(text: string) {
  const matches = [...text.matchAll(/(?:^|\n)\s*(?:镜头|分镜|shot)\s*[0-9一二三四五六七八九十]+[：:、.\s-]*/gi)];
  if (matches.length < 2) return [];
  return matches.map((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    return text.slice(start, end).trim();
  }).filter(Boolean);
}

function splitIntoStoryChunks(text: string) {
  const paragraphChunks = text
    .split(/\n{2,}|(?:^|\n)\s*(?:场景|第[一二三四五六七八九十0-9]+幕|转场)\s*[：:、.\s-]*/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
  if (paragraphChunks.length >= 2) return paragraphChunks;

  const sentenceChunks = text
    .split(/(?<=[。！？!?])\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (sentenceChunks.length <= 4) return sentenceChunks;

  const targetSize = Math.ceil(sentenceChunks.length / 4);
  const chunks: string[] = [];
  for (let i = 0; i < sentenceChunks.length; i += targetSize) {
    chunks.push(sentenceChunks.slice(i, i + targetSize).join(""));
  }
  return chunks;
}

function analyzeTiming(text: string, shots: Shot[], totalChunks: number, selectedSeconds: number, drama: DramaContext): TimingAnalysis {
  const dialogueChars = shots.reduce((sum, shot) => sum + shot.dialogue.join("").length, 0);
  const actionChars = shots.reduce((sum, shot) => sum + shot.action.length, 0);
  const explicitSeconds = [...text.matchAll(/(\d{1,2})\s*(?:秒|s|S)/g)].map((match) => Number(match[1])).filter(Boolean);
  const explicitTotal = explicitSeconds.length >= 2 ? Math.max(...explicitSeconds) : explicitSeconds.reduce((sum, value) => sum + value, 0);
  const shotBase = Math.max(1, shots.length) * 2.2;
  const dialogueTime = dialogueChars * 0.16;
  const actionTime = actionChars * 0.018;
  const overflowChunkTime = Math.max(0, totalChunks - shots.length) * 3.2;
  const sparseEstimate = estimateSparseMinimumSeconds(drama, shots);
  const estimatedSeconds = drama.sourceSparse
    ? sparseEstimate
    : Math.max(4, Math.ceil(Math.max(explicitTotal, shotBase + dialogueTime + actionTime + overflowChunkTime)));
  const recommendedSegments = Math.max(1, Math.ceil(estimatedSeconds / 15));
  let status: TimingAnalysis["status"] = "balanced";
  const suggestions: string[] = [];

  if (estimatedSeconds > 15 || totalChunks > shots.length) {
    status = "too_long";
    suggestions.push(`当前内容估算约 ${estimatedSeconds} 秒，超过 Seedance 2.0 单次 15 秒表达上限，建议拆成 ${recommendedSegments} 段生成。`);
    suggestions.push("每段保留 3-4 个镜头：建立场景、角色动作、台词反应、收束动作，避免把完整长剧本一次塞进一个任务。");
  } else if (selectedSeconds - estimatedSeconds >= 5 || (estimatedSeconds < 7 && selectedSeconds >= 14)) {
    status = "too_sparse";
    suggestions.push(`当前内容估算约 ${estimatedSeconds} 秒，但选择了 ${selectedSeconds} 秒，容易被模型用重复动作或空镜填满。`);
    suggestions.push(`建议把时长调到 ${Math.max(4, estimatedSeconds - 1)}-${Math.min(15, estimatedSeconds + 1)} 秒，或补充明确动作转折、表情反应和必要音效。`);
  } else if (estimatedSeconds > selectedSeconds + 2) {
    status = "too_dense";
    suggestions.push(`当前内容最低需要约 ${estimatedSeconds} 秒，高于所选 ${selectedSeconds} 秒；建议调到 ${estimatedSeconds}-${Math.min(15, estimatedSeconds + 2)} 秒，或只生成其中一个情绪片段。`);
    suggestions.push("4-5 秒只适合单一动作或一个表情反应，不适合完整交代偶遇、认出、伪装、擦肩离开。");
  } else {
    suggestions.push(`当前内容估算约 ${estimatedSeconds} 秒，适合生成 ${selectedSeconds} 秒左右的单段镜头。`);
  }

  return {
    estimatedSeconds,
    selectedSeconds,
    status,
    recommendedSegments,
    suggestions
  };
}

function estimateSparseMinimumSeconds(drama: DramaContext, shots: Shot[]) {
  return estimateDirectorMinimumSeconds(drama, shots);
}

function extractDialogue(chunk: string) {
  const text = chunk.replace(/^\s*(建立场景|情绪触发|关系伪装|收束镜头|冲突触发|反应推进)\s*[：:]/, "");
  const dialogues = new Set<string>();
  const speakerPattern = /[\u4e00-\u9fa5A-Za-z0-9_·]{1,10}\s*[：:]\s*([^\n。！？!?]{2,80}[。！？!?]?)/g;
  for (const match of text.matchAll(speakerPattern)) dialogues.add(cleanDialogue(match[1]));
  const quotePattern = /[“"]([^”"]{2,80})[”"]/g;
  for (const match of text.matchAll(quotePattern)) dialogues.add(cleanDialogue(match[1]));
  return [...dialogues].slice(0, 3);
}

function actionize(chunk: string, dialogue: string[], drama: DramaContext, index: number) {
  let cleaned = chunk
    .replace(/^\s*(建立场景|情绪触发|关系伪装|收束镜头|冲突触发|反应推进)\s*[：:]/, "")
    .replace(/@?\s*(图片|图像|图|image|视频|video|音频|audio)\s*([0-9一二三四五六七八九十]+)/gi, "")
    .replace(/[\u4e00-\u9fa5A-Za-z0-9_·]{1,10}\s*[：:]\s*/g, "")
    .replace(/[“"][^”"]+[”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const line of dialogue) cleaned = cleaned.replace(line, "");
  cleaned = cleaned.replace(/[。！？!?，,；;：:]+$/g, "").trim();
  if (!cleaned) return enrichAction("角色保持自然站姿，眼神和表情随台词轻微变化", drama, index);
  return enrichAction(refineAction(cleaned), drama, index);
}

function refineAction(action: string) {
  const replacements: Array<[RegExp, string]> = [
    [/跑/g, "快步向前，肩背微微前倾"],
    [/生气/g, "下颌轻收，动作节奏慢半拍"],
    [/伤心/g, "呼吸放慢，视线短暂下垂"],
    [/害怕/g, "呼吸变浅，肩颈略微收紧"],
    [/震惊/g, "目光焦点短暂停住，呼吸漏半拍"],
    [/开心/g, "嘴角轻微放松，眼神变柔"]
  ];
  return replacements.reduce((next, [pattern, value]) => next.replace(pattern, value), action);
}

function enrichAction(action: string, drama: DramaContext, index: number) {
  if (drama.theme === "双向背叛撞见") {
    const additions = [
      "锁定两组配对和相反行进方向，人物服装轮廓清楚，不让四人对称站在空场",
      "用方向相反的男女中近景组成匹配视线，两人各有约一秒可读反应，不只靠慢眨或虚焦",
      "两位同行者继续原话题和视线方向，对相遇毫无感知，不给反应镜头",
      "跟随一组按原步速离开，用迟半拍回应留下余波；另一组在反射或背景中自然出画"
    ];
    return `${action}，${additions[Math.min(index, additions.length - 1)]}`;
  }
  if (drama.theme === "旧爱重逢") {
    const additions = [
      "锁定两组配对和相反行进方向，人物服装轮廓清楚，不让四人对称站在空场",
      "用方向相反的男女中近景组成匹配视线，两人各有约一秒可读反应，不只靠慢眨或虚焦",
      "两位同行者继续原话题和视线方向，对相遇毫无感知，不给反应镜头",
      "跟随一组按原步速离开，用迟半拍回应留下余波；另一组在反射或背景中自然出画"
    ];
    return `${action}，${additions[Math.min(index, additions.length - 1)]}`;
  }
  if (drama.sourceSparse && index === 0) return `${action}，先交代空间、主体和关系，不要空泛`;
  if (drama.sourceSparse && index === 1) return `${action}，把冲突落到眼神、手部或身体停顿上`;
  return action;
}

function chooseCamera(chunk: string, index: number, hasDialogue: boolean, drama: DramaContext) {
  if (drama.theme === "双向背叛撞见") {
    const cameras = ["侧向中远景平稳跟拍", "中近景匹配视线剪辑", "侧面中景平稳跟拍", "单组中景平稳跟拍"];
    return cameras[Math.min(index, cameras.length - 1)];
  }
  if (drama.theme === "旧爱重逢") {
    const cameras = ["侧向中远景平稳跟拍", "中近景匹配视线剪辑", "侧面中景平稳跟拍", "单组中景平稳跟拍"];
    return cameras[Math.min(index, cameras.length - 1)];
  }
  if (/推门|进入|走进|出场/.test(chunk)) return "中景固定机位";
  if (/发现|看见|震惊|哭|流泪|沉默/.test(chunk)) return "近景缓慢推近";
  if (/追|逃|跑|打|拉扯|争夺/.test(chunk)) return "手持跟拍";
  if (/展示|拿出|递给|手机|合同|戒指|照片/.test(chunk)) return "特写固定镜头";
  if (hasDialogue) return index % 2 === 0 ? "中景固定机位" : "近景切换";
  return index === 0 ? "全景缓慢推近" : "中景固定机位";
}

function inferAudio(chunk: string, dialogue: string[], drama: DramaContext) {
  const audio = new Set<string>();
  for (const [keyword, sound] of SOUND_HINTS) {
    if (chunk.includes(keyword)) audio.add(sound);
  }
  if (drama.theme === "双向背叛撞见") {
    audio.add("远处车流声");
    audio.add("人群脚步声");
    audio.add("手机轻微震动声");
  }
  if (drama.theme === "旧爱重逢") {
    audio.add("远处车流声");
    audio.add("人群脚步声");
  }
  if (/雨夜|街头|车/.test(chunk)) audio.add("轻微环境声");
  if (/沉默|停顿|看着/.test(chunk)) audio.add("保留自然呼吸声");
  if (dialogue.length > 0) audio.add("台词清晰，同步口型");
  return [...audio].slice(0, 4);
}

function buildPrompt(input: {
  normalized: string;
  taskType: TaskType;
  characters: string[];
  locations: string[];
  style: string;
  shots: Shot[];
  detectedAssets: ReferenceAsset[];
  audioPolicy: AudioPolicy;
  options: TranslatorOptions;
  timing: TimingAnalysis;
  drama: DramaContext;
  neutralizeRelationshipLabels: boolean;
  crossGenderRelationshipLock: boolean;
}) {
  const hasDialogue = input.shots.some((shot) => shot.dialogue.length > 0);
  const assetLead = compactAssetLead(input.detectedAssets, input.taskType);
  const characterLead = `人物：${productionField(compactCharacters(input.drama), input.neutralizeRelationshipLabels, input.crossGenderRelationshipLock)}。`;
  const relationshipLead = input.crossGenderRelationshipLock ? relationshipLockLine() : "";
  const sceneLead = `场景：${productionField(compactScene(input.drama), input.neutralizeRelationshipLabels, input.crossGenderRelationshipLock)}。`;
  const shotBudget = input.shots.length >= 4 ? 58 : 76;
  const executableShots = input.shots.map((shot) => ({
    ...shot,
    camera: shortCamera(shot.camera),
    action: productionField(compactShotAction(shot, input.drama, input.detectedAssets, shotBudget), input.neutralizeRelationshipLabels, input.crossGenderRelationshipLock)
  }));
  const audioLead = compactAudioLine(input.audioPolicy, input.detectedAssets, hasDialogue);
  const directingLead = directingConstraintLine(input.normalized, input.crossGenderRelationshipLock);
  const constraintLead = "约束：人物身份、外貌和服装连续一致，动作自然连贯；画面内不生成字幕、文字或Logo。";

  const prompt = [
    executionHeader(input.taskType, input.options, input.style),
    taskOperationLine(input.taskType),
    assetLead,
    characterLead,
    relationshipLead,
    sceneLead,
    ...timedShotLines(executableShots, input.options.duration),
    directingLead,
    audioLead,
    constraintLead
  ].filter(Boolean).join("\n");
  return fitPromptToOfficialLimit(prompt);
}

function executionHeader(taskType: TaskType, options: TranslatorOptions, style: string) {
  const mode = taskType === "text_to_video" ? "" : taskType === "multimodal_reference" ? "多模态参考，" : "视频编辑，";
  const ratio = options.ratio === "adaptive" ? "自动画幅" : options.ratio;
  return `${options.duration}秒，${ratio}，${mode}${cleanPromptField(style)}。`;
}

function taskOperationLine(taskType: TaskType) {
  if (taskType === "video_edit") return "严格编辑输入视频，只改变用户明确指定的内容，其余主体、动作和构图保持不变。";
  if (taskType === "video_extend") return "从输入视频末尾自然延长，保持人物、场景、光线、声音和运动连续。";
  if (taskType === "track_fill") return "按输入视频顺序补齐中间段，首尾动作、机位和声音自然衔接。";
  return "";
}

function timedShotLines(shots: Shot[], duration: number) {
  if (!shots.length) return [];
  return shots.map((shot, index) => {
    const start = Math.round(index * duration / shots.length);
    const end = Math.max(start + 1, Math.round((index + 1) * duration / shots.length));
    const dialogue = shot.dialogue.length ? `，台词${shot.dialogue.map((line) => `“${cleanDialogue(line)}”`).join("、")}` : "";
    return `${start}-${Math.min(duration, end)}秒，${shortCamera(shot.camera)}：${cleanPromptField(shot.action)}${dialogue}。`;
  });
}

function detailAlreadyVisible(detail: string, actionText: string) {
  if (!detail || actionText.includes(detail)) return true;
  const normalized = detail.replace(/[，。；、：:,.\s]/g, "");
  if (normalized.length < 4) return actionText.includes(normalized);
  const grams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) grams.add(normalized.slice(index, index + 2));
  const hits = [...grams].filter((gram) => actionText.includes(gram)).length;
  return hits >= 3 && hits / grams.size >= 0.48;
}

function compactAssetLead(assets: ReferenceAsset[], taskType: TaskType) {
  if (assets.length === 0) return "";
  const imageRefs = assets.filter((asset) => asset.type === "image").map(assetMention);
  const videoRefs = assets.filter((asset) => asset.type === "video").map(assetMention);
  const audioRefs = assets.filter((asset) => asset.type === "audio").map(assetMention);
  const parts: string[] = [];
  if (imageRefs.length) parts.push(`${imageRefs.join("、")}取角色/服装/道具`);
  if (videoRefs.length) parts.push(`${videoRefs.join("、")}${taskType === "video_edit" || taskType === "video_extend" || taskType === "track_fill" ? "作原视频" : "取动作/运镜"}`);
  if (audioRefs.length) parts.push(`${audioRefs.join("、")}取音色/音效`);
  return `参考：${parts.join("；")}。`;
}

function compactCharacters(drama: DramaContext) {
  return compactDirectorCharacters(drama);
}

function compactScene(drama: DramaContext) {
  return compactDirectorScene(drama);
}

function shortCamera(camera: string) {
  return camera
    .replace("全景缓慢推近", "全景推近")
    .replace("中近景轻微推近", "中近景推近")
    .replace("背影中景轻微跟拍", "背影跟拍")
    .replace("近景固定镜头", "近景固定")
    .replace("中景固定机位", "中景固定")
    .replace("特写固定镜头", "特写固定");
}

function compactShotAction(shot: Shot, drama: DramaContext, assets: ReferenceAsset[], maxLength: number) {
  return compactDirectorShotAction(shot, drama, assets, maxLength);
}

function compactAudioLine(policy: AudioPolicy, assets: ReferenceAsset[], hasDialogue: boolean) {
  if (policy === "silent") return "声音：无声。";
  if (policy === "full_audio") return "声音：人声、环境声、必要音效同步，可有弱氛围声。";
  const ref = assets.some((asset) => asset.type === "audio") ? "参考音频仅取音色/音效，" : "";
  return `声音：${hasDialogue ? "台词口型同步，" : "自然呼吸和动作声，"}${ref}保留环境声和必要音效，不生成背景音乐。`;
}

function cleanPromptField(text: string) {
  return String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/。+/g, "。")
    .replace(/[；;，,。]+$/g, "")
    .trim();
}

function fitPromptToOfficialLimit(prompt: string) {
  return prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function buildAssetLead(assets: ReferenceAsset[], taskType: TaskType) {
  if (assets.length === 0) return "";
  const imageRefs = assets.filter((asset) => asset.type === "image").map(assetMention);
  const videoRefs = assets.filter((asset) => asset.type === "video").map(assetMention);
  const audioRefs = assets.filter((asset) => asset.type === "audio").map(assetMention);
  const parts: string[] = [];
  if (imageRefs.length) parts.push(`参考${imageRefs.join("、")}中的角色样貌、服装、道具或场景特征`);
  if (videoRefs.length) {
    const verb = taskType === "video_edit" || taskType === "video_extend" || taskType === "track_fill" ? "使用" : "参考";
    parts.push(`${verb}${videoRefs.join("、")}的动作、运镜或原始画面关系`);
  }
  if (audioRefs.length) parts.push(`参考${audioRefs.join("、")}中的音色或必要音效`);
  return `${parts.join("；")}。`;
}

function assetMention(asset: ReferenceAsset) {
  return `@${asset.label}`;
}

function withAtLabels(text: string, assets: ReferenceAsset[]) {
  return assets.reduce((next, asset) => {
    const escaped = asset.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return next.replace(new RegExp(`(?<!@)${escaped}`, "g"), `@${asset.label}`);
  }, text);
}

function taskTypeInstruction(taskType: TaskType) {
  switch (taskType) {
    case "video_edit":
      return "任务类型：严格编辑输入视频，未提及的主体、动作、构图和画面关系保持不变。";
    case "video_extend":
      return "任务类型：延长输入视频，音视频风格、主体身份和叙事节奏与原视频保持一致。";
    case "track_fill":
      return "任务类型：轨道补齐，按视频输入顺序生成自然过渡，首尾衔接平稳。";
    case "multimodal_reference":
      return "任务类型：多模态参考生视频，从参考素材中提取主体、动作、运镜、场景或音色，生成全新短剧镜头。";
    default:
      return "任务类型：文生视频，按短剧镜头生产方式生成单段可剪辑视频。";
  }
}

function audioPolicyInstruction(policy: AudioPolicy, assets: ReferenceAsset[], hasDialogue = true) {
  if (policy === "silent") return "音频要求：生成无声视频，不生成台词、音效或背景音乐。";
  if (policy === "full_audio") return "音频要求：生成与画面同步的人声、必要音效和剧情需要的氛围声；若使用参考音频，只继承明确要求的音色或节奏。";
  const hasAudioRef = assets.some((asset) => asset.type === "audio");
  const dialoguePart = hasDialogue ? "台词、人声气息" : "人物自然呼吸和轻微动作声";
  return hasAudioRef
    ? `音频要求：保留${dialoguePart}、环境声和必要音效；参考音频仅用于音色或指定音效，不额外生成背景音乐。`
    : `音频要求：保留${dialoguePart}、环境声和必要音效；不生成背景音乐。`;
}

function compactForSeedance(prompt: string) {
  return prompt
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/。+/g, "。")
    .trim();
}

function buildApiRequest(prompt: string, assets: ReferenceAsset[], options: TranslatorOptions) {
  const model = options.modelPreset === "custom" ? options.customModelId || "<YOUR_ENDPOINT_OR_MODEL_ID>" : MODEL_IDS[options.modelPreset];
  return {
    model,
    content: [
      {
        type: "text",
        text: prompt
      },
      ...assets.map((asset) => assetToContent(asset))
    ],
    generate_audio: options.audioPolicy !== "silent",
    ratio: options.ratio,
    resolution: options.resolution,
    duration: options.duration,
    watermark: options.watermark
  };
}

function assetToContent(asset: ReferenceAsset) {
  if (asset.type === "image") {
    return {
      type: "image_url",
      image_url: { url: asset.url || `<${asset.label}_URL_OR_ASSET_ID>` },
      role: "reference_image"
    };
  }
  if (asset.type === "video") {
    return {
      type: "video_url",
      video_url: { url: asset.url || `<${asset.label}_URL_OR_ASSET_ID>` },
      role: "reference_video"
    };
  }
  return {
    type: "audio_url",
    audio_url: { url: asset.url || `<${asset.label}_URL_OR_ASSET_ID>` },
    role: "reference_audio"
  };
}

function buildWarnings(text: string, prompt: string, assets: ReferenceAsset[], options: TranslatorOptions, taskType: TaskType, timing: TimingAnalysis) {
  const warnings: string[] = [];
  const chineseLength = [...prompt].filter((char) => /[\u4e00-\u9fa5]/.test(char)).length;
  if (chineseLength > 500) warnings.push(`中文 Prompt 约 ${chineseLength} 字，已优先保留完整剧情与镜头信息。500 字仅作效果建议，不会自动截断；如平台生成偏离，再按剧情转折拆成多段。`);
  if (assets.filter((asset) => asset.type === "image").length > 9) warnings.push("Seedance 2.0 多模态参考最多 9 张图片。");
  if (assets.filter((asset) => asset.type === "video").length > 3) warnings.push("Seedance 2.0 多模态参考最多 3 个视频，且总时长不超过 15 秒。");
  if (assets.filter((asset) => asset.type === "audio").length > 3) warnings.push("Seedance 2.0 多模态参考最多 3 段音频，且总时长不超过 15 秒。");
  if (assets.length === assets.filter((asset) => asset.type === "audio").length && assets.length > 0) warnings.push("官方 API 不支持纯音频或文本+音频输入，至少需要 1 个图片或视频参考。");
  if (/真人|本人|明星|艺人|演员|照片|脸/.test(text) && assets.some((asset) => asset.type === "image" || asset.type === "video")) {
    warnings.push("Seedance 2.0 不支持直接上传含真人人脸的参考图/视频；请使用官方信任的模型原始产物、虚拟人像或已授权真人素材。");
  }
  if (options.resolution === "4k" && options.modelPreset !== "seedance-2.0") warnings.push("4K 输出仅适用于 Doubao Seedance 2.0，Fast/Mini 不支持。");
  if ((taskType === "video_edit" || taskType === "video_extend") && !assets.some((asset) => asset.type === "video")) warnings.push("编辑或延长任务需要视频输入；当前会退化为文本/参考生成。");
  if (timing.status !== "balanced") warnings.push(...timing.suggestions);
  if (assets.some((asset) => asset.path && !/^https?:|^asset:|^data:/.test(asset.url))) warnings.push("本地拖入/扫描的素材已用于 @ 标注；若要调用 Seedance API，请先上传为公网 URL、Base64 或 asset:// 素材 ID。");
  return warnings;
}

function buildChecks(taskType: TaskType, audioPolicy: AudioPolicy, assets: ReferenceAsset[], timing: TimingAnalysis) {
  const checks = [
    "按镜头顺序组织：谁、在哪、做什么、镜头怎么动。",
    "主体指代清楚，参考素材使用 @图片N / @视频N / @音频N，复制后可到平台手动改 @ 绑定。",
    "每镜头仅保留一种主要运镜。",
    "已加入无字幕、无水印、无 Logo 约束。"
  ];
  checks.push(`时长估算：约 ${timing.estimatedSeconds} 秒；Seedance 2.0 单次最多 15 秒。`);
  if (audioPolicy === "dialogue_effects") checks.push("短剧音频策略：保留台词和必要音效，不主动生成背景音乐。");
  if (assets.length) checks.push("已按官方多模态规则生成 content 数组。");
  return checks;
}

function numberFromToken(token: string) {
  if (/^\d+$/.test(token)) return Number(token);
  if (token.length === 1) return CHINESE_NUMBERS[token] || 1;
  if (token === "十一") return 11;
  if (token === "十二") return 12;
  return 1;
}

function cleanDialogue(line: string) {
  return line.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();
}

function assetTypeName(type: AssetType) {
  if (type === "image") return "图片";
  if (type === "video") return "视频";
  return "音频";
}

function assetTypeOrder(type: AssetType) {
  if (type === "image") return 0;
  if (type === "video") return 1;
  return 2;
}
