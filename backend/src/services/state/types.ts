/**
 * StateAnalyzer 类型定义
 */

export interface EquipmentChanges {
  gained: string[];
  lost: string[];
}

export interface AbilityChanges {
  newlyRevealed: string[];
}

export interface ConditionState {
  physical: string;
  mental: string;
  combat: string;
}

export interface PermanentMark {
  mark: string;
  type: 'disability' | 'special' | 'awakening';
}

export interface CharacterUpdate {
  equipment: EquipmentChanges;
  abilities: AbilityChanges;
  condition: ConditionState;
  permanentMark: PermanentMark | null;
}

export interface CharacterAnalysis {
  name: string;
  updates: CharacterUpdate;
}

export interface PlantedForeshadowingItem {
  content: string;
  type: 'suspense' | 'character' | 'item' | 'plot';
  importance: 'high' | 'normal' | 'low';
}

export interface ResolvedForeshadowingItem {
  content: string;
  resolution: string;
}

export interface ForeshadowingData {
  planted: PlantedForeshadowingItem[];
  resolved: ResolvedForeshadowingItem[];
}

export interface EpisodeSummaryData {
  brief: string;
  keyEvents: string[];
  cliffhanger: string;
  foreshadowing: ForeshadowingData;
}

export interface StateAnalysisResult {
  episode: number;
  characters: CharacterAnalysis[];
  episodeSummary: EpisodeSummaryData;
}

export interface VerificationResult {
  verified: boolean;
  score: number;
  reason: string;
}

/**
 * 旧格式变化项（向后兼容）
 */
export interface OldFormatChange {
  type: 'equipment' | 'ability' | 'injury' | 'power' | 'event';
  action?: 'add' | 'remove' | 'recover';
  item?: string;
  name?: string;
  detail?: string;
  status?: string;
  description?: string;
}

/**
 * 旧格式角色分析
 */
export interface OldFormatCharacterAnalysis {
  name: string;
  changes?: OldFormatChange[];
  updates?: CharacterUpdate;
}
