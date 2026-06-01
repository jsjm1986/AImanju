/**
 * Property-Based Tests for Generation Context Enhancement
 * 
 * Feature: generation-context-enhancement
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ==================== Type Definitions ====================

interface IBudgetAllocation {
  previousSummaries: number;
  characters: number;
  foreshadowing: number;
  characterContinuity: number;
  stateChanges: number;
  sceneRhythm: number;
  characterCharm: number;
  total: number;
}

interface IEpisodeNeeds {
  hasOverdueForeshadowing: boolean;
  overdueCount: number;
  warningCount: number;
  isNewChapter: boolean;
  isClimax: boolean;
  absentMainCharacters: string[];
  relationshipMilestones: string[];
  totalForeshadowingCount: number;
}

type SceneType = 'action' | 'dialogue' | 'introspection' | 'transition';
type RhythmCurve = 'rising' | 'falling' | 'wave' | 'plateau';
type SceneDuration = 'short' | 'medium' | 'long';
type GrowthStage = 'initial' | 'challenged' | 'growing' | 'transformed';
type FormalLevel = 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual';
type VocabularyStyle = 'literary' | 'technical' | 'colloquial' | 'archaic' | 'modern';
type SentencePattern = 'long_complex' | 'medium' | 'short_punchy' | 'mixed';
type ImpressiveMomentType = 'combat' | 'wisdom' | 'emotional' | 'humor';
type GrowthEventType = 'skill' | 'mindset' | 'relationship' | 'identity';
type RelationshipLevel = 'stranger' | 'acquaintance' | 'familiar' | 'close' | 'intimate' | 'hostile' | 'enemy';

interface IScenePlan {
  sceneNumber: number;
  type: SceneType;
  intensity: number;
  duration: SceneDuration;
  purpose: string;
}

interface ISceneRhythmPlan {
  scenes: IScenePlan[];
  rhythmCurve: RhythmCurve;
  peakPosition: number;
  overallIntensity: number;
}

interface ICharacterCharm {
  catchphrases: string[];
  quirks: string[];
  signatureMoves: string[];
  impressiveMoments: { episode: number; description: string; type: ImpressiveMomentType }[];
}

interface ICharacterArc {
  currentStage: GrowthStage;
  stageHistory: { stage: GrowthStage; startEpisode: number; endEpisode?: number; trigger?: string }[];
  turningPoints: { episode: number; event: string; impact: string; beforeState: string; afterState: string }[];
  growthEvents: { episode: number; type: GrowthEventType; description: string }[];
  milestones: { episode: number; milestone: string; achieved: boolean }[];
  lastGrowthEpisode: number;
}

interface IVoiceEvolution {
  stage: GrowthStage;
  formalLevel: FormalLevel;
  vocabularyStyle: VocabularyStyle;
  description: string;
}

interface ICharacterVoice {
  formalLevel: FormalLevel;
  vocabularyStyle: VocabularyStyle;
  sentencePattern: SentencePattern;
  preferredWords: string[];
  avoidedWords: string[];
  voiceEvolution: IVoiceEvolution[];
  emotionalAdjustments: { emotion: string; adjustments: { formalLevel?: FormalLevel; sentencePattern?: SentencePattern } }[];
}

interface IRelationship {
  characterAName: string;
  characterBName: string;
  currentLevel: RelationshipLevel;
  sentiment: number;
  history: { episode: number; fromLevel: RelationshipLevel; toLevel: RelationshipLevel; event: string }[];
  keyEvents: { episode: number; type: string; description: string; impact: string }[];
  lastInteractionEpisode: number;
}

// ==================== Constants ====================

const BASE_BUDGET = 12000;
const DEFAULT_ALLOCATION: IBudgetAllocation = {
  previousSummaries: 2160, characters: 3360, foreshadowing: 840,
  characterContinuity: 1200, stateChanges: 1440, sceneRhythm: 1200,
  characterCharm: 1800, total: 12000,
};

// ==================== Pure Functions Under Test ====================

function allocateBudget(needs: IEpisodeNeeds): IBudgetAllocation {
  const allocation = { ...DEFAULT_ALLOCATION };
  
  if (needs.hasOverdueForeshadowing && needs.overdueCount > 0) {
    allocation.foreshadowing += Math.min(needs.overdueCount * 200, 800);
  } else if (needs.warningCount > 0) {
    allocation.foreshadowing += Math.min(needs.warningCount * 100, 400);
  }
  if (needs.isNewChapter) allocation.characters += 600;
  if (needs.isClimax) allocation.previousSummaries += 500;
  if (needs.absentMainCharacters.length > 0) {
    allocation.characterContinuity += Math.min(needs.absentMainCharacters.length * 300, 600);
  }

  const currentTotal = Object.entries(allocation)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + (value as number), 0);
  
  if (currentTotal > BASE_BUDGET) {
    const ratio = BASE_BUDGET / currentTotal;
    for (const key of Object.keys(allocation) as (keyof IBudgetAllocation)[]) {
      if (key !== 'total') allocation[key] = Math.floor(allocation[key] * ratio);
    }
  }

  allocation.total = Object.entries(allocation)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + (value as number), 0);

  return allocation;
}

function validateSceneRhythmPlan(plan: ISceneRhythmPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validTypes: SceneType[] = ['action', 'dialogue', 'introspection', 'transition'];
  const validCurves: RhythmCurve[] = ['rising', 'falling', 'wave', 'plateau'];

  if (plan.scenes.length < 3) errors.push('Plan must have at least 3 scenes');
  for (const scene of plan.scenes) {
    if (!validTypes.includes(scene.type)) errors.push(`Invalid scene type: ${scene.type}`);
    if (scene.intensity < 0 || scene.intensity > 1) errors.push(`Invalid intensity: ${scene.intensity}`);
  }
  if (!validCurves.includes(plan.rhythmCurve)) errors.push(`Invalid rhythm curve: ${plan.rhythmCurve}`);
  if (plan.peakPosition < 0 || plan.peakPosition > 1) errors.push(`Invalid peak position: ${plan.peakPosition}`);
  if (plan.overallIntensity < 0 || plan.overallIntensity > 1) errors.push(`Invalid overall intensity: ${plan.overallIntensity}`);

  return { valid: errors.length === 0, errors };
}

function validateCharacterEnhancement(charm: ICharacterCharm, arc: ICharacterArc, voice: ICharacterVoice): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(charm.catchphrases)) errors.push('charm.catchphrases must be an array');
  if (!Array.isArray(charm.quirks)) errors.push('charm.quirks must be an array');
  if (!Array.isArray(charm.signatureMoves)) errors.push('charm.signatureMoves must be an array');

  const validStages: GrowthStage[] = ['initial', 'challenged', 'growing', 'transformed'];
  if (!validStages.includes(arc.currentStage)) errors.push(`Invalid growth stage: ${arc.currentStage}`);
  if (!Array.isArray(arc.stageHistory)) errors.push('arc.stageHistory must be an array');

  const validFormalLevels: FormalLevel[] = ['very_formal', 'formal', 'neutral', 'casual', 'very_casual'];
  const validVocabStyles: VocabularyStyle[] = ['literary', 'technical', 'colloquial', 'archaic', 'modern'];
  const validPatterns: SentencePattern[] = ['long_complex', 'medium', 'short_punchy', 'mixed'];

  if (!validFormalLevels.includes(voice.formalLevel)) errors.push(`Invalid formal level: ${voice.formalLevel}`);
  if (!validVocabStyles.includes(voice.vocabularyStyle)) errors.push(`Invalid vocabulary style: ${voice.vocabularyStyle}`);
  if (!validPatterns.includes(voice.sentencePattern)) errors.push(`Invalid sentence pattern: ${voice.sentencePattern}`);

  return { valid: errors.length === 0, errors };
}

function checkRelationshipHistoryConsistency(relationship: IRelationship): { consistent: boolean; errors: string[] } {
  const errors: string[] = [];
  const history = relationship.history;
  const sortedHistory = [...history].sort((a, b) => a.episode - b.episode);

  for (let i = 0; i < history.length; i++) {
    if (history[i].episode !== sortedHistory[i].episode) {
      errors.push('History is not ordered by episode');
      break;
    }
  }

  for (let i = 0; i < sortedHistory.length - 1; i++) {
    if (sortedHistory[i].toLevel !== sortedHistory[i + 1].fromLevel) {
      errors.push(`History inconsistency at episode ${sortedHistory[i].episode}`);
    }
  }

  return { consistent: errors.length === 0, errors };
}

function checkGrowthStagnation(arc: ICharacterArc, currentEpisode: number): string | null {
  const episodesSinceGrowth = currentEpisode - arc.lastGrowthEpisode;
  if (episodesSinceGrowth >= 10) {
    return `角色已${episodesSinceGrowth}集未有成长事件，建议安排角色发展或转变`;
  }
  return null;
}

function checkRelationshipStagnation(relationship: IRelationship, currentEpisode: number): string | null {
  const episodesSince = currentEpisode - relationship.lastInteractionEpisode;
  if (['stranger', 'enemy'].includes(relationship.currentLevel)) return null;
  if (episodesSince >= 5) {
    return `${relationship.characterAName}与${relationship.characterBName}已${episodesSince}集无互动`;
  }
  return null;
}

function getVoiceForStage(voice: ICharacterVoice, stage: GrowthStage): ICharacterVoice {
  const evolution = voice.voiceEvolution.find(e => e.stage === stage);
  if (evolution) {
    return { ...voice, formalLevel: evolution.formalLevel, vocabularyStyle: evolution.vocabularyStyle };
  }
  return voice;
}

// ==================== Arbitraries (Generators) ====================

const episodeNeedsArb = fc.record({
  hasOverdueForeshadowing: fc.boolean(),
  overdueCount: fc.integer({ min: 0, max: 10 }),
  warningCount: fc.integer({ min: 0, max: 10 }),
  isNewChapter: fc.boolean(),
  isClimax: fc.boolean(),
  absentMainCharacters: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  relationshipMilestones: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
  totalForeshadowingCount: fc.integer({ min: 0, max: 20 }),
});

const sceneTypeArb = fc.constantFrom<SceneType>('action', 'dialogue', 'introspection', 'transition');
const rhythmCurveArb = fc.constantFrom<RhythmCurve>('rising', 'falling', 'wave', 'plateau');
const sceneDurationArb = fc.constantFrom<SceneDuration>('short', 'medium', 'long');
const growthStageArb = fc.constantFrom<GrowthStage>('initial', 'challenged', 'growing', 'transformed');
const formalLevelArb = fc.constantFrom<FormalLevel>('very_formal', 'formal', 'neutral', 'casual', 'very_casual');
const vocabularyStyleArb = fc.constantFrom<VocabularyStyle>('literary', 'technical', 'colloquial', 'archaic', 'modern');
const sentencePatternArb = fc.constantFrom<SentencePattern>('long_complex', 'medium', 'short_punchy', 'mixed');
const impressiveMomentTypeArb = fc.constantFrom<ImpressiveMomentType>('combat', 'wisdom', 'emotional', 'humor');
const growthEventTypeArb = fc.constantFrom<GrowthEventType>('skill', 'mindset', 'relationship', 'identity');
const relationshipLevelArb = fc.constantFrom<RelationshipLevel>('stranger', 'acquaintance', 'familiar', 'close', 'intimate', 'hostile', 'enemy');

const scenePlanArb = fc.record({
  sceneNumber: fc.integer({ min: 1, max: 10 }),
  type: sceneTypeArb,
  intensity: fc.float({ min: 0, max: 1, noNaN: true }),
  duration: sceneDurationArb,
  purpose: fc.string({ minLength: 1, maxLength: 100 }),
});

const sceneRhythmPlanArb = fc.record({
  scenes: fc.array(scenePlanArb, { minLength: 3, maxLength: 6 }),
  rhythmCurve: rhythmCurveArb,
  peakPosition: fc.float({ min: 0, max: 1, noNaN: true }),
  overallIntensity: fc.float({ min: 0, max: 1, noNaN: true }),
});

const impressiveMomentArb = fc.record({
  episode: fc.integer({ min: 1, max: 100 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  type: impressiveMomentTypeArb,
});

const characterCharmArb = fc.record({
  catchphrases: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  quirks: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  signatureMoves: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  impressiveMoments: fc.array(impressiveMomentArb, { minLength: 0, maxLength: 10 }),
});

const stageHistoryArb = fc.record({
  stage: growthStageArb,
  startEpisode: fc.integer({ min: 1, max: 100 }),
  endEpisode: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  trigger: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

const growthEventArb = fc.record({
  episode: fc.integer({ min: 1, max: 100 }),
  type: growthEventTypeArb,
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

const turningPointArb = fc.record({
  episode: fc.integer({ min: 1, max: 100 }),
  event: fc.string({ minLength: 1, maxLength: 100 }),
  impact: fc.string({ minLength: 1, maxLength: 100 }),
  beforeState: fc.string({ minLength: 1, maxLength: 50 }),
  afterState: fc.string({ minLength: 1, maxLength: 50 }),
});

const milestoneArb = fc.record({
  episode: fc.integer({ min: 1, max: 100 }),
  milestone: fc.string({ minLength: 1, maxLength: 100 }),
  achieved: fc.boolean(),
});

const characterArcArb = fc.record({
  currentStage: growthStageArb,
  stageHistory: fc.array(stageHistoryArb, { minLength: 0, maxLength: 5 }),
  turningPoints: fc.array(turningPointArb, { minLength: 0, maxLength: 5 }),
  growthEvents: fc.array(growthEventArb, { minLength: 0, maxLength: 10 }),
  milestones: fc.array(milestoneArb, { minLength: 0, maxLength: 5 }),
  lastGrowthEpisode: fc.integer({ min: 0, max: 100 }),
});

const voiceEvolutionArb = fc.record({
  stage: growthStageArb,
  formalLevel: formalLevelArb,
  vocabularyStyle: vocabularyStyleArb,
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

const emotionalAdjustmentArb = fc.record({
  emotion: fc.string({ minLength: 1, maxLength: 30 }),
  adjustments: fc.record({
    formalLevel: fc.option(formalLevelArb, { nil: undefined }),
    sentencePattern: fc.option(sentencePatternArb, { nil: undefined }),
  }),
});

const characterVoiceArb = fc.record({
  formalLevel: formalLevelArb,
  vocabularyStyle: vocabularyStyleArb,
  sentencePattern: sentencePatternArb,
  preferredWords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  avoidedWords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  voiceEvolution: fc.array(voiceEvolutionArb, { minLength: 0, maxLength: 4 }),
  emotionalAdjustments: fc.array(emotionalAdjustmentArb, { minLength: 0, maxLength: 5 }),
});

// ==================== Property Tests ====================

describe('Generation Context Enhancement Property Tests', () => {

  /** Property 2: Budget Allocation Invariant - Validates: Requirements 3.5, 3.6 */
  describe('Property 2: Budget Allocation Invariant', () => {
    it('should have total equal to sum of all module allocations', () => {
      fc.assert(fc.property(episodeNeedsArb, (needs) => {
        const a = allocateBudget(needs);
        const sum = a.previousSummaries + a.characters + a.foreshadowing + a.characterContinuity + a.stateChanges + a.sceneRhythm + a.characterCharm;
        return a.total === sum;
      }), { numRuns: 100 });
    });

    it('should not exceed BASE_BUDGET (12000 characters)', () => {
      fc.assert(fc.property(episodeNeedsArb, (needs) => allocateBudget(needs).total <= BASE_BUDGET), { numRuns: 100 });
    });

    it('should have all module allocations be non-negative', () => {
      fc.assert(fc.property(episodeNeedsArb, (needs) => {
        const a = allocateBudget(needs);
        return a.previousSummaries >= 0 && a.characters >= 0 && a.foreshadowing >= 0 && a.characterContinuity >= 0 && a.stateChanges >= 0 && a.sceneRhythm >= 0 && a.characterCharm >= 0;
      }), { numRuns: 100 });
    });
  });

  /** Property 3: Dynamic Budget Adjustment - Validates: Requirements 3.1, 3.2, 3.3, 3.4 */
  describe('Property 3: Dynamic Budget Adjustment', () => {
    it('should increase foreshadowing budget when overdue foreshadowing exists', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 10 }), (overdueCount) => {
        const needsWithOverdue: IEpisodeNeeds = { hasOverdueForeshadowing: true, overdueCount, warningCount: 0, isNewChapter: false, isClimax: false, absentMainCharacters: [], relationshipMilestones: [], totalForeshadowingCount: overdueCount };
        const needsWithout: IEpisodeNeeds = { ...needsWithOverdue, hasOverdueForeshadowing: false, overdueCount: 0 };
        return allocateBudget(needsWithOverdue).foreshadowing >= allocateBudget(needsWithout).foreshadowing;
      }), { numRuns: 100 });
    });

    it('should increase characters budget for new chapter', () => {
      fc.assert(fc.property(episodeNeedsArb, (baseNeeds) => {
        return allocateBudget({ ...baseNeeds, isNewChapter: true }).characters >= allocateBudget({ ...baseNeeds, isNewChapter: false }).characters;
      }), { numRuns: 100 });
    });

    it('should increase previousSummaries budget for climax', () => {
      fc.assert(fc.property(episodeNeedsArb, (baseNeeds) => {
        return allocateBudget({ ...baseNeeds, isClimax: true }).previousSummaries >= allocateBudget({ ...baseNeeds, isClimax: false }).previousSummaries;
      }), { numRuns: 100 });
    });

    it('should increase characterContinuity budget for absent main characters', () => {
      fc.assert(fc.property(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }), (absentChars) => {
        const needsWithAbsent: IEpisodeNeeds = { hasOverdueForeshadowing: false, overdueCount: 0, warningCount: 0, isNewChapter: false, isClimax: false, absentMainCharacters: absentChars, relationshipMilestones: [], totalForeshadowingCount: 0 };
        const needsWithout: IEpisodeNeeds = { ...needsWithAbsent, absentMainCharacters: [] };
        return allocateBudget(needsWithAbsent).characterContinuity >= allocateBudget(needsWithout).characterContinuity;
      }), { numRuns: 100 });
    });
  });

  /** Property 4: Scene Rhythm Plan Validity - Validates: Requirements 4.2, 4.3, 4.4 */
  describe('Property 4: Scene Rhythm Plan Validity', () => {
    it('should have all scenes with valid types', () => {
      fc.assert(fc.property(sceneRhythmPlanArb, (plan) => {
        const validTypes: SceneType[] = ['action', 'dialogue', 'introspection', 'transition'];
        return plan.scenes.every(scene => validTypes.includes(scene.type));
      }), { numRuns: 100 });
    });

    it('should have all scenes with intensity between 0 and 1', () => {
      fc.assert(fc.property(sceneRhythmPlanArb, (plan) => plan.scenes.every(scene => scene.intensity >= 0 && scene.intensity <= 1)), { numRuns: 100 });
    });

    it('should have valid rhythm curve', () => {
      fc.assert(fc.property(sceneRhythmPlanArb, (plan) => {
        const validCurves: RhythmCurve[] = ['rising', 'falling', 'wave', 'plateau'];
        return validCurves.includes(plan.rhythmCurve);
      }), { numRuns: 100 });
    });

    it('should have peak position between 0 and 1', () => {
      fc.assert(fc.property(sceneRhythmPlanArb, (plan) => plan.peakPosition >= 0 && plan.peakPosition <= 1), { numRuns: 100 });
    });

    it('should pass validation for all generated plans', () => {
      fc.assert(fc.property(sceneRhythmPlanArb, (plan) => validateSceneRhythmPlan(plan).valid), { numRuns: 100 });
    });
  });

  /** Property 6: Character Enhancement Data Structure - Validates: Requirements 7.1, 8.1, 10.1 */
  describe('Property 6: Character Enhancement Data Structure', () => {
    it('should have charm with required array fields', () => {
      fc.assert(fc.property(characterCharmArb, (charm) => Array.isArray(charm.catchphrases) && Array.isArray(charm.quirks) && Array.isArray(charm.signatureMoves) && Array.isArray(charm.impressiveMoments)), { numRuns: 100 });
    });

    it('should have arc with valid currentStage', () => {
      fc.assert(fc.property(characterArcArb, (arc) => {
        const validStages: GrowthStage[] = ['initial', 'challenged', 'growing', 'transformed'];
        return validStages.includes(arc.currentStage);
      }), { numRuns: 100 });
    });

    it('should have voice with valid formalLevel', () => {
      fc.assert(fc.property(characterVoiceArb, (voice) => {
        const validLevels: FormalLevel[] = ['very_formal', 'formal', 'neutral', 'casual', 'very_casual'];
        return validLevels.includes(voice.formalLevel);
      }), { numRuns: 100 });
    });

    it('should pass full validation for all generated enhancements', () => {
      fc.assert(fc.property(characterCharmArb, characterArcArb, characterVoiceArb, (charm, arc, voice) => validateCharacterEnhancement(charm, arc, voice).valid), { numRuns: 100 });
    });
  });

  /** Property 7: Relationship History Consistency - Validates: Requirements 9.1, 9.2 */
  describe('Property 7: Relationship History Consistency', () => {
    it('should detect inconsistent history', () => {
      const relationship: IRelationship = {
        characterAName: 'Alice', characterBName: 'Bob', currentLevel: 'close', sentiment: 0.5,
        history: [
          { episode: 1, fromLevel: 'stranger', toLevel: 'acquaintance', event: 'First meeting' },
          { episode: 5, fromLevel: 'familiar', toLevel: 'close', event: 'Bonding' },
        ],
        keyEvents: [], lastInteractionEpisode: 5,
      };
      expect(checkRelationshipHistoryConsistency(relationship).consistent).toBe(false);
    });

    it('should pass for empty history', () => {
      const relationship: IRelationship = {
        characterAName: 'Alice', characterBName: 'Bob', currentLevel: 'stranger', sentiment: 0,
        history: [], keyEvents: [], lastInteractionEpisode: 0,
      };
      expect(checkRelationshipHistoryConsistency(relationship).consistent).toBe(true);
    });

    it('should pass for consistent single-entry history', () => {
      const relationship: IRelationship = {
        characterAName: 'Alice', characterBName: 'Bob', currentLevel: 'acquaintance', sentiment: 0.2,
        history: [{ episode: 1, fromLevel: 'stranger', toLevel: 'acquaintance', event: 'First meeting' }],
        keyEvents: [], lastInteractionEpisode: 1,
      };
      expect(checkRelationshipHistoryConsistency(relationship).consistent).toBe(true);
    });
  });

  /** Property 8: Growth Stagnation Detection - Validates: Requirements 8.5 */
  describe('Property 8: Growth Stagnation Detection', () => {
    it('should detect stagnation when gap >= 10 episodes', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 90 }), fc.integer({ min: 10, max: 50 }), (lastGrowth, gap) => {
        const arc: ICharacterArc = { currentStage: 'initial', stageHistory: [], turningPoints: [], growthEvents: [], milestones: [], lastGrowthEpisode: lastGrowth };
        const warning = checkGrowthStagnation(arc, lastGrowth + gap);
        return warning !== null;
      }), { numRuns: 100 });
    });

    it('should not detect stagnation when gap < 10 episodes', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 90 }), fc.integer({ min: 0, max: 9 }), (lastGrowth, gap) => {
        const arc: ICharacterArc = { currentStage: 'growing', stageHistory: [], turningPoints: [], growthEvents: [], milestones: [], lastGrowthEpisode: lastGrowth };
        return checkGrowthStagnation(arc, lastGrowth + gap) === null;
      }), { numRuns: 100 });
    });

    it('should include episode count in warning message', () => {
      const arc: ICharacterArc = { currentStage: 'initial', stageHistory: [], turningPoints: [], growthEvents: [], milestones: [], lastGrowthEpisode: 5 };
      const warning = checkGrowthStagnation(arc, 20);
      expect(warning).not.toBeNull();
      expect(warning).toContain('15集');
    });
  });

  /** Property 9: Relationship Stagnation Detection - Validates: Requirements 9.5 */
  describe('Property 9: Relationship Stagnation Detection', () => {
    it('should detect stagnation for meaningful relationships when gap >= 5', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 90 }), fc.integer({ min: 5, max: 50 }), fc.constantFrom<RelationshipLevel>('acquaintance', 'familiar', 'close', 'intimate', 'hostile'), (lastInteraction, gap, level) => {
        const relationship: IRelationship = { characterAName: 'Alice', characterBName: 'Bob', currentLevel: level, sentiment: 0.5, history: [], keyEvents: [], lastInteractionEpisode: lastInteraction };
        return checkRelationshipStagnation(relationship, lastInteraction + gap) !== null;
      }), { numRuns: 100 });
    });

    it('should not detect stagnation for stranger or enemy relationships', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 90 }), fc.integer({ min: 5, max: 50 }), fc.constantFrom<RelationshipLevel>('stranger', 'enemy'), (lastInteraction, gap, level) => {
        const relationship: IRelationship = { characterAName: 'Alice', characterBName: 'Bob', currentLevel: level, sentiment: level === 'enemy' ? -1 : 0, history: [], keyEvents: [], lastInteractionEpisode: lastInteraction };
        return checkRelationshipStagnation(relationship, lastInteraction + gap) === null;
      }), { numRuns: 100 });
    });

    it('should not detect stagnation when gap < 5 episodes', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 90 }), fc.integer({ min: 0, max: 4 }), relationshipLevelArb, (lastInteraction, gap, level) => {
        const relationship: IRelationship = { characterAName: 'Alice', characterBName: 'Bob', currentLevel: level, sentiment: 0.5, history: [], keyEvents: [], lastInteractionEpisode: lastInteraction };
        return checkRelationshipStagnation(relationship, lastInteraction + gap) === null;
      }), { numRuns: 100 });
    });

    it('should include character names in suggestion', () => {
      const relationship: IRelationship = { characterAName: 'Alice', characterBName: 'Bob', currentLevel: 'close', sentiment: 0.8, history: [], keyEvents: [], lastInteractionEpisode: 5 };
      const suggestion = checkRelationshipStagnation(relationship, 15);
      expect(suggestion).not.toBeNull();
      expect(suggestion).toContain('Alice');
      expect(suggestion).toContain('Bob');
    });
  });

  /** Property 10: Voice Profile Evolution Consistency - Validates: Requirements 10.5 */
  describe('Property 10: Voice Profile Evolution Consistency', () => {
    it('should return evolution voice when stage matches', () => {
      fc.assert(fc.property(characterVoiceArb, growthStageArb, formalLevelArb, vocabularyStyleArb, (baseVoice, stage, formalLevel, vocabStyle) => {
        const evolution: IVoiceEvolution = { stage, formalLevel, vocabularyStyle: vocabStyle, description: `Voice for ${stage} stage` };
        const voiceWithEvolution: ICharacterVoice = { ...baseVoice, voiceEvolution: [evolution] };
        const result = getVoiceForStage(voiceWithEvolution, stage);
        return result.formalLevel === formalLevel && result.vocabularyStyle === vocabStyle;
      }), { numRuns: 100 });
    });

    it('should return base voice when no evolution rule exists for stage', () => {
      fc.assert(fc.property(characterVoiceArb, (voice) => {
        const voiceNoEvolution: ICharacterVoice = { ...voice, voiceEvolution: [] };
        const result = getVoiceForStage(voiceNoEvolution, 'transformed');
        return result.formalLevel === voice.formalLevel && result.vocabularyStyle === voice.vocabularyStyle && result.sentencePattern === voice.sentencePattern;
      }), { numRuns: 100 });
    });

    it('should preserve other voice properties when applying evolution', () => {
      fc.assert(fc.property(characterVoiceArb, growthStageArb, (baseVoice, stage) => {
        const evolution: IVoiceEvolution = { stage, formalLevel: 'very_formal', vocabularyStyle: 'literary', description: 'Test evolution' };
        const voiceWithEvolution: ICharacterVoice = { ...baseVoice, voiceEvolution: [evolution] };
        const result = getVoiceForStage(voiceWithEvolution, stage);
        return result.sentencePattern === baseVoice.sentencePattern && JSON.stringify(result.preferredWords) === JSON.stringify(baseVoice.preferredWords) && JSON.stringify(result.avoidedWords) === JSON.stringify(baseVoice.avoidedWords);
      }), { numRuns: 100 });
    });

    it('should use first matching evolution when multiple exist for same stage', () => {
      const baseVoice: ICharacterVoice = { formalLevel: 'neutral', vocabularyStyle: 'colloquial', sentencePattern: 'medium', preferredWords: [], avoidedWords: [], voiceEvolution: [{ stage: 'growing', formalLevel: 'formal', vocabularyStyle: 'literary', description: 'First' }, { stage: 'growing', formalLevel: 'casual', vocabularyStyle: 'modern', description: 'Second' }], emotionalAdjustments: [] };
      const result = getVoiceForStage(baseVoice, 'growing');
      expect(result.formalLevel).toBe('formal');
      expect(result.vocabularyStyle).toBe('literary');
    });
  });
});
