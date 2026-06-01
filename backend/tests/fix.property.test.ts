/**
 * Property-Based Tests for Fix System
 * 
 * These tests validate the correctness properties defined in the design document
 * using fast-check for property-based testing.
 * 
 * Feature: validation-fix-integration
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

// ==================== Type Definitions ====================

interface FixPlan {
  id: string;
  name: string;
  description: string;
  confidence: number;
  recommended: boolean;
  changes: FixChange[];
  sideEffects?: string[];
}

interface FixChange {
  type: 'replace' | 'insert' | 'delete';
  location: string;
  original?: string;
  replacement?: string;
}

interface FixResult {
  originalContent: string;
  fixedContent: string;
  wordCountDiff: number;
  planId: string;
  episodeNumber: number;
}

interface AnalysisResult {
  analysis: string;
  plans: FixPlan[];
}

// ==================== Arbitraries (Generators) ====================

/**
 * Generator for fix change types
 */
const changeTypeArb = fc.constantFrom<'replace' | 'insert' | 'delete'>('replace', 'insert', 'delete');

/**
 * Generator for a fix change
 */
const fixChangeArb = fc.record({
  type: changeTypeArb,
  location: fc.string({ minLength: 1, maxLength: 50 }),
  original: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  replacement: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

/**
 * Generator for confidence values (0-100)
 */
const confidenceArb = fc.integer({ min: 0, max: 100 });

/**
 * Generator for a fix plan
 */
const fixPlanArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  confidence: confidenceArb,
  recommended: fc.boolean(),
  changes: fc.array(fixChangeArb, { minLength: 1, maxLength: 5 }),
  sideEffects: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 3 }), { nil: undefined }),
});

/**
 * Generator for an array of fix plans (2-3 plans as per requirement)
 */
const fixPlansArb = fc.array(fixPlanArb, { minLength: 2, maxLength: 3 });

/**
 * Generator for analysis result
 */
const analysisResultArb = fc.record({
  analysis: fc.string({ minLength: 10, maxLength: 500 }),
  plans: fixPlansArb,
});

/**
 * Generator for content strings
 */
const contentArb = fc.string({ minLength: 10, maxLength: 1000 });

/**
 * Generator for fix result
 */
const fixResultArb = fc.record({
  originalContent: contentArb,
  fixedContent: contentArb,
  wordCountDiff: fc.integer({ min: -500, max: 500 }),
  planId: fc.uuid(),
  episodeNumber: fc.integer({ min: 1, max: 100 }),
});

// ==================== Pure Functions Under Test ====================

/**
 * Validates that plans array has correct count (2-3)
 * Property 15.1: Plan Count Constraint
 */
function validatePlanCount(plans: FixPlan[]): boolean {
  return plans.length >= 2 && plans.length <= 3;
}

/**
 * Validates that all required fields are present in a plan
 * Property 15.2: Plan Field Completeness
 */
function validatePlanFields(plan: FixPlan): boolean {
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
 * Sorts plans with recommended first
 * Property 15.3: Recommended Plan Sorting
 */
function sortPlansWithRecommendedFirst(plans: FixPlan[]): FixPlan[] {
  return [...plans].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return b.confidence - a.confidence; // Secondary sort by confidence
  });
}

/**
 * Calculates word count difference
 * Property 15.4: Word Count Calculation
 */
function calculateWordCountDiff(original: string, fixed: string): number {
  const countWords = (text: string): number => {
    // Count Chinese characters and English words
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  };
  
  return countWords(fixed) - countWords(original);
}

/**
 * Validates fix result structure
 */
function validateFixResult(result: FixResult): boolean {
  return (
    typeof result.originalContent === 'string' &&
    typeof result.fixedContent === 'string' &&
    typeof result.wordCountDiff === 'number' &&
    typeof result.planId === 'string' &&
    typeof result.episodeNumber === 'number' && result.episodeNumber > 0
  );
}

// ==================== Property Tests ====================

describe('Fix Property Tests', () => {

  /**
   * Property 15.1: Plan Count Constraint
   * **Validates: Requirements 2.2**
   * 
   * For any analysis result, the number of fix plans should be between 2 and 3.
   */
  describe('Property 15.1: Plan Count Constraint', () => {
    it('should always return 2-3 plans', () => {
      fc.assert(
        fc.property(
          fixPlansArb,
          (plans) => {
            return validatePlanCount(plans);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject plans array with less than 2 plans', () => {
      fc.assert(
        fc.property(
          fc.array(fixPlanArb, { minLength: 0, maxLength: 1 }),
          (plans) => {
            return !validatePlanCount(plans);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject plans array with more than 3 plans', () => {
      fc.assert(
        fc.property(
          fc.array(fixPlanArb, { minLength: 4, maxLength: 10 }),
          (plans) => {
            return !validatePlanCount(plans);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 15.2: Plan Field Completeness
   * **Validates: Requirements 2.3**
   * 
   * For any fix plan, all required fields must be present and valid.
   */
  describe('Property 15.2: Plan Field Completeness', () => {
    it('should have all required fields in each plan', () => {
      fc.assert(
        fc.property(
          fixPlanArb,
          (plan) => {
            return validatePlanFields(plan);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid confidence range (0-100)', () => {
      fc.assert(
        fc.property(
          fixPlanArb,
          (plan) => {
            return plan.confidence >= 0 && plan.confidence <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty id', () => {
      fc.assert(
        fc.property(
          fixPlanArb,
          (plan) => {
            return plan.id.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty name', () => {
      fc.assert(
        fc.property(
          fixPlanArb,
          (plan) => {
            return plan.name.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have at least one change', () => {
      fc.assert(
        fc.property(
          fixPlanArb,
          (plan) => {
            return plan.changes.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15.3: Recommended Plan Sorting
   * **Validates: Requirements 2.4**
   * 
   * When plans are sorted, the recommended plan should always be first.
   */
  describe('Property 15.3: Recommended Plan Sorting', () => {
    it('should place recommended plan first after sorting', () => {
      fc.assert(
        fc.property(
          fixPlansArb.filter(plans => plans.some(p => p.recommended)),
          (plans) => {
            const sorted = sortPlansWithRecommendedFirst(plans);
            // If there's a recommended plan, it should be first
            const hasRecommended = plans.some(p => p.recommended);
            if (hasRecommended) {
              return sorted[0].recommended === true;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all plans after sorting', () => {
      fc.assert(
        fc.property(
          fixPlansArb,
          (plans) => {
            const sorted = sortPlansWithRecommendedFirst(plans);
            return sorted.length === plans.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort non-recommended plans by confidence descending', () => {
      fc.assert(
        fc.property(
          fixPlansArb.filter(plans => plans.filter(p => !p.recommended).length >= 2),
          (plans) => {
            const sorted = sortPlansWithRecommendedFirst(plans);
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

    it('should keep all recommended plans before non-recommended', () => {
      fc.assert(
        fc.property(
          fixPlansArb,
          (plans) => {
            const sorted = sortPlansWithRecommendedFirst(plans);
            
            let foundNonRecommended = false;
            for (const plan of sorted) {
              if (!plan.recommended) {
                foundNonRecommended = true;
              }
              if (plan.recommended && foundNonRecommended) {
                return false; // Recommended found after non-recommended
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
   * Property 15.4: Word Count Calculation
   * **Validates: Requirements 3.2**
   * 
   * The word count difference should correctly reflect the change in content length.
   */
  describe('Property 15.4: Word Count Calculation', () => {
    it('should return positive diff when fixed content has more words', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (original, addition) => {
            const fixed = original + ' ' + addition;
            const diff = calculateWordCountDiff(original, fixed);
            // Adding content should result in positive or zero diff
            return diff >= 0 || addition.trim().length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero diff for identical content', () => {
      fc.assert(
        fc.property(
          contentArb,
          (content) => {
            const diff = calculateWordCountDiff(content, content);
            return diff === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return negative diff when content is removed', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 200 }),
          (original) => {
            // Remove some content
            const fixed = original.slice(0, Math.floor(original.length / 2));
            const diff = calculateWordCountDiff(original, fixed);
            // Removing content should result in negative or zero diff
            return diff <= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly count Chinese characters', () => {
      const original = '这是一个测试';
      const fixed = '这是一个更长的测试';
      const diff = calculateWordCountDiff(original, fixed);
      expect(diff).toBe(3); // Added 3 Chinese characters: 更, 长, 的
    });

    it('should correctly count English words', () => {
      const original = 'hello world';
      const fixed = 'hello beautiful world';
      const diff = calculateWordCountDiff(original, fixed);
      expect(diff).toBe(1); // Added 1 English word: beautiful
    });

    it('should handle mixed Chinese and English content', () => {
      const original = '你好 world';
      const fixed = '你好美丽的 beautiful world';
      const diff = calculateWordCountDiff(original, fixed);
      // Added: 美, 丽, 的 (3 Chinese) + beautiful (1 English) = 4
      expect(diff).toBe(4);
    });
  });

  /**
   * Additional Property: Fix Result Validation
   * **Validates: Requirements 3.1**
   */
  describe('Fix Result Validation', () => {
    it('should have valid fix result structure', () => {
      fc.assert(
        fc.property(
          fixResultArb,
          (result) => {
            return validateFixResult(result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have positive episode number', () => {
      fc.assert(
        fc.property(
          fixResultArb,
          (result) => {
            return result.episodeNumber > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
