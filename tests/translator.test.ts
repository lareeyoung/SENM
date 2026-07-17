import { describe, expect, it } from "vitest";
import { assessJimengCompliance } from "../src/shared/jimengCompliance";
import { buildPromptAgentRequest } from "../src/shared/promptAgent";
import { DEFAULT_OPTIONS, retargetTranslationRatio, translateScriptToSeedance, translateScriptWithAgentDraft } from "../src/shared/seedanceTranslator";
import { retrieveShortDramaCases } from "../src/shared/shortDramaKnowledgeBase";

describe("translateScriptToSeedance", () => {
  it("keeps short-drama dialogue and suppresses background music by default", () => {
    const result = translateScriptToSeedance("女主：你来了。\n男主：我不会再走了。雨夜医院走廊。");

    expect(result.compactPrompt).toContain("“你来了。”");
    expect(result.compactPrompt).toContain("“我不会再走了。”");
    expect(result.compactPrompt).toContain("不生成背景音乐");
    expect(result.apiRequest.generate_audio).toBe(true);
  });

  it("changes only ratio wording and API metadata on an existing result", () => {
    const original = translateScriptToSeedance("一对已经分手的前任在街头重逢，各自和现任礼貌擦肩。", [], {
      ratio: "9:16",
      duration: 8
    });
    const modelStyleOriginal = {
      ...original,
      prompt: original.prompt.replace("9:16，", "9:16竖屏，"),
      compactPrompt: original.compactPrompt.replace("9:16，", "9:16竖屏，")
    };
    const updated = retargetTranslationRatio(modelStyleOriginal, "16:9");

    expect(updated.compactPrompt).toContain("16:9");
    expect(updated.compactPrompt).not.toContain("9:16");
    expect(updated.compactPrompt).toContain("16:9横屏");
    expect(updated.compactPrompt).not.toContain("16:9竖屏");
    expect(updated.compactPrompt).not.toContain("竖屏构图");
    expect(updated.apiRequest.ratio).toBe("16:9");
    expect(JSON.stringify(updated.apiRequest.content)).toContain("16:9");
    expect(updated.shots).toEqual(original.shots);
    expect(updated.agent).toBe(original.agent);
    expect(updated.compactPrompt.replace(/16:9/g, "9:16").replace(/横屏/g, "竖屏"))
      .toBe(modelStyleOriginal.compactPrompt);
  });

  it("detects multimodal references and builds API content items", () => {
    const result = translateScriptToSeedance("参考@图片1里的女主，参考@视频1的运镜，女主轻轻转身。");

    expect(result.taskType).toBe("multimodal_reference");
    expect(result.detectedAssets.map((asset) => asset.label)).toEqual(["图片1", "视频1"]);
    expect(result.compactPrompt).toContain("@图片1");
    expect(result.compactPrompt).toContain("@视频1");
    expect(JSON.stringify(result.apiRequest)).toContain("reference_image");
    expect(JSON.stringify(result.apiRequest)).toContain("reference_video");
  });

  it("uses video edit mode when the script asks to replace elements in a video", () => {
    const result = translateScriptToSeedance("严格编辑视频1，将桌面上的旧手机替换成图片1中的新手机，其余动作不变。");

    expect(result.taskType).toBe("video_edit");
    expect(result.compactPrompt).toContain("严格编辑输入视频");
  });

  it("warns when one prompt is too dense for a 15 second Seedance unit", () => {
    const longScript = Array.from({ length: 12 }, (_, index) => `镜头${index + 1}：女主快步走到走廊尽头，转身看向男主，说：“你还要骗我到什么时候？”`).join("\n");
    const result = translateScriptToSeedance(longScript, [], { duration: 15 });

    expect(result.timing.status).toBe("too_long");
    expect(result.warnings.join("\n")).toContain("超过 Seedance 2.0 单次 15 秒表达上限");
  });

  it("merges scanned media with matching @ labels instead of duplicating them", () => {
    const result = translateScriptToSeedance("参考@图片1生成女主转身。", [
      { id: "image-local", type: "image", label: "图片1", url: "/tmp/a.png", path: "/tmp/a.png", enabled: true }
    ]);

    expect(result.detectedAssets).toHaveLength(1);
    expect(result.detectedAssets[0].path).toBe("/tmp/a.png");
  });

  it("warns before generation when a long-distance relationship premise implies concurrent partners", () => {
    const result = translateScriptToSeedance("一对异地恋人在陌生城市偶遇，但各自都带着不同的伴侣，心照不宣的假装没看到彼此的戏。", [], {
      duration: 9
    });

    expect(result.timing.status).toBe("balanced");
    expect(result.compliance.status).toBe("review");
    expect(result.compliance.canGenerate).toBe(true);
    expect(result.compliance.issues[0].guideline).toContain("第22条");
    expect(result.compliance.issues[0].suggestion).toContain("已经分手的前任");
    expect(result.compactPrompt).toContain("旧识男");
    expect(result.compactPrompt).toContain("旧识女");
    expect(result.compactPrompt).toContain("旧识男与女同行者同组");
    expect(result.compactPrompt).toContain("旧识女与男同行者同组");
    expect(result.compactPrompt).toContain("中近景匹配视线剪辑");
    expect(result.compactPrompt).toContain("两位同行者对相遇完全无感");
    expect(result.compactPrompt).toContain("旧识女迟半拍点头");
    expect(result.compactPrompt).toContain("旧识男一组自然出画");
    expect(result.compactPrompt).not.toContain("只慢眨一次");
    expect(result.compactPrompt).not.toContain("四人全景");
    expect(result.compactPrompt).not.toContain("反应不同步");
    expect(result.compactPrompt).not.toContain("异地恋人");
    expect(result.compactPrompt).not.toContain("背叛");
    expect(result.compactPrompt).not.toContain("双人合照");
    expect(result.compactPrompt).not.toMatch(/旧识A|旧识B|同行者A|同行者B/);
    expect(result.compactPrompt).not.toContain("台词“");
    expect(result.shots.every((shot) => shot.dialogue.length === 0)).toBe(true);
  });

  it("warns when a sparse but complex premise is forced into four seconds", () => {
    const result = translateScriptToSeedance("一对异地恋人在陌生城市偶遇，但各自都带着不同的伴侣，心照不宣的假装没看到彼此的戏。", [
      { id: "image-a", type: "image", label: "图片1", url: "/tmp/a.png", enabled: true },
      { id: "image-b", type: "image", label: "图片2", url: "/tmp/b.png", enabled: true }
    ], {
      duration: 4
    });

    expect(result.timing.status).toBe("too_dense");
    expect(result.timing.estimatedSeconds).toBeGreaterThan(4);
    expect(result.warnings.join("\n")).toContain("最低需要约");
    expect(result.compactPrompt).not.toContain("…");
  });

  it("turns a hidden-family reveal into concrete visual beats instead of placeholder conflict language", () => {
    const result = translateScriptToSeedance("女主在雨夜医院门口撞见失踪三年的丈夫，他手里牵着一个叫他爸爸的小女孩。", [], {
      duration: 8
    });

    expect(result.compliance.status).toBe("pass");
    expect(result.compactPrompt).toContain("女孩仰头晃动两人牵着的手");
    expect(result.compactPrompt).toContain("台词“爸爸”");
    expect(result.compactPrompt).toContain("雨伞边缘缓慢下沉");
    expect(result.compactPrompt).toContain("丈夫抬眼认出主角");
    expect(result.compactPrompt).not.toContain("关键动作触发冲突");
    expect(result.compactPrompt).not.toContain("关系：");
    expect(result.compactPrompt).not.toContain("钩子：");
  });

  it("retrieves the matching directing pattern before model generation", () => {
    const cases = retrieveShortDramaCases("异地恋情侣在陌生城市偶遇，两个人身边各自带着伴侣，只能装作没看见");

    expect(cases[0].id).toBe("mutual-betrayal-encounter");
    expect(cases[0].score).toBeGreaterThan(cases[1].score);
  });

  it("turns a model draft into a compact Seedance prompt and keeps truthful timing", () => {
    const script = "已经分手的旧恋人在街头撞见，身边各自带着现任，两人保持礼貌。";
    const result = translateScriptWithAgentDraft(script, [], { duration: 4 }, {
      compliance: { status: "pass", issues: [] },
      estimatedSeconds: 9,
      relationshipRead: "关系已经结束的两个人仍有身体记忆，但都要维护现任的体面",
      dramaticEngine: "双方都想礼貌略过，却无法完全隐藏熟悉感",
      hook: "四人同框后，两部手机同时亮起情侣备注",
      characters: "旧恋人A先僵住再装自然，旧恋人B迅速移开视线，双方现任自然陪伴",
      scene: "陌生城市夜街，橱窗暖光和手机冷光交错",
      details: ["手从同行者臂弯抽回半寸", "手机被同时按灭", "擦肩后都没有回头"],
      style: "都市情感短剧，写实克制",
      shots: [
        { camera: "全景缓推", action: "四人迎面走近，A和B的手机同时亮起情侣备注", dialogue: [], audio: ["车流声"] },
        { camera: "中景固定", action: "A和B认出彼此，手同时从同行者臂弯里抽回半寸", dialogue: [], audio: ["脚步声"] },
        { camera: "近景固定", action: "两人对视后各自移开，按灭手机继续向前", dialogue: [], audio: ["手机震动"] }
      ],
      audio: "保留街道环境声和手机震动，不生成背景音乐"
    }, { model: "gpt-5.6-terra", retrievedCases: ["双方都有秘密的街头撞见"] });

    expect(result.agent?.mode).toBe("model-rag");
    expect(result.agent?.relationshipRead).toContain("关系已经结束");
    expect(result.compactPrompt).not.toContain("关系：");
    expect(result.compactPrompt).not.toContain("冲突：");
    expect(result.compactPrompt).not.toContain("钩子：");
    expect(result.compactPrompt).toContain("不生成背景音乐");
    expect(result.timing.status).toBe("too_dense");
    expect(result.warnings.join("\n")).toContain("最低约需 9 秒");
    expect(result.compactPrompt).toContain("无人回头");
    expect(result.compactPrompt).toContain("继续跟随旧识女与男同行者前行");
    expect(result.compactPrompt).not.toContain("…");
  });

  it("keeps relationship risk in the warning while removing review labels from production fields", () => {
    const result = translateScriptWithAgentDraft("一对异地恋人在陌生城市偶遇，但各自带着不同伴侣。", [], { duration: 8 }, {
      compliance: {
        status: "review",
        issues: [{
          category: "婚恋伦理与不良价值导向",
          guideline: "第22条 传播不良价值导向的内容",
          reason: "正在进行的关系中出现其他伴侣，可能触发平台审核。",
          suggestion: "明确关系已经结束，或将同行者改为朋友。"
        }]
      },
      estimatedSeconds: 8,
      relationshipRead: "异地恋人双方都在隐瞒现任，形成双向背叛。",
      dramaticEngine: "谁先开口谁先暴露。",
      hook: "前任男与前任女同时认出彼此。",
      characters: "前任男、前任女；男方现任、女方现任，四人均为成年人",
      scene: "商场入口，前任与现任迎面靠近",
      details: ["双方现任不知情", "前任男心虚地移开视线"],
      style: "现实主义婚恋伦理短剧，克制写实",
      shots: [
        { camera: "中景缓推", action: "前任男与男方现任迎面走来，前任女与女方现任从反方向靠近", dialogue: [], audio: ["环境声"] },
        { camera: "近景固定", action: "前任男和前任女认出彼此，双方现任不知情，两人心虚地移开视线", dialogue: [], audio: ["脚步声"] }
      ],
      audio: "保留环境声，不生成背景音乐"
    }, { model: "gpt-5.6-terra", retrievedCases: ["旧爱携现任重逢"] });

    expect(result.compliance.status).toBe("review");
    expect(result.compliance.canGenerate).toBe(true);
    expect(result.compliance.issues.some((issue) => issue.guideline.includes("第22条"))).toBe(true);
    expect(result.compactPrompt).toContain("旧识男");
    expect(result.compactPrompt).toContain("旧识女");
    expect(result.compactPrompt).toContain("女同行者");
    expect(result.compactPrompt).toContain("男同行者");
    expect(result.compactPrompt).toContain("旧识男与女同行者同组");
    expect(result.compactPrompt).toContain("旧识女与男同行者同组");
    expect(result.compactPrompt).toContain("两组沿相反屏幕方向接近");
    expect(result.compactPrompt).toContain("路人只在转场与擦肩瞬间形成前景遮挡");
    expect(result.compactPrompt).not.toMatch(/前任|现任|异地恋人|背叛|心虚|不知情|婚恋伦理|不良价值导向|情侣备注|双人合照/);
    expect(result.compactPrompt).not.toMatch(/旧识A|旧识B|同行者A|同行者B/);
    expect(result.compactPrompt).not.toContain("旧识男与女同行者并肩由画面左侧");
    expect(result.compactPrompt).not.toContain("四人全景");
    expect(result.compactPrompt).not.toContain("男同行者先看旧识女");
    expect(result.compactPrompt).not.toContain("女同行者随后看旧识男");
    expect(result.compactPrompt).not.toContain("表演细节：");
    expect(result.checks.join("\n")).toContain("风险分析与生产指令分离");
    expect(result.checks.join("\n")).toContain("两组成年男女同行关系");
    expect(result.checks.join("\n")).toContain("四段可读分镜");
    expect(result.shots).toHaveLength(4);
    expect(result.shots[0].action).toContain("旧识男与女同行者从左向右");
    expect(result.shots[0].action).toContain("旧识女与男同行者从右向左");
    expect(result.shots[1].camera).toContain("匹配视线剪辑");
    expect(result.shots[1].action).toContain("旧识男位于画面左侧看向画外右侧约一秒");
    expect(result.shots[1].action).toContain("旧识女位于画面右侧看向画外左侧约一秒");
    expect(result.shots[1].action).toContain("观众明确知道他们互相认出");
    expect(result.shots[2].action).toContain("对相遇毫无感知");
    expect(result.shots[3].action).toContain("旧识女迟半拍才点头回应");
    expect(result.shots[3].action).toContain("旧识男一组按原方向自然出画");
    expect(result.shots[3].action).toContain("镜头不切回");
    expect(result.compactPrompt).not.toContain("只慢眨一次");
    expect(result.agent?.relationshipRead).toContain("双向背叛");
  });

  it("defaults an unspecified couple to one adult man and one adult woman", () => {
    const result = translateScriptToSeedance("一对情侣在雨夜车站久别重逢，两人克制地看着彼此。", [], { duration: 8 });

    expect(result.compactPrompt).toContain("人物：男方");
    expect(result.compactPrompt).toContain("女方");
    expect(result.compactPrompt).toContain("成年男性");
    expect(result.compactPrompt).toContain("成年女性");
    expect(result.compactPrompt).not.toMatch(/主角A|关系人物B/);
  });

  it("keeps an explicitly stated same-gender couple instead of applying the default", () => {
    const result = translateScriptToSeedance("两个成年男人是一对情侣，在雨夜车站重逢。", [], { duration: 8 });

    expect(result.compactPrompt).toContain("男人");
    expect(result.compactPrompt).not.toContain("女方");
    expect(result.compactPrompt).not.toContain("成年女性");
  });

  it("keeps a long model draft complete even when it exceeds the 500-character recommendation", () => {
    const endingMarker = "最后让女主停在门外听见孩子喊另一个女人妈妈，她没有推门，只把准备好的生日礼物放在地上，转身时才允许眼泪落下";
    const longAction = `女主从电梯走到病房门口，先看见前夫替孩子母亲整理围巾，再看见孩子把画递给她，动作因果必须完整，${endingMarker}`;
    const longDetails = Array.from({ length: 5 }, (_, index) => `细节${index + 1}必须完整保留：女主先观察门内人物的自然站位，再通过手指、呼吸、视线和礼物袋的变化逐层确认关系，所有反应按因果顺序发生，不能压缩成笼统的震惊表情`);
    const result = translateScriptWithAgentDraft("女主在医院意外看见前夫已经组建的新家庭。", [], { duration: 15 }, {
      compliance: { status: "pass", issues: [] },
      estimatedSeconds: 15,
      relationshipRead: "女主理智上接受婚姻已经结束，情感上仍被前夫的新家庭刺痛，信息差必须由门内外站位揭开",
      dramaticEngine: "女主想推门确认真相，又害怕一旦推门就无法维持最后的体面",
      hook: "门缝里先出现丈夫替陌生女人整理围巾的手，再露出孩子递画的动作",
      characters: "女主强撑镇定，前夫在门内毫无防备，孩子母亲和孩子自然亲密，所有反应按先后发生",
      scene: "医院病房外走廊，门内暖光与走廊冷光形成清晰边界",
      details: [...longDetails, "孩子的画上有四个人"],
      style: "现实婚姻短剧，克制写实，表演准确",
      shots: [
        { camera: "走廊全景缓慢跟随", action: "女主提着生日礼物走出电梯，脚步在病房门口停住", dialogue: [], audio: ["电梯提示音", "走廊脚步声"] },
        { camera: "门缝视角中景固定", action: longAction, dialogue: [], audio: ["孩子轻声说话", "纸张摩擦声"] }
      ],
      audio: "保留走廊环境声、孩子说话和纸袋摩擦声，不生成背景音乐"
    }, { model: "gpt-5.6-terra", retrievedCases: ["婚姻背叛门外发现"] });

    expect(result.compactPrompt).toContain(endingMarker);
    expect(result.compactPrompt).toContain(longDetails[4]);
    expect([...result.compactPrompt].filter((char) => /[\u4e00-\u9fa5]/.test(char)).length).toBeGreaterThan(500);
    expect(result.warnings.join("\n")).toContain("500 字仅作效果建议，不会自动截断");
    expect(result.compactPrompt).not.toContain("…");
  });

  it("keeps a semantic model warning without preventing generation", () => {
    const result = translateScriptWithAgentDraft("用隐晦方式诱导观众相信未经证实的社会事件。", [], { duration: 8 }, {
      compliance: {
        status: "review",
        issues: [{
          category: "不实信息",
          guideline: "第20条 不实信息",
          reason: "内容可能通过暗示把未经证实的事件包装成事实。",
          suggestion: "明确标注虚构，并删除诱导观众信以为真的表达。"
        }]
      },
      estimatedSeconds: 8,
      relationshipRead: "",
      dramaticEngine: "",
      hook: "",
      characters: "两名成年演员，使用虚构身份",
      scene: "明确标注为虚构的摄影棚新闻场景",
      details: [],
      style: "虚构剧情，克制写实",
      shots: [
        { camera: "中景固定", action: "演员拿起写有虚构字样的道具报纸", dialogue: [], audio: ["纸张声"] },
        { camera: "近景固定", action: "镜头停在道具上的虚构标记，演员放下报纸", dialogue: [], audio: ["环境声"] }
      ],
      audio: "保留环境声，不生成背景音乐"
    }, { model: "gpt-5.6-terra", retrievedCases: [] });

    expect(result.compliance.status).toBe("review");
    expect(result.compliance.canGenerate).toBe(true);
    expect(result.compliance.issues[0].guideline).toContain("第20条");
    expect(result.compactPrompt).toContain("虚构标记");
  });
});

describe("assessJimengCompliance", () => {
  it("passes an ordinary relationship scene", () => {
    const result = assessJimengCompliance("一对情侣在雨夜车站重逢，两人克制地说出误会。\n");

    expect(result.status).toBe("pass");
    expect(result.canGenerate).toBe(true);
  });

  it("uses the official guideline snapshot in every model review request", () => {
    const request = buildPromptAgentRequest("普通成年情侣在车站重逢。", [], DEFAULT_OPTIONS);

    expect(request.system).toContain("《“即梦AI”社区自律公约》");
    expect(request.system).toContain("2024-11-18");
    expect(request.system).toContain("第21至23条");
    expect(request.system).toContain("正在进行的恋爱或婚姻关系中另有伴侣");
    expect(request.system).toContain("不得以审核结果为由返回空内容");
    expect(request.system).toContain("合规判断与生产提示词必须分层");
    expect(request.system).toContain("旧识男、旧识女、男同行者、女同行者");
    expect(request.system).toContain("默认角色为一名成年男性和一名成年女性");
    expect(request.system).toContain("中近景匹配视线");
    expect(request.system).toContain("观众看懂、同行者不懂");
    expect(request.system).toContain("全局表演默认真实克制，但关键剧情反应必须可读");
    expect(request.system).toContain("禁止四人对称摆在空旷中轴");
    expect(request.system).toContain("不得在观众确认关系之前就虚化消失");
  });

  it("warns about sexualized content involving minors without disabling generation", () => {
    const result = translateScriptToSeedance("生成未成年学生的色情性暗示内容。", [], { duration: 8 });

    expect(result.compliance.status).toBe("block");
    expect(result.compliance.canGenerate).toBe(true);
    expect(result.compliance.issues[0].guideline).toContain("未成年人");
    expect(result.compactPrompt.length).toBeGreaterThan(0);
  });

  it("warns about a violent scene without disabling generation", () => {
    const result = translateScriptToSeedance("两个人在街头持刀斗殴，镜头表现打斗过程。", [], { duration: 8 });

    expect(result.compliance.status).toBe("review");
    expect(result.compliance.canGenerate).toBe(true);
    expect(result.compliance.issues.some((issue) => issue.category === "暴力行为")).toBe(true);
    expect(result.compactPrompt.length).toBeGreaterThan(0);
  });

  it("blocks deceptive public-information fabrication", () => {
    const result = assessJimengCompliance("制作假新闻，冒充官方账号发布虚构灾情。\n");

    expect(result.status).toBe("block");
    expect(result.issues.some((issue) => issue.category === "不实信息")).toBe(true);
  });

  it("holds unauthorized celebrity likeness use for rights review", () => {
    const result = assessJimengCompliance("未经授权复刻某明星的肖像和声音制作广告。\n");

    expect(result.status).toBe("review");
    expect(result.issues.some((issue) => issue.category === "肖像与知识产权")).toBe(true);
  });
});
