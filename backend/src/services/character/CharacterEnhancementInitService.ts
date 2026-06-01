import mongoose from 'mongoose';
import { Character, ICharacter } from '../../models/Character';
import { CharacterEnhancement, ICharacterCharm, ICharacterVoice, FormalLevel, VocabularyStyle, SentencePattern } from '../../models/CharacterEnhancement';
import { aiClient } from '../ai/AIClient';

export interface CharacterInitResult {
    characterId: string;
    characterName: string;
    success: boolean;
    error?: string;
    charm?: ICharacterCharm;
    voice?: ICharacterVoice;
}

export interface BatchInitResult {
    projectId: string;
    totalCharacters: number;
    successCount: number;
    failedCount: number;
    results: CharacterInitResult[];
}

export interface InitProgressCallbacks {
    onStart?: (total: number) => void;
    onProgress?: (current: number, total: number, characterName: string) => void;
    onCharacterDone?: (result: CharacterInitResult) => void;
    onComplete?: (result: BatchInitResult) => void;
    onError?: (error: Error) => void;
}

function buildCharacterUserPrompt(character: ICharacter): string {
    return `角色信息:
姓名:${character.name}
定位:${character.role || '配角'}
性格:${character.personality || '未设定'}
身份:${character.identity || '未设定'}`;
}

const CHARM_SYSTEM_PROMPT = `你是一位专业的角色设计师，擅长为影视角色设计生动的个人特征。
请根据角色信息，推断该角色的魅力特征。

【输出格式】严格按以下JSON格式输出：
{"catchphrases":["...","..."],"quirks":["..."],"signatureMoves":["..."]}

【规则】
- catchphrases: 口头禅，2-3条，符合角色性格
- quirks: 小癖好，1-2条
- signatureMoves: 标志动作，1-2条

【重要】
- 只输出纯JSON，不要任何markdown标记或解释
- 数组中每个元素用英文双引号包裹
- 数组元素之间用英文逗号分隔
- 最后一个元素后不要逗号`;

const VOICE_SYSTEM_PROMPT = `你是一位专业的编剧，擅长设计角色的语言风格。
请根据角色信息，推断该角色的语言风格设定。

【输出格式】严格按以下JSON格式输出:
{"formalLevel":"neutral","vocabularyStyle":"colloquial","sentencePattern":"medium","preferredWords":["..."],"avoidedWords":["..."]}

【字段说明】
formalLevel: very_formal/formal/neutral/casual/very_casual
vocabularyStyle: literary/technical/colloquial/archaic/modern
sentencePattern: long_complex/medium/short_punchy/mixed
preferredWords: 偏好词汇，1-3个
avoidedWords: 避免词汇，0-2个

【重要】
- 只输出纯JSON，不要任何markdown标记或解释
- 数组元素用英文双引号包裹
- 最后一个元素后不要逗号`;

function parseJsonResponse<T>(text: string): T | null {
    const cleaned = text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(fixCommonJsonIssues(match[0]));
        } catch (_) { /* fall through to direct parse */ }
    }

    try {
        return JSON.parse(fixCommonJsonIssues(cleaned));
    } catch (error) {
        console.error('[CharacterEnhancementInit] JSON 解析失败:', error);
        console.error('[CharacterEnhancementInit] 原始内容:', text.substring(0, 500));
        return null;
    }
}

function fixCommonJsonIssues(jsonStr: string): string {
    let fixed = jsonStr;

    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
        fixed = fixed.replace(/,\s*"[^"]*$/, '');
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
            fixed += ']';
        }
    }

    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
        for (let i = 0; i < openBraces - closeBraces; i++) {
            fixed += '}';
        }
    }

    fixed = fixed.replace(/\/\/[^\n]*/g, '');
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
    fixed = fixed.replace(/[""]/g, '"');
    fixed = fixed.replace(/['']/g, "'");

    return fixed;
}

function streamAIResponse(system: string, user: string): Promise<string> {
    return aiClient.generateStream(system, user, {});
}

function validateEnum<T extends string>(value: string | undefined, valid: readonly T[], fallback: T): T {
    return valid.includes(value as T) ? (value as T) : fallback;
}

function asArray(value: unknown): string[] {
    return Array.isArray(value) ? value : [];
}

function buildCharmData(charm: Partial<ICharacterCharm>): ICharacterCharm {
    return {
        catchphrases: charm.catchphrases || [],
        quirks: charm.quirks || [],
        signatureMoves: charm.signatureMoves || [],
        impressiveMoments: [],
    };
}

function buildVoiceData(voice: Partial<ICharacterVoice>): ICharacterVoice {
    return {
        formalLevel: (voice.formalLevel || 'neutral') as FormalLevel,
        vocabularyStyle: (voice.vocabularyStyle || 'colloquial') as VocabularyStyle,
        sentencePattern: (voice.sentencePattern || 'medium') as SentencePattern,
        preferredWords: voice.preferredWords || [],
        avoidedWords: voice.avoidedWords || [],
        voiceEvolution: [],
        emotionalAdjustments: [],
    };
}

export class CharacterEnhancementInitService {

    async initializeProjectCharacters(
        projectId: string,
        callbacks?: InitProgressCallbacks
    ): Promise<BatchInitResult> {
        const results: CharacterInitResult[] = [];

        try {
            const characters = await Character.find({
                projectId: new mongoose.Types.ObjectId(projectId)
            });

            if (characters.length === 0) {
                return {
                    projectId,
                    totalCharacters: 0,
                    successCount: 0,
                    failedCount: 0,
                    results: [],
                };
            }

            callbacks?.onStart?.(characters.length);

            let successCount = 0;
            let failedCount = 0;

            for (let i = 0; i < characters.length; i++) {
                const character = characters[i];
                callbacks?.onProgress?.(i + 1, characters.length, character.name);

                try {
                    const result = await this.initializeCharacter(character);
                    results.push(result);
                    result.success ? successCount++ : failedCount++;
                    callbacks?.onCharacterDone?.(result);
                } catch (error) {
                    const errorResult: CharacterInitResult = {
                        characterId: character._id.toString(),
                        characterName: character.name,
                        success: false,
                        error: (error as Error).message,
                    };
                    results.push(errorResult);
                    failedCount++;
                    callbacks?.onCharacterDone?.(errorResult);
                }

                if (i < characters.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            const batchResult: BatchInitResult = {
                projectId,
                totalCharacters: characters.length,
                successCount,
                failedCount,
                results,
            };

            callbacks?.onComplete?.(batchResult);
            return batchResult;

        } catch (error) {
            callbacks?.onError?.(error as Error);
            throw error;
        }
    }

    async initializeCharacter(character: ICharacter): Promise<CharacterInitResult> {
        const characterId = character._id.toString();
        const projectId = character.projectId.toString();

        try {
            console.log(`[CharacterEnhancementInit] 初始化角色: ${character.name}`);

            const [charm, voice] = await Promise.all([
                this.inferCharm(character),
                this.inferVoice(character),
            ]);

            const charmData = buildCharmData(charm);
            const voiceData = buildVoiceData(voice);

            await CharacterEnhancement.findOneAndUpdate(
                { projectId: new mongoose.Types.ObjectId(projectId), characterId: new mongoose.Types.ObjectId(characterId) },
                { $set: { characterName: character.name, charm: charmData, voice: voiceData } },
                { upsert: true, new: true }
            );

            console.log(`[CharacterEnhancementInit] 角色 ${character.name} 初始化完成`);

            return {
                characterId,
                characterName: character.name,
                success: true,
                charm: charmData,
                voice: voiceData,
            };
        } catch (error) {
            console.error(`[CharacterEnhancementInit] 角色 ${character.name} 初始化失败:`, error);
            return {
                characterId,
                characterName: character.name,
                success: false,
                error: (error as Error).message,
            };
        }
    }

    async generatePreview(character: ICharacter): Promise<CharacterInitResult> {
        const characterId = character._id.toString();

        try {
            console.log(`[CharacterEnhancementInit] 生成预览: ${character.name}`);

            const [charm, voice] = await Promise.all([
                this.inferCharm(character),
                this.inferVoice(character),
            ]);

            console.log(`[CharacterEnhancementInit] 角色 ${character.name} 预览生成完成`);

            return {
                characterId,
                characterName: character.name,
                success: true,
                charm: buildCharmData(charm),
                voice: buildVoiceData(voice),
            };
        } catch (error) {
            console.error(`[CharacterEnhancementInit] 角色 ${character.name} 预览生成失败:`, error);
            return {
                characterId,
                characterName: character.name,
                success: false,
                error: (error as Error).message,
            };
        }
    }

    async saveCharacterEnhancement(
        projectId: string,
        characterId: string,
        characterName: string,
        charm: ICharacterCharm,
        voice: ICharacterVoice
    ): Promise<boolean> {
        try {
            await CharacterEnhancement.findOneAndUpdate(
                {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    characterId: new mongoose.Types.ObjectId(characterId)
                },
                { $set: { characterName, charm, voice } },
                { upsert: true, new: true }
            );
            console.log(`[CharacterEnhancementInit] 角色 ${characterName} 保存成功`);
            return true;
        } catch (error) {
            console.error(`[CharacterEnhancementInit] 角色 ${characterName} 保存失败:`, error);
            return false;
        }
    }

    private async inferCharm(character: ICharacter): Promise<Partial<ICharacterCharm>> {
        const response = await streamAIResponse(CHARM_SYSTEM_PROMPT, buildCharacterUserPrompt(character));

        const parsed = parseJsonResponse<{
            catchphrases?: string[];
            quirks?: string[];
            signatureMoves?: string[];
        }>(response);

        if (!parsed) {
            return { catchphrases: [], quirks: [], signatureMoves: [] };
        }

        return {
            catchphrases: asArray(parsed.catchphrases),
            quirks: asArray(parsed.quirks),
            signatureMoves: asArray(parsed.signatureMoves),
        };
    }

    private static readonly VALID_FORMAL_LEVELS: readonly FormalLevel[] = ['very_formal', 'formal', 'neutral', 'casual', 'very_casual'];
    private static readonly VALID_VOCABULARY_STYLES: readonly VocabularyStyle[] = ['literary', 'technical', 'colloquial', 'archaic', 'modern'];
    private static readonly VALID_SENTENCE_PATTERNS: readonly SentencePattern[] = ['long_complex', 'medium', 'short_punchy', 'mixed'];

    private async inferVoice(character: ICharacter): Promise<Partial<ICharacterVoice>> {
        const response = await streamAIResponse(VOICE_SYSTEM_PROMPT, buildCharacterUserPrompt(character));

        const parsed = parseJsonResponse<{
            formalLevel?: string;
            vocabularyStyle?: string;
            sentencePattern?: string;
            preferredWords?: string[];
            avoidedWords?: string[];
        }>(response);

        if (!parsed) {
            return {
                formalLevel: 'neutral' as FormalLevel,
                vocabularyStyle: 'colloquial' as VocabularyStyle,
                sentencePattern: 'medium' as SentencePattern,
                preferredWords: [],
                avoidedWords: [],
            };
        }

        return {
            formalLevel: validateEnum(parsed.formalLevel, CharacterEnhancementInitService.VALID_FORMAL_LEVELS, 'neutral'),
            vocabularyStyle: validateEnum(parsed.vocabularyStyle, CharacterEnhancementInitService.VALID_VOCABULARY_STYLES, 'colloquial'),
            sentencePattern: validateEnum(parsed.sentencePattern, CharacterEnhancementInitService.VALID_SENTENCE_PATTERNS, 'medium'),
            preferredWords: asArray(parsed.preferredWords),
            avoidedWords: asArray(parsed.avoidedWords),
        };
    }

    async getInitializationStatus(projectId: string): Promise<{
        totalCharacters: number;
        initializedCount: number;
        uninitializedCount: number;
        characters: Array<{ name: string; initialized: boolean }>;
    }> {
        const characters = await Character.find({
            projectId: new mongoose.Types.ObjectId(projectId)
        }).select('_id name');

        const characterIds = characters.map(c => c._id);

        const enhancements = await CharacterEnhancement.find({
            projectId: new mongoose.Types.ObjectId(projectId),
            characterId: { $in: characterIds },
        }).select('characterId');

        const initializedIds = new Set(enhancements.map(e => e.characterId.toString()));

        const result = characters.map(c => ({
            name: c.name,
            initialized: initializedIds.has(c._id.toString()),
        }));

        return {
            totalCharacters: characters.length,
            initializedCount: initializedIds.size,
            uninitializedCount: characters.length - initializedIds.size,
            characters: result,
        };
    }
}

export const characterEnhancementInitService = new CharacterEnhancementInitService();
