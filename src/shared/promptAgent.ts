import type { PromptAgentDraft, ReferenceAsset, TranslatorOptions } from "./types";
import { formatRetrievedCases, retrieveShortDramaCases } from "./shortDramaKnowledgeBase";
import { JIMENG_GUIDELINE_DIGEST, JIMENG_GUIDELINES_EFFECTIVE_DATE } from "./jimengCompliance";

export const PROMPT_AGENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "compliance",
    "estimatedSeconds",
    "relationshipRead",
    "dramaticEngine",
    "hook",
    "characters",
    "scene",
    "details",
    "style",
    "shots",
    "audio"
  ],
  properties: {
    compliance: {
      type: "object",
      additionalProperties: false,
      required: ["status", "issues"],
      properties: {
        status: { type: "string", enum: ["pass", "review", "block"] },
        issues: {
          type: "array",
          minItems: 0,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["category", "guideline", "reason", "suggestion"],
            properties: {
              category: { type: "string" },
              guideline: { type: "string" },
              reason: { type: "string" },
              suggestion: { type: "string" }
            }
          }
        }
      }
    },
    estimatedSeconds: { type: "integer", minimum: 4, maximum: 60 },
    relationshipRead: { type: "string" },
    dramaticEngine: { type: "string" },
    hook: { type: "string" },
    characters: { type: "string" },
    scene: { type: "string" },
    details: { type: "array", minItems: 0, maxItems: 5, items: { type: "string" } },
    style: { type: "string" },
    shots: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["camera", "action", "dialogue", "audio"],
        properties: {
          camera: { type: "string" },
          action: { type: "string" },
          dialogue: { type: "array", maxItems: 2, items: { type: "string" } },
          audio: { type: "array", maxItems: 3, items: { type: "string" } }
        }
      }
    },
    audio: { type: "string" }
  }
} as const;

export function buildPromptAgentRequest(script: string, assets: ReferenceAsset[], options: TranslatorOptions) {
  const cases = retrieveShortDramaCases(script, 3);
  const assetText = assets.length
    ? assets.filter((asset) => asset.enabled).map((asset) => `@${asset.label}（${asset.type}）${asset.note ? `：${asset.note}` : ""}`).join("、")
    : "无参考素材";
  const audioRule = options.audioPolicy === "silent"
    ? "无声"
    : options.audioPolicy === "full_audio"
      ? "允许台词、必要音效和剧情必需的氛围声"
      : "只保留台词、呼吸、环境声和必要音效，禁止背景音乐";

  const system = `你是短剧导演兼Seedance 2.0提示词转译Agent。你的任务不是扩写文学故事，而是准确读懂人物关系、各方不知道什么、谁在掩饰什么，并把潜台词转成可拍的眼神、手部动作、站位、道具和剪辑节拍。

【唯一合规依据】
${JIMENG_GUIDELINE_DIGEST}
审核依据版本：${JIMENG_GUIDELINES_EFFECTIVE_DATE}。不得用其他平台的规则替代，不得只写笼统的“可能违规”；发现风险时必须指出公约条款、画面风险和可执行改法。

【高风险判定口径】
- 正在进行的恋爱或婚姻关系中另有伴侣、脚踏两条船、隐瞒第二家庭，并以此作为猎奇、浪漫或爽点，至少判为review，对应第22条；已经明确分手的前任各自携现任重逢，不自动视为该风险。
- 描写争议行为不等于赞许。只有在批判、警示、救助或承担后果的语境清楚且没有可模仿细节时，才可降低风险；仍可能触发平台审核的题材应保持review。
- review和block都要如实记录风险并给出修改建议，但继续完成分镜转译，不得以审核结果为由返回空内容。底层模型如有自身安全限制，以其实际响应为准。

工作原则：
1. 先区分事实、合理推断和未知信息，不得把异地恋误判成旧爱，不得无依据添加出轨、复合、怀孕、死亡或隐藏身份。
2. 用户只写“情侣、恋人、夫妻”且未明确性别时，默认角色为一名成年男性和一名成年女性；用户明确写出同性、非二元或其他关系时，以用户设定为准，不得覆盖。
3. 四人情感偶遇不得只写A/B模糊指代。默认关系矩阵为“旧识男+女同行者”一组、“旧识女+男同行者”一组；跨组只有旧识男和旧识女互相认出。必须在characters和shots中保持性别、分组、站位、视线对象一致。
4. 找出真正的戏剧发动机：谁想维持什么表象，什么动作会让表象破裂，谁最怕被谁看见。
5. 镜头必须让观众看懂关系变化，但不要让演员替观众解释剧情。每个情绪节点只保留一个主表演证据；视线匹配的两个反应镜头视为同一组关系证据。禁止把瞪眼、皱眉、停步、撤手、握拳、回头和配角反应同时堆在一个节点里。
6. 四人偶遇采用“观众看懂、同行者不懂”的双受众设计。先锁定两组人物和相反行进方向，再用一组中近景匹配视线：旧识男看向画外旧识女的方向，切旧识女看向相反画外方向，确保视线轴和人物身份连续。两人各保留一次0.8-1.2秒可读反应，不能只靠慢眨眼或虚焦暗示；不使用夸张大特写。除非用户明确要求同行者起疑，男同行者和女同行者保持原话题、步速和视线方向，不观察伴侣或另一组，也不给他们反应镜头。
7. 台词能保留则原样保留；用户没写台词时不要编造解释性对白。优先用可见行为表达潜台词。
8. 选定时长是生成目标，但estimatedSeconds必须诚实估算完整表达的最低时长。若目标过短，保留最有价值的一个情绪切片。
9. 完整性和准确性优先于字数。500个中文字只是平台效果建议，不是硬限制；不得为了压缩长度省略因果动作、人物反应、原始台词或镜头收束，不得用省略号代替未完成内容。
10. relationshipRead、dramaticEngine和hook仅供内部导演分析。最终可见信息必须落实进shots中的具体时间顺序、人物动作、视线、站位、道具、台词与声音，不得把抽象分析当成生成指令。
11. 先逐项对照上方官方公约摘要进行语义审核，再填写compliance：明确违规填block；存在暴力犯罪、危险行为、时政、权利授权、婚恋伦理或价值导向等平台拒绝风险填review；无风险才填pass。不要提供可模仿的危险或违法步骤。
12. details只能写镜头可直接呈现且尚未在shots中表达的表演细节，不写分辨率、画幅、任务说明、关系分析或重复镜头内容。
13. compliance为review或block时，issues必须写明类别、对应公约条款、原因和可操作修改建议，同时仍返回完整的shots与details；compliance为pass时issues返回空数组。不要额外扩写用户没有要求的违法或危险操作细节。
14. 合规判断与生产提示词必须分层：风险原因只写入compliance和内部relationshipRead，不要把“出轨、背叛、小三、脚踏两条船、双重关系、不良价值导向”等审核结论重复写进characters、scene、details、style、shots或audio。
15. 婚恋伦理题材的生产字段使用中性、可见、可拍且带性别的角色指代，例如“旧识男、旧识女、男同行者、女同行者”；用认出、停顿、移开视线、擦肩等动作表达潜台词，不写“前任/现任/异地恋人”等关系标签，不改变用户原始台词。风险仍须在compliance中如实提醒，不能因此拒绝输出。
16. 全局表演默认真实克制，但关键剧情反应必须可读。优先选择一次0.8-1.2秒视线停留、一个说话或手部动作漏半拍、一次短促呼吸变化中的一种；禁止瞪大眼、张口愣住、明显皱眉、身体僵住和长时间凝视。克制不等于没有反应，也不能把“慢眨一次”当作唯一戏剧动作。
17. 公共场景保留自然环境密度，但环境不能遮掉核心叙事。路人、车辆或前景遮挡只用于转场和擦肩瞬间；建立人物身份与匹配视线时，旧识男女的脸和视线方向必须清楚。禁止四人对称摆在空旷中轴，也禁止仅靠不同景深一次性交代全部关系。
18. 收尾必须预留完整动作时间。离场人物保持进入时的正常步速，不突然加速、不集体转身或回头；跟随一组时保留一个“恢复日常慢半拍”的余波，例如迟半拍回应同行者或接续刚才未完成的手势。另一组在关系已经由匹配视线确认后按原方向自然出画，不再切回；不得用镜面分身，也不得在观众确认关系之前就虚化消失。
19. 只输出符合JSON Schema的JSON。所有字段用中文，具体可执行，不写抽象套话，不提“参考模式”或分析过程。`;

  const user = `【用户剧情】
${script.trim() || "（空）"}

【生成设置】
时长：${options.duration}秒；比例：${options.ratio}；分辨率：${options.resolution}；风格补充：${options.styleHint || "自动判断"}；音频：${audioRule}。

【素材】
${assetText}

【本地知识库检索结果】
这些只是导演方法参考，必须服从用户剧情，不得照抄或强行套类型。
${formatRetrievedCases(cases)}

请输出2到4个连续镜头。camera写景别+单一运镜；action写“谁、在哪、做什么、导致谁如何反应”，包含必要站位、视线和道具信息。四人情感偶遇必须输出4个时间段，并明确“旧识男+女同行者”“旧识女+男同行者”两组：先建立两组相反行进方向，再用旧识男、旧识女各一次中近景反应组成匹配视线，随后擦肩，最后用一组恢复日常慢半拍收束；两位同行者默认对相遇毫无感知。公共场景保留自然人流，但不得遮住旧识男女的身份和视线。若compliance涉及婚恋伦理风险，生产字段必须使用“旧识男/旧识女/男同行者/女同行者”等中性指代，审核原因只留在compliance中。`;

  return {
    system,
    user,
    schema: PROMPT_AGENT_SCHEMA,
    retrievedCases: cases.map((item) => item.title)
  };
}

export function parsePromptAgentDraft(value: unknown): PromptAgentDraft {
  if (!value || typeof value !== "object") throw new Error("模型没有返回有效JSON");
  const raw = value as Record<string, unknown>;
  const compliance = parseCompliance(raw.compliance);
  const shots = Array.isArray(raw.shots) ? raw.shots.slice(0, 4).map((shot) => {
    const item = shot && typeof shot === "object" ? shot as Record<string, unknown> : {};
    return {
      camera: clean(item.camera),
      action: clean(item.action),
      dialogue: stringArray(item.dialogue, 2),
      audio: stringArray(item.audio, 3)
    };
  }).filter((shot) => shot.action) : [];
  if (shots.length < 2) throw new Error("模型返回的分镜不足");
  return {
    compliance,
    estimatedSeconds: clampNumber(raw.estimatedSeconds, 4, 60),
    relationshipRead: clean(raw.relationshipRead),
    dramaticEngine: clean(raw.dramaticEngine),
    hook: clean(raw.hook),
    characters: clean(raw.characters),
    scene: clean(raw.scene),
    details: stringArray(raw.details, 5),
    style: clean(raw.style),
    shots,
    audio: clean(raw.audio)
  };
}

function parseCompliance(value: unknown): PromptAgentDraft["compliance"] {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = raw.status === "pass" || raw.status === "block" || raw.status === "review" ? raw.status : "review";
  const issues = Array.isArray(raw.issues) ? raw.issues.slice(0, 5).map((issue) => {
    const item = issue && typeof issue === "object" ? issue as Record<string, unknown> : {};
    return {
      category: clean(item.category) || "模型语义审核",
      guideline: clean(item.guideline) || "《即梦AI社区自律公约》",
      reason: clean(item.reason) || "模型未返回完整的风险说明。",
      suggestion: clean(item.suggestion) || "修改内容后重新生成。"
    };
  }) : [];
  if (status !== "pass" && issues.length === 0) {
    issues.push({
      category: "模型语义审核",
      guideline: "《即梦AI社区自律公约》",
      reason: "模型判定内容需要修改或拦截。",
      suggestion: "删除可能造成伤害、误导、侵权或不适的表达后重试。"
    });
  }
  return { status, issues: status === "pass" ? [] : issues };
}

function clean(value: unknown) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function stringArray(value: unknown, limit: number) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean).slice(0, limit) : [];
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}
