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
            overseas_drama: { contentType: '海外短剧剧本', unitName: '集', actionDesc: '动作线' },
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

/**
 * 海外短剧格式的机械性归一化（仅处理排版漂移，不改内容语义）：
 * - 剥离集标题前的 markdown 标题符（## 第1集 → 第1集）
 * - 角色名与 OS/VO 之间去空格（Nora OS → NoraOS）
 * - 场标序号与场景名之间去空格（3-1 宅邸 → 3-1宅邸）
 */
export function normalizeOverseasScript(content: string): string {
    return content
        .replace(/^#{1,6}\s*(第\d+集)/gm, '$1')
        .replace(/([A-Za-z\u4e00-\u9fa5'’\-])\s+(OS|VO)(?=：|\()/g, '$1$2')
        .replace(/^(\d+-\d+) +/gm, '$1');
}

export interface OverseasScanViolation {
    content: string;
    evidence: string;
    severity: 'important' | 'normal';
    suggestion: string;
}

/**
 * 海外短剧格式的确定性正则扫描（不依赖 AI 判断，命中即确凿违规）：
 * - 弱动作句式："动词+了一下/一拍/一声/两秒"
 * - 抽象语气括号：（低声）（压低声）（轻声）（小声）（语气平静）等整词命中
 * - OS 密度：单集 OS 行超过4条大概率为信息交代滥用
 * - 字数上限：按解析后的格式配置判定
 */
export function scanOverseasScript(content: string, wordLimitMax?: number): OverseasScanViolation[] {
    const violations: OverseasScanViolation[] = [];
    const samples = (arr: string[], n = 3) => arr.slice(0, n).join('；');

    const weakHits = (content.match(/[^，。！？\n「」()（）]{1,10}了[一二]?[下拍声秒]/g) || [])
        .filter(h => {
            const m = h.match(/(.)了[一二]?([下拍声秒])$/);
            return !(m && m[1] === m[2]);  // 排除动词重叠（拍了拍/看了看），非弱动作句式
        });
    if (weakHits.length > 0) {
        violations.push({
            content: '弱动作句式禁止：全文不得出现"动词+了一下/一拍/一声/两秒"式收笔，动作必须写到具体落点',
            evidence: `命中${weakHits.length}处，如：${samples(weakHits)}`,
            severity: 'normal',
            suggestion: '把"了一下"式收笔改写为有落点的具体动作',
        });
    }

    const parenHits = content.match(/（低[声音量]）|（压低声）|（压低声音）|（轻声）|（小声）|（语气平静）/g) || [];
    if (parenHits.length > 0) {
        violations.push({
            content: '抽象括号禁止：对白括号内不得出现抽象语气词，必须写可视动作',
            evidence: `命中${parenHits.length}处：${samples(parenHits)}`,
            severity: 'normal',
            suggestion: '将抽象语气词替换为可拍摄的动作描述',
        });
    }

    const osCount = (content.match(/^[A-Za-z\u4e00-\u9fa5'’\-]+OS/mg) || []).length;
    if (osCount > 4) {
        violations.push({
            content: 'OS/VO边界：OS仅用于情绪与潜台词，单集OS不得超过4条；禁止用OS交代剧情信息或推理结论',
            evidence: `本集OS共${osCount}条，超阈值`,
            severity: 'important',
            suggestion: '将交代信息的OS改写为道具行为或高压对白，仅保留纯情绪OS',
        });
    }

    if (wordLimitMax && content.length > wordLimitMax) {
        violations.push({
            content: `字数上限：每集不得超过${wordLimitMax}字`,
            evidence: `本集${content.length}字，超出${content.length - wordLimitMax}字`,
            severity: content.length > wordLimitMax * 1.5 ? 'important' : 'normal',
            suggestion: '压缩重复信息与弱功能场景至字数范围内',
        });
    }

    // 场景过渡：场景头前后两侧均无△行（对白→场景头→对白的纯硬切）
    const lines = content.split('\n');
    const hardCuts: string[] = [];
    const nonEmpty = (idx: number, dir: number) => {
        for (let j = idx + dir; j >= 0 && j < lines.length; j += dir) {
            const t = lines[j].trim();
            if (t) return t;
        }
        return '';
    };
    for (let i = 0; i < lines.length; i++) {
        if (!/^\d+-\d+/.test(lines[i].trim())) continue;
        const prev = nonEmpty(i, -1);
        const next = nonEmpty(i, 1);
        const prevOk = prev.startsWith('△') || prev.startsWith('【闪出】')
            || /^出场人物[：:]/.test(prev) || /^第\d+集/.test(prev) || prev === '';
        const nextOk = next.startsWith('△') || next === '';
        if (!prevOk && !nextOk) {
            hardCuts.push(`${prev.slice(0, 16)}… → ${lines[i].trim().slice(0, 16)} → ${next.slice(0, 16)}…`);
        }
    }
    if (hardCuts.length > 0) {
        violations.push({
            content: '场景过渡：场景切换处须有视觉过渡（△过渡行或△切镜：标记），禁止对白直接接新场景头的硬切',
            evidence: `命中${hardCuts.length}处硬切：${samples(hardCuts)}`,
            severity: 'normal',
            suggestion: '在场景头前或后补一条△过渡动作行（如△切镜：车驶入夜色），或让场景以△画面开场',
        });
    }

    // [HOOK] 唯一且必须位于集尾（多钩或中段钩子破坏结构）
    const hookMatches = [...content.matchAll(/\[HOOK\]/g)];
    if (hookMatches.length > 1) {
        violations.push({
            content: '集尾钩子唯一性：每集只允许一个[HOOK]标注，且必须位于剧本末尾',
            evidence: `命中${hookMatches.length}个[HOOK]标记`,
            severity: 'important',
            suggestion: '删除中段[HOOK]，仅保留集尾最后一个',
        });
    } else if (hookMatches.length === 1 && hookMatches[0].index !== undefined && hookMatches[0].index < content.length * 0.85) {
        violations.push({
            content: '集尾钩子位置：[HOOK]必须位于剧本末尾（后15%）',
            evidence: `[HOOK]位于正文${Math.round((hookMatches[0].index! / content.length) * 100)}%处`,
            severity: 'normal',
            suggestion: '将[HOOK]移至剧本最后一行之后',
        });
    }

    // 台词行长：角色名（…）：台词 超过25字（排除出场人物/字幕/黑屏/HOOK/OS/VO行）
    const longDialogue = lines.filter(l => {
        const t = l.trim();
        if (/^(出场人物|字幕|黑屏)|^\[HOOK\]|OS[（：:]|VO[（：:]/.test(t)) return false;
        const m = t.match(/^[^△\s【\[][^(（\n]{1,20}(?:（[^）]*）)?[：:](.*)$/);
        if (!m) return false;
        const spoken = m[1].replace(/\s/g, '');
        return spoken.length > 25;
    });
    if (longDialogue.length > 0) {
        violations.push({
            content: '对白精简：单句台词不得超过25字（不含语气括号）',
            evidence: `命中${longDialogue.length}行长台词，如：${samples(longDialogue.map(l => l.trim().slice(0, 34)))}`,
            severity: 'normal',
            suggestion: '拆成两句或删冗余修饰，保留短促有力的口语',
        });
    }

    // △行长：超过30字
    const longActions = lines.filter(l => l.trim().startsWith('△') && l.trim().replace(/\s/g, '').length > 32);
    if (longActions.length > 0) {
        violations.push({
            content: '动作线精简：每条△不得超过30字',
            evidence: `命中${longActions.length}条长△，如：${samples(longActions.map(l => l.trim().slice(0, 36)))}`,
            severity: 'normal',
            suggestion: '一条△只写一个动作/画面，拆分长句',
        });
    }

    // 场标缺情绪标签
    const headersMissingEmotion = lines.filter(l => /^\d+-\d+/.test(l.trim()) && !l.includes('【核心情绪'));
    if (headersMissingEmotion.length > 0) {
        violations.push({
            content: '场景头必须包含【核心情绪：X】标签',
            evidence: `命中${headersMissingEmotion.length}个场景头缺情绪标签：${samples(headersMissingEmotion.map(l => l.trim().slice(0, 24)))}`,
            severity: 'important',
            suggestion: '为每个场景头补【核心情绪：单一情绪词】',
        });
    }

    // 缺出场人物行
    if (!/出场人物[：:]/.test(content)) {
        violations.push({
            content: '集标题下必须有"出场人物："行',
            evidence: '全文未检出"出场人物："标记',
            severity: 'important',
            suggestion: '在集标题下一行补"出场人物：角色A、角色B"',
        });
    }

    return violations;
}
