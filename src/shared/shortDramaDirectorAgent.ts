import type { ReferenceAsset, Shot, TranslatorOptions } from "./types";

export interface CharacterProfile {
  name: string;
  description: string;
}

export interface DramaContext {
  sourceSparse: boolean;
  theme: string;
  bridge: string;
  hook: string;
  premise: string;
  conflict: string;
  emotionalArc: string;
  location: string;
  timeAndLight: string;
  atmosphere: string;
  characters: CharacterProfile[];
  motifs: string[];
  props: string[];
  endingBeat: string;
  minSeconds: number;
}

interface DirectorInput {
  text: string;
  detectedCharacters: string[];
  detectedLocations: string[];
  assets: ReferenceAsset[];
  options: TranslatorOptions;
}

interface GenrePack {
  theme: string;
  bridge: string;
  minSeconds: number;
  keywords: RegExp;
  hook: string;
  premise: string;
  conflict: string;
  emotionalArc: string;
  location: string;
  timeAndLight: string;
  atmosphere: string;
  motifs: string[];
  props: string[];
  endingBeat: string;
  beats: string[];
  compactShots: string[];
}

const GENRE_PACKS: GenrePack[] = [
  {
    theme: "双向背叛撞见",
    bridge: "异地恋互撞+双向背叛封口",
    minSeconds: 8,
    keywords: /(?:异地恋.*(?:伴侣|陌生城市|偶遇|心照不宣|假装没看到))|(?:(?:各自|都).*伴侣.*心照不宣)|(?:心照不宣.*假装没看到)/,
    hook: "先锁定两组相反行进方向，再用一组方向匹配的男女反应镜头让观众确认他们互相认出",
    premise: "一名成年男性和一名成年女性在陌生城市意外碰面，两人各自与另一名异性同行；他们一眼认出，却默契装作没看见。",
    conflict: "两个人同时暴露背叛，谁先开口谁先崩盘",
    emotionalArc: "撞见 -> 心虚 -> 互相封口 -> 关系悬空",
    location: "陌生城市夜晚街口，微湿反光，橱窗暖光，行人与车流形成遮挡",
    timeAndLight: "夜晚路灯与橱窗暖光混合，手机屏幕冷光短暂照亮表情",
    atmosphere: "公共空间保持真实人流，四个人不停步；镜头让观众清楚看见旧识男女的视线闭环，同行者仍毫无感知",
    motifs: ["相反屏幕方向", "男女匹配视线", "说话动作漏半拍", "同行者继续原话题且毫无感知", "迟半拍恢复日常"],
    props: ["购物袋或手机"],
    endingBeat: "镜头继续跟随旧识女一组正常前行；她迟半拍回应男同行者，旧识男一组按原方向自然出画，无人回头",
    beats: [
      "侧向中远景跟随旧识男与女同行者从左向右前行，旧识女与男同行者从右向左进入环境纵深；四人服装轮廓可区分，不同时面向镜头摆拍",
      "一组中近景匹配视线，先拍旧识男看向画外右侧约一秒，随步伐摆动的手停半拍；切旧识女看向画外左侧约一秒，原本的浅笑停一拍后收住。两人视线方向准确相接",
      "侧面中景跟拍两组擦肩，旧识男女看回各自前方，保持原步速且不回头；男同行者仍示意前方店铺，女同行者继续看橱窗，对相遇毫无感知",
      "镜头跟随旧识女与男同行者继续前行；男同行者再次抬手示意前方店铺，旧识女迟半拍才点头回应，随后恢复日常。旧识男一组按原方向自然出画"
    ],
    compactShots: [
      "侧向中远景跟旧识男一组从左向右；旧识女一组从右向左进入纵深，四人服装轮廓清楚且不并排摆拍",
      "旧识男看画外右侧约一秒，随步伐摆动的手停半拍；切旧识女看画外左侧约一秒，原本的浅笑停一拍后收住",
      "侧面中景跟拍擦肩，旧识男女看回前方且不回头；男同行者仍示意店铺，女同行者继续看橱窗，均无感",
      "跟随旧识女一组前行，男同行者再次示意店铺，旧识女迟半拍点头后恢复日常；旧识男一组自然出画"
    ]
  },
  {
    theme: "隐秘家庭撞破",
    bridge: "失踪伴侣现身+隐藏家庭揭开",
    minSeconds: 8,
    keywords: /(?:失踪.{0,12}丈夫.*(?:孩子|女孩|男孩|女儿|儿子))|(?:医院.{0,24}丈夫.{0,24}(?:孩子|女孩|男孩|女儿|儿子))|(?:叫他爸爸)|(?:丈夫.{0,18}另一个家庭)/,
    hook: "先让失踪伴侣牵着孩子从医院门内出现，再用一声称呼坐实关系",
    premise: "主角在医院门口撞见失踪多年的伴侣，对方正牵着一个称其为父亲或母亲的孩子。",
    conflict: "失踪的谎言在一个家庭动作里被揭穿，主角必须在追问和维持最后体面之间停住",
    emotionalArc: "撞见 -> 听见称呼 -> 确认真相 -> 对视悬停",
    location: "医院门口与门诊雨棚交界，门内冷白光，门外雨夜冷色反光",
    timeAndLight: "雨夜，医院冷白光切开门口，雨水在地面形成清晰倒影",
    atmosphere: "周围行人正常经过，三个人的静止与环境流动形成反差",
    motifs: ["孩子自然牵手", "一声爸爸或妈妈", "雨伞边缘下沉", "失踪伴侣抬眼认出主角"],
    props: ["雨伞", "儿童书包"],
    endingBeat: "伴侣抬眼认出主角，孩子轻拽其手，三个人停在无法解释的对视里",
    beats: [
      "雨夜医院门口，主角收伞走近，失踪多年的伴侣牵着小女孩从门内出来",
      "女孩仰头喊“爸爸”，自然晃动两人牵着的手，伴侣低头回应",
      "主角认出两人，脚步停住，雨伞边缘缓慢下沉，手指仍扣着伞柄",
      "伴侣抬眼认出主角，笑意消失；女孩轻拽他的手，三个人隔着雨帘对视"
    ],
    compactShots: [
      "雨夜医院门口，主角收伞走近，失踪多年的丈夫牵着小女孩从门内出来",
      "女孩仰头晃动两人牵着的手，丈夫低头回应",
      "主角认出两人，脚步停住，雨伞边缘缓慢下沉，手指仍扣着伞柄",
      "丈夫抬眼认出主角，笑意消失；女孩轻拽他的手，三个人隔着雨帘对视"
    ]
  },
  {
    theme: "旧爱重逢",
    bridge: "旧爱重逢+现任在场",
    minSeconds: 8,
    keywords: /前任|旧爱|旧恋人|(?:分手|离婚|多年未见|多年后).{0,16}重逢|重逢.{0,16}(?:前任|旧爱|旧恋人)/,
    hook: "先分别建立两组稳定配对，再以一组方向相反的中近景匹配视线完成只有观众看懂的重逢",
    premise: "一名成年男性和一名成年女性在陌生城市意外碰面，两人各自与另一名异性同行；他们一眼认出，又立刻假装陌生。",
    conflict: "认出但不能认，旧情只能压进沉默",
    emotionalArc: "撞见 -> 失守 -> 伪装 -> 擦肩",
    location: "陌生城市夜晚街口，微湿反光，橱窗暖光，行人与车流形成遮挡",
    timeAndLight: "夜晚路灯与橱窗暖光混合，面部柔和侧光",
    atmosphere: "人流和日常谈话持续不受影响；旧识男女各有一次清楚但克制的反应，同行者仍不知道发生了什么",
    motifs: ["相反行进方向", "男女匹配视线", "动作漏半拍", "步速不变", "同行者毫无感知", "迟半拍恢复日常"],
    props: ["手机", "纸袋或手提包"],
    endingBeat: "跟随旧识女一组正常离开，她迟半拍回应男同行者的日常手势；旧识男一组按原方向自然出画",
    beats: [
      "侧向中远景跟随旧识男与女同行者从左向右，旧识女与男同行者从右向左进入纵深；两组配对和服装轮廓稳定清楚",
      "一组中近景匹配视线，旧识男看向画外右侧约一秒，随步伐摆动的手停半拍；切旧识女看向画外左侧约一秒，原本的浅笑停一拍后收住",
      "侧面中景跟拍擦肩，旧识男女看回前方并保持步速；女同行者继续看橱窗，男同行者仍示意前方店铺，对相遇毫无感知",
      "跟随旧识女与男同行者继续前行；男同行者再次抬手示意店铺，旧识女迟半拍点头后恢复自然，旧识男一组按原方向出画"
    ],
    compactShots: [
      "侧向中远景跟旧识男一组从左向右；旧识女一组从右向左进入纵深，两组身份和服装轮廓稳定清楚",
      "旧识男看画外右侧约一秒，随步伐摆动的手停半拍；切旧识女看画外左侧约一秒，原本的浅笑停一拍后收住",
      "侧面中景跟拍擦肩，旧识男女看回前方且不回头；女同行者看橱窗，男同行者示意店铺，均无感",
      "跟随旧识女一组前行，男同行者再次示意店铺，旧识女迟半拍点头后恢复自然；旧识男一组按原方向出画"
    ]
  },
  {
    theme: "情感摊牌",
    bridge: "背叛摊牌+强情绪压迫",
    minSeconds: 8,
    keywords: /背叛|出轨|小三|离婚|复仇|报复|摊牌|抓奸|渣男|绿茶/,
    hook: "前3秒给证据特写和主角冷静反应，先爽点后解释",
    premise: "亲密关系的背叛被当场撞破，主角忍住崩溃，准备反击。",
    conflict: "体面和崩溃之间的强压抑",
    emotionalArc: "证据 -> 对峙 -> 反击 -> 留钩子",
    location: "酒店走廊、客厅或餐厅包间，空间压迫，门缝和玻璃可制造窥视感",
    timeAndLight: "冷白顶光混合局部暖光，面部阴影清晰",
    atmosphere: "安静到窒息，所有情绪压在一句话前",
    motifs: ["证据特写", "手指发抖", "眼神变冷", "对方沉默"],
    props: ["手机聊天记录", "戒指", "照片"],
    endingBeat: "主角把证据收起，抬眼冷笑，下一秒准备反击",
    beats: [
      "证据或暧昧物件先入画，主角站在门口停住",
      "对方慌乱解释，主角没有立刻爆发，只低头看证据",
      "主角抬眼变冷，说出关键一句或做出反击动作",
      "对方失语，镜头停在主角冷笑或证据特写上"
    ],
    compactShots: [
      "证据特写先入画，主角在门口停住",
      "对方慌乱解释，主角低头看证据，手指发紧",
      "主角抬眼变冷，说出关键一句或亮出反击",
      "对方失语，镜头停在冷笑或证据上"
    ]
  },
  {
    theme: "逆袭打脸",
    bridge: "逆袭打脸+身份反转",
    minSeconds: 7,
    keywords: /逆袭|打脸|身份|看不起|羞辱|马甲|豪门|战神|归来|翻身/,
    hook: "前3秒先给羞辱动作和主角反常冷静，立刻埋身份反转",
    premise: "主角被当众轻视，却用隐藏身份或关键证据完成反击。",
    conflict: "低位受辱到高位反杀的爽点落差",
    emotionalArc: "羞辱 -> 忍住 -> 亮牌 -> 反杀",
    location: "宴会厅、会议室或门店前台，人群围观形成审判感",
    timeAndLight: "明亮商业光，主角面部干净，反派略硬光",
    atmosphere: "人群压迫，主角越冷静越有反差",
    motifs: ["围观视线", "身份牌或合同特写", "反派表情崩塌", "主角平静抬眼"],
    props: ["合同", "名片", "手机通知"],
    endingBeat: "反派脸色僵住，主角平静转身离开",
    beats: [
      "反派当众羞辱，围观者低声议论",
      "主角没有辩解，只拿出关键道具或手机信息",
      "身份反转被揭开，反派表情从得意变僵",
      "主角平静离开，围观人群让路"
    ],
    compactShots: [
      "反派当众羞辱，围观者聚拢",
      "主角不辩解，拿出关键道具或手机信息",
      "身份反转揭开，反派表情僵住",
      "主角平静离开，人群让路"
    ]
  },
  {
    theme: "甜宠暧昧",
    bridge: "甜宠暧昧+克制拉扯",
    minSeconds: 6,
    keywords: /甜宠|告白|心动|暧昧|拥抱|吃醋|婚礼|闪婚|恋爱/,
    hook: "前3秒给近距离误触或保护动作，先让观众看见心动",
    premise: "两人因一次近距离接触产生暧昧，但都假装镇定。",
    conflict: "想靠近又不敢承认",
    emotionalArc: "误触 -> 心动 -> 掩饰 -> 甜钩子",
    location: "电梯、车内、雨夜门口或厨房，空间狭窄形成亲密压力",
    timeAndLight: "柔和暖光，肤色自然，背景虚化",
    atmosphere: "安静、轻微心跳感，动作比台词更重要",
    motifs: ["手指误触", "视线躲闪", "保护动作", "嘴角压笑"],
    props: ["雨伞", "外套", "杯子"],
    endingBeat: "两人同时移开视线，嘴角忍不住上扬",
    beats: [
      "狭窄空间里两人意外靠近或被迫同框",
      "一方做出保护动作，手指短暂触碰",
      "两人视线躲闪，假装整理衣服或道具",
      "最后同时移开视线，留下心动钩子"
    ],
    compactShots: [
      "狭窄空间里两人意外靠近",
      "一方保护对方，手指短暂触碰",
      "两人视线躲闪，假装整理衣服",
      "同时移开视线，嘴角压笑"
    ]
  },
  {
    theme: "悬疑发现",
    bridge: "悬疑发现+信息反转",
    minSeconds: 7,
    keywords: /悬疑|跟踪|真相|尸体|审讯|案件|杀|线索|秘密|监控/,
    hook: "前3秒给异常细节特写，不解释，让观众先产生疑问",
    premise: "主角发现异常线索，但暂时不能声张。",
    conflict: "知道真相和必须隐藏之间的紧张",
    emotionalArc: "异常 -> 靠近 -> 确认 -> 藏起",
    location: "低照度走廊、房间角落或监控室，局部光源突出线索",
    timeAndLight: "冷色低照度，关键物件有窄光",
    atmosphere: "安静、压迫、留悬念",
    motifs: ["线索特写", "屏住呼吸", "回头确认", "迅速藏起"],
    props: ["照片", "钥匙", "监控画面"],
    endingBeat: "主角把线索藏入口袋，假装无事转身",
    beats: [
      "异常物件或监控画面先入画",
      "主角靠近确认，呼吸放轻",
      "背后传来脚步声，主角迅速藏起线索",
      "主角转身假装平静，悬念停住"
    ],
    compactShots: [
      "异常物件或监控画面先入画",
      "主角靠近确认，呼吸放轻",
      "脚步声靠近，主角藏起线索",
      "转身假装平静，悬念停住"
    ]
  }
];

const FALLBACK_PACK: GenrePack = {
  theme: "关系反转",
  bridge: "关系反转+情绪钩子",
  minSeconds: 6,
  keywords: /./,
  hook: "前3秒先给异常动作或关键表情，避免铺垫过长",
  premise: "人物关系出现反转，情绪通过动作和眼神推进。",
  conflict: "表面平静和真实情绪之间的反差",
  emotionalArc: "建立关系 -> 触发冲突 -> 反应收束",
  location: "真实可拍的城市生活场景，前景、中景、背景层次清楚",
  timeAndLight: "自然写实光线，人物面部清晰",
  atmosphere: "真实、克制、有短剧冲突张力",
  motifs: ["关键表情变化", "手部小动作", "短暂停顿", "空间遮挡"],
  props: ["手机"],
  endingBeat: "用一个明确表情或手部动作收束",
  beats: [
    "主体进入场景，人物关系一眼可辨",
    "关键动作触发冲突，表情从平静转为紧张",
    "对方察觉变化但没有立刻点破",
    "镜头停在表情或道具特写上"
  ],
  compactShots: [
    "主体进入场景，人物关系清楚",
    "关键动作触发冲突，表情变化",
    "对方察觉但不点破",
    "停在表情或道具特写上"
  ]
};

export function runShortDramaDirectorAgent(input: DirectorInput): DramaContext {
  const pack = GENRE_PACKS.find((item) => item.keywords.test(input.text)) || inferFallbackPack(input.text);
  const sourceSparse = isSparseStory(input.text);
  const location = inferLocation(input.text, input.detectedLocations, pack);
  const timeAndLight = inferTimeAndLight(input.text, pack);
  const characters = buildCharacters(input.text, input.detectedCharacters, input.assets, pack);

  return {
    sourceSparse,
    theme: pack.theme,
    bridge: pack.bridge,
    hook: pack.hook,
    premise: pack.theme === "关系反转" && input.text.trim() ? `${input.text.replace(/[。！？!?]+$/g, "")}；${pack.conflict}。` : pack.premise,
    conflict: pack.conflict,
    emotionalArc: pack.emotionalArc,
    location,
    timeAndLight,
    atmosphere: pack.atmosphere,
    characters,
    motifs: pack.motifs,
    props: pack.props,
    endingBeat: pack.endingBeat,
    minSeconds: pack.minSeconds
  };
}

export function buildDirectorBeats(_text: string, drama: DramaContext, duration: number) {
  const pack = packForTheme(drama.theme);
  const shotCount = duration >= 8 ? 4 : duration >= 6 ? 3 : 2;
  return pack.beats.slice(0, shotCount);
}

export function estimateDirectorMinimumSeconds(drama: DramaContext, shots: Shot[]) {
  return Math.max(drama.minSeconds, Math.ceil(Math.max(1, shots.length) * 2));
}

export function compactDirectorCharacters(drama: DramaContext) {
  if (drama.theme === "双向背叛撞见") {
    const man = drama.characters.find((character) => character.name === "旧识男");
    const woman = drama.characters.find((character) => character.name === "旧识女");
    const manRef = extractRef(man?.description);
    const womanRef = extractRef(woman?.description);
    return `旧识男${manRef ? `参考${manRef}` : ""}，看向画外旧识女约一秒且摆动的手停半拍；旧识女${womanRef ? `参考${womanRef}` : ""}，反向回望约一秒且浅笑停一拍；女同行者只与旧识男同组，男同行者只与旧识女同组，两位同行者均对相遇无感`;
  }
  if (drama.theme === "旧爱重逢") {
    const man = drama.characters.find((character) => character.name === "旧识男");
    const woman = drama.characters.find((character) => character.name === "旧识女");
    const manRef = extractRef(man?.description);
    const womanRef = extractRef(woman?.description);
    return `旧识男${manRef ? `参考${manRef}` : ""}，看向画外旧识女约一秒且摆动的手停半拍；旧识女${womanRef ? `参考${womanRef}` : ""}，反向回望约一秒且浅笑停一拍；女同行者只与旧识男同组，男同行者只与旧识女同组，两位同行者均对相遇无感`;
  }
  if (drama.theme === "隐秘家庭撞破") {
    const heroine = drama.characters.find((character) => character.name === "女主");
    const husband = drama.characters.find((character) => character.name === "丈夫");
    const girl = drama.characters.find((character) => /女孩|女儿/.test(character.name));
    const heroineRef = extractRef(heroine?.description);
    const husbandRef = extractRef(husband?.description);
    const girlRef = extractRef(girl?.description);
    return `女主${heroineRef ? `参考${heroineRef}` : ""}，认出丈夫后脚步停住但不立刻质问；丈夫${husbandRef ? `参考${husbandRef}` : ""}，牵着女孩自然走出医院，抬眼后笑意消失；小女孩${girlRef ? `参考${girlRef}` : ""}，信任地牵着丈夫`;
  }
  return drama.characters.slice(0, 3).map((character) => `${character.name}${limitClean(character.description.replace(/^外貌可参考/, "参考"), 24)}`).join("；");
}

export function compactDirectorScene(drama: DramaContext) {
  if (drama.theme === "双向背叛撞见") return "陌生城市夜晚街口，微湿反光，橱窗暖光，手机冷光短暂照脸";
  if (drama.theme === "旧爱重逢") return "陌生城市夜晚街口，微湿反光，橱窗暖光，行人与车流形成遮挡";
  if (drama.theme === "隐秘家庭撞破") return "雨夜医院门口，门内冷白光切开雨帘，湿地反光，行人正常经过";
  return limitClean(`${drama.location}，${drama.timeAndLight}`, 48);
}

export function compactDirectorShotAction(shot: Shot, drama: DramaContext, assets: ReferenceAsset[], maxLength: number) {
  const pack = packForTheme(drama.theme);
  const action = pack.compactShots[shot.id - 1];
  if (action) return action;
  return limitClean(withAtLabels(shot.action, assets), maxLength);
}

function inferFallbackPack(text: string) {
  if (/家庭|母亲|父亲|婆婆|孩子|女儿|儿子/.test(text)) {
    return {
      ...FALLBACK_PACK,
      theme: "家庭伦理",
      bridge: "家庭伦理+亲情撕裂",
      minSeconds: 7,
      hook: "前3秒先给家庭关系失衡的动作，如推开、沉默、被忽视",
      conflict: "亲情责任和自我尊严之间的拉扯",
      emotionalArc: "委屈 -> 忍耐 -> 爆发边缘 -> 留钩子",
      motifs: ["沉默饭桌", "手停在门把上", "压住眼泪", "旧物特写"]
    };
  }
  if (/古风|王爷|皇上|宫殿|将军|公主|世子/.test(text)) {
    return {
      ...FALLBACK_PACK,
      theme: "古风冲突",
      bridge: "古风权谋+身份压迫",
      minSeconds: 8,
      hook: "前3秒给跪地、令牌或刀光等强权力符号",
      conflict: "身份压迫和隐忍反击之间的张力",
      emotionalArc: "压迫 -> 忍住 -> 抬眼 -> 反击钩子",
      location: "宫门、廊下或厅堂，层层纵深，烛火和冷月形成反差",
      motifs: ["衣袖攥紧", "令牌特写", "抬眼冷光", "侍从停步"]
    };
  }
  if (/总裁|合同|会议|公司|职场|老板/.test(text)) {
    return {
      ...FALLBACK_PACK,
      theme: "职场压迫",
      bridge: "职场压迫+隐忍反击",
      minSeconds: 7,
      hook: "前3秒给文件被摔下或全场注视，压迫感先到",
      conflict: "权力压迫和主角反击之间的落差",
      emotionalArc: "被压 -> 忍住 -> 抬眼 -> 亮牌",
      location: "现代会议室或办公室，冷静整洁，桌面有文件和屏幕光",
      motifs: ["文件落桌", "全场注视", "签字笔停住", "主角抬眼"]
    };
  }
  return FALLBACK_PACK;
}

function isSparseStory(text: string) {
  if (!text.trim()) return true;
  const sentenceCount = text.split(/(?<=[。！？!?])\s*/).filter(Boolean).length;
  const hasDialogue = /[：:]\s*[^，。！？!?]{2,}|[“"][^”"]+[”"]/.test(text);
  const hasExplicitShots = /(?:镜头|分镜|shot)\s*[0-9一二三四五六七八九十]+/i.test(text);
  return text.length < 90 && sentenceCount <= 2 && !hasDialogue && !hasExplicitShots;
}

function inferLocation(text: string, detectedLocations: string[], pack: GenrePack) {
  if (detectedLocations.length) return detectedLocations.join("、");
  if (/陌生城市/.test(text)) return "陌生城市夜晚街口，微湿反光，橱窗暖光，行人与车流形成遮挡";
  if (/医院/.test(text)) return "医院走廊，冷白顶灯，墙面和地面干净但压抑";
  if (/电梯/.test(text)) return "写字楼电梯口，金属门反光，空间狭窄";
  if (/餐厅|咖啡/.test(text)) return "安静餐厅或咖啡店靠窗位置，玻璃反射城市灯光";
  return pack.location;
}

function inferTimeAndLight(text: string, pack: GenrePack) {
  if (/雨夜/.test(text)) return "雨夜冷色环境光，地面反光明显";
  if (/夜|霓虹|陌生城市|街/.test(text)) return "夜晚路灯与橱窗暖光混合，面部柔和侧光";
  if (/清晨|早晨/.test(text)) return "清晨自然光，空气干净";
  if (/黄昏|傍晚/.test(text)) return "黄昏暖光，阴影拉长";
  return pack.timeAndLight;
}

function buildCharacters(text: string, detectedCharacters: string[], assets: ReferenceAsset[], pack: GenrePack): CharacterProfile[] {
  const imageRefs = assets.filter((asset) => asset.type === "image").map(assetMention);
  if (pack.theme === "双向背叛撞见") {
    return [
      { name: "旧识男", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}成年男性，看向画外旧识女约一秒，随步伐摆动的手停半拍，但步速保持自然` },
      { name: "旧识女", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}成年女性，反向回望旧识男约一秒，原本的浅笑停一拍后收住，不停步` },
      { name: "女同行者", description: "成年女性，只与旧识男同组并肩前行，继续看橱窗，对相遇完全无感" },
      { name: "男同行者", description: "成年男性，只与旧识女同组并示意前方店铺，对相遇完全无感" }
    ];
  }
  if (pack.theme === "旧爱重逢") {
    return [
      { name: "旧识男", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}成年男性，看向画外旧识女约一秒，随步伐摆动的手停半拍，但不改变步速` },
      { name: "旧识女", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}成年女性，反向回望旧识男约一秒，原本的浅笑停一拍后收住` },
      { name: "女同行者", description: "成年女性，只与旧识男同组，自然并肩前行，对相遇完全无感" },
      { name: "男同行者", description: "成年男性，只与旧识女同组，示意前方店铺，对相遇完全无感" }
    ];
  }
  if (pack.theme === "隐秘家庭撞破") {
    return [
      { name: "女主", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}认出丈夫后脚步停住，先压住质问，反应克制` },
      { name: "丈夫", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}牵着女孩自然走出医院，认出女主后笑意消失` },
      { name: "小女孩", description: `${imageRefs[2] ? `外貌可参考${imageRefs[2]}，` : ""}信任地牵着丈夫，动作自然，不理解大人的停顿` }
    ];
  }
  if (detectedCharacters.length) {
    return detectedCharacters.slice(0, 4).map((name, index) => ({
      name,
      description: `${imageRefs[index] ? `外貌可参考${imageRefs[index]}，` : ""}身份连续，情绪动作真实`
    }));
  }
  if (/(情侣|恋人|夫妻|男友|女友|相爱|恋爱)/.test(text) && !hasExplicitAlternativeCouple(text)) {
    return [
      { name: "男方", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}成年男性，身份连续，动作和情绪真实` },
      { name: "女方", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}成年女性，身份连续，动作和情绪真实` }
    ];
  }
  return [
    { name: "主角A", description: `${imageRefs[0] ? `外貌可参考${imageRefs[0]}，` : ""}承担主要情绪变化，动作克制真实` },
    { name: "关系人物B", description: `${imageRefs[1] ? `外貌可参考${imageRefs[1]}，` : ""}推动关系冲突，反应自然` }
  ];
}

function hasExplicitAlternativeCouple(text: string) {
  return /(?:男男|女女|同性|两个男人|两名男子|两个女人|两名女子).{0,18}(?:情侣|恋人|相爱|伴侣)|(?:情侣|恋人|伴侣).{0,18}(?:男男|女女|同性)/.test(text);
}

function packForTheme(theme: string) {
  return GENRE_PACKS.find((pack) => pack.theme === theme) || inferFallbackPack(theme);
}

function assetMention(asset: ReferenceAsset) {
  return `@${asset.label}`;
}

function extractRef(text = "") {
  return text.match(/@(?:图片|视频|音频)\d+/)?.[0] || "";
}

function limitClean(text: string, maxLength: number) {
  const compact = text.replace(/\s+/g, "").replace(/。+/g, "。").replace(/[；;，,]+$/g, "");
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, maxLength);
}

function withAtLabels(text: string, assets: ReferenceAsset[]) {
  return assets.reduce((next, asset) => {
    const escaped = asset.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return next.replace(new RegExp(`(?<!@)${escaped}`, "g"), `@${asset.label}`);
  }, text);
}
