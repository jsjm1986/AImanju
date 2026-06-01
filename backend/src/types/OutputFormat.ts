/**
 * 输出格式配置类型定义
 * 
 * 支持三种模式：
 * - preset: 使用预设模板
 * - advanced: 基于预设微调
 * - custom: 完全自定义
 */

// ==================== 预设类型 ====================

export type OutputFormatPreset =
  | 'standard'      // 标准漫剧格式（当前默认）
  | 'novel'         // 小说格式
  | 'screenplay'    // 影视剧本格式
  | 'webtoon'       // 条漫/竖屏格式
  | 'audio_drama'   // 广播剧格式
  | 'game_script'   // 游戏剧情格式
  | 'stage_play'    // 话剧/舞台剧格式
  | 'manga_jp'      // 日式漫画分镜格式
  | 'short_video'   // 短视频/短剧格式
  | 'interactive'   // 互动剧/AVG格式
  | 'live_action'   // 真人短剧格式
  | 'ai_avatar'     // AI真人数字人格式
  | 'american_comic' // 美漫格式
  | 'chinese_comic'  // 国漫格式
  | 'documentary';   // 纪录片/解说格式

export type DialogueStyle =
  | 'colon'         // 张三：内容
  | 'brackets'      // 【张三】内容
  | 'screenplay'    // 张三\n（动作描述）内容
  | 'quotes';       // 「张三」内容

export type ActionStyle =
  | 'prefix'        // △描述
  | 'wrap'          // 【画面】描述
  | 'indent'        // （缩进）描述
  | 'parentheses';  // （描述）

// ==================== 格式详情接口 ====================

export interface IEpisodeHeaderConfig {
  format: string;              // "第{ep}集：\n梗概：{summary}\n人物：{characters}"
  includeSummary: boolean;
  includeCharacters: boolean;
}

export interface ISceneConfig {
  format: string;              // "{ep}-{scene}：{location}-{time} {inOut}"
  timeOptions: string[];       // ["日", "夜", "傍晚", "清晨", "黄昏"]
  inOutOptions: string[];      // ["内", "外", "内/外"]
}

export interface IDialogueConfig {
  style: DialogueStyle;
  normal: string;              // "{name}：{content}"
  withState: string;           // "{name}（{state}）：{content}"
  innerThought: string;        // "{name}OS：{content}"
  narrator: string;            // "画外音：{content}"
  systemPrompt: string;        // "【系统：{content}】"
}

export interface IActionConfig {
  marker: string;              // "△"
  style: ActionStyle;
  wrapSymbols?: [string, string]; // ["【", "】"]
  actionLabel?: string;        // 格式表中的行标签，如"画面"/"叙述"/"音效"/"舞台指示"
}

export interface IWordLimitConfig {
  min: number;
  target: number;
  max: number;
  enforceStrict: boolean;
}

export interface ISceneLimitConfig {
  min: number;
  max: number;
  recommended: number;
}

export interface IGuidelinesConfig {
  avoidWatering: boolean;      // 拒绝注水
  showDontTell: boolean;       // 动作优先
  dialogueMaxLength: number;   // 单句对白上限
  extraNaming: string;         // 龙套命名规则
  customRules: string[];       // 用户自定义规则
}

// 完整格式详情
export interface IFormatDetails {
  episodeHeader: IEpisodeHeaderConfig;
  scene: ISceneConfig;
  dialogue: IDialogueConfig;
  action: IActionConfig;
  wordLimit: IWordLimitConfig;
  sceneLimit: ISceneLimitConfig;
  episodeSeparator: string;    // "---"
  guidelines: IGuidelinesConfig;
  promptTemplate?: string;     // 专属格式提示词模板，存在时替代自动生成的格式表格
}

// ==================== 主配置接口 ====================

export interface IOutputFormatConfig {
  mode: 'preset' | 'advanced' | 'custom';

  // 预设模式
  preset?: OutputFormatPreset;

  // 自定义输出提示词 (追加到格式说明中)
  customPrompt?: string;

  // 启用叙事科学方法论 (注入完整方法论到System Prompt)
  enableNarrativeMethodology?: boolean;

  // 高级模式 (基于预设微调，部分覆盖) - 保留向后兼容
  advanced?: Partial<IFormatDetails>;

  // 完全自定义模式 - 保留向后兼容
  custom?: IFormatDetails;
}

// ==================== 预设信息 ====================

export interface IPresetInfo {
  id: OutputFormatPreset;
  name: string;
  description: string;
  wordRange: string;
  sceneRange: string;
  suitableFor: string[];
  expertIdentity: string;     // 剧本生成身份
  plannerIdentity?: string;   // 大纲策划身份
  editorIdentity?: string;    // 改写编辑身份
  validatorIdentity?: string; // 审核专家身份
}

// ==================== 默认值 ====================

export const DEFAULT_OUTPUT_FORMAT: IOutputFormatConfig = {
  mode: 'preset',
  preset: 'standard',
  enableNarrativeMethodology: true
};
