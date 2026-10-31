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

        const fillDialogue = (tpl: string) => tpl
            .replace('{name}', '张三')
            .replace('{cnName}', '张三')
            .replace('{EnName}', 'Zhang San')
            .replace('{cnEmotion}', '冷笑')
            .replace('{enEmotion}', 'Sneering')
            .replace('{cnContent}', '你来了')
            .replace('{enContent}', 'You came')
            .replace('{state}', '冷笑')
            .replace('{content}', '你来了');

        const dialogueExample = fillDialogue(dialogue.normal);
        const stateDialogueExample = fillDialogue(dialogue.withState);
        const narratorExample = dialogue.narrator
            .replace('{content}', '三年后...')
            .replace('{cnContent}', '三年后...')
            .replace('{enContent}', 'Three years later...');

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

/** 阿拉伯数字→中文数字（1-199，覆盖常规集数） */
function toCnNum(n: number): string {
    const d = '零一二三四五六七八九';
    if (n <= 10) return n === 10 ? '十' : d[n];
    if (n < 20) return `十${d[n % 10]}`;
    if (n < 100) return `${d[Math.floor(n / 10)]}十${n % 10 ? d[n % 10] : ''}`;
    return `${d[Math.floor(n / 100)]}百${n % 100 ? toCnNum(n % 100) : ''}`;
}

/** 时间词集合（场景头用） */
const TIME_WORDS = '日|夜|清晨|凌晨|傍晚|黄昏|深夜|上午|下午|中午|黎明|拂晓';
/** 场景头（新标准）：`9-2 夜/内 王宫·杀阵中枢暗室`；时间槽可为复合段（`1-3 三个月前/夜/内 王室星耀宴会大厅`），内外永远是最后一个斜杠段 */
const SCENE_HEADER_STD_RE = /^\d+-\d+\s+\S+\s*\/\s*(?:内|外|内外)\s+\S/;
/** 旧式场景头（归一化用）：`1-5 农场-溪边 日 外` — 地点+时间+内外顺序 */
const SCENE_HEADER_LEGACY_RE = new RegExp(`^(\\d+)-(\\d+)\\s+(.+?)\\s+(${TIME_WORDS})\\s+(内\\/外|外\\/内|内|外)\\s*$`);

/**
 * 海外短剧格式的机械性归一化（中英台词对照标准，仅处理排版漂移，不改内容语义）：
 * - 集标题归一为"第X话"中文数字（第10集/EP10/第十集 → 第十话）
 * - 旧式场景头（地点 时间 内外）转为新式（时间/内外 地点·子场景）
 * - 剥离集标题前的 markdown 标题符
 * - 内心独白变体归一：(VO)/(v.o.) → (V.O.)
 * - 动作行缺▲补▲；△空心三角→▲实心
 * - 人物行分隔符归一为半角逗号（、→", "）
 * - 剥离内部标记泄漏：[HOOK]行、【核心情绪：X】标签、出场人物行→人物行
 * - 剔除 --- 集分隔线
 */
export function normalizeOverseasScript(content: string): string {
    const out = content
        .replace(/^#{1,6}\s*(第[^\n]{0,20})/gm, '$1')
        .replace(/\((?:V\.?O\.?|v\.?o\.?)\)/g, '(V.O.)')
        .replace(/【核心情绪[：:][^】]*】/g, '')
        .replace(/^(特写|大特写|慢镜头|升格镜头|主观视角)[：:]\s*/gm, '{$1}')
        .replace(/^闪回[：:]\s*/gm, '【闪回】')
        .replace(/^闪出[：:]\s*/gm, '【闪出】')
        .replace(/^出场人物[：:]/gm, '人物：')
        .replace(/^\s*\[HOOK\][^\n]*$/gm, '')
        .replace(/^\s*-{3,}\s*$/gm, '')
        .replace(/^△\s*/gm, '▲');
    const lines = out.split('\n').map((raw) => {
        const t = raw.trim();
        if (!t) return raw;
        // 集标题：第10集/第十集/第10话/EP 10 → 第十话
        const ep = t.match(/^第\s*([0-9]+|[一二三四五六七八九十百零〇]+)\s*(?:集|话|章)\s*(?:[:：].*)?$|^EP\.?\s*([0-9]+)\s*$/i);
        if (ep) {
            const num = ep[1]
                ? (/^\d+$/.test(ep[1]) ? Number(ep[1]) : cnNumParse(ep[1]))
                : Number(ep[2]);
            if (Number.isFinite(num)) return `第${toCnNum(num)}话`;
        }
        // 旧式场景头 → 新式（时间/内外 地点·子）
        const sc = t.match(SCENE_HEADER_LEGACY_RE);
        if (sc && !SCENE_HEADER_STD_RE.test(t)) {
            const loc = sc[3].replace(/[\s-]+/g, '·').replace(/·{2,}/g, '·').replace(/^·|·$/g, '');
            return `${sc[1]}-${sc[2]} ${sc[4]}/${sc[5]} ${loc}`;
        }
        // 人物行分隔符归一
        if (/^人物[：:]/.test(t)) {
            return `人物：${t.replace(/^人物[：:]\s*/, '').split(/[、，,;；]/).map(s => s.trim()).filter(Boolean).join(', ')}`;
        }
        return raw;
    });
    // 动作行补▲：非空、非场景头/人物/标题/方括号/花括号/台词行，且含中文、不以▲开头
    return lines.map((raw) => {
        const t = raw.trim();
        if (!t || t.startsWith('▲') || t.startsWith('{') || t.startsWith('【')) return raw;
        if (SCENE_HEADER_STD_RE.test(t) || /^人物[：:]/.test(t) || /^第[一二三四五六七八九十百零〇\d]+话/.test(t)) return raw;
        if (PAIRED_DIALOGUE_RE.test(t) || PROP_TEXT_RE.test(t)) return raw;
        if (/^[^\s：:（(【\[]{1,15}(?:（[^）]{0,30}）|\([^)]{0,40}\))?[：:]/.test(t)) return raw; // 含冒号行（台词/疑似台词）不改
        if (/[一-鿿]/.test(t)) return `▲${t}`;
        return raw;
    }).join('\n');
}

/** 中文数字→阿拉伯数字（1-199） */
function cnNumParse(s: string): number {
    const d: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (s === '十') return 10;
    const b = s.indexOf('百');
    if (b >= 0) return (d[s[0]] ?? 1) * 100 + (b + 1 < s.length ? cnNumParse(s.slice(b + 1)) : 0);
    const i = s.indexOf('十');
    if (i < 0) return d[s] ?? NaN;
    return (i === 0 ? 1 : (d[s[0]] ?? NaN)) * 10 + (i + 1 < s.length ? (d[s[i + 1]] ?? NaN) : 0);
}

export interface OverseasScanViolation {
    content: string;
    evidence: string;
    severity: 'important' | 'normal';
    suggestion: string;
}

/** 场景头：`9-2 夜/内 王宫·杀阵中枢暗室` */
const SCENE_HEADER_RE = SCENE_HEADER_STD_RE;
/** 场景级人物行 */
const CAST_LINE_RE = /^人物[：:]/;
/** 中英对照台词行：`中文名（中文情绪）：中文台词English Name (English Emotion): English line`
 * 结构：中文名 + 全角括号中文情绪 + 全角冒号 + 中文台词 + 英文名(首字母大写,可含空格) + 半角括号英文情绪 + 半角冒号 + 英文台词 */
const PAIRED_DIALOGUE_RE = /^([^\s（(：:▲【]{1,15})（([^（）]{1,30})）：(.+?)([A-Z][A-Za-z'’&.\-#0-9 ]{0,45}?)\s*\(([^()]{1,70})\)\s*:\s*(.+)$/;
/** 旧合并格式/畸形名块探测（提示改写）：`Name EN(emo)：...` 或 `中文名 英文名(...)...` */
const LEGACY_DIALOGUE_HINT_RE = /^[^\s：:（(\[【]{1,15}\s+[A-Z][A-Za-z'’.\- ]*\s*(?:（[^）]{1,40}）|\([^)]{1,60}\))?[：:]/;
/** 中英分行台词-中文头：`凯（眼神冰冷）：祖父，你最好祈祷我死透。`（下一行须为英文对照行） */
const CN_PAIR_HEAD_RE = /^[^\s（(：:▲【]{1,15}（[^（）]{1,30}）：\S/;
/** 中英分行台词-英文尾：`Kai (Cold, clear voice): Grandfather...` 或 `Harlan faked a smile to ragged Kai: "Family..."`（名块可带动作描述，台词须非中文开头） */
const EN_PAIR_TAIL_RE = /^[A-Z][A-Za-z'’&.,\-#0-9 ]{0,55}?(?:\([^()]{1,100}\))?\s*:\s*[^\s一-鿿].*$/;
/** -VO- 旁白行（docx 合法交付格式，形式不限：-VO-：中文 / -VO- Name (Emotion): EN / -VO-：高燃BGM骤起） */
const VO_NARRATOR_RE = /^-VO-/;
/** 非台词行型（人物行/字幕/黑屏/集标题/方括号标记/花括号镜头/场景头/▲动作） */
const NON_DIALOGUE_RE = /^(人物|字幕|黑屏)(?:[（(][^）)]{0,20}[）)])?[：:]|^第[一二三四五六七八九十百零〇\d]+\s*[话集]|^【|^\{|^▲/;
/** 道具/画面文字行（"纸上写着：GHOST""收款人一栏：D. Ricci""页眉一行黑体：许可证"等）——含冒号但非台词 */
const PROP_TEXT_RE = /^[^\s：:（(【\[]{0,10}(?:写着|显示|备注|打字|刻着|标明|打印|字样|一栏|一行字|一行|页眉|封面|标题|落款|签名|红章|抬头|横幅|弹窗|推送|截图|弹幕|字幕条|提示|公告|新闻|头条|黑体|红字|大字|小字|粗体|斜体|英文|编号|日期|金额|姓名|账号|电话|地址|照片|相片|监控|录像|画面|屏幕|海报|报纸|网页|邮件|短信|文件|报告|名单|清单|病历|合同|证件|档案|报纸头版|头版|配图)[：:]/;
const ENGLISH_WORD_RE = /[A-Za-z]{2,}/;
const CJK_RE = /[一-鿿]/;

/** 方法论自检/质检报告等元信息泄漏检测——所有格式通用（海外另有完整格式扫描）。
 * 命中即重要级违规：这些内容是生成过程的元产物，不是交付剧本的一部分。 */
const META_LEAK_RE = /【自检评分】|【质检报告】|【评分表】|【自检报告】|质检报告[:：]|自检评分[:：]|开场钩子评分|爽点评分表|认知负荷判断|结尾钩子评分|已执行的优化动作/;
export function scanMetaLeak(content: string): OverseasScanViolation[] {
    const hits = (content.match(new RegExp(META_LEAK_RE.source, 'g')) || []);
    if (hits.length === 0) return [];
    return [{
        content: '元信息泄漏：剧本正文不得包含自检评分/质检报告段（生成过程的元产物，不属于交付剧本）',
        evidence: `命中${hits.length}处：${[...new Set(hits)].slice(0, 4).join('、')}`,
        severity: 'important',
        suggestion: '删除评分报告段落，只保留剧本本体（场景/人物/台词/动作）',
    }];
}

/** 国内短剧台词行：「角色名（情绪）：台词」——名字≤12字、允许空括号 */
const DOMESTIC_DIALOGUE_RE = /^[^\s△（(【{：:]{1,12}(?:（[^）]{0,20}）)?[：:](.+)$/;
const DOMESTIC_NON_DIALOGUE_PREFIX = /^(人物|场景|字幕|黑屏|地点|时间|梗概|第\s*\d+\s*集|【|\{|\d+-\d+)/;
const DIALOGUE_PUNCT_RE = /[\s，。！？…—、·：；！?,.:"'（）()【】「」]/g;

/** 国内短剧对白长度确定性检测：对白应以≤15字短句为主，命中超长句/大面积超限即提示 */
export function scanDomesticDialogue(content: string): OverseasScanViolation[] {
    const violations: OverseasScanViolation[] = [];
    const over15: string[] = [];
    const over25: string[] = [];
    let dialogueCount = 0;
    for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (!line || DOMESTIC_NON_DIALOGUE_PREFIX.test(line)) continue;
        const m = line.match(DOMESTIC_DIALOGUE_RE);
        if (!m) continue;
        dialogueCount += 1;
        const speechLen = m[1].replace(DIALOGUE_PUNCT_RE, '').length;
        if (speechLen > 25) over25.push(`${speechLen}字|${line.slice(0, 30)}`);
        else if (speechLen > 15) over15.push(`${speechLen}字|${line.slice(0, 30)}`);
    }
    if (over25.length > 0) {
        violations.push({
            content: '对白长句：存在25字以上单句对白，短剧台词须短平快',
            evidence: `${over25.length}句：${over25.slice(0, 3).join('；')}`,
            severity: 'normal',
            suggestion: '拆拍：先一句短句定性，再用动作或短句补信息（如"资产保全，赵德海递的"△动作"案号三天就批"）',
        });
    }
    if (dialogueCount >= 8 && (over15.length + over25.length) / dialogueCount > 0.35) {
        violations.push({
            content: '对白整体偏长：超过15字的台词占比过高，短剧应以15字内短句为主体',
            evidence: `${dialogueCount}句对白中${over15.length + over25.length}句超15字（${Math.round((over15.length + over25.length) / dialogueCount * 100)}%）`,
            severity: 'normal',
            suggestion: '压缩台词长度，信息密集处拆成两拍：短句定性+动作/短句补充',
        });
    }
    return violations;
}


/**
 * 海外短剧格式的确定性正则扫描（中英台词对照标准，不依赖 AI 判断，命中即确凿违规）。
 * 对齐交付规范：第X话标题、集-场 时间/内外 地点场景头、人物行、▲动作行、中英对照同行台词。
 */
export function scanOverseasScript(content: string, wordLimitMax?: number, sceneMax?: number): OverseasScanViolation[] {
    const violations: OverseasScanViolation[] = [];
    const samples = (arr: string[], n = 3) => arr.slice(0, n).join('；');
    const lines = content.split('\n');

    // ---- 弱动作句式 ----
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

    // ---- 字数上限（中文字+英文词口径） ----
    const cnChars = (content.match(/[一-鿿]/g) || []).length;
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

    // ---- 内部标记泄漏（▲/【卡点】/【字幕：】/【闪回】【闪出】为合法交付标记） ----
    const leakHits = content.match(/\[HOOK\]|【核心情绪[：:]|^△|出场人物[：:]|^[^\s（(：:▲【]{1,15}(?:OS|VO)[：:]|^#{1,6}\s/gm) || [];
    if (leakHits.length > 0) {
        violations.push({
            content: '内部标记泄漏：交付剧本不得出现[HOOK]/【核心情绪】/△/出场人物/OS：/VO：/markdown标题符',
            evidence: `命中${leakHits.length}处：${samples(leakHits)}`,
            severity: 'important',
            suggestion: '删除内部标记；合法交付标记只有▲动作、【卡点】、【字幕：】、【闪回】/【闪出】',
        });
    }

    // ---- 场景头存在性 ----
    const sceneHeaderIdx: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (SCENE_HEADER_RE.test(lines[i].trim())) sceneHeaderIdx.push(i);
    }
    if (sceneHeaderIdx.length === 0) {
        violations.push({
            content: '缺少场景头（格式：集-场 时间/内外 地点·子场景，如 9-2 夜/内 王宫·杀阵中枢暗室）',
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

    // ---- 花括号镜头指令混入拍摄执行参数 ----
    const execCamHits = lines.filter(l => /^\{[^}\n]*(\d+\s*秒|\d+\s*帧|持续\d|构图|机位|景别|运镜)[^}\n]*\}/.test(l.trim()));
    if (execCamHits.length > 0) {
        violations.push({
            content: '镜头指令含拍摄执行参数：花括号内只写镜头类型/视角标签，不得写时长/构图/机位',
            evidence: `命中${execCamHits.length}处：${samples(execCamHits)}`,
            severity: 'normal',
            suggestion: '改为纯镜头标签，如 {特写} {升格+慢镜头} {主观视角}',
        });
    }

    // ---- 人物行配对 + 硬切检查 ----
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
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (CAST_LINE_RE.test(lines[j]?.trim() ?? '')) {
            j++;
            while (j < lines.length && !lines[j].trim()) j++;
        }
        const afterCast = (lines[j] ?? '').trim();
        if (afterCast && PAIRED_DIALOGUE_RE.test(afterCast)) {
            hardCuts.push(`${lines[i].trim().slice(0, 16)}… → ${afterCast.slice(0, 20)}…`);
        }
    }
    if (missingCast.length > 0) {
        violations.push({
            content: '场景人物行缺失：每个场景头下一行必须有"人物：角色A, 角色B"（半角逗号分隔）',
            evidence: `命中${missingCast.length}个场景缺人物行：${samples(missingCast)}`,
            severity: 'important',
            suggestion: '在每个场景头下一行补"人物：…"（仅列本场上场角色）',
        });
    }
    if (hardCuts.length > 0) {
        violations.push({
            content: '场景开场硬切：人物行后直接接台词，缺少▲动作描写建立画面',
            evidence: `命中${hardCuts.length}处：${samples(hardCuts)}`,
            severity: 'normal',
            suggestion: '在人物行后补一条▲动作描写再给台词',
        });
    }

    // ---- 台词合规：中英对照同行 ----
    const badDialogue: string[] = [];
    const noCnSpeech: string[] = [];
    const noCnName: string[] = [];
    const enEmotionBad: string[] = [];
    const mixedDialogue: string[] = [];
    const longDialogue: string[] = [];
    const missingTriangle: string[] = [];
    const cnToEn = new Map<string, Set<string>>();
    const nextNonEmptyOf = (from: number) => {
        for (let j = from + 1; j < lines.length; j++) {
            const x = lines[j].trim();
            if (x) return x;
        }
        return '';
    };
    let prevNonEmpty = '';
    for (let li = 0; li < lines.length; li++) {
        const t = lines[li].trim();
        if (!t) continue;
        // -VO- 旁白行（docx 合法交付标记，中英各一行）
        if (VO_NARRATOR_RE.test(t)) { prevNonEmpty = t; continue; }
        // ▲开头的行里若藏"名字(情绪): 文本"结构＝台词行误加▲且名块结构错误（真实缺陷样例：▲Camela (Cold Fury): 中文。English.）
        if (t.startsWith('▲')) {
            if (/^▲\s*[^\s（(：:]{1,15}\s*\([^)]{1,60}\)\s*[:：]/.test(t)) {
                badDialogue.push(t.slice(0, 44));
            }
            prevNonEmpty = t;
            continue;
        }
        if (SCENE_HEADER_RE.test(t) || CAST_LINE_RE.test(t) || NON_DIALOGUE_RE.test(t)) { prevNonEmpty = t; continue; }
        if (PROP_TEXT_RE.test(t)) { prevNonEmpty = t; continue; }
        const m = t.match(PAIRED_DIALOGUE_RE);
        if (m) {
            const [, cnName, , cnSpeech, enName, enEmotion, enSpeech] = m;
            if (!CJK_RE.test(cnSpeech)) noCnSpeech.push(t.slice(0, 46));
            if (!CJK_RE.test(cnName)) noCnName.push(`${cnName}`);
            if (CJK_RE.test(enEmotion)) enEmotionBad.push(`(${enEmotion.slice(0, 24)})`);
            if (CJK_RE.test(enSpeech)) mixedDialogue.push(t.slice(0, 46));
            if (enSpeech.length > 170) longDialogue.push(t.slice(0, 46));
            if (!cnToEn.has(cnName)) cnToEn.set(cnName, new Set());
            cnToEn.get(cnName)!.add(enName.trim().toUpperCase());
            prevNonEmpty = t;
            continue;
        }
        // 中英分行台词：中文头行下一非空行须为英文对照行；英文尾行上一非空行须为中文头
        if (CN_PAIR_HEAD_RE.test(t) && EN_PAIR_TAIL_RE.test(nextNonEmptyOf(li))) {
            prevNonEmpty = t;
            continue;
        }
        if (EN_PAIR_TAIL_RE.test(t) && CN_PAIR_HEAD_RE.test(prevNonEmpty)) {
            prevNonEmpty = t;
            continue;
        }
        if (/[：:]/.test(t) && (/^[^\s：:（(【\[]{1,15}(?:（[^）]{0,30}）|\([^)]{0,40}\))?[：:]/.test(t) || LEGACY_DIALOGUE_HINT_RE.test(t) || /^[^\s（(：:]{1,15}\s*\([^)]{1,60}\)\s*[:：]/.test(t))) {
            badDialogue.push(t.slice(0, 44));
            prevNonEmpty = t;
            continue;
        }
        if (CJK_RE.test(t) && !t.startsWith('▲') && !t.startsWith('{') && !/[：:]/.test(t)) {
            missingTriangle.push(t.slice(0, 30));
        }
        prevNonEmpty = t;
    }
    if (badDialogue.length > 0) {
        violations.push({
            content: '台词必须为中英对照同行：中文名（中文情绪）：中文台词English Name (English Emotion): English line',
            evidence: `命中${badDialogue.length}行非对照台词：${samples(badDialogue)}`,
            severity: 'important',
            suggestion: '改写为 奥瑞安（惊怒）：什么？！Orian (Shocked): What?! 结构——中文台词与英文对照同一行',
        });
    }
    if (noCnSpeech.length > 0) {
        violations.push({
            content: '中文台词缺失：对照行的中文槽位必须是中文台词（英文原声的中文对照译文），不得写英文',
            evidence: `命中${noCnSpeech.length}行：${samples(noCnSpeech)}`,
            severity: 'important',
            suggestion: '中文槽位写该句英文台词的中文对照译文（奥瑞安（惊怒）：什么？！Orian (Shocked): What?!）',
        });
    }
    if (noCnName.length > 0) {
        violations.push({
            content: '中文名槽位应为中文名：对照行开头写角色的中文名（人物卡中的中文名），英文名放在中文台词之后',
            evidence: `命中${noCnName.length}行：${samples([...new Set(noCnName)])}`,
            severity: 'normal',
            suggestion: '改为 中文名（中文情绪）：中文台词English Name (Emotion): English line',
        });
    }
    if (enEmotionBad.length > 0) {
        violations.push({
            content: '英文情绪必须为英文：英文名后的半角括号内情绪/动作描述不得使用中文',
            evidence: `命中${enEmotionBad.length}处：${samples(enEmotionBad)}`,
            severity: 'important',
            suggestion: '改为英文可表演状态，如 (Quietly)/(Voice low)/(Gritting teeth)',
        });
    }
    if (mixedDialogue.length > 0) {
        violations.push({
            content: '英文台词混入中文字符：配音稿英文部分必须是纯英文（术语/名词需本地化翻译，不得留中文）',
            evidence: `命中${mixedDialogue.length}行：${samples(mixedDialogue)}`,
            severity: 'important',
            suggestion: '把英文台词里的中文词改写为英文对应表达（如"灰石碱"→"greystone alkali"）',
        });
    }
    if (longDialogue.length > 0) {
        violations.push({
            content: '英文台词过长：单句英文台词超过170字符需拆为两条对照行（交付实样上限约165字符）',
            evidence: `命中${longDialogue.length}行：${samples(longDialogue)}`,
            severity: 'normal',
            suggestion: '拆成两条对照行或删冗余修饰，保留短促有力的口语',
        });
    }
    if (missingTriangle.length > 0) {
        violations.push({
            content: '动作描写缺▲标记：每条动作/画面描写必须以▲开头',
            evidence: `命中${missingTriangle.length}行：${samples(missingTriangle)}`,
            severity: 'normal',
            suggestion: '动作行开头补▲（▲奥瑞安拔剑，魔力暴涨。）',
        });
    }

    // ---- 同一中文名对应多个不相关英文名 ----
    const nameConflicts: string[] = [];
    const TITLE_PREFIXES = new Set(['Uncle','Aunt','Mr','Mrs','Miss','Ms','Dr','Sheriff','Professor','Father','Mother','Brother','Sister','Lady','Lord','Old','Young','Officer','Agent','Captain','Boss','King','Queen','Prince','Princess','Grandpa','Grandma','Noble','Townsperson','Guard','Bodyguard','打手','保镖','女仆','管家','佣人','司机','医生','护士','手下','老大','老板','助理','秘书','仆人','侍从','卫兵','执事','贵族','镇民群像','群演','执刑官']);
    for (const [cn, ens] of cnToEn) {
        if (ens.size <= 1 || TITLE_PREFIXES.has(cn)) continue;
        const arr = [...ens];
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
            suggestion: '全剧统一为人物卡中的英文名（首字母大写），不得换用其他词',
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

    return violations;
}
