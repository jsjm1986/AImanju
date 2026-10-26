import { describe, it, expect } from 'vitest';
import {
  validateResumePrefix,
  computeOutlineInputKey,
  acquireOutlineRun,
  releaseOutlineRun,
  buildRunningDraft,
} from '../src/services/outline/outlineCheckpoint';
import type { IOutlineDraft } from '../src/models/Project';
import type { OutlineParams } from '../src/services/outline/OutlineService';

function mkDraft(over: Partial<IOutlineDraft>): IOutlineDraft {
  return {
    generationId: 'g1', inputKey: 'k', mode: 'enhanced',
    modelName: 'deepseek-chat', model: 'deepseek-flash',
    status: 'interrupted', completedSteps: [],
    result: { raw: '', characterCards: '', synopsis: '', episodeSummaries: '' },
    episodeBatches: [], updatedAt: new Date().toISOString(),
    ...over,
  };
}

const baseParams: OutlineParams = {
  name: 'p', genre: 'g', type: 't', totalEpisodes: 40, concept: 'c',
  requirements: '', storyMode: 'open_ended',
};

describe('computeOutlineInputKey', () => {
  it('相同输入稳定；参数/模型变化产生不同键', () => {
    const k1 = computeOutlineInputKey(baseParams, 'enhanced', 'deepseek-chat', 'deepseek-flash');
    const k2 = computeOutlineInputKey({ ...baseParams }, 'enhanced', 'deepseek-chat', 'deepseek-flash');
    expect(k1).toBe(k2);
    expect(computeOutlineInputKey({ ...baseParams, concept: 'c2' }, 'enhanced', 'deepseek-chat', 'deepseek-flash')).not.toBe(k1);
    expect(computeOutlineInputKey(baseParams, 'standard', 'deepseek-chat', 'deepseek-flash')).not.toBe(k1);
    expect(computeOutlineInputKey(baseParams, 'enhanced', 'other', 'm')).not.toBe(k1);
  });
});

describe('run lock', () => {
  it('同项目排他；不同 generationId 不释放他人锁', () => {
    const pid = 'p-lock-test';
    expect(acquireOutlineRun(pid, 'g1')).toBe(true);
    expect(acquireOutlineRun(pid, 'g2')).toBe(false);
    releaseOutlineRun(pid, 'g2'); // 不应释放 g1
    expect(acquireOutlineRun(pid, 'g3')).toBe(false);
    releaseOutlineRun(pid, 'g1');
    expect(acquireOutlineRun(pid, 'g3')).toBe(true);
    releaseOutlineRun(pid, 'g3');
  });
});

describe('validateResumePrefix（连续有效前缀）', () => {
  it('步骤1-4+批1有效：恢复4步+1批', () => {
    const draft = mkDraft({
      completedSteps: [1, 2, 3, 4],
      result: { raw: '', storyCore: 'a', characterFunctions: 'b', characterCards: 'c', synopsis: 'd', episodeSummaries: '批1' },
      episodeBatches: [{ startEpisode: 1, endEpisode: 20, content: '批1' }],
    });
    const r = validateResumePrefix(draft, 'enhanced', 40);
    expect(r.completedSteps).toEqual([1, 2, 3, 4]);
    expect(r.episodeBatches).toHaveLength(1);
  });

  it('步骤2存在但步骤1缺失 => 前缀为空且批次不可复用', () => {
    const draft = mkDraft({
      completedSteps: [2, 3],
      result: { raw: '', characterFunctions: 'b', characterCards: 'c', synopsis: '', episodeSummaries: '' },
      episodeBatches: [{ startEpisode: 1, endEpisode: 20, content: 'x' }],
    });
    const r = validateResumePrefix(draft, 'enhanced', 40);
    expect(r.completedSteps).toEqual([]);
    expect(r.episodeBatches).toHaveLength(0);
  });

  it('已声明步骤但字段内容为空 => 终止于该步', () => {
    const draft = mkDraft({
      completedSteps: [1, 2, 3],
      result: { raw: '', storyCore: 'a', characterFunctions: '   ', characterCards: 'c', synopsis: '', episodeSummaries: '' },
      episodeBatches: [],
    });
    const r = validateResumePrefix(draft, 'enhanced', 40);
    expect(r.completedSteps).toEqual([1]);
  });

  it('批2保存但批1缺失 => 批2不可复用（空洞后全部重算）', () => {
    const draft = mkDraft({
      completedSteps: [1, 2, 3, 4],
      result: { raw: '', storyCore: 'a', characterFunctions: 'b', characterCards: 'c', synopsis: 'd', episodeSummaries: '' },
      episodeBatches: [{ startEpisode: 21, endEpisode: 40, content: '批2' }],
    });
    const r = validateResumePrefix(draft, 'enhanced', 40);
    expect(r.episodeBatches).toHaveLength(0);
  });

  it('批次范围不匹配 20 集边界 => 不复用', () => {
    const draft = mkDraft({
      completedSteps: [1, 2, 3, 4],
      result: { raw: '', storyCore: 'a', characterFunctions: 'b', characterCards: 'c', synopsis: 'd', episodeSummaries: '' },
      episodeBatches: [{ startEpisode: 1, endEpisode: 19, content: 'x' }],
    });
    expect(validateResumePrefix(draft, 'enhanced', 40).episodeBatches).toHaveLength(0);
  });

  it('全部5步完成：恢复后无需任何 AI 调用即可终稿', () => {
    const draft = mkDraft({
      completedSteps: [1, 2, 3, 4, 5],
      result: { raw: '', storyCore: 'a', characterFunctions: 'b', characterCards: 'c', synopsis: 'd', episodeSummaries: '全部分集' },
      episodeBatches: [
        { startEpisode: 1, endEpisode: 20, content: '批1' },
        { startEpisode: 21, endEpisode: 40, content: '批2' },
      ],
    });
    const r = validateResumePrefix(draft, 'enhanced', 40);
    expect(r.completedSteps).toEqual([1, 2, 3, 4, 5]);
    expect(r.episodeBatches).toHaveLength(2);
  });

  it('标准模式字段映射正确', () => {
    const draft = mkDraft({
      mode: 'standard',
      completedSteps: [1, 2],
      result: { raw: '', characterCards: 'cc', synopsis: 'syn', episodeSummaries: '' },
    });
    const r = validateResumePrefix(draft, 'standard', 20);
    expect(r.completedSteps).toEqual([1, 2]);
    expect(r.result.characterCards).toBe('cc');
  });
});

describe('buildRunningDraft', () => {
  it('初始 running 草稿含输入快照', () => {
    const d = buildRunningDraft({
      generationId: 'g', inputKey: 'k', mode: 'enhanced',
      modelName: 'deepseek-chat', model: 'deepseek-flash',
      concept: 'c', requirements: 'r',
      generationConfig: { storyMode: 'open_ended' },
    });
    expect(d.status).toBe('running');
    expect(d.completedSteps).toEqual([]);
    expect(d.episodeBatches).toEqual([]);
    expect(d.concept).toBe('c');
    expect(d.generationConfig?.storyMode).toBe('open_ended');
  });
});
