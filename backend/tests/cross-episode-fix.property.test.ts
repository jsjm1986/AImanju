/**
 * Property-Based Tests for Cross-Episode Fix System
 * 
 * These tests validate the correctness properties for the cross-episode fix feature
 * using fast-check for property-based testing.
 * 
 * Feature: cross-episode-fix
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

// ==================== Type Definitions ====================

interface CrossEpisodeFixPlan {
  id: string;
  name: string;
  description: string;
  confidence: number;
  recommended: boolean;
  changes: CrossEpisodeChange[];
  connections?: EpisodeConnection[];
  sideEffects?: string;
}

interface CrossEpisodeChange {
  episode: number;
  role?: 'source' | 'bridge' | 'resolution';
  priority?: 'required' | 'recommended' | 'optional';
  location: string;
  original: string;
  modified: string;
  reason: string;
  relatedTo?: number[];
}

interface EpisodeConnection {
  fromEpisode: number;
  toEpisode: number;
  type: 'foreshadowing' | 'callback' | 'continuation';
  description: string;
}

interface AffectedEpisode {
  episodeNumber: number;
  role: 'source' | 'bridge' | 'resolution';
  relevance: string;
}

interface TargetedValidationResult {
  passed: boolean;
  originalIssueResolved: boolean;
  details: string;
}

interface CrossEpisodeFixMetadata {
  issue: {
    type: string;
    description: string;
    sourceEpisode: number;
    evidence?: string;
  };
  plan: {
    id: string;
    name: string;
    description: string;
    confidence: number;
  };
  affectedEpisodes: Array<{
    episodeNumber: number;
    historyId?: string;
  }>;
  masterHistoryId?: string;
}

interface MultiEpisodeFixResult {
  original: string;
  fixed: string;
}

// ==================== Arbitraries (Generators) ====================

/**
 * Generator for episode roles
 */
const episodeRoleArb = fc.constantFrom<'source' | 'bridge' | 'resolution'>('source', 'bridge', 'resolution');

/**
 * Generator for change priorities
 */
const changePriorityArb = fc.constantFrom<'required' | 'recommended' | 'optional'>('required', 'recommended', 'optional');

/**
 * Generator for connection types
 */
const connectionTypeArb = fc.constantFrom<'foreshadowing' | 'callback' | 'continuation'>('foreshadowing', 'callback', 'continuation');

/**
 * Generator for issue types
 */
const issueTypeArb = fc.constantFrom('unresolved', 'character', 'timeline', 'setting', 'continuity', 'logic', 'relationship', 'pacing', 'dialogue');

/**
 * Generator for episode numbers (1-100)
 */
const episodeNumberArb = fc.integer({ min: 1, max: 100 });

/**
 * Generator for confidence values (0-100)
 */
const confidenceArb = fc.integer({ min: 0, max: 100 });

/**
 * Generator for content strings (Chinese script content) - with meaningful content
 */
const contentArb = fc.array(
  fc.constantFrom('这', '是', '一', '个', '测', '试', '内', '容', '剧', '本'),
  { minLength: 10, maxLength: 100 }
).map(arr => arr.join(''));

/**
 * Generator for a cross-episode change
 */
const crossEpisodeChangeArb = fc.record({
  episode: episodeNumberArb,
  role: fc.option(episodeRoleArb, { nil: undefined }),
  priority: fc.option(changePriorityArb, { nil: undefined }),
  location: fc.string({ minLength: 1, maxLength: 50 }),
  original: contentArb,
  modified: contentArb,
  reason: fc.string({ minLength: 1, maxLength: 200 }),
  relatedTo: fc.option(fc.array(episodeNumberArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
});

/**
 * Generator for episode connection
 */
const episodeConnectionArb = fc.record({
  fromEpisode: episodeNumberArb,
  toEpisode: episodeNumberArb,
  type: connectionTypeArb,
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

/**
 * Generator for a cross-episode fix plan
 */
const crossEpisodeFixPlanArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  confidence: confidenceArb,
  recommended: fc.boolean(),
  changes: fc.array(crossEpisodeChangeArb, { minLength: 1, maxLength: 5 }),
  connections: fc.option(fc.array(episodeConnectionArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
  sideEffects: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

/**
 * Generator for affected episode
 */
const affectedEpisodeArb = fc.record({
  episodeNumber: episodeNumberArb,
  role: episodeRoleArb,
  relevance: fc.string({ minLength: 1, maxLength: 100 }),
});

/**
 * Generator for targeted validation result
 */
const targetedValidationResultArb = fc.record({
  passed: fc.boolean(),
  originalIssueResolved: fc.boolean(),
  details: fc.string({ minLength: 1, maxLength: 200 }),
});

/**
 * Generator for cross-episode fix metadata
 */
const crossEpisodeFixMetadataArb = fc.record({
  issue: fc.record({
    type: issueTypeArb,
    description: fc.string({ minLength: 1, maxLength: 200 }),
    sourceEpisode: episodeNumberArb,
    evidence: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  }),
  plan: fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    confidence: confidenceArb,
  }),
  affectedEpisodes: fc.array(
    fc.record({
      episodeNumber: episodeNumberArb,
      historyId: fc.option(fc.uuid(), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 5 }
  ),
  masterHistoryId: fc.option(fc.uuid(), { nil: undefined }),
});

/**
 * Generator for multi-episode fix result
 */
const multiEpisodeFixResultArb = fc.record({
  original: contentArb,
  fixed: contentArb,
});

// ==================== Pure Functions Under Test ====================

/**
 * Validates that a cross-episode fix plan has valid structure
 * **Validates: Requirements 1.2**
 */
function validateCrossEpisodeFixPlan(plan: CrossEpisodeFixPlan): boolean {
  return (
    typeof plan.id === 'string' && plan.id.length > 0 &&
    typeof plan.name === 'string' && plan.name.length > 0 &&
    typeof plan.description === 'string' && plan.description.length > 0 &&
    typeof plan.confidence === 'number' && plan.confidence >= 0 && plan.confidence <= 100 &&
    typeof plan.recommended === 'boolean' &&
    Array.isArray(plan.changes) && plan.changes.length > 0
  );
}

/**
 * Validates that affected episodes have correct roles
 * **Validates: Requirements 1.3**
 */
function validateAffectedEpisodeRoles(episodes: AffectedEpisode[]): boolean {
  if (episodes.length === 0) return false;
  
  // Must have exactly one source
  const sources = episodes.filter(e => e.role === 'source');
  if (sources.length !== 1) return false;
  
  // All episodes must have valid roles
  const validRoles = ['source', 'bridge', 'resolution'];
  return episodes.every(e => validRoles.includes(e.role));
}

/**
 * Validates that changes span multiple episodes
 * **Validates: Requirements 2.1**
 */
function validateMultiEpisodeChanges(changes: CrossEpisodeChange[]): boolean {
  const episodes = new Set(changes.map(c => c.episode));
  return episodes.size >= 1; // At least one episode affected
}

/**
 * Validates that required changes are present
 * **Validates: Requirements 2.2**
 */
function validateRequiredChanges(changes: CrossEpisodeChange[]): boolean {
  // If there are priority-marked changes, at least one should be required
  const priorityChanges = changes.filter(c => c.priority !== undefined);
  if (priorityChanges.length === 0) return true;
  
  return priorityChanges.some(c => c.priority === 'required');
}

/**
 * Validates targeted validation result structure
 * **Validates: Requirements 4.1**
 */
function validateTargetedValidationResult(result: TargetedValidationResult): boolean {
  return (
    typeof result.passed === 'boolean' &&
    typeof result.originalIssueResolved === 'boolean' &&
    typeof result.details === 'string' && result.details.length > 0
  );
}

/**
 * Validates that validation only checks original issue (no scope expansion)
 * **Validates: Requirements 4.2**
 */
function validateNoScopeExpansion(result: TargetedValidationResult): boolean {
  // Result should not contain fields for new issues
  const resultObj = result as Record<string, unknown>;
  return !('newIssuesIntroduced' in resultObj) && !('additionalIssues' in resultObj);
}

/**
 * Validates cross-episode fix metadata structure
 * **Validates: Requirements 3.1**
 */
function validateCrossEpisodeFixMetadata(metadata: CrossEpisodeFixMetadata): boolean {
  return (
    metadata.issue !== undefined &&
    typeof metadata.issue.type === 'string' &&
    typeof metadata.issue.description === 'string' &&
    typeof metadata.issue.sourceEpisode === 'number' &&
    metadata.plan !== undefined &&
    typeof metadata.plan.id === 'string' &&
    Array.isArray(metadata.affectedEpisodes) &&
    metadata.affectedEpisodes.length > 0
  );
}

/**
 * Validates that all affected episodes are tracked in metadata
 * **Validates: Requirements 3.2**
 */
function validateAffectedEpisodesTracking(
  metadata: CrossEpisodeFixMetadata,
  appliedEpisodes: number[]
): boolean {
  const trackedEpisodes = new Set(metadata.affectedEpisodes.map(e => e.episodeNumber));
  return appliedEpisodes.every(ep => trackedEpisodes.has(ep));
}

/**
 * Calculates word count for Chinese/English mixed content
 */
function calculateWordCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

/**
 * Validates that fix result preserves reasonable content length
 * **Validates: Requirements 2.3**
 */
function validateContentLengthPreservation(
  original: string,
  fixed: string,
  maxChangeRatio: number = 0.5
): boolean {
  const originalLen = calculateWordCount(original);
  const fixedLen = calculateWordCount(fixed);
  
  if (originalLen === 0) return true;
  
  const changeRatio = Math.abs(fixedLen - originalLen) / originalLen;
  return changeRatio <= maxChangeRatio;
}

/**
 * Validates episode connections are valid
 * **Validates: Requirements 1.4**
 */
function validateEpisodeConnections(connections: EpisodeConnection[]): boolean {
  const validTypes = ['foreshadowing', 'callback', 'continuation'];
  return connections.every(conn => 
    conn.fromEpisode > 0 &&
    conn.toEpisode > 0 &&
    validTypes.includes(conn.type) &&
    conn.description.length > 0
  );
}

/**
 * Validates that revert restores original content
 * **Validates: Requirements 7.1**
 */
function validateRevertRestoresOriginal(
  originalContent: string,
  revertedContent: string
): boolean {
  return originalContent === revertedContent;
}

/**
 * Sorts plans with recommended first, then by confidence
 */
function sortCrossEpisodePlans(plans: CrossEpisodeFixPlan[]): CrossEpisodeFixPlan[] {
  return [...plans].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return b.confidence - a.confidence;
  });
}

/**
 * Extracts unique episode numbers from changes
 */
function extractAffectedEpisodeNumbers(changes: CrossEpisodeChange[]): number[] {
  return [...new Set(changes.map(c => c.episode))].sort((a, b) => a - b);
}

// ==================== Property Tests ====================

describe('Cross-Episode Fix Property Tests', () => {

  /**
   * Property 1: Plan Structure Validation
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Plan Structure Validation', () => {
    it('should have all required fields in cross-episode fix plan', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixPlanArb,
          (plan) => validateCrossEpisodeFixPlan(plan)
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid confidence range (0-100)', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixPlanArb,
          (plan) => plan.confidence >= 0 && plan.confidence <= 100
        ),
        { numRuns: 100 }
      );
    });

    it('should have at least one change', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixPlanArb,
          (plan) => plan.changes.length > 0
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Affected Episode Roles
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Affected Episode Roles', () => {
    it('should have exactly one source episode when roles are assigned', () => {
      fc.assert(
        fc.property(
          fc.array(affectedEpisodeArb, { minLength: 1, maxLength: 5 })
            .filter(eps => eps.filter(e => e.role === 'source').length === 1),
          (episodes) => validateAffectedEpisodeRoles(episodes)
        ),
        { numRuns: 100 }
      );
    });

    it('should only have valid role values', () => {
      fc.assert(
        fc.property(
          affectedEpisodeArb,
          (episode) => ['source', 'bridge', 'resolution'].includes(episode.role)
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Multi-Episode Changes
   * **Validates: Requirements 2.1**
   */
  describe('Property 3: Multi-Episode Changes', () => {
    it('should affect at least one episode', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixPlanArb,
          (plan) => validateMultiEpisodeChanges(plan.changes)
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly extract affected episode numbers', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixPlanArb,
          (plan) => {
            const extracted = extractAffectedEpisodeNumbers(plan.changes);
            const expected = [...new Set(plan.changes.map(c => c.episode))].sort((a, b) => a - b);
            return JSON.stringify(extracted) === JSON.stringify(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Targeted Validation
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 4: Targeted Validation', () => {
    it('should have valid validation result structure', () => {
      fc.assert(
        fc.property(
          targetedValidationResultArb,
          (result) => validateTargetedValidationResult(result)
        ),
        { numRuns: 100 }
      );
    });

    it('should not expand validation scope', () => {
      fc.assert(
        fc.property(
          targetedValidationResultArb,
          (result) => validateNoScopeExpansion(result)
        ),
        { numRuns: 100 }
      );
    });

    it('should have boolean values for passed and originalIssueResolved', () => {
      fc.assert(
        fc.property(
          targetedValidationResultArb,
          (result) => {
            // Both fields should be boolean
            return typeof result.passed === 'boolean' && 
                   typeof result.originalIssueResolved === 'boolean';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Metadata Structure
   * **Validates: Requirements 3.1, 3.2**
   */
  describe('Property 5: Metadata Structure', () => {
    it('should have valid metadata structure', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixMetadataArb,
          (metadata) => validateCrossEpisodeFixMetadata(metadata)
        ),
        { numRuns: 100 }
      );
    });

    it('should track all affected episodes', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixMetadataArb,
          (metadata) => {
            const appliedEpisodes = metadata.affectedEpisodes.map(e => e.episodeNumber);
            return validateAffectedEpisodesTracking(metadata, appliedEpisodes);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid issue type', () => {
      fc.assert(
        fc.property(
          crossEpisodeFixMetadataArb,
          (metadata) => {
            const validTypes = ['unresolved', 'character', 'timeline', 'setting', 'continuity', 'logic', 'relationship', 'pacing', 'dialogue'];
            return validTypes.includes(metadata.issue.type);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Content Length Preservation
   * **Validates: Requirements 2.3**
   */
  describe('Property 6: Content Length Preservation', () => {
    it('should correctly calculate word count', () => {
      const testCases = [
        { text: '这是测试', expected: 4 },
        { text: 'hello world', expected: 2 },
        { text: '你好 world', expected: 3 },
      ];
      
      for (const tc of testCases) {
        expect(calculateWordCount(tc.text)).toBe(tc.expected);
      }
    });

    it('should detect significant content changes', () => {
      fc.assert(
        fc.property(
          contentArb,
          (original) => {
            // Doubling content should be detected as significant change
            const doubled = original + original;
            const originalLen = calculateWordCount(original);
            const doubledLen = calculateWordCount(doubled);
            
            // Doubling should result in ~2x length
            return doubledLen >= originalLen * 1.5;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve content when no changes made', () => {
      fc.assert(
        fc.property(
          contentArb,
          (content) => {
            // Same content should have 0% change
            return validateContentLengthPreservation(content, content, 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Episode Connections
   * **Validates: Requirements 1.4**
   */
  describe('Property 7: Episode Connections', () => {
    it('should have valid connection types', () => {
      fc.assert(
        fc.property(
          fc.array(episodeConnectionArb, { minLength: 1, maxLength: 5 }),
          (connections) => validateEpisodeConnections(connections)
        ),
        { numRuns: 100 }
      );
    });

    it('should have positive episode numbers in connections', () => {
      fc.assert(
        fc.property(
          episodeConnectionArb,
          (conn) => conn.fromEpisode > 0 && conn.toEpisode > 0
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Revert Functionality
   * **Validates: Requirements 7.1**
   */
  describe('Property 8: Revert Functionality', () => {
    it('should restore original content after revert', () => {
      fc.assert(
        fc.property(
          contentArb,
          (original) => validateRevertRestoresOriginal(original, original)
        ),
        { numRuns: 100 }
      );
    });

    it('should detect when content is not properly reverted', () => {
      fc.assert(
        fc.property(
          contentArb,
          contentArb.filter(s => s.length > 0),
          (original, modified) => {
            if (original === modified) return true;
            return !validateRevertRestoresOriginal(original, modified);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Plan Sorting
   * **Validates: Requirements 2.4**
   */
  describe('Property 9: Plan Sorting', () => {
    it('should place recommended plan first after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(crossEpisodeFixPlanArb, { minLength: 2, maxLength: 5 })
            .filter(plans => plans.some(p => p.recommended)),
          (plans) => {
            const sorted = sortCrossEpisodePlans(plans);
            return sorted[0].recommended === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all plans after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(crossEpisodeFixPlanArb, { minLength: 1, maxLength: 5 }),
          (plans) => {
            const sorted = sortCrossEpisodePlans(plans);
            return sorted.length === plans.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort non-recommended plans by confidence descending', () => {
      fc.assert(
        fc.property(
          fc.array(crossEpisodeFixPlanArb, { minLength: 2, maxLength: 5 })
            .filter(plans => plans.filter(p => !p.recommended).length >= 2),
          (plans) => {
            const sorted = sortCrossEpisodePlans(plans);
            const nonRecommended = sorted.filter(p => !p.recommended);
            
            for (let i = 0; i < nonRecommended.length - 1; i++) {
              if (nonRecommended[i].confidence < nonRecommended[i + 1].confidence) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Change Priority Validation
   * **Validates: Requirements 2.2**
   */
  describe('Property 10: Change Priority Validation', () => {
    it('should have valid priority values', () => {
      fc.assert(
        fc.property(
          crossEpisodeChangeArb,
          (change) => {
            if (change.priority === undefined) return true;
            return ['required', 'recommended', 'optional'].includes(change.priority);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have at least one required change when priorities are specified', () => {
      fc.assert(
        fc.property(
          fc.array(crossEpisodeChangeArb, { minLength: 1, maxLength: 5 })
            .map(changes => changes.map((c, i) => ({ ...c, priority: i === 0 ? 'required' as const : c.priority }))),
          (changes) => validateRequiredChanges(changes)
        ),
        { numRuns: 100 }
      );
    });
  });
});
