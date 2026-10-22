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
