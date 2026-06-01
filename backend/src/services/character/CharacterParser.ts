/**
 * 角色解析服务 - 从人物卡文本中提取角色信息
 *
 * 从 V1 版本 characterService.js 迁移
 */

// 角色类型定义
export enum CharacterType {
  MAIN = 'main',           // 主角，全程出现
  SUPPORTING = 'supporting', // 重要配角，多集出现
  RECURRING = 'recurring',   // 反复出现的角色
  GUEST = 'guest',          // 客串角色，1-3集
  EXTRA = 'extra'           // 龙套
}

// 角色类型权重（用于上下文长度分配）
export const TYPE_WEIGHTS: Record<CharacterType, number> = {
  [CharacterType.MAIN]: 1.0,
  [CharacterType.SUPPORTING]: 0.7,
  [CharacterType.RECURRING]: 0.4,
  [CharacterType.GUEST]: 0.2,
  [CharacterType.EXTRA]: 0.1
};

// 解析后的角色数据
export interface ParsedCharacter {
  name: string;
  role: string;         // 角色定位：男主角、反派等
  type: CharacterType;
  gender: string;
  age: string;
  identity: string;
  personality: string;
  // 详细外貌字段
  hairStyle?: string;
  hairColor?: string;
  faceType?: string;
  bodyType?: string;
  clothing?: string;
  accessories?: string;
  // 合并外貌（兼容旧格式）
  appearance?: string;
  // 初始状态
  equipment?: string[];
  abilities?: string[];
}

/**
 * 从人物卡文本解析角色列表
 * 支持 V1 版本的详细字段格式
 */
export function parseCharacterCards(text: string): ParsedCharacter[] {
  const characters: ParsedCharacter[] = [];

  if (!text || typeof text !== 'string') {
    return characters;
  }

  // 按角色块分割（以"数字."开头）
  const blocks = text.split(/(?=\d+\.\s*[^\d])/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // 提取角色名和定位
    const headerMatch = block.match(/(\d+)\.\s*([^（(（\n]+)[（(]([^）)）]+)[）)]/);
    if (!headerMatch) continue;

    const [, , name, role] = headerMatch;

    // 提取各字段（支持中英文冒号）
    const genderMatch = block.match(/性别[：:]\s*([^\n]+)/);
    const ageMatch = block.match(/年龄[：:]\s*([^\n]+)/);
    const identityMatch = block.match(/身份[：:]\s*([^\n]+)/);
    const personalityMatch = block.match(/性格[：:]\s*([^\n]+)/);

    // 详细外貌字段
    const hairStyleMatch = block.match(/发型[：:]\s*([^\n]+)/);
    const hairColorMatch = block.match(/发色[：:]\s*([^\n]+)/);
    const faceTypeMatch = block.match(/脸型[：:]\s*([^\n]+)/);
    const bodyTypeMatch = block.match(/身材[：:]\s*([^\n]+)/);
    const clothingMatch = block.match(/穿着[：:]\s*([^\n]+)/);
    const accessoriesMatch = block.match(/配饰[：:]\s*([^\n]+)/);

    // 合并外貌字段（兼容旧格式）
    const appearanceMatch = block.match(/外貌[：:]\s*([\s\S]*?)(?=性格[：:]|能力[：:]|装备[：:]|$)/);

    // 初始装备和能力
    const abilitiesMatch = block.match(/能力[：:]\s*([^\n]+)/);
    const equipmentMatch = block.match(/装备[：:]\s*([^\n]+)/);

    // 判断角色类型
    let type = CharacterType.SUPPORTING;
    const roleLower = role.toLowerCase();
    if (roleLower.includes('主角') || roleLower.includes('男主') || roleLower.includes('女主')) {
      type = CharacterType.MAIN;
    } else if (roleLower.includes('反派') || roleLower.includes('对手') || roleLower.includes('boss')) {
      type = CharacterType.RECURRING;
    } else if (roleLower.includes('龙套') || roleLower.includes('路人') || roleLower.includes('观众')) {
      type = CharacterType.EXTRA;
    } else if (roleLower.includes('客串')) {
      type = CharacterType.GUEST;
    }

    // 解析初始装备和能力
    const equipment = equipmentMatch
      ? equipmentMatch[1].split(/[、,，]/).map(e => e.trim()).filter(e => e)
      : [];
    const abilities = abilitiesMatch
      ? abilitiesMatch[1].split(/[、,，]/).map(a => a.trim()).filter(a => a)
      : [];

    // 构建角色数据
    const character: ParsedCharacter = {
      name: name.trim(),
      role: role.trim(),
      type,
      gender: genderMatch ? genderMatch[1].trim() : '',
      age: ageMatch ? ageMatch[1].trim() : '',
      identity: identityMatch ? identityMatch[1].trim() : '',
      personality: personalityMatch ? personalityMatch[1].trim() : '',
      // 详细外貌字段
      hairStyle: hairStyleMatch ? hairStyleMatch[1].trim() : undefined,
      hairColor: hairColorMatch ? hairColorMatch[1].trim() : undefined,
      faceType: faceTypeMatch ? faceTypeMatch[1].trim() : undefined,
      bodyType: bodyTypeMatch ? bodyTypeMatch[1].trim() : undefined,
      clothing: clothingMatch ? clothingMatch[1].trim() : undefined,
      accessories: accessoriesMatch ? accessoriesMatch[1].trim() : undefined,
      // 合并外貌
      appearance: appearanceMatch ? appearanceMatch[1].trim().replace(/\s+/g, ' ') : undefined,
      equipment,
      abilities,
    };

    // 如果没有详细外貌字段，但有合并外貌，尝试从合并外貌中提取
    if (!character.hairStyle && character.appearance) {
      // 尝试从appearance中提取各字段
      const appearanceText = character.appearance;
      if (!character.hairStyle) {
        const hairMatch = appearanceText.match(/([^\u4e00-\u9fa5]*(?:短发|长发|卷发|直发|黑发|白发|金发|棕发)[^\u4e00-\u9fa5]*)/);
        if (hairMatch) character.hairStyle = hairMatch[1];
      }
    }

    characters.push(character);
  }

  return characters;
}

/**
 * 获取角色类型的中文显示名称
 */
export function getCharacterTypeLabel(type: CharacterType): string {
  const labels: Record<CharacterType, string> = {
    [CharacterType.MAIN]: '主角',
    [CharacterType.SUPPORTING]: '重要配角',
    [CharacterType.RECURRING]: '关键角色',
    [CharacterType.GUEST]: '客串角色',
    [CharacterType.EXTRA]: '龙套',
  };
  return labels[type] || '配角';
}

/**
 * 从角色定位推断角色类型
 */
export function inferCharacterType(role: string): CharacterType {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('主角') || roleLower.includes('男主') || roleLower.includes('女主')) {
    return CharacterType.MAIN;
  } else if (roleLower.includes('反派') || roleLower.includes('对手') || roleLower.includes('boss')) {
    return CharacterType.RECURRING;
  } else if (roleLower.includes('龙套') || roleLower.includes('路人') || roleLower.includes('观众')) {
    return CharacterType.EXTRA;
  } else if (roleLower.includes('客串')) {
    return CharacterType.GUEST;
  }
  return CharacterType.SUPPORTING;
}
