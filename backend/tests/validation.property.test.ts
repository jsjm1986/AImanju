/**
 * Property-Based Tests for Validation System
 * 
 * These tests validate the correctness properties defined in the design document
 * using fast-check for property-based testing.
 * 
 * Feature: validation-workspace
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';

// ==================== Type Definitions ====================

type IssueType = 'error' | 'warning' | 'info';
type IssueCategory = 'logic' | 'character' | 'timeline' | 'unresolved' | 'setting' | 'continuity' | 'relationship' | 'pacing' | 'dialogue';

interface ValidationIssue {
  type: IssueType;
  category: IssueCategory;
  episode: number;
  description: string;
  evidence?: string;
  suggestion?: string;
  location?: string;
  isGlobal?: boolean;
  windowRange?: string;
}

interface FilterState {
  type: IssueType | '';
  episode: number | '';
  category: IssueCategory | '';
  isGlobal: boolean | null;
}

interface EpisodeIssueGroup {
  episode: number;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

// ==================== Arbitraries (Generators) ====================

/**
 * Generator for issue types
 */
const issueTypeArb = fc.constantFrom<IssueType>('error', 'warning', 'info');

/**
 * Generator for issue categories
 */
const issueCategoryArb = fc.constantFrom<IssueCategory>(
  'logic', 'character', 'timeline', 'unresolved', 
  'setting', 'continuity', 'relationship', 'pacing', 'dialogue'
);

/**
 * Generator for episode numbers
 */
const episodeNumberArb = fc.integer({ min: 1, max: 100 });

/**
 * Generator for a validation issue
 */
const validationIssueArb = fc.record({
  type: issueTypeArb,
  category: issueCategoryArb,
  episode: episodeNumberArb,
  description: fc.string({ minLength: 1, maxLength: 200 }),
  evidence: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  suggestion: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  location: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  isGlobal: fc.option(fc.boolean(), { nil: undefined }),
  windowRange: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
});

/**
 * Generator for an array of validation issues
 */
const validationIssuesArb = fc.array(validationIssueArb, { minLength: 0, maxLength: 100 });

/**
 * Generator for filter state
 */
const filterStateArb = fc.record({
  type: fc.constantFrom<IssueType | ''>('', 'error', 'warning', 'info'),
  episode: fc.oneof(fc.constant(''), episodeNumberArb) as fc.Arbitrary<number | ''>,
  category: fc.constantFrom<IssueCategory | ''>(
    '', 'logic', 'character', 'timeline', 'unresolved', 
    'setting', 'continuity', 'relationship', 'pacing', 'dialogue'
  ),
  isGlobal: fc.constantFrom<boolean | null>(null, true, false),
});

// ==================== Pure Functions Under Test ====================

/**
 * Filters issues based on filter state
 * Property 1: Filter Consistency
 */
function filterIssues(issues: ValidationIssue[], filter: FilterState): ValidationIssue[] {
  let result = issues;

  if (filter.type) {
    result = result.filter(i => i.type === filter.type);
  }

  if (filter.episode !== '') {
    result = result.filter(i => i.episode === filter.episode);
  }

  if (filter.category) {
    result = result.filter(i => i.category === filter.category);
  }

  if (filter.isGlobal === true) {
    result = result.filter(i => i.isGlobal === true);
  } else if (filter.isGlobal === false) {
    result = result.filter(i => !i.isGlobal);
  }

  return result;
}

/**
 * Sorts issues by severity (error > warning > info)
 * Property 2: Severity Sorting
 */
function sortBySeverity(issues: ValidationIssue[]): ValidationIssue[] {
  const severityOrder: Record<IssueType, number> = { error: 0, warning: 1, info: 2 };
  return [...issues].sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);
}

/**
 * Groups issues by episode
 * Property 3: Episode Grouping Completeness
 */
function groupByEpisode(issues: ValidationIssue[]): Record<number, EpisodeIssueGroup> {
  const groups: Record<number, EpisodeIssueGroup> = {};

  for (const issue of issues) {
    if (!groups[issue.episode]) {
      groups[issue.episode] = {
        episode: issue.episode,
        issues: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      };
    }

    groups[issue.episode].issues.push(issue);

    if (issue.type === 'error') {
      groups[issue.episode].errorCount++;
    } else if (issue.type === 'warning') {
      groups[issue.episode].warningCount++;
    } else {
      groups[issue.episode].infoCount++;
    }
  }

  return groups;
}

// ==================== Property Tests ====================

describe('Validation Property Tests', () => {

  /**
   * Property 1: Filter Consistency
   * **Validates: Requirements 4.2, 4.3, 4.4, 8.3**
   * 
   * For any set of validation issues and any combination of filter values,
   * the filtered result should only contain issues that match ALL specified filter criteria.
   */
  describe('Property 1: Filter Consistency', () => {
    it('should return only issues matching type filter', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          issueTypeArb,
          (issues, filterType) => {
            const filter: FilterState = { type: filterType, episode: '', category: '', isGlobal: null };
            const filtered = filterIssues(issues, filter);
            return filtered.every(i => i.type === filterType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only issues matching episode filter', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          episodeNumberArb,
          (issues, filterEpisode) => {
            const filter: FilterState = { type: '', episode: filterEpisode, category: '', isGlobal: null };
            const filtered = filterIssues(issues, filter);
            return filtered.every(i => i.episode === filterEpisode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only issues matching category filter', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          issueCategoryArb,
          (issues, filterCategory) => {
            const filter: FilterState = { type: '', episode: '', category: filterCategory, isGlobal: null };
            const filtered = filterIssues(issues, filter);
            return filtered.every(i => i.category === filterCategory);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only global issues when isGlobal filter is true', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const filter: FilterState = { type: '', episode: '', category: '', isGlobal: true };
            const filtered = filterIssues(issues, filter);
            return filtered.every(i => i.isGlobal === true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only local issues when isGlobal filter is false', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const filter: FilterState = { type: '', episode: '', category: '', isGlobal: false };
            const filtered = filterIssues(issues, filter);
            return filtered.every(i => !i.isGlobal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return issues matching ALL filter criteria when multiple filters applied', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          filterStateArb,
          (issues, filter) => {
            const filtered = filterIssues(issues, filter);
            
            return filtered.every(issue => {
              // Check type filter
              if (filter.type && issue.type !== filter.type) return false;
              // Check episode filter
              if (filter.episode !== '' && issue.episode !== filter.episode) return false;
              // Check category filter
              if (filter.category && issue.category !== filter.category) return false;
              // Check global filter
              if (filter.isGlobal === true && issue.isGlobal !== true) return false;
              if (filter.isGlobal === false && issue.isGlobal) return false;
              
              return true;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not lose any matching issues during filtering', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          filterStateArb,
          (issues, filter) => {
            const filtered = filterIssues(issues, filter);
            
            // Count expected matches manually
            const expectedCount = issues.filter(issue => {
              if (filter.type && issue.type !== filter.type) return false;
              if (filter.episode !== '' && issue.episode !== filter.episode) return false;
              if (filter.category && issue.category !== filter.category) return false;
              if (filter.isGlobal === true && issue.isGlobal !== true) return false;
              if (filter.isGlobal === false && issue.isGlobal) return false;
              return true;
            }).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Severity Sorting
   * **Validates: Requirements 4.5**
   * 
   * For any list of validation issues, when sorted by severity,
   * all 'error' issues should appear before 'warning' issues,
   * and all 'warning' issues should appear before 'info' issues.
   */
  describe('Property 2: Severity Sorting', () => {
    it('should place all errors before warnings', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const sorted = sortBySeverity(issues);
            
            let foundWarning = false;
            for (const issue of sorted) {
              if (issue.type === 'warning') {
                foundWarning = true;
              }
              if (issue.type === 'error' && foundWarning) {
                return false; // Error found after warning
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place all warnings before info', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const sorted = sortBySeverity(issues);
            
            let foundInfo = false;
            for (const issue of sorted) {
              if (issue.type === 'info') {
                foundInfo = true;
              }
              if (issue.type === 'warning' && foundInfo) {
                return false; // Warning found after info
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place all errors before info', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const sorted = sortBySeverity(issues);
            
            let foundInfo = false;
            for (const issue of sorted) {
              if (issue.type === 'info') {
                foundInfo = true;
              }
              if (issue.type === 'error' && foundInfo) {
                return false; // Error found after info
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all issues after sorting', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const sorted = sortBySeverity(issues);
            return sorted.length === issues.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain correct severity order throughout the list', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const sorted = sortBySeverity(issues);
            const severityOrder: Record<IssueType, number> = { error: 0, warning: 1, info: 2 };
            
            for (let i = 0; i < sorted.length - 1; i++) {
              if (severityOrder[sorted[i].type] > severityOrder[sorted[i + 1].type]) {
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
   * Property 3: Episode Grouping Completeness
   * **Validates: Requirements 7.2**
   * 
   * For any set of validation issues, when grouped by episode,
   * the total count of issues across all groups should equal the original issue count,
   * and each issue should appear in exactly one group corresponding to its episode number.
   */
  describe('Property 3: Episode Grouping Completeness', () => {
    it('should have total issues across groups equal to original count', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const groups = groupByEpisode(issues);
            const totalInGroups = Object.values(groups).reduce(
              (sum, group) => sum + group.issues.length, 
              0
            );
            return totalInGroups === issues.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place each issue in the correct episode group', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const groups = groupByEpisode(issues);
            
            for (const [episodeStr, group] of Object.entries(groups)) {
              const episode = Number(episodeStr);
              if (!group.issues.every(i => i.episode === episode)) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly count errors in each group', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const groups = groupByEpisode(issues);
            
            for (const group of Object.values(groups)) {
              const actualErrors = group.issues.filter(i => i.type === 'error').length;
              if (group.errorCount !== actualErrors) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly count warnings in each group', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const groups = groupByEpisode(issues);
            
            for (const group of Object.values(groups)) {
              const actualWarnings = group.issues.filter(i => i.type === 'warning').length;
              if (group.warningCount !== actualWarnings) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly count info in each group', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const groups = groupByEpisode(issues);
            
            for (const group of Object.values(groups)) {
              const actualInfo = group.issues.filter(i => i.type === 'info').length;
              if (group.infoCount !== actualInfo) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have counts sum to total issues in each group', () => {
      fc.assert(
        fc.property(
          validationIssuesArb,
          (issues) => {
            const groups = groupByEpisode(issues);
            
            for (const group of Object.values(groups)) {
              const countSum = group.errorCount + group.warningCount + group.infoCount;
              if (countSum !== group.issues.length) {
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
});
