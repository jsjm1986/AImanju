/**
 * 输出格式服务
 * 负责解析配置、生成格式提示词
 */

import {
    IOutputFormatConfig,
    IFormatDetails,
    DEFAULT_OUTPUT_FORMAT,
    OutputFormatPreset
} from '../../types/OutputFormat';
import {
    FORMAT_PRESETS,
    PRESET_INFO_LIST,
    getPresetConfig,
    getExpertIdentity
} from '../../constants/formatPresets';

export interface ResolvedFormatConfig extends IFormatDetails {
    sourcePreset?: OutputFormatPreset;
    expertIdentity?: string;  // 专家身份定义
}

/** 格式相关术语，用于 system prompt 中动态替换 */
export interface FormatTerminology {
    contentType: string;   // "剧本"/"小说"/"分镜脚本"/"解说词"
    unitName: string;      // "集"/"章"/"期"/"幕"/"話"
    actionDesc: string;    // "画面描写"/"叙述描写"/"动作描写"/"音效描述"
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export class OutputFormatService {

    /**
     * 解析配置，合并预设和覆盖
     */
    resolveConfig(config?: IOutputFormatConfig): ResolvedFormatConfig {
        const safeConfig = config || DEFAULT_OUTPUT_FORMAT;

        switch (safeConfig.mode) {
            case 'custom':
                if (!safeConfig.custom) {
                    return {
                        ...getPresetConfig('standard'),
                        sourcePreset: 'standard',
                        expertIdentity: getExpertIdentity('standard')
                    };
                }
                return { ...safeConfig.custom, sourcePreset: undefined };

            case 'advanced':
                const basePreset = safeConfig.preset || 'standard';
                const baseConfig = getPresetConfig(basePreset);
                return this.mergeConfig(baseConfig, safeConfig.advanced || {}, basePreset);

            case 'preset':
            default:
                const preset = safeConfig.preset || 'standard';
                return {
                    ...getPresetConfig(preset),
                    sourcePreset: preset,
                    expertIdentity: getExpertIdentity(preset)
                };
        }
    }

    /**
     * 深度合并配置
     */
    private mergeConfig(
        base: IFormatDetails,
        overrides: Partial<IFormatDetails>,
        sourcePreset: OutputFormatPreset
    ): ResolvedFormatConfig {
        return {
            episodeHeader: { ...base.episodeHeader, ...overrides.episodeHeader },
            scene: { ...base.scene, ...overrides.scene },
            dialogue: { ...base.dialogue, ...overrides.dialogue },
            action: { ...base.action, ...overrides.action },
            wordLimit: { ...base.wordLimit, ...overrides.wordLimit },
            sceneLimit: { ...base.sceneLimit, ...overrides.sceneLimit },
            episodeSeparator: overrides.episodeSeparator ?? base.episodeSeparator,
            guidelines: { ...base.guidelines, ...overrides.guidelines },
            promptTemplate: overrides.promptTemplate ?? base.promptTemplate,
            sourcePreset,
            expertIdentity: getExpertIdentity(sourcePreset)
        };
    }

    /**
     * 生成格式提示词片段
     * @param config 解析后的格式配置
     * @param customPrompt 用户自定义输出要求（可选）
     */
    buildFormatPromptSection(config: ResolvedFormatConfig, customPrompt?: string): string {
        let result: string;

        if (config.promptTemplate) {
            // 使用预设专属的格式提示词模板
            result = this.renderPromptTemplate(config.promptTemplate, config);
        } else {
            // 兜底：custom 模式等没有 promptTemplate 时，走自动生成的表格
            const formatTable = this.buildFormatTable(config);
            const guidelines = this.buildGuidelines(config);
            result = `## 输出格式（严格遵循）

${formatTable}

## 创作规范

${guidelines}`;
        }

        // 追加用户自定义输出要求
        if (customPrompt && customPrompt.trim()) {
            result += `

## 用户特殊要求（必须遵守）

${customPrompt.trim()}`;
        }

        return result;
    }

    /**
     * 渲染格式提示词模板，替换动态变量
     */
    private renderPromptTemplate(template: string, config: ResolvedFormatConfig): string {
        const { wordLimit, sceneLimit } = config;
        return template
            .replace(/\{wordMin\}/g, String(wordLimit.min))
            .replace(/\{wordTarget\}/g, String(wordLimit.target))
            .replace(/\{wordMax\}/g, String(wordLimit.max))
            .replace(/\{sceneMin\}/g, String(sceneLimit.min))
            .replace(/\{sceneMax\}/g, String(sceneLimit.max))
            .replace(/\{sceneRecommended\}/g, String(sceneLimit.recommended));
    }

    /**
     * 生成格式表格（兜底，用于 custom 模式）
     */
    private buildFormatTable(config: ResolvedFormatConfig): string {
        const { episodeHeader, scene, dialogue, action, episodeSeparator } = config;

        // 生成示例
        const sceneExample = scene.format
            .replace('{ep}', '1')
            .replace('{scene}', '1')
            .replace('{location}', '客厅')
            .replace('{time}', scene.timeOptions[0] || '日')
            .replace('{inOut}', scene.inOutOptions[0] || '内');

        const dialogueExample = dialogue.normal
            .replace('{name}', '张三')
            .replace('{content}', '你来了');

        const stateDialogueExample = dialogue.withState
            .replace('{name}', '张三')
            .replace('{state}', '冷笑')
            .replace('{content}', '你来了');

        const narratorExample = dialogue.narrator
            .replace('{content}', '三年后...');

        const actionExample = this.buildActionExample(config);

        // 生成集头示例（使用实际格式模板）
        const headerExample = episodeHeader.format
            .replace('{ep}', '1')
            .replace('{summary}', '主角初登场')
            .replace('{characters}', '张三，李四');

        // 动态 action 标签（不同格式含义不同：画面/叙述/音效/舞台指示等）
        const actionLabel = action.actionLabel || '画面';

        // 构建表格行
        const rows: string[] = [
            '| 元素 | 格式 | 示例 |',
            '|-----|------|-----|',
            `| 集头 | ${this.escapeForTable(episodeHeader.format)} | ${this.escapeForTable(headerExample)} |`,
            `| 场景 | ${this.escapeForTable(scene.format)} | ${sceneExample} |`,
            `| ${actionLabel} | ${action.marker}描述 | ${actionExample} |`,
            `| 对白 | ${this.escapeForTable(dialogue.normal)} | ${dialogueExample} |`,
            `| 状态对白 | ${this.escapeForTable(dialogue.withState)} | ${stateDialogueExample} |`,
        ];

        // 仅当innerThought非空时添加
        if (dialogue.innerThought && dialogue.innerThought.trim()) {
            const innerExample = dialogue.innerThought
                .replace('{name}', '张三')
                .replace('{content}', '他终于来了');
            rows.push(`| 内心戏 | ${this.escapeForTable(dialogue.innerThought)} | ${innerExample} |`);
        }

        rows.push(`| 旁白 | ${this.escapeForTable(dialogue.narrator)} | ${narratorExample} |`);

        // 仅当systemPrompt非空时添加
        if (dialogue.systemPrompt && dialogue.systemPrompt.trim()) {
            const systemExample = dialogue.systemPrompt.replace('{content}', '获得神器');
            rows.push(`| 系统提示 | ${this.escapeForTable(dialogue.systemPrompt)} | ${systemExample} |`);
        }

        rows.push(`| 集分隔 | ${episodeSeparator} | ${episodeSeparator} |`);

        return rows.join('\n');
    }

    private buildActionExample(config: ResolvedFormatConfig): string {
        const { action } = config;
        switch (action.style) {
            case 'wrap':
                const [open, close] = action.wrapSymbols || ['【', '】'];
                return `${open}阳光透过窗户洒落${close}`;
            case 'indent':
                return `${action.marker}阳光透过窗户洒落`;
            case 'prefix':
            default:
                return `${action.marker}阳光透过窗户洒落`;
        }
    }

    private escapeForTable(str: string): string {
        return str.replace(/\n/g, '\\n').replace(/\|/g, '\\|');
    }

    /**
     * 生成创作规范
     */
    private buildGuidelines(config: ResolvedFormatConfig): string {
        const { wordLimit, sceneLimit, guidelines } = config;

        const lines: string[] = [];

        lines.push(`- **字数要求**：每集实际内容严格控制在 **${wordLimit.min}-${wordLimit.target}字** 之间，上限 **${wordLimit.max}字**。`);
        lines.push(`- **场景数量**：每集 ${sceneLimit.min}-${sceneLimit.max} 个场景。`);

        if (guidelines.avoidWatering || guidelines.showDontTell) {
            lines.push('- **表达精炼**：');
            if (guidelines.avoidWatering) {
                lines.push('  1. **拒绝注水**：禁止使用冗长的环境描写，除非暗示关键剧情。');
            }
            if (guidelines.showDontTell) {
                lines.push('  2. **动作优先**：尽量用动作代替心理描写 (Show, Don\'t Tell)。');
            }
            if (guidelines.dialogueMaxLength > 0) {
                lines.push(`  3. **对话精简**：单句对白尽量不超过${guidelines.dialogueMaxLength}字，删除无效寒暄。`);
            }
        }

        if (guidelines.extraNaming) {
            lines.push(`- **角色命名**：龙套用"${guidelines.extraNaming}"命名，同集内名称一致。`);
        }

        if (guidelines.customRules && guidelines.customRules.length > 0) {
            lines.push('- **特殊要求**：');
            guidelines.customRules.forEach((rule, i) => {
                lines.push(`  ${i + 1}. ${rule}`);
            });
        }

        return lines.join('\n');
    }

    /**
     * 验证配置合法性
     */
    validateConfig(config: IOutputFormatConfig): ValidationResult {
        const errors: string[] = [];

        // 验证 mode 字段
        const validModes = ['preset', 'advanced', 'custom'];
        if (!validModes.includes(config.mode)) {
            errors.push(`无效的模式: ${config.mode}，可选值: ${validModes.join(', ')}`);
        }

        // preset 模式：验证预设名称是否合法
        if (config.mode === 'preset') {
            if (config.preset) {
                const validPresets = PRESET_INFO_LIST.map(p => p.id);
                if (!validPresets.includes(config.preset)) {
                    errors.push(`无效的预设名称: ${config.preset}`);
                }
            }
        }

        // custom 模式：验证自定义提示词不为空
        if (config.mode === 'custom') {
            if (!config.customPrompt || !config.customPrompt.trim()) {
                errors.push('自定义模式下 customPrompt 不能为空');
            }
        }

        // advanced 模式：验证字数和场景数范围
        if (config.mode === 'advanced' && config.advanced?.wordLimit) {
            const { min, target, max } = config.advanced.wordLimit;
            if (min > target) errors.push('最小字数不能大于目标字数');
            if (target > max) errors.push('目标字数不能大于最大字数');
            if (min < 100) errors.push('最小字数不能小于100');
            if (max > 5000) errors.push('最大字数不能超过5000');
        }

        if (config.mode === 'advanced' && config.advanced?.sceneLimit) {
            const { min, max } = config.advanced.sceneLimit;
            if (min > max) errors.push('最小场景数不能大于最大场景数');
            if (min < 1) errors.push('最小场景数不能小于1');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * 获取所有预设信息
     */
    getPresets() {
        return PRESET_INFO_LIST;
    }

    /**
     * 获取预设详情
     */
    getPresetDetails(preset: OutputFormatPreset): IFormatDetails {
        return getPresetConfig(preset);
    }

    /**
     * 获取格式相关术语
     * 不同格式在 system prompt 中使用不同的称谓
     */
    getFormatTerminology(preset?: OutputFormatPreset): FormatTerminology {
        const TERMINOLOGY_MAP: Partial<Record<OutputFormatPreset, FormatTerminology>> = {
            novel:          { contentType: '小说',     unitName: '章', actionDesc: '叙述描写' },
            screenplay:     { contentType: '剧本',     unitName: '集', actionDesc: '动作描写' },
            audio_drama:    { contentType: '广播剧本', unitName: '期', actionDesc: '音效描述' },
            stage_play:     { contentType: '剧本',     unitName: '幕', actionDesc: '舞台指示' },
            game_script:    { contentType: '剧情脚本', unitName: '章', actionDesc: 'CG指示' },
            manga_jp:       { contentType: '分镜脚本', unitName: '話', actionDesc: '効果描写' },
            interactive:    { contentType: '互动剧本', unitName: '章', actionDesc: '场景描述' },
            documentary:    { contentType: '解说词',   unitName: '期', actionDesc: '画面描述' },
            american_comic: { contentType: '漫画脚本', unitName: '期', actionDesc: 'Panel描写' },
            chinese_comic:  { contentType: '漫画脚本', unitName: '话', actionDesc: '画面描写' },
        };

        if (preset && TERMINOLOGY_MAP[preset]) {
            return TERMINOLOGY_MAP[preset]!;
        }
        // 默认：标准漫剧/条漫/短视频/真人短剧/AI真人剧
        return { contentType: '剧本', unitName: '集', actionDesc: '画面描写' };
    }
}

// 导出单例
export const outputFormatService = new OutputFormatService();
