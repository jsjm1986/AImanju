/**
 * 海外短剧品类常量与判定
 * 供大纲/生成链路统一判断"是否海外项目"，避免多处硬编码题材清单漂移
 */

/** 海外女频题材 */
export const OVERSEAS_FEMALE_TYPES = [
  '霸总契约',
  '黑手党',
  '狼人',
  'ABO',
  '吸血鬼',
  '契约婚姻',
  '禁忌之恋',
  '隐藏身份',
  '重生复仇',
  '神话虐恋',
  '豪门恩怨',
] as const;

/** 海外男频题材 */
export const OVERSEAS_MALE_TYPES = [
  '复仇逆袭',
  '黑帮枭雄',
  '都市强者',
  '技术流逆袭',
  '身份揭露',
  '战神归来',
] as const;

export const OVERSEAS_TYPES: readonly string[] = [
  ...OVERSEAS_FEMALE_TYPES,
  ...OVERSEAS_MALE_TYPES,
];

/** 海外频道 genre 值 */
export const OVERSEAS_GENRES = ['海外女频', '海外男频', '海外短剧'] as const;

/**
 * 判断是否海外短剧项目
 * 判定依据：genre 含"海外" 或 type 命中海外题材清单
 */
export function isOverseasProject(genre?: string, type?: string): boolean {
  if (genre && genre.includes('海外')) return true;
  if (type && OVERSEAS_TYPES.includes(type)) return true;
  return false;
}

/** 海外女频判定（用于人物公式/节奏分支） */
export function isOverseasFemaleChannel(genre?: string, type?: string): boolean {
  if (genre === '海外男频') return false;
  if (genre === '海外女频') return true;
  if (type && (OVERSEAS_MALE_TYPES as readonly string[]).includes(type)) return false;
  return true; // 默认按女频处理（海外约70%为女频向）
}

// ==================== 生产管线资产规范（批量剧制作流程） ====================

/**
 * 人物标准三视图资产提示词模板（主要角色专用）。
 * 下游 AI 仿真人管线要求：同一角色四个机位同一画面、纯白无缝背景、五官神态一致。
 */
export const CHARACTER_THREE_VIEW_TEMPLATE =
  'Character reference sheet of {name}: {appearance}。' +
  '四机位同一画面横向排列——最左为脸部特写（正脸），随后依次为全身正面、全身左侧45°、全身背面；' +
  '纯白无缝背景，无道具无场景，统一站姿，人物特征与服装在所有机位间100%一致；' +
  '画面干净无LOGO无水印无文字标注，写实风格，16:9';

/** 场景资产提示词约束（16:9或21:9，无水印） */
export const SCENE_ASSET_RULE =
  '场景资产：16:9 或 21:9 横构图，空场景无人物，无LOGO无水印';

/** 道具资产提示词约束（16:9或9:16，无水印） */
export const PROP_ASSET_RULE =
  '道具资产：16:9 或 9:16 构图，单一物件居中特写，无LOGO无水印';

/** 主要角色按项目绑定：音色单独制作，服装/场景/道具绑定到集数（资产表字段） */
export const ASSET_TABLE_FIELDS =
  '资产表字段：资产名/类型(人物|场景|道具)/绑定集数/提示词/状态(待生成|已生成|已审核)/备注';
