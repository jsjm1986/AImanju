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

        if (config.sourcePreset === 'overseas_drama') {
            lines.push(`- **字数要求**：每集按"中文字数+英文台词词数"计，控制在 **${wordLimit.min}-${wordLimit.target}** 之间，上限 **${wordLimit.max}**（英文台词按词计，不按字母计）。`);
        } else {
            lines.push(`- **字数要求**：每集实际内容严格控制在 **${wordLimit.min}-${wordLimit.target}字** 之间，上限 **${wordLimit.max}字**。`);
        }
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
 * - 剥离集标题前的 markdown 标题符（## 第1集 → 第 1 集）
 * - 集标题空格归一：第1集 → 第 1 集（对齐正样本排版）
 * - 内心独白变体归一：(VO)/(V.O)/(v.o.) → (V.O.)
 * - 中文名与英文名粘连补空格：ClaudiaCLAUDIA( → Claudia CLAUDIA(
 * - 场标序号后多空格归一为单空格
 * - 剥离内部标记泄漏：[HOOK]行、【核心情绪：X】标签、△前缀、出场人物行→人物行
 * - 剔除 --- 集分隔线（正样本为空行分隔）
 */
export function normalizeOverseasScript(content: string): string {
    return content
        .replace(/^#{1,6}\s*(第\s*\d+\s*集[^\n]*)/gm, '$1')
        .replace(/^第\s*(\d+)\s*集/mg, '第 $1 集')
        .replace(/\((?:V\.?O\.?|v\.?o\.?)\)/g, '(V.O.)')
        .replace(/([a-z\u4e00-\u9fa5'’.\-])([A-Z]{2,}[A-Za-z'’.]*)\s*(?=[（(])/g, '$1 $2')
        .replace(/([A-Z])['’]\s+([A-Z])/g, "$1'$2")
        .replace(/^(\d+-\d+) {2,}/gm, '$1 ')
        .replace(/【核心情绪[：:][^】]*】/g, '')
        .replace(/^△\s*/gm, '')
        .replace(/^(特写|大特写|慢镜头|升格镜头|主观视角)[：:]\s*/gm, '{$1}')
        .replace(/^闪回[：:]\s*/gm, '【闪回】')
        .replace(/^闪出[：:]\s*/gm, '【闪出】')
        .replace(/^出场人物[：:]/gm, '人物：')
        .replace(/^\s*\[HOOK\][^\n]*$/gm, '')
        .replace(/^\s*-{3,}\s*$/gm, '');
}

export interface OverseasScanViolation {
    content: string;
    evidence: string;
    severity: 'important' | 'normal';
    suggestion: string;
}

/** 场景头：`1-5 农场-卧室 日 内`（行业标准空格分隔，可带【闪回】） */
const SCENE_HEADER_RE = /^\d+-\d+\s+\S/;
/** 场景级人物行 */
const CAST_LINE_RE = /^人物[：:]/;
/** 合并双语台词行：`Claudia CLAUDIA(Smiling brightly)：English line`（中文名 英文名（英文情绪）：英文台词） */
const DIALOGUE_LINE_RE = /^[^\s：:（(\[【]{1,12}\s+[A-Za-z][A-Za-z'’.\- ]*\s*(?:（[^）]{1,40}）|\([^)]{1,60}\))?[：:](.+)$/;
/** 台词行前的行型（非台词判定；字幕/黑屏允许带括号变体如"字幕（特写）："；{起始为镜头指令行） */
const NON_DIALOGUE_RE = /^(人物|字幕|黑屏)(?:[（(][^）)]{0,20}[）)])?[：:]|^第\s*\d+\s*集|^【|^【闪出】|^\{/;
/** 道具/画面文字行（"纸上写着：GHOST""收款人一栏：D. Ricci""页眉一行黑体：许可证"等）——含冒号但非台词 */
const PROP_TEXT_RE = /^[^\s：:（(【\[]{0,10}(?:写着|显示|备注|打字|刻着|标明|打印|字样|一栏|一行字|一行|页眉|封面|标题|落款|签名|红章|抬头|横幅|弹窗|推送|截图|弹幕|字幕条|提示|公告|新闻|头条|黑体|红字|大字|小字|粗体|斜体|英文|编号|日期|金额|姓名|账号|电话|地址)[：:]/;
const ENGLISH_WORD_RE = /[A-Za-z]{2,}/;

/**
 * 海外短剧格式的确定性正则扫描（不依赖 AI 判断，命中即确凿违规）。
 * 对齐《批量剧制作流程》交付格式：合并双语台词、行业标准场记、场景级人物行、无内部标记。
 */
export function scanOverseasScript(content: string, wordLimitMax?: number, sceneMax?: number): OverseasScanViolation[] {
    const violations: OverseasScanViolation[] = [];
    const samples = (arr: string[], n = 3) => arr.slice(0, n).join('；');
    const lines = content.split('\n');

    // ---- 弱动作句式（动作描写仍是中文，沿用） ----
    const weakHits = (content.match(/[^，。！？\n「」()（）]{1,10}了[一二]?[下拍声秒]/g) || [])
        .filter(h => {
            const m = h.match(/(.)了[一二]?([下拍声秒])$/);
            return !(m && m[1] === m[2]);
        });
    if (weakHits.length > 0) {
        violations.push({
            content: '弱动作句式禁止：全文不得出现"动词+了一下/一拍/一声/两秒"式收笔，动作必须写到具体落点',
            evidence: `命中${weakHits.length}处，如：${samples(weakHits)}`,
            severity: 'normal',
            suggestion: '把"了一下"式收笔改写为有落点的具体动作',
        });
    }

    // ---- 台词括号内中文情绪（生产格式硬契约：下游配音/翻译管线依赖英文描述） ----
    const cnEmotionHits: string[] = [];
    for (const raw of lines) {
        const t = raw.trim();
        if (!DIALOGUE_LINE_RE.test(t)) continue;
        for (const pm of t.matchAll(/[（(]([^）)]*)[）)]/g)) {
            if (/[\u4e00-\u9fa5]/.test(pm[1])) cnEmotionHits.push(`(${pm[1]})`);
        }
    }
    if (cnEmotionHits.length > 0) {
        violations.push({
            content: '台词情绪必须为英文：括号内情绪/动作描述不得使用中文',
            evidence: `命中${cnEmotionHits.length}处：${samples(cnEmotionHits)}`,
            severity: 'important',
            suggestion: '改为英文可表演状态，如 (Quietly)/(Voice low)/(Gritting teeth)',
        });
    }

    // ---- 非台词行中文抽象语气括号残留 ----
    const nonDlgLines = lines.filter(l => !DIALOGUE_LINE_RE.test(l.trim())).join('\n');
    const baseParenHits: string[] = nonDlgLines.match(/（低[声音量]）|（压低声）|（压低声音）|（轻声）|（小声）|（语气平静）/g) || [];
    if (baseParenHits.length > 0) {
        violations.push({
            content: '抽象括号禁止：对白括号内不得出现中文抽象语气词，情绪/动作描述须用英文',
            evidence: `命中${baseParenHits.length}处：${samples(baseParenHits)}`,
            severity: 'normal',
            suggestion: '情绪描述改为英文可表演状态，如 (Quietly)/(Voice low)',
        });
    }

    // ---- V.O. 密度 ----
    const voCount = (content.match(/\(V\.O\.\)/g) || []).length
        + (content.match(/OS[（(]|\bOS[：:]/g) || []).length;
    if (voCount > 4) {
        violations.push({
            content: 'V.O.边界：内心独白/画外音仅用于情绪与潜台词，单集不得超过4条；禁止用V.O.交代剧情信息',
            evidence: `本集V.O.共${voCount}条，超阈值`,
            severity: 'important',
            suggestion: '将交代信息的V.O.改写为道具行为或高压对白，仅保留纯情绪V.O.',
        });
    }

    // ---- 字数上限（双语口径：中文字数+英文词数，英文台词不按字母计） ----
    const cnChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const enWords = (content.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
    const effectiveLen = cnChars + enWords;
    if (wordLimitMax && effectiveLen > wordLimitMax) {
        violations.push({
            content: `字数上限：每集不得超过${wordLimitMax}字（中文字+英文词口径）`,
            evidence: `本集等效${effectiveLen}字（中文${cnChars}+英文词${enWords}），超出${effectiveLen - wordLimitMax}字`,
            severity: effectiveLen > wordLimitMax * 1.5 ? 'important' : 'normal',
            suggestion: '压缩重复信息与弱功能场景至字数范围内',
        });
    }

    // ---- 内部标记泄漏（交付稿不得出现） ----
    const leakHits = content.match(/\[HOOK\]|【核心情绪[：:]|^△|出场人物[：:]|[A-Za-z\u4e00-\u9fa5]OS[：:]|[A-Za-z\u4e00-\u9fa5]VO[：:]|^#{1,6}\s/gm) || [];
    if (leakHits.length > 0) {
        violations.push({
            content: '内部标记泄漏：交付剧本不得出现[HOOK]/【核心情绪】/△/出场人物/OS：/VO：/markdown标题符',
            evidence: `命中${leakHits.length}处：${samples(leakHits)}`,
            severity: 'important',
            suggestion: '删除内部标记；场景头用行业标准格式，情绪描述写进台词括号内',
        });
    }

    // ---- 场景头存在性与人物行配对 ----
    const sceneHeaderIdx: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (SCENE_HEADER_RE.test(lines[i].trim())) sceneHeaderIdx.push(i);
    }
    if (sceneHeaderIdx.length === 0) {
        violations.push({
            content: '缺少场景头（格式：集-场 地点 时间 内/外，如 1-5 农场-卧室 日 内）',
            evidence: '全文未检出场景头',
            severity: 'important',
            suggestion: '为每场补标准场景头行',
        });
    }
    if (sceneMax && sceneHeaderIdx.length > sceneMax) {
        violations.push({
            content: `场景数超限：本集${sceneHeaderIdx.length}场，超出规范上限${sceneMax}场`,
            evidence: `检出场景头${sceneHeaderIdx.length}个`,
            severity: 'normal',
            suggestion: '合并弱功能场景或压缩过场戏，集中主场景推进',
        });
    }

    // ---- 花括号镜头指令混入拍摄执行参数（实测泄漏：{固定镜头-肩部以上构图-持续3秒}） ----
    const execCamHits = lines.filter(l => /^\{[^}\n]*(\d+\s*秒|\d+\s*帧|持续\d|构图|机位|景别|运镜)[^}\n]*\}/.test(l.trim()));
    if (execCamHits.length > 0) {
        violations.push({
            content: '镜头指令含拍摄执行参数：花括号内只写镜头类型/视角标签，不得写时长/构图/机位',
            evidence: `命中${execCamHits.length}处：${samples(execCamHits)}`,
            severity: 'normal',
            suggestion: '改为纯镜头标签，如 {特写} {升格+慢镜头} {主观视角}；情绪节拍用动作描写表达',
        });
    }

    const missingCast: string[] = [];
    const hardCuts: string[] = [];
    const nonEmptyLine = (idx: number, dir: number) => {
        for (let j = idx + dir; j >= 0 && j < lines.length; j += dir) {
            const t = lines[j].trim();
            if (t) return t;
        }
        return '';
    };
    for (const i of sceneHeaderIdx) {
        const next = nonEmptyLine(i, 1);
        if (!CAST_LINE_RE.test(next)) {
            missingCast.push(lines[i].trim().slice(0, 24));
            continue;
        }
        // 人物行之后首行应是动作/镜头行（对白直接开场=硬切）
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (CAST_LINE_RE.test(lines[j]?.trim() ?? '')) {
            j++;
            while (j < lines.length && !lines[j].trim()) j++;
        }
        const afterCast = (lines[j] ?? '').trim();
        if (afterCast && DIALOGUE_LINE_RE.test(afterCast) && !/^\{/.test(afterCast)) {
            hardCuts.push(`${lines[i].trim().slice(0, 16)}… → ${afterCast.slice(0, 20)}…`);
        }
    }
    if (missingCast.length > 0) {
        violations.push({
            content: '场景人物行缺失：每个场景头下一行必须有"人物：角色A、角色B"',
            evidence: `命中${missingCast.length}个场景缺人物行：${samples(missingCast)}`,
            severity: 'important',
            suggestion: '在每个场景头紧接的下一行补"人物：…"（仅列本场上场角色）',
        });
    }
    if (hardCuts.length > 0) {
        violations.push({
            content: '场景开场硬切：人物行后直接接台词，缺少开场动作描写建立画面',
            evidence: `命中${hardCuts.length}处：${samples(hardCuts)}`,
            severity: 'normal',
            suggestion: '在人物行后补一条中文动作描写（可含{镜头指令}）再给台词',
        });
    }

    // ---- 台词合规：冒号行必须是合并双语格式，且台词内容为英文 ----
    const badDialogue: string[] = [];
    const cnDialogue: string[] = [];
    const mixedDialogue: string[] = [];
    const longDialogue: string[] = [];
    for (const raw of lines) {
        const t = raw.trim();
        if (!t || NON_DIALOGUE_RE.test(t) || PROP_TEXT_RE.test(t) || SCENE_HEADER_RE.test(t)) continue;
        if (!/[：:]/.test(t)) continue; // 无冒号=动作行
        const m = t.match(DIALOGUE_LINE_RE);
        if (!m) {
            // 有冒号但不是合并双语行（旧式"角色名：台词"/"角色名（中文状态）：台词"）；
            // 冒号前词≤6字视为说话人位（动作行的句中冒号前缀通常更长，规避误报）
            if (/^[^\s：:（(【\[]{1,6}(?:（[^）]{0,20}）|\([^)]{0,30}\))?[：:]/.test(t)) {
                badDialogue.push(t.slice(0, 30));
            }
            continue;
        }
        const spoken = m[1].trim();
        if (!ENGLISH_WORD_RE.test(spoken)) {
            cnDialogue.push(t.slice(0, 34));
        } else if (/[\u4e00-\u9fff]/.test(spoken)) {
            mixedDialogue.push(t.slice(0, 40));
        }
        if (spoken.length > 110) {
            longDialogue.push(t.slice(0, 40));
        }
    }
    if (badDialogue.length > 0) {
        violations.push({
            content: '台词必须为合并双语单行：中文名 英文名（英文情绪）：英文台词',
            evidence: `命中${badDialogue.length}行非双语台词：${samples(badDialogue)}`,
            severity: 'important',
            suggestion: '改写为 Claudia CLAUDIA(Smiling brightly)：English line 结构',
        });
    }
    if (cnDialogue.length > 0) {
        violations.push({
            content: '英文台词缺失：冒号后必须是英文原声文案（美式口语），不得用中文',
            evidence: `命中${cnDialogue.length}行中文台词：${samples(cnDialogue)}`,
            severity: 'important',
            suggestion: '将台词正文改写为英文原声（中文名/情绪保留，台词用英文）',
        });
    }
    if (mixedDialogue.length > 0) {
        violations.push({
            content: '英文台词混入中文字符：配音稿英文部分必须是纯英文（术语/名词需本地化翻译，不得留中文）',
            evidence: `命中${mixedDialogue.length}行：${samples(mixedDialogue)}`,
            severity: 'important',
            suggestion: '把台词里的中文词改写为英文对应表达（如"灰石碱"→"grayscale alkali"）',
        });
    }
    if (longDialogue.length > 0) {
        violations.push({
            content: '英文台词过长：单句英文台词建议≤80字符（约15词），超长需拆行',
            evidence: `命中${longDialogue.length}行：${samples(longDialogue)}`,
            severity: 'normal',
            suggestion: '拆成两句或删冗余修饰，保留短促有力的口语',
        });
    }

    // ---- 双语名块：英文名块畸形 + 同一中文名对应多个不相关英文名 ----
    // 实测缺陷样例：`Vera HALF- VOICE(Hands to mouth)`——情绪词被写进名字槽位
    const NAME_BLOCK_RE = /^([^\s：:（(\[【]{1,12})\s+([A-Za-z][A-Za-z'’.\- ]*?)\s*(?:（[^）]{1,40}）|\([^)]{1,60}\))?[：:]/;
    const malformedEnNames: string[] = [];
    const cnToEn = new Map<string, Set<string>>();
    for (const raw of lines) {
        const t = raw.trim();
        if (!t || NON_DIALOGUE_RE.test(t) || PROP_TEXT_RE.test(t) || SCENE_HEADER_RE.test(t) || !DIALOGUE_LINE_RE.test(t)) continue;
        const m = t.match(NAME_BLOCK_RE);
        if (!m) continue;
        const cnName = m[1];
        const enName = m[2].trim().toUpperCase();
        if (/[-–—]\s|\s[-–—]|\d/.test(enName)) {
            malformedEnNames.push(`${cnName} ${m[2].trim()}`);
        }
        if (!cnToEn.has(cnName)) cnToEn.set(cnName, new Set());
        cnToEn.get(cnName)!.add(enName);
    }
    if (malformedEnNames.length > 0) {
        violations.push({
            content: '英文名块畸形：台词名块中的英文名含连字符断词或数字（情绪词被误写进名字槽位）',
            evidence: `命中${malformedEnNames.length}处：${samples(malformedEnNames)}`,
            severity: 'important',
            suggestion: '英文名块写人物卡中的完整英文名（大写），情绪/动作写进括号内',
        });
    }
    const nameConflicts: string[] = [];
    // 称谓/角色描述词作首词时不是唯一身份（"Uncle Hale"/"Uncle Tom"共享首词），跳过防误报
    const TITLE_PREFIXES = new Set(['Uncle','Aunt','Mr','Mrs','Miss','Ms','Dr','Sheriff','Professor','Father','Mother','Brother','Sister','Lady','Lord','Old','Young','Officer','Agent','Captain','Boss','King','Queen','Prince','Princess','Grandpa','Grandma','打手','保镖','女仆','管家','佣人','司机','医生','护士','手下','老大','老板','助理','秘书','仆人','侍从','卫兵','执事']);
    for (const [cn, ens] of cnToEn) {
        if (ens.size <= 1 || TITLE_PREFIXES.has(cn)) continue;
        const arr = [...ens];
        // 互为包含或共享任一词元（"VERA" vs "VERA HALE"）视为同一名的简繁写法，不算冲突；
        // 昵称前缀（"GIO" vs "GIOVANNI"）按前缀包含放行，避免误报
        const unrelated = arr.some(a => arr.some(b =>
            a !== b &&
            !a.split(/\s+/).some(tok => b.split(/\s+/).includes(tok)) &&
            !a.startsWith(b) && !b.startsWith(a)
        ));
        if (unrelated) nameConflicts.push(`${cn}→${arr.join('/')}`);
    }
    if (nameConflicts.length > 0) {
        violations.push({
            content: '双语名块不一致：同一中文名对应多个互不相同的英文名',
            evidence: `命中${nameConflicts.length}处：${samples(nameConflicts)}`,
            severity: 'important',
            suggestion: '全剧统一为人物卡中的英文名（大写），不得换用其他词',
        });
    }

    return violations;
}
