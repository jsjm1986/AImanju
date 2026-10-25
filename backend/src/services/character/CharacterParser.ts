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
  nameCn?: string;      // 中文译名（海外卡：英文名（中文译名·角色定位）中的译名部分）
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

    const [, , name, parensRaw] = headerMatch;

    // 括号内容拆分：新格式为"中文译名·角色定位"，旧格式为纯"角色定位"或纯"中文译名"
    // 身份描述词表（实测泄漏：家族掌权者/祖母、恶亲戚/假千金之母、养母 混入 nameCn）
    const ROLE_KEYWORDS = /主角|反派|配角|客串|龙套|对手|boss|群像|男主|女主|男配|女配|掌权|夫人|婆婆|祖母|父亲|母亲|养母|姨妈|叔叔|管家|医生|总裁|千金|少爷|小姐|长老|女王|猎人|侍者|司机|保姆|闺蜜|情妇|私生子|恶/i;
    const parenParts = parensRaw.split(/[·，,—]/).map(s => s.trim()).filter(Boolean);
    // 单段括号 + 命中角色词 → 纯角色定位（旧格式）；多段时按段判定
    const isRolePart = (p: string) => ROLE_KEYWORDS.test(p) || p.includes('/');
    const nonRoleParts = parenParts.filter(p => !isRolePart(p));
    const roleParts = parenParts.filter(p => isRolePart(p));
    let role = roleParts.join('·');
    let nameCn = nonRoleParts.join('·');
    if (!role && ROLE_KEYWORDS.test(parensRaw)) { role = parensRaw.trim(); nameCn = ''; }

    // 提取各字段（支持中英文冒号；行首锚定防"身份背景"被子字段"背景"重复捕获等子串碰撞）
    const genderMatch = block.match(/(?:^|\n)性别[：:]\s*([^\n]+)/);
    const ageMatch = block.match(/(?:^|\n)年龄[：:]\s*([^\n]+)/);
    // 角色定位字段（新格式独立成行时优先于括号）
    const roleMatch = block.match(/(?:^|\n)角色定位[：:]\s*([^\n]+)/);
    if (roleMatch) role = roleMatch[1].trim();
    // 身份：新格式"身份背景"优先，旧格式"身份"
    const identityMatch = block.match(/(?:^|\n)身份背景[：:]\s*([^\n]+)/) || block.match(/(?:^|\n)身份[：:]\s*([^\n]+)/);
    // 性格：新格式"性格特质"优先，旧格式"性格"
    const personalityMatch = block.match(/(?:^|\n)性格特质[：:]\s*([^\n]+)/) || block.match(/(?:^|\n)性格[：:]\s*([^\n]+)/);
    // 新人物小传字段：核心动机/人物弧光/关键关系
    const motivationMatch = block.match(/(?:^|\n)核心动机[：:]\s*([^\n]+)/);
    const arcMatch = block.match(/(?:^|\n)人物弧光[：:]\s*([^\n]+)/);
    const relationsMatch = block.match(/(?:^|\n)关键关系[：:]\s*([^\n]+)/);

    // 详细外貌字段
    const hairStyleMatch = block.match(/(?:^|\n)发型[：:]\s*([^\n]+)/);
    const hairColorMatch = block.match(/(?:^|\n)发色[：:]\s*([^\n]+)/);
    const faceTypeMatch = block.match(/(?:^|\n)脸型[：:]\s*([^\n]+)/);
    const bodyTypeMatch = block.match(/(?:^|\n)身材[：:]\s*([^\n]+)/);
    const clothingMatch = block.match(/(?:^|\n)穿着[：:]\s*([^\n]+)/);
    const accessoriesMatch = block.match(/(?:^|\n)配饰[：:]\s*([^\n]+)/);

    // 合并外貌字段（兼容旧格式）
    const appearanceMatch = block.match(/(?:^|\n)外貌[：:]\s*([\s\S]*?)(?=\n(?:性格|性格特质|能力|装备)[：:]|$)/);

    // 海外人物卡扩展字段：英文名（别名）、形态（狼人/ABO等变身形态）
    const englishNameMatch = block.match(/(?:^|\n)英文名[：:]\s*([^\n]+)/);
    const formMatch = block.match(/(?:^|\n)形态[：:]\s*([^\n]+)/);
    // 海外人物卡小传层字段：背景/渴望/反差/软肋
    const backgroundMatch = block.match(/(?:^|\n)背景[：:]\s*([^\n]+)/);
    const desireMatch = block.match(/(?:^|\n)渴望[：:]\s*([^\n]+)/);
    const contrastMatch = block.match(/(?:^|\n)反差[：:]\s*([^\n]+)/);
    const weaknessMatch = block.match(/(?:^|\n)软肋[：:]\s*([^\n]+)/);

    // 初始装备和能力
    const abilitiesMatch = block.match(/(?:^|\n)能力[：:]\s*([^\n]+)/);
    const equipmentMatch = block.match(/(?:^|\n)装备[：:]\s*([^\n]+)/);

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
      nameCn: nameCn || undefined,
      role: (role || '').trim(),
      type,
      gender: genderMatch ? genderMatch[1].trim() : '',
      age: ageMatch ? ageMatch[1].trim() : '',
      identity: identityMatch ? identityMatch[1].trim() : '',
      personality: [
        personalityMatch ? personalityMatch[1].trim() : '',
        motivationMatch ? `核心动机：${motivationMatch[1].trim()}` : '',
        arcMatch ? `人物弧光：${arcMatch[1].trim()}` : '',
        relationsMatch ? `关键关系：${relationsMatch[1].trim()}` : '',
        backgroundMatch ? `背景：${backgroundMatch[1].trim()}` : '',
        desireMatch ? `渴望：${desireMatch[1].trim()}` : '',
        contrastMatch ? `反差：${contrastMatch[1].trim()}` : '',
        weaknessMatch ? `软肋：${weaknessMatch[1].trim()}` : '',
      ].filter(Boolean).join('；'),
      // 详细外貌字段
      hairStyle: hairStyleMatch ? hairStyleMatch[1].trim() : undefined,
      hairColor: hairColorMatch ? hairColorMatch[1].trim() : undefined,
      faceType: faceTypeMatch ? faceTypeMatch[1].trim() : undefined,
      bodyType: bodyTypeMatch ? bodyTypeMatch[1].trim() : undefined,
      clothing: clothingMatch ? clothingMatch[1].trim() : undefined,
      accessories: accessoriesMatch ? accessoriesMatch[1].trim() : undefined,
      // 合并外貌（海外卡的英文名/形态并入外貌，保证入库不丢失）
      appearance: [
        appearanceMatch ? appearanceMatch[1].trim().replace(/\s+/g, ' ') : '',
        englishNameMatch ? `英文名：${englishNameMatch[1].trim()}` : '',
        formMatch && !/^无[。.]?$/.test(formMatch[1].trim()) ? `形态：${formMatch[1].trim()}` : '',
      ].filter(Boolean).join('；') || undefined,
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
