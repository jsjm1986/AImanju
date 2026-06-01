/**
 * 输出格式配置类型 (与后端同步)
 */

export type OutputFormatPreset =
    | 'standard' | 'novel' | 'screenplay' | 'webtoon' | 'audio_drama'
    | 'game_script' | 'stage_play' | 'manga_jp' | 'short_video' | 'interactive'
    | 'live_action' | 'ai_avatar' | 'american_comic' | 'chinese_comic' | 'documentary';

export interface IOutputFormatConfig {
    mode: 'preset' | 'advanced' | 'custom';
    preset?: OutputFormatPreset;
    customPrompt?: string;  // 用户自定义输出要求
    advanced?: {
        wordLimit?: { min: number; target: number; max: number };
        sceneLimit?: { min: number; max: number };
    };
}

export interface IPresetInfo {
    id: OutputFormatPreset;
    name: string;
    description: string;
    wordRange: string;
    sceneRange: string;
    suitableFor: string[];
    expertIdentity?: string;
}
