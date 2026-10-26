import { createHash } from 'crypto';
import { IOutlineDraft } from '../../models/Project';
import type { OutlineParams, OutlineResult } from './OutlineService';

/** 稳定序列化：对象键排序，保证同输入同键 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

/**
 * 计算大纲输入指纹：规范化全部生成参数 + 模型选择，
 * resume:true 请求必须匹配该键，防止参数已变的请求误续跑
 */
export function computeOutlineInputKey(
  params: OutlineParams,
  mode: 'standard' | 'enhanced',
  modelName: string,
  model: string
): string {
  const canonical = canonicalize({
    name: params.name,
    genre: params.genre,
    type: params.type,
    totalEpisodes: params.totalEpisodes,
    concept: params.concept,
    requirements: params.requirements || '',
    storyMode: params.storyMode || null,
    pacing: params.pacing || null,
    previousSeasonContext: params.previousSeasonContext || null,
    expertIdentity: params.expertIdentity || null,
    mode,
    modelName,
    model,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** 从草稿提取可供服务层续跑的检查点（只认 contiguous 已完成步骤/批次） */
export function draftToResumeCheckpoint(draft: IOutlineDraft) {
  return {
    completedSteps: [...(draft.completedSteps || [])].sort((a, b) => a - b),
    result: draft.result || ({} as Partial<OutlineResult>),
    episodeBatches: [...(draft.episodeBatches || [])].sort((a, b) => a.startEpisode - b.startEpisode),
  };
}

/**
 * 同项目同时只允许一个大纲生成运行（当前部署为单实例）：
 * acquire 返回 false 表示已有运行；完成后必须 release。
 * 进程重启后 map 为空，数据库里残留的 running 草稿仍可 resume，不构成幽灵锁。
 */
const activeOutlineRuns = new Map<string, string>();

export function acquireOutlineRun(projectId: string, generationId: string): boolean {
  if (activeOutlineRuns.has(projectId)) return false;
  activeOutlineRuns.set(projectId, generationId);
  return true;
}

export function releaseOutlineRun(projectId: string, generationId: string): void {
  if (activeOutlineRuns.get(projectId) === generationId) {
    activeOutlineRuns.delete(projectId);
  }
}

export function isOutlineRunActive(projectId: string): boolean {
  return activeOutlineRuns.has(projectId);
}

/** 构建草稿的初始 running 态 */
export function buildRunningDraft(input: {
  generationId: string;
  inputKey: string;
  mode: 'standard' | 'enhanced';
  modelName: string;
  model: string;
  concept?: string;
  requirements?: string;
  generationConfig?: IOutlineDraft['generationConfig'];
}): IOutlineDraft {
  return {
    generationId: input.generationId,
    inputKey: input.inputKey,
    mode: input.mode,
    modelName: input.modelName,
    model: input.model,
    status: 'running',
    completedSteps: [],
    result: { raw: '', characterCards: '', synopsis: '', episodeSummaries: '' },
    episodeBatches: [],
    updatedAt: new Date().toISOString(),
    concept: input.concept,
    requirements: input.requirements,
    generationConfig: input.generationConfig,
  };
}

const ENHANCED_STEP_FIELDS: Record<number, keyof IOutlineDraft['result']> = {
  1: 'storyCore', 2: 'characterFunctions', 3: 'characterCards', 4: 'synopsis', 5: 'episodeSummaries',
};
const STANDARD_STEP_FIELDS: Record<number, keyof IOutlineDraft['result']> = {
  1: 'characterCards', 2: 'synopsis', 3: 'episodeSummaries',
};
const BATCH_SIZE = 20;

/**
 * 校验草稿中的"连续有效前缀"：
 * - 步骤必须从第1步起连续、且对应字段内容非空（缺前置则后续一律重算）
 * - 分集批次仅在分集步骤之前的全部步骤有效时才可复用，
 *   且批次范围必须精确匹配 20 集边界、内容非空；遇空洞即停止采信
 */
export function validateResumePrefix(
  draft: IOutlineDraft,
  mode: 'standard' | 'enhanced',
  totalEpisodes: number
): { completedSteps: number[]; result: Partial<IOutlineDraft['result']>; episodeBatches: IOutlineDraft['episodeBatches'] } {
  const fieldMap = mode === 'enhanced' ? ENHANCED_STEP_FIELDS : STANDARD_STEP_FIELDS;
  const totalSteps = Object.keys(fieldMap).length;
  const declared = new Set(draft.completedSteps || []);
  const result = draft.result || ({} as IOutlineDraft['result']);

  const completedSteps: number[] = [];
  const picked: Partial<IOutlineDraft['result']> = {};
  for (let step = 1; step <= totalSteps; step++) {
    if (!declared.has(step)) break;
    const field = fieldMap[step];
    const value = result[field];
    if (typeof value !== 'string' || !value.trim()) break;
    completedSteps.push(step);
    picked[field] = value;
  }

  // 分集步骤之前必须全部有效，批次才可复用
  const prereqComplete = completedSteps.length >= totalSteps - 1;
  const episodeBatches: IOutlineDraft['episodeBatches'] = [];
  if (prereqComplete) {
    const byStart = new Map((draft.episodeBatches || []).map(b => [b.startEpisode, b]));
    let expected = 1;
    while (expected <= totalEpisodes) {
      const end = Math.min(expected + BATCH_SIZE - 1, totalEpisodes);
      const batch = byStart.get(expected);
      if (!batch || batch.endEpisode !== end || !batch.content?.trim()) break;
      episodeBatches.push({ startEpisode: batch.startEpisode, endEpisode: batch.endEpisode, content: batch.content });
      expected += BATCH_SIZE;
    }
  }

  return { completedSteps, result: picked, episodeBatches };
}
