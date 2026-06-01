/**
 * 字数统计工具类（前端版本）
 * 与后端 WordCountService 保持一致的算法
 */

export enum WordCountAlgorithm {
    V1 = 'v1',  // 旧版：简单去除 ASCII 空白
    V2 = 'v2',  // 新版：增强版对齐 Word 标准
}

export interface WordCountResult {
    v1: number;
    v2: number;
}

export class WordCountService {
    /**
     * V1 算法：简单去除 ASCII 空白字符
     * 与旧版行为保持一致
     */
    static countV1(text: string): number {
        return text.replace(/\s/g, '').length;
    }

    /**
     * V2 算法：增强版，对齐 Microsoft Word 标准
     * 
     * 移除的字符：
     * 1. ASCII 空白字符（空格、制表符、换行符等）
     * 2. 全角空格（U+3000）
     * 3. 零宽字符（零宽空格、零宽连接符、零宽非连接符等）
     * 4. 特殊 Unicode 空白字符
     * 5. 软连字符（U+00AD）
     * 6. 方向标记字符（LTR、RTL 标记）
     */
    static countV2(text: string): number {
        return text
            // 1. ASCII 空白字符（\s 包含空格、制表符、换行符等）
            .replace(/\s/g, '')
            // 2. 全角空格
            .replace(/\u3000/g, '')
            // 3. 零宽字符
            .replace(/[\u200B-\u200D]/g, '')  // 零宽空格、零宽连接符、零宽非连接符
            .replace(/\uFEFF/g, '')           // 零宽非断空格（BOM）
            // 4. 特殊 Unicode 空白字符
            .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F]/g, '')
            // 5. 软连字符
            .replace(/\u00AD/g, '')
            // 6. 方向标记字符
            .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
            .length;
    }

    /**
     * 同时计算 V1 和 V2 版本的字数
     * 用于过渡期的数据对比
     */
    static countBoth(text: string): WordCountResult {
        return {
            v1: this.countV1(text),
            v2: this.countV2(text),
        };
    }

    /**
     * 根据指定算法计算字数
     * 默认使用 V2 算法
     */
    static count(text: string, algorithm: WordCountAlgorithm = WordCountAlgorithm.V2): number {
        switch (algorithm) {
            case WordCountAlgorithm.V1:
                return this.countV1(text);
            case WordCountAlgorithm.V2:
                return this.countV2(text);
            default:
                return this.countV2(text);
        }
    }

    /**
     * 获取优先显示的字数
     * 优先使用 V2，如果不存在则回退到 V1
     */
    static getPreferredCount(v2Count?: number, v1Count?: number): number {
        return v2Count ?? v1Count ?? 0;
    }
}
