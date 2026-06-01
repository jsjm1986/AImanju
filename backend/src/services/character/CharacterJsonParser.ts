/**
 * 角色 JSON 解析器 - 从 JSON 格式的人物卡中提取角色信息
 */

import { CharacterType, ParsedCharacter, parseCharacterCards } from './CharacterParser';

// JSON 格式的角色外貌
export interface CharacterAppearanceJson {
  hairStyle?: string;
  hairColor?: string;
  faceType?: string;
  bodyType?: string;
  clothing?: string;
  accessories?: string;
}

// JSON 格式的角色卡
export interface CharacterJsonCard {
  name: string;
  role: string;
  gender: string;
  age: string;
  identity: string;
  appearance: CharacterAppearanceJson;
  personality: string[];
  abilities?: string[];
  equipment?: string[];
  background?: string;
}

// JSON 格式的人物卡列表
export interface CharacterCardsJson {
  characters: CharacterJsonCard[];
}

/**
 * 从角色定位推断角色类型
 */
export function inferCharacterTypeFromRole(role: string): CharacterType {
  // 处理空值和空字符串
  if (!role || typeof role !== 'string' || !role.trim()) {
    return CharacterType.SUPPORTING;
  }

  const roleLower = role.toLowerCase();

  if (roleLower.includes('主角') || roleLower.includes('男主') || roleLower.includes('女主')) {
    return CharacterType.MAIN;
  } else if (roleLower.includes('反派') || roleLower.includes('对手') || roleLower.includes('boss') || roleLower.includes('大boss')) {
    return CharacterType.RECURRING;
  } else if (roleLower.includes('龙套') || roleLower.includes('路人') || roleLower.includes('观众')) {
    return CharacterType.EXTRA;
  } else if (roleLower.includes('客串')) {
    return CharacterType.GUEST;
  }

  return CharacterType.SUPPORTING;
}

/**
 * 从 JSON 格式的人物卡文本中提取 JSON 字符串
 */
function extractJsonFromText(text: string): string | null {
  // 尝试从 ```json ... ``` 中提取
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // 尝试从 ``` ... ``` 中提取
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // 检查是否像 JSON
    if (content.startsWith('{') || content.startsWith('[')) {
      return content;
    }
  }

  // 尝试直接解析（如果整个文本就是 JSON）
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  return null;
}

/**
 * 从 JSON 格式的人物卡文本中解析角色列表
 */
export function parseCharacterCardsJson(text: string): ParsedCharacter[] {
  const characters: ParsedCharacter[] = [];

  if (!text || typeof text !== 'string') {
    return characters;
  }

  try {
    // 提取 JSON 字符串
    const jsonStr = extractJsonFromText(text);
    if (!jsonStr) {
      console.log('[CharacterJsonParser] 未找到 JSON 内容');
      return characters;
    }

    // 解析 JSON 并进行类型安全检查
    const parsed = JSON.parse(jsonStr);

    // 验证 parsed 是否为对象
    if (!parsed || typeof parsed !== 'object') {
      console.log('[CharacterJsonParser] JSON 格式错误：不是对象');
      return characters;
    }

    // 验证 characters 是否为数组
    const cards = Array.isArray(parsed.characters) ? parsed.characters : [];

    if (cards.length === 0) {
      console.log('[CharacterJsonParser] JSON 中没有角色数据');
      return characters;
    }

    console.log(`[CharacterJsonParser] 成功解析 ${cards.length} 个角色`);

    for (const card of cards) {
      // 跳过无效数据：检查 name 是否存在且为字符串
      if (!card || typeof card !== 'object') {
        console.warn('[CharacterJsonParser] 跳过无效的角色数据');
        continue;
      }

      if (!card.name || typeof card.name !== 'string' || !card.name.trim()) {
        console.warn('[CharacterJsonParser] 跳过无名称的角色');
        continue;
      }

      // 推断角色类型
      const type = inferCharacterTypeFromRole(card.role || '');

      // 处理性格数组
      let personality = '';
      if (Array.isArray(card.personality)) {
        personality = card.personality.filter((p: unknown) => typeof p === 'string').join('、');
      } else if (typeof card.personality === 'string') {
        personality = card.personality;
      }

      // 安全获取字符串值
      const safeString = (val: unknown, defaultVal = ''): string => {
        if (typeof val === 'string') return val.trim();
        return defaultVal;
      };

      // 构建角色数据
      const character: ParsedCharacter = {
        name: card.name.trim(),
        role: safeString(card.role, '配角'),
        type,
        gender: safeString(card.gender, '未知'),
        age: safeString(card.age),
        identity: safeString(card.identity) || safeString(card.role),
        personality,
        // 详细外貌字段（安全访问）
        hairStyle: safeString(card.appearance?.hairStyle) || undefined,
        hairColor: safeString(card.appearance?.hairColor) || undefined,
        faceType: safeString(card.appearance?.faceType) || undefined,
        bodyType: safeString(card.appearance?.bodyType) || undefined,
        clothing: safeString(card.appearance?.clothing) || undefined,
        accessories: safeString(card.appearance?.accessories) || undefined,
        // 初始状态（验证数组类型）
        equipment: Array.isArray(card.equipment)
          ? card.equipment.filter((e: unknown) => typeof e === 'string')
          : [],
        abilities: Array.isArray(card.abilities)
          ? card.abilities.filter((a: unknown) => typeof a === 'string')
          : [],
      };

      characters.push(character);
    }

  } catch (error) {
    if (error instanceof SyntaxError) {
      console.log('[CharacterJsonParser] JSON 语法错误，将回退到正则解析');
    } else {
      console.error('[CharacterJsonParser] 解析错误:', error);
    }
    // 返回空数组，让调用方回退到正则解析
  }

  return characters;
}

/**
 * 智能解析：优先尝试 JSON，失败则回退到正则
 */
export function parseCharacterCardsSmart(text: string): ParsedCharacter[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 1. 检测是否包含 JSON 格式
  const hasJsonBlock = text.includes('```json') || text.includes('```');
  const looksLikeJson = text.trim().startsWith('{') || text.trim().startsWith('[');

  if (hasJsonBlock || looksLikeJson) {
    console.log('[CharacterParser] 检测到 JSON 格式，尝试 JSON 解析');
    const jsonResult = parseCharacterCardsJson(text);
    if (jsonResult.length > 0) {
      console.log(`[CharacterParser] JSON 解析成功，提取 ${jsonResult.length} 个角色`);
      return jsonResult;
    }
    console.log('[CharacterParser] JSON 解析失败或无结果，回退到正则解析');
  }

  // 2. 回退到正则解析（兼容旧格式）
  console.log('[CharacterParser] 使用正则格式解析');
  return parseCharacterCards(text);
}
