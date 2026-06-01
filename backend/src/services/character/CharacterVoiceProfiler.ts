import mongoose from 'mongoose';
import {
    CharacterEnhancement,
    FormalLevel,
    GrowthStage,
    ICharacterVoice,
    IEmotionalAdjustment,
    IVoiceEvolution,
    SentencePattern,
    VocabularyStyle
} from '../../models/CharacterEnhancement';
import { createLogger } from '../../utils/errorLogger';

const logger = createLogger('CharacterVoiceProfiler');

const FORMAL_LEVEL_DESCRIPTIONS: Record<FormalLevel, string> = {
  very_formal: '非常正式 - 使用敬语、书面语，措辞严谨',
  formal: '正式 - 礼貌用语，较少口语化表达',
  neutral: '中性 - 标准语言，适度正式',
  casual: '随意 - 口语化，轻松自然',
  very_casual: '非常随意 - 大量口语、俚语、省略',
};

const VOCABULARY_STYLE_DESCRIPTIONS: Record<VocabularyStyle, string> = {
  literary: '文学性 - 优美词汇，修辞丰富',
  technical: '专业性 - 术语较多，逻辑严密',
  colloquial: '口语化 - 日常用语，通俗易懂',
  archaic: '古风 - 古典词汇，文言色彩',
  modern: '现代 - 流行语、网络用语',
};

const SENTENCE_PATTERN_DESCRIPTIONS: Record<SentencePattern, string> = {
  long_complex: '长复句 - 从句多，结构复杂',
  medium: '中等 - 句式适中，节奏平稳',
  short_punchy: '短促有力 - 短句为主，节奏明快',
  mixed: '混合 - 长短结合，富有变化',
};

const VOICE_FIELDS = ['formalLevel', 'vocabularyStyle', 'sentencePattern', 'preferredWords', 'avoidedWords'] as const;

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

async function pushToEnhancement(
  projectId: string,
  characterId: string,
  characterName: string,
  field: string,
  value: unknown
): Promise<boolean> {
  try {
    await CharacterEnhancement.findOneAndUpdate(
      {
        projectId: toObjectId(projectId),
        characterId: toObjectId(characterId),
      },
      {
        $set: { characterName },
        $push: { [field]: value },
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    logger.error(`更新角色增强数据失败 (${field})`, error as Error, {
      method: 'pushToEnhancement',
      additionalInfo: { projectId, characterId },
    });
    return false;
  }
}

export class CharacterVoiceProfiler {
  async getVoice(characterId: string): Promise<ICharacterVoice | null> {
    try {
      const enhancement = await CharacterEnhancement.findOne({
        characterId: toObjectId(characterId),
      });
      return enhancement?.voice ?? null;
    } catch (error) {
      logger.error('获取角色语言风格失败', error as Error, {
        method: 'getVoice',
        additionalInfo: { characterId },
      });
      return null;
    }
  }

  async setVoice(
    projectId: string,
    characterId: string,
    characterName: string,
    voice: Partial<ICharacterVoice>
  ): Promise<boolean> {
    try {
      const updateFields: Record<string, unknown> = { characterName };
      for (const field of VOICE_FIELDS) {
        if (voice[field] !== undefined) {
          updateFields[`voice.${field}`] = voice[field];
        }
      }

      await CharacterEnhancement.findOneAndUpdate(
        {
          projectId: toObjectId(projectId),
          characterId: toObjectId(characterId),
        },
        { $set: updateFields },
        { upsert: true }
      );

      logger.info('设置角色语言风格成功', { characterId, characterName });
      return true;
    } catch (error) {
      logger.error('设置角色语言风格失败', error as Error, {
        method: 'setVoice',
        additionalInfo: { projectId, characterId },
      });
      return false;
    }
  }

  async addVoiceEvolution(
    projectId: string,
    characterId: string,
    characterName: string,
    evolution: IVoiceEvolution
  ): Promise<boolean> {
    const ok = await pushToEnhancement(projectId, characterId, characterName, 'voice.voiceEvolution', evolution);
    if (ok) logger.info('添加语言风格演变规则成功', { characterId, characterName, stage: evolution.stage });
    return ok;
  }

  async addEmotionalAdjustment(
    projectId: string,
    characterId: string,
    characterName: string,
    adjustment: IEmotionalAdjustment
  ): Promise<boolean> {
    const ok = await pushToEnhancement(projectId, characterId, characterName, 'voice.emotionalAdjustments', adjustment);
    if (ok) logger.info('添加情绪调整规则成功', { characterId, characterName, emotion: adjustment.emotion });
    return ok;
  }

  async getVoiceForStage(
    characterId: string,
    stage: GrowthStage
  ): Promise<ICharacterVoice | null> {
    try {
      const voice = await this.getVoice(characterId);
      if (!voice) return null;

      const evolution = voice.voiceEvolution.find(e => e.stage === stage);
      if (!evolution) return voice;

      return {
        ...voice,
        formalLevel: evolution.formalLevel,
        vocabularyStyle: evolution.vocabularyStyle,
      };
    } catch (error) {
      logger.error('获取阶段语言风格失败', error as Error, {
        method: 'getVoiceForStage',
        additionalInfo: { characterId, stage },
      });
      return null;
    }
  }

  async getVoiceForEmotion(
    characterId: string,
    emotion: string
  ): Promise<ICharacterVoice | null> {
    try {
      const voice = await this.getVoice(characterId);
      if (!voice) return null;

      const adjustment = voice.emotionalAdjustments.find(
        a => a.emotion.toLowerCase() === emotion.toLowerCase()
      );
      if (!adjustment?.adjustments) return voice;

      return {
        ...voice,
        formalLevel: adjustment.adjustments.formalLevel || voice.formalLevel,
        sentencePattern: adjustment.adjustments.sentencePattern || voice.sentencePattern,
      };
    } catch (error) {
      logger.error('获取情绪调整语言风格失败', error as Error, {
        method: 'getVoiceForEmotion',
        additionalInfo: { characterId, emotion },
      });
      return null;
    }
  }

  validateDialogue(
    voice: ICharacterVoice,
    dialogue: string
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    for (const word of voice.avoidedWords ?? []) {
      if (dialogue.includes(word)) {
        warnings.push(`使用了禁用词汇"${word}"`);
      }
    }

    const sentences = dialogue.split(/[。！？]/g).filter(s => s.trim().length > 0);
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / (sentences.length || 1);

    if (voice.sentencePattern === 'short_punchy' && avgLength > 15) {
      warnings.push(`句子平均长度(${avgLength.toFixed(1)}字)偏长，与短促有力风格不符`);
    } else if (voice.sentencePattern === 'long_complex' && avgLength < 10) {
      warnings.push(`句子平均长度(${avgLength.toFixed(1)}字)偏短，与长复句风格不符`);
    }

    const casualMarkers = ['啊', '呢', '嘛', '呗', '哈', '嘿', '哎', '唉'];
    const formalMarkers = ['请', '您', '阁下', '敬请', '恳请'];
    const casualCount = casualMarkers.filter(m => dialogue.includes(m)).length;
    const formalCount = formalMarkers.filter(m => dialogue.includes(m)).length;

    if (voice.formalLevel === 'very_formal' && casualCount > 0) {
      warnings.push(`使用了口语化词汇，与非常正式风格不符`);
    } else if (voice.formalLevel === 'very_casual' && formalCount > 0) {
      warnings.push(`使用了正式用语，与非常随意风格不符`);
    }

    return { valid: warnings.length === 0, warnings };
  }

  formatForPrompt(voices: Array<{ characterId: string; characterName: string; voice: ICharacterVoice }>): string {
    if (!voices?.length) return '';

    const lines: string[] = ['【角色语言风格】', ''];

    for (const { characterName, voice } of voices) {
      lines.push(`【${characterName}】`);
      lines.push(`  正式程度：${FORMAL_LEVEL_DESCRIPTIONS[voice.formalLevel]}`);
      lines.push(`  词汇风格：${VOCABULARY_STYLE_DESCRIPTIONS[voice.vocabularyStyle]}`);
      lines.push(`  句式模式：${SENTENCE_PATTERN_DESCRIPTIONS[voice.sentencePattern]}`);

      if (voice.preferredWords?.length) {
        lines.push(`  常用词汇：${voice.preferredWords.slice(0, 5).join('、')}`);
      }

      if (voice.avoidedWords?.length) {
        lines.push(`  禁用词汇：${voice.avoidedWords.slice(0, 5).join('、')}`);
      }

      lines.push('');
    }

    lines.push('请确保每个角色的对白符合其语言风格特征。');
    
    return lines.join('\n');
  }

  async getProjectVoices(projectId: string): Promise<Array<{
    characterId: string;
    characterName: string;
    voice: ICharacterVoice;
  }>> {
    try {
      const enhancements = await CharacterEnhancement.find({
        projectId: toObjectId(projectId),
      });

      return enhancements.map(e => ({
        characterId: e.characterId.toString(),
        characterName: e.characterName,
        voice: e.voice,
      }));
    } catch (error) {
      logger.error('批量获取角色语言风格失败', error as Error, {
        method: 'getProjectVoices',
        additionalInfo: { projectId },
      });
      return [];
    }
  }

  getStyleDescriptions(): {
    formalLevels: Record<FormalLevel, string>;
    vocabularyStyles: Record<VocabularyStyle, string>;
    sentencePatterns: Record<SentencePattern, string>;
  } {
    return {
      formalLevels: FORMAL_LEVEL_DESCRIPTIONS,
      vocabularyStyles: VOCABULARY_STYLE_DESCRIPTIONS,
      sentencePatterns: SENTENCE_PATTERN_DESCRIPTIONS,
    };
  }
}

export const characterVoiceProfiler = new CharacterVoiceProfiler();
