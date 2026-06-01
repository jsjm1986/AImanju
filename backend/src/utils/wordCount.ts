/**
 * 字数统计服务
 * 提供多版本字数统计算法，支持向后兼容
 */

/**
 * 字数统计算法版本
 */
export enum WordCountAlgorithm {
    V1 = 'v1',  // 旧版：简单去空格
    V2 = 'v2',  // 新版：增强版，对齐 Microsoft Word
}

/**
 * 字数统计结果（双版本）
 */
export interface WordCountResult {
    v1: number;      // V1 算法结果
    v2: number;      // V2 算法结果
    diff: number;    // 差值 (v2 - v1)，通常为负数
}

/**
 * 字数统计服务类
 * 提供统一的字数统计接口
 */
export class WordCountService {
    /**
     * V1 算法：原有逻辑（简单去除空白字符）
     * @param text 待统计文本
     * @returns 字符数
     */
    static countV1(text: string): number {
        if (!text) return 0;
        return text.replace(/\s/g, '').length;
    }

    /**
     * V2 算法：增强版（对齐 Microsoft Word "字符数（不计空格）"）
     * 
     * 相比 V1 额外移除：
     * - 全角空格 (U+3000)
     * - 零宽字符 (U+200B-U+200D, U+FEFF)
     * - Unicode 空白和分隔符 (U+2000-U+200F, U+2028-U+202F)
     * 
     * @param text 待统计文本
     * @returns 字符数
     */
    static countV2(text: string): number {
        if (!text) return 0;

        return text
            // 1. 移除所有标准 ASCII 空白字符 (空格、制表符、换行等)
            .replace(/[\s]/g, '')

            // 2. 移除全角空格
            .replace(/　/g, '')

            // 3. 移除零宽字符
            // U+200B: 零宽空格 (ZWSP)
            // U+200C: 零宽非断字符 (ZWNJ)
            // U+200D: 零宽连字符 (ZWJ)
            // U+FEFF: 零宽非断空格/BOM
            .replace(/[\u200B-\u200D\uFEFF]/g, '')

            // 4. 移除其他 Unicode 空白和分隔符
            // U+2000-U+200F: 各种宽度的空格
            // U+2028: 行分隔符
            // U+2029: 段落分隔符
            // U+202F: 窄空格
            .replace(/[\u2000-\u200F\u2028-\u202F]/g, '')

            .length;
    }

    /**
     * 双重计算：同时返回两个版本的结果
     * 用于过渡期的数据对比和验证
     * 
     * @param text 待统计文本
     * @returns 包含 v1、v2 和差值的结果对象
     */
    static countBoth(text: string): WordCountResult {
        const v1 = this.countV1(text);
        const v2 = this.countV2(text);
        return {
            v1,
            v2,
            diff: v2 - v1  // 通常为负数，因为 V2 过滤更严格
        };
    }

    /**
     * 根据算法版本选择性计数
     * 
     * @param text 待统计文本
     * @param algorithm 算法版本，默认 V2
     * @returns 字符数
     */
    static count(text: string, algorithm: WordCountAlgorithm = WordCountAlgorithm.V2): number {
        return algorithm === WordCountAlgorithm.V1
            ? this.countV1(text)
            : this.countV2(text);
    }

    /**
     * 获取默认算法版本
     * 从环境变量读取，默认使用 V2
     */
    static getDefaultAlgorithm(): WordCountAlgorithm {
        const envAlgorithm = process.env.WORD_COUNT_ALGORITHM;
        return envAlgorithm === 'v1' ? WordCountAlgorithm.V1 : WordCountAlgorithm.V2;
    }

    /**
     * 是否启用双模式（V1 和 V2 同时计算）
     * 用于过渡期的数据对比
     */
    static isDualModeEnabled(): boolean {
        return process.env.WORD_COUNT_DUAL_MODE === 'true';
    }
}
