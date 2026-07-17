export interface ShortDramaCase {
  id: string;
  title: string;
  genres: string[];
  cues: string[];
  relationship: string;
  dramaticEngine: string;
  shotGrammar: string[];
  performance: string[];
  avoid: string[];
}

export interface RetrievedDramaCase extends ShortDramaCase {
  score: number;
}

// These are generalized directing patterns, not copied scripts. Keeping the library
// local makes every piece of context sent to the model visible and testable.
export const SHORT_DRAMA_CASES: ShortDramaCase[] = [
  {
    id: "mutual-betrayal-encounter",
    title: "双方都有秘密的街头撞见",
    genres: ["都市情感", "关系反转", "背叛"],
    cues: ["异地恋", "各自", "伴侣", "偶遇", "陌生城市", "装作没看见", "心照不宣"],
    relationship: "仍在关系中的两个人同时露出破绽，不是旧爱重逢",
    dramaticEngine: "谁先承认看见对方，谁就必须先解释身边的人",
    shotGrammar: ["先建立旧识男与女同行者、旧识女与男同行者两组及相反行进方向，不把四人排成一列", "用旧识男看向画外与旧识女反向回望的一组中近景匹配视线坐实旧识关系", "侧面跟拍擦肩，两位同行者继续日常动作且对相遇毫无感知", "结尾跟随一组，迟半拍恢复日常；另一组按原方向自然出画且不再切回"],
    performance: ["旧识男目光停住约一秒，说话或手部动作漏半拍", "旧识女的日常表情短暂失去连续性，约一秒后看回同行者", "两人不停步、不转头；两位同行者保持原话题、步速和视线，不出现察觉动作"],
    avoid: ["用A/B模糊性别与配对", "只靠慢眨或虚焦让观众猜关系", "只给一方反应造成陌生人凝视", "瞪眼皱眉张口或身体僵住", "同行者侧头观察或起疑", "四人对称站在空场", "四人集体回头或匆忙离场"]
  },
  {
    id: "ex-reunion-with-current-partners",
    title: "旧爱携现任重逢",
    genres: ["都市情感", "旧爱", "修罗场"],
    cues: ["前任", "旧爱", "重逢", "现任", "婚礼", "多年后"],
    relationship: "感情已经结束，但身体记忆先于礼貌反应",
    dramaticEngine: "双方都要维护现任体面，却无法隐藏熟悉感",
    shotGrammar: ["分别建立两组相反行进方向和稳定配对，避免人物在切镜后互换", "用一组方向相反的中近景匹配视线让观众确认旧识男女互相看见", "同行者继续示意店铺或看橱窗，不给任何察觉反应", "擦肩后跟随一组，用迟半拍回应留下余波，另一组按原方向自然出画且不再切回"],
    performance: ["旧识男女各有一次约一秒的可读反应，但都不停止行走", "只选择视线停留、动作漏拍或呼吸变化中的一个主证据", "同行者始终无感，不替观众确认关系"],
    avoid: ["用A/B模糊性别与分组", "把同行者拍成跨组关系", "默认双方仍相爱", "只靠慢眨或路人遮挡交代重逢", "大眼皱眉和长时间凝视", "四人空场摆拍", "集体回头或突然快走"]
  },
  {
    id: "identity-reversal-slapback",
    title: "身份揭晓后的打脸反转",
    genres: ["逆袭", "身份反转", "爽剧"],
    cues: ["看不起", "身份", "总裁", "继承人", "开除", "道歉", "打脸", "逆袭"],
    relationship: "压迫者依据错误身份做判断，主角掌握真正权力",
    dramaticEngine: "先让羞辱完成，再用一个可验证物件或称谓翻转权力",
    shotGrammar: ["低位或遮挡建立压迫", "关键证据入画但不解释", "众人反应按地位依次变化", "主角不争辩只执行决定"],
    performance: ["主角克制", "反派从笃定到寻找退路", "配角反应不同时发生"],
    avoid: ["主角提前自报身份", "全员同步震惊", "只靠旁白宣布反转"]
  },
  {
    id: "evidence-discovery-suspense",
    title: "日常物件暴露秘密",
    genres: ["悬疑", "婚恋", "秘密"],
    cues: ["发现", "照片", "短信", "戒指", "录音", "证据", "秘密", "抽屉"],
    relationship: "熟悉关系因一个不该出现的细节产生裂缝",
    dramaticEngine: "观众先看懂证据，角色晚半拍确认其含义",
    shotGrammar: ["正常日常动作开场", "证据在动作路径中自然露出", "先拍手停再拍眼神", "在对方即将出现时切断"],
    performance: ["呼吸变浅", "手指不立即拿起证据", "恢复现场时出现微小错误"],
    avoid: ["镜头一开始就特写答案", "角色把推理说出来", "滥用闪回"]
  },
  {
    id: "breakup-power-shift",
    title: "分手谈判中的权力倒置",
    genres: ["情感摊牌", "分手", "追妻"],
    cues: ["分手", "离婚", "签字", "净身出户", "再见", "后悔", "挽留"],
    relationship: "提出结束的人以为掌握主动，真正离开的人完成权力转移",
    dramaticEngine: "一方等待纠缠，另一方却迅速完成退出动作",
    shotGrammar: ["先给准备好的协议或行李", "让强势方说完条件", "弱势方用一个干净动作接受", "停在强势方失去预期后的空白"],
    performance: ["离开者不哭诉", "留下者先轻松后失焦", "动作比台词更决绝"],
    avoid: ["双方轮流长篇控诉", "用摔东西制造力量", "结尾立刻和解"]
  },
  {
    id: "secret-protection-misunderstanding",
    title: "保护被误读为背叛",
    genres: ["虐恋", "误会", "牺牲"],
    cues: ["误会", "保护", "隐瞒", "离开", "病历", "替他", "不能说"],
    relationship: "表面伤害与真实保护同时成立，角色无法公开动机",
    dramaticEngine: "伤人的台词与保护性的手部动作相互矛盾",
    shotGrammar: ["先给冷硬决定", "用遮挡隐藏保护动作", "被保护者只看到表面", "让观众在最后一个细节中先知道真相"],
    performance: ["说狠话时不直视", "转身后才失控", "保护动作短而准确"],
    avoid: ["过早解释秘密", "依赖旁白", "用偶然偷听解决误会"]
  },
  {
    id: "workplace-public-humiliation",
    title: "职场公开压迫与反制",
    genres: ["职场", "压迫", "逆袭"],
    cues: ["会议", "老板", "同事", "方案", "功劳", "背锅", "辞职", "客户"],
    relationship: "公开场合的上下级权力被证据或客户态度重新排序",
    dramaticEngine: "压迫者利用群体沉默，主角用事实迫使群体重新站队",
    shotGrammar: ["用座位和站位交代权力", "先让指控落地", "证据投屏或关键人物入场", "反应镜头从边缘人物开始扩散"],
    performance: ["主角语速稳定", "压迫者先打断后失语", "围观者避免统一表情"],
    avoid: ["主角空口反击", "所有人鼓掌", "复杂运镜遮盖信息"]
  },
  {
    id: "family-table-secret",
    title: "家庭饭桌秘密引爆",
    genres: ["家庭伦理", "秘密", "群像"],
    cues: ["饭桌", "婆婆", "孩子", "亲子鉴定", "家宴", "红包", "全家"],
    relationship: "表面维持家庭秩序，某个具体物件让每个人的利益同时暴露",
    dramaticEngine: "最普通的礼节动作承载最危险的信息",
    shotGrammar: ["先建立座次", "让证据随递菜或递红包进入中心", "按知情程度切不同反应", "用无人继续动筷收尾"],
    performance: ["知情者不敢抬头", "掌权者先维持礼貌", "孩子或局外人保持自然"],
    avoid: ["开场即争吵", "每个人重复事实", "随意越轴导致关系混乱"]
  },
  {
    id: "sweet-ambiguous-contact",
    title: "被迫靠近的暧昧升温",
    genres: ["甜宠", "暧昧", "轻喜"],
    cues: ["暧昧", "靠近", "壁咚", "心动", "雨伞", "电梯", "同居"],
    relationship: "双方都在试探边界，嘴上退让、身体反应却提前暴露",
    dramaticEngine: "外部空间压缩距离，谁先主动拉开谁反而更在意",
    shotGrammar: ["先交代狭窄空间", "用物理事件迫使靠近", "切呼吸和手部而非反复对视", "用一句日常话掩盖心动"],
    performance: ["先看距离再看对方", "手想扶又停", "笑意压住而非夸张害羞"],
    avoid: ["慢动作堆叠", "无动机亲密接触", "把暧昧拍成静态凝视"]
  },
  {
    id: "revenge-recognition",
    title: "复仇者被提前认出",
    genres: ["复仇", "悬疑", "身份"],
    cues: ["复仇", "认出", "改名", "整容", "仇人", "回来", "卧底"],
    relationship: "复仇者以为身份安全，对手通过习惯性细节完成确认",
    dramaticEngine: "表面对话正常，对手暗中设置只有旧身份才会回应的测试",
    shotGrammar: ["先展示新身份的从容", "测试物件或旧称呼突然出现", "拍本能反应后立即掩饰", "以对手确认但不揭穿的眼神收尾"],
    performance: ["本能反应快于思考", "掩饰动作过于完整", "对手只露极轻微笑意"],
    avoid: ["直接喊出身份", "大段解释恩怨", "靠巧合认出"]
  }
];

export function retrieveShortDramaCases(text: string, limit = 3): RetrievedDramaCase[] {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  const tokens = new Set([
    ...normalized.match(/[\u4e00-\u9fa5]{2,6}/g) || [],
    ...normalized.split(/[，。！？、；：,.!?;:]/).filter((item) => item.length >= 2)
  ]);

  return SHORT_DRAMA_CASES.map((item) => {
    let score = 0;
    for (const cue of item.cues) {
      if (normalized.includes(cue.toLowerCase())) score += cue.length >= 4 ? 5 : 3;
    }
    for (const genre of item.genres) {
      if (normalized.includes(genre.toLowerCase())) score += 2;
    }
    for (const token of tokens) {
      if (token.length >= 2 && `${item.relationship}${item.dramaticEngine}${item.title}`.includes(token)) score += 1;
    }
    return { ...item, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatRetrievedCases(cases: RetrievedDramaCase[]) {
  return cases.map((item, index) => [
    `参考模式${index + 1}｜${item.title}`,
    `关系判断：${item.relationship}`,
    `戏剧发动机：${item.dramaticEngine}`,
    `镜头习惯：${item.shotGrammar.join("；")}`,
    `表演：${item.performance.join("；")}`,
    `避免：${item.avoid.join("；")}`
  ].join("\n")).join("\n\n");
}
