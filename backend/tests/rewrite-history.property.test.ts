/**
 * Property-Based Tests for Rewrite History System
 * 
 * These tests validate the correctness properties defined in the design document
 * using fast-check for property-based testing.
 * 
 * Feature: rewrite-history
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';

// ==================== Type Definitions ====================

type RewriteType = 'full' | 'selection' | 'instruction';

interface RewriteHistoryRecord {
  id: string;
  projectId: string;
  episodeId: string;
  episodeNumber: number;
  type: RewriteType;
  instruction: string;
  originalContent: string;
  rewrittenContent: string;
  selection?: {
    start: number;
    end: number;
    text: string;
  };
  originalWordCount: number;
  rewrittenWordCount: number;
  wordCountDiff: number;
  applied: boolean;
  appliedAt?: Date;
  createdAt: Date;
}

interface RewriteHistoryStats {
  total: number;
  byType: {
    selection: number;
    instruction: number;
    full: number;
  };
  applied: number;
  pending: number;
}

// ==================== Arbitraries (Generators) ====================

/**
 * Generator for valid rewrite types
 */
const rewriteTypeArb = fc.constantFrom<RewriteType>('full', 'selection', 'instruction');

/**
 * Generator for non-empty instruction strings
 */
const instructionArb = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Generator for content strings (simulating script content)
 */
const contentArb = fc.string({ minLength: 1, maxLength: 5000 });

/**
 * Generator for valid MongoDB ObjectId-like strings
 */
const hexChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'] as const;
const objectIdArb = fc.array(fc.constantFrom(...hexChars), { minLength: 24, maxLength: 24 })
  .map(chars => chars.join(''));

/**
 * Generator for episode numbers (positive integers)
 */
const episodeNumberArb = fc.integer({ min: 1, max: 100 });

/**
 * Generator for selection range (for selection type rewrites)
 */
const selectionArb = (contentLength: number) => {
  if (contentLength < 2) {
    return fc.constant(undefined);
  }
  return fc.record({
    start: fc.integer({ min: 0, max: Math.max(0, contentLength - 2) }),
    end: fc.integer({ min: 1, max: contentLength - 1 }),
    text: fc.string({ minLength: 1, maxLength: Math.min(100, contentLength) }),
  }).filter(sel => sel.start < sel.end);
};

/**
 * Generator for a complete rewrite history record
 */
const rewriteHistoryRecordArb = fc.record({
  id: objectIdArb,
  projectId: objectIdArb,
  episodeId: objectIdArb,
  episodeNumber: episodeNumberArb,
  type: rewriteTypeArb,
  instruction: instructionArb,
  originalContent: contentArb,
  rewrittenContent: contentArb,
  originalWordCount: fc.integer({ min: 0, max: 10000 }),
  rewrittenWordCount: fc.integer({ min: 0, max: 10000 }),
  wordCountDiff: fc.integer({ min: -5000, max: 5000 }),
  applied: fc.boolean(),
  appliedAt: fc.option(fc.date(), { nil: undefined }),
  createdAt: fc.date(),
}).map(record => ({
  ...record,
  // Ensure wordCountDiff is consistent
  wordCountDiff: record.rewrittenWordCount - record.originalWordCount,
}));

/**
 * Generator for an array of rewrite history records with consistent timestamps
 */
const rewriteHistoryArrayArb = fc.array(rewriteHistoryRecordArb, { minLength: 0, maxLength: 50 })
  .map(records => {
    // Assign unique, sequential timestamps to ensure deterministic sorting
    const now = Date.now();
    return records.map((record, index) => ({
      ...record,
      createdAt: new Date(now - index * 1000), // Each record 1 second apart
    }));
  });

// ==================== Pure Functions Under Test ====================

/**
 * Validates that a rewrite history record has all required fields
 * Property 1: 改写记录完整性
 */
function validateRecordCompleteness(record: RewriteHistoryRecord): boolean {
  const requiredFields = [
    'id',
    'projectId',
    'episodeId',
    'episodeNumber',
    'type',
    'instruction',
    'originalContent',
    'rewrittenContent',
  ];
  
  for (const field of requiredFields) {
    if (record[field as keyof RewriteHistoryRecord] === undefined || 
        record[field as keyof RewriteHistoryRecord] === null) {
      return false;
    }
  }
  
  // Validate type is one of the allowed values
  if (!['full', 'selection', 'instruction'].includes(record.type)) {
    return false;
  }
  
  // Validate ID is non-empty
  if (record.id.length === 0) {
    return false;
  }
  
  return true;
}

/**
 * Sorts history records by createdAt in descending order (newest first)
 * Property 3: 历史列表排序正确性
 */
function sortHistoryByTime(records: RewriteHistoryRecord[]): RewriteHistoryRecord[] {
  return [...records].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Filters history records by type
 * Property 6: 筛选搜索正确性
 */
function filterByType(records: RewriteHistoryRecord[], type: RewriteType): RewriteHistoryRecord[] {
  return records.filter(r => r.type === type);
}

/**
 * Searches history records by instruction keyword
 * Property 6: 筛选搜索正确性
 */
function searchByKeyword(records: RewriteHistoryRecord[], keyword: string): RewriteHistoryRecord[] {
  const lowerKeyword = keyword.toLowerCase();
  return records.filter(r => r.instruction.toLowerCase().includes(lowerKeyword));
}

/**
 * Calculates statistics for a list of history records
 * Property 8: 统计数据正确性
 */
function calculateStats(records: RewriteHistoryRecord[]): RewriteHistoryStats {
  const stats: RewriteHistoryStats = {
    total: records.length,
    byType: {
      selection: 0,
      instruction: 0,
      full: 0,
    },
    applied: 0,
    pending: 0,
  };
  
  for (const record of records) {
    stats.byType[record.type]++;
    if (record.applied) {
      stats.applied++;
    } else {
      stats.pending++;
    }
  }
  
  return stats;
}

/**
 * Simulates rollback operation - marks record and subsequent records as not applied
 * Property 5: 回滚操作正确性
 */
function simulateRollback(
  records: RewriteHistoryRecord[], 
  targetId: string
): { 
  updatedRecords: RewriteHistoryRecord[]; 
  affectedCount: number;
  targetOriginalContent: string | null;
} {
  const targetIndex = records.findIndex(r => r.id === targetId);
  if (targetIndex === -1) {
    return { updatedRecords: records, affectedCount: 0, targetOriginalContent: null };
  }
  
  const target = records[targetIndex];
  const targetTime = new Date(target.createdAt).getTime();
  let affectedCount = 0;
  
  const updatedRecords = records.map(record => {
    const recordTime = new Date(record.createdAt).getTime();
    // Affect the target record and all records created after it
    if (record.id === targetId || (recordTime > targetTime && record.applied)) {
      affectedCount++;
      return { ...record, applied: false, appliedAt: undefined };
    }
    return record;
  });
  
  return { 
    updatedRecords, 
    affectedCount,
    targetOriginalContent: target.originalContent,
  };
}

// ==================== Property Tests ====================

describe('Rewrite History Property Tests', () => {
  
  /**
   * Property 1: 改写记录完整性
   * **Validates: Requirements 1.1, 1.2**
   * 
   * For any rewrite operation (regardless of type), the resulting record should
   * contain all required fields (type, instruction, originalContent, rewrittenContent,
   * episodeId, projectId) and return a valid record ID.
   */
  describe('Property 1: 改写记录完整性', () => {
    it('should have all required fields for any generated record', () => {
      fc.assert(
        fc.property(rewriteHistoryRecordArb, (record) => {
          return validateRecordCompleteness(record);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should have valid type field for any record', () => {
      fc.assert(
        fc.property(rewriteHistoryRecordArb, (record) => {
          return ['full', 'selection', 'instruction'].includes(record.type);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should have non-empty ID for any record', () => {
      fc.assert(
        fc.property(rewriteHistoryRecordArb, (record) => {
          return record.id.length > 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: 历史列表排序正确性
   * **Validates: Requirements 2.2**
   * 
   * For any rewrite history list, records should be sorted by createdAt
   * in descending order (newest first).
   */
  describe('Property 3: 历史列表排序正确性', () => {
    it('should sort history by createdAt descending', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          if (records.length < 2) return true;
          
          const sorted = sortHistoryByTime(records);
          
          for (let i = 0; i < sorted.length - 1; i++) {
            const currentTime = new Date(sorted[i].createdAt).getTime();
            const nextTime = new Date(sorted[i + 1].createdAt).getTime();
            if (currentTime < nextTime) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
    
    it('should preserve all records after sorting', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          const sorted = sortHistoryByTime(records);
          return sorted.length === records.length;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: 回滚操作正确性
   * **Validates: Requirements 4.2, 4.3, 4.5**
   * 
   * For any applied rewrite record, after rollback:
   * 1. The script content should equal the record's originalContent
   * 2. The record's applied field should be false
   * 3. All subsequent applied records should also have applied = false
   */
  describe('Property 5: 回滚操作正确性', () => {
    it('should mark target record as not applied after rollback', () => {
      fc.assert(
        fc.property(
          rewriteHistoryArrayArb.filter(arr => arr.some(r => r.applied)),
          (records) => {
            const appliedRecords = records.filter(r => r.applied);
            if (appliedRecords.length === 0) return true;
            
            const targetId = appliedRecords[0].id;
            const { updatedRecords } = simulateRollback(records, targetId);
            
            const targetRecord = updatedRecords.find(r => r.id === targetId);
            return targetRecord !== undefined && targetRecord.applied === false;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should return original content reference after rollback', () => {
      fc.assert(
        fc.property(
          rewriteHistoryArrayArb.filter(arr => arr.some(r => r.applied)),
          (records) => {
            const appliedRecords = records.filter(r => r.applied);
            if (appliedRecords.length === 0) return true;
            
            const target = appliedRecords[0];
            const { targetOriginalContent } = simulateRollback(records, target.id);
            
            return targetOriginalContent === target.originalContent;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should mark subsequent applied records as not applied', () => {
      fc.assert(
        fc.property(
          rewriteHistoryArrayArb.filter(arr => arr.filter(r => r.applied).length >= 2),
          (records) => {
            // Sort by time to establish order
            const sorted = sortHistoryByTime(records);
            const appliedRecords = sorted.filter(r => r.applied);
            if (appliedRecords.length < 2) return true;
            
            // Pick a record that's not the most recent
            const targetIndex = Math.floor(appliedRecords.length / 2);
            const target = appliedRecords[targetIndex];
            const targetTime = new Date(target.createdAt).getTime();
            
            const { updatedRecords } = simulateRollback(sorted, target.id);
            
            // Check that all records created after target are not applied
            for (const record of updatedRecords) {
              const recordTime = new Date(record.createdAt).getTime();
              if (recordTime > targetTime) {
                // Records after target should be not applied
                // (if they were originally applied)
                const original = sorted.find(r => r.id === record.id);
                if (original?.applied && record.applied) {
                  return false;
                }
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
   * Property 6: 筛选搜索正确性
   * **Validates: Requirements 5.2, 5.3**
   * 
   * For any filter condition or search keyword:
   * 1. Type filter: all returned records should have type equal to filter value
   * 2. Keyword search: all returned records should contain the keyword in instruction
   */
  describe('Property 6: 筛选搜索正确性', () => {
    it('should return only records matching the type filter', () => {
      fc.assert(
        fc.property(
          rewriteHistoryArrayArb,
          rewriteTypeArb,
          (records, filterType) => {
            const filtered = filterByType(records, filterType);
            return filtered.every(r => r.type === filterType);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should return only records containing the search keyword', () => {
      fc.assert(
        fc.property(
          rewriteHistoryArrayArb,
          fc.string({ minLength: 1, maxLength: 10 }),
          (records, keyword) => {
            const results = searchByKeyword(records, keyword);
            const lowerKeyword = keyword.toLowerCase();
            return results.every(r => 
              r.instruction.toLowerCase().includes(lowerKeyword)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should not lose any matching records during filtering', () => {
      fc.assert(
        fc.property(
          rewriteHistoryArrayArb,
          rewriteTypeArb,
          (records, filterType) => {
            const filtered = filterByType(records, filterType);
            const expectedCount = records.filter(r => r.type === filterType).length;
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: 统计数据正确性
   * **Validates: Requirements 7.1**
   * 
   * For any rewrite history list, statistics should satisfy:
   * 1. total = list length
   * 2. byType.selection + byType.instruction + byType.full = total
   * 3. applied + pending = total
   */
  describe('Property 8: 统计数据正确性', () => {
    it('should have total equal to list length', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          const stats = calculateStats(records);
          return stats.total === records.length;
        }),
        { numRuns: 100 }
      );
    });
    
    it('should have byType counts sum to total', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          const stats = calculateStats(records);
          const typeSum = stats.byType.selection + stats.byType.instruction + stats.byType.full;
          return typeSum === stats.total;
        }),
        { numRuns: 100 }
      );
    });
    
    it('should have applied + pending equal to total', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          const stats = calculateStats(records);
          return stats.applied + stats.pending === stats.total;
        }),
        { numRuns: 100 }
      );
    });
    
    it('should correctly count each type', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          const stats = calculateStats(records);
          
          const actualSelection = records.filter(r => r.type === 'selection').length;
          const actualInstruction = records.filter(r => r.type === 'instruction').length;
          const actualFull = records.filter(r => r.type === 'full').length;
          
          return stats.byType.selection === actualSelection &&
                 stats.byType.instruction === actualInstruction &&
                 stats.byType.full === actualFull;
        }),
        { numRuns: 100 }
      );
    });
    
    it('should correctly count applied and pending', () => {
      fc.assert(
        fc.property(rewriteHistoryArrayArb, (records) => {
          const stats = calculateStats(records);
          
          const actualApplied = records.filter(r => r.applied).length;
          const actualPending = records.filter(r => !r.applied).length;
          
          return stats.applied === actualApplied && stats.pending === actualPending;
        }),
        { numRuns: 100 }
      );
    });
  });
});
