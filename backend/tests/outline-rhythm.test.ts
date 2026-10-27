import { describe, it, expect } from 'vitest';
import {
  getEnhancedEpisodesBatchPrompt,
  getOutlineEpisodesBatchPrompt,
  getStoryCorePrompt,
  getOutlineSynopsisPrompt,
  getEnhancedSynopsisPrompt,
  getEpisodeRhythm,
  getPaywallEpisodes,
  EnhancedOutlineParams,
} from '../src/services/outline/outlinePrompts';
import { getScriptAgentPrompt } from '../src/services/script/scriptPrompts';
import { buildEpisodeTensionConstraints } from '../src/controllers/worldStateController';
import { IOutputFormatConfig } from '../src/types/OutputFormat';

const overseas: EnhancedOutlineParams = {
  genre: '海外女频',
  type: '美国南方哥特/奇幻逆袭/女性独立/小镇复仇',
  concept: 'x',
  totalEpisodes: 40,
  pacing: 'fast',
  storyMode: 'complete',
};
const domestic: EnhancedOutlineParams = {
  genre: '女频漫剧',
  type: '奇幻',
  concept: 'x',
  totalEpisodes: 40,
};

describe('enhanced batch prompt（增强大纲分批梗概）', () => {
  it('海外第1批：含黄金开局+起伏铁律+金手指首秀指令', () => {
    const p = getEnhancedEpisodesBatchPrompt(overseas, 'core', 'cards', 'syn', 1, 20, 40);
    expect(p).toContain('【第1集黄金开局】');
    expect(p).toContain('【分集起伏铁律】');
    expect(p).toContain('金手指首秀');
    expect(p).toContain('亮出主角金手指并完成"压→扬→再压"起伏');
  });
  it('海外第21批：有起伏铁律，无黄金开局', () => {
    const p = getEnhancedEpisodesBatchPrompt(overseas, 'core', 'cards', 'syn', 21, 40, 40);
    expect(p).toContain('【分集起伏铁律】');
    expect(p).not.toContain('【第1集黄金开局】');
  });
  it('国内第1批：含黄金开局+压扬新危机', () => {
    const p = getEnhancedEpisodesBatchPrompt(domestic, 'core', 'cards', 'syn', 1, 20, 40);
    expect(p).toContain('【第1集黄金开局】');
    expect(p).toContain('"压→扬→新危机"的起伏和结尾悬念');
  });
  it('国内第21批：无黄金开局', () => {
    const p = getEnhancedEpisodesBatchPrompt(domestic, 'core', 'cards', 'syn', 21, 40, 40);
    expect(p).not.toContain('【第1集黄金开局】');
  });
});

describe('outline batch prompt（旧大纲分批梗概）', () => {
  it('第1批：含两个块 + 每集梗概都要有起伏', () => {
    const p = getOutlineEpisodesBatchPrompt('cards', 'syn', 1, 20, 40, '', undefined, false);
    expect(p).toContain('【第1集黄金开局】');
    expect(p).toContain('【分集起伏铁律】');
    expect(p).toContain('每集梗概都要有起伏');
  });
  it('第21批：无黄金开局', () => {
    const p = getOutlineEpisodesBatchPrompt('cards', 'syn', 21, 40, 40, '', undefined, false);
    expect(p).not.toContain('【第1集黄金开局】');
  });
  it('海外第1批：含压扬再压金手指指令', () => {
    const p = getOutlineEpisodesBatchPrompt('cards', 'syn', 1, 20, 40, '', undefined, true);
    expect(p).toContain('亮出主角金手指并完成"压→扬→再压"起伏');
  });
});

describe('storyCore prompt', () => {
  it('海外：金手指首秀+黄金开局+燃点节奏', () => {
    const p = getStoryCorePrompt(overseas);
    expect(p).toContain('## 金手指首秀');
    expect(p).toContain('【第1集黄金开局】');
    expect(p).toContain('开篇（写明第1集"压→扬→再压"的具体起伏）');
    expect(p).toContain('每3-5集一个小燃点');
    expect(p).toContain('第一次大高燃（一卡）');
  });
  it('国内：同块注入', () => {
    const p = getStoryCorePrompt(domestic);
    expect(p).toContain('## 金手指首秀');
    expect(p).toContain('【第1集黄金开局】');
    expect(p).toContain('开篇（写明第1集"压→扬→再压"的具体起伏）');
  });
});

describe('synopsis prompts', () => {
  it('旧大纲 overseas + 国内：都含黄金开局+起伏铁律', () => {
    expect(getOutlineSynopsisPrompt('cards', undefined, true)).toContain('【第1集黄金开局】');
    expect(getOutlineSynopsisPrompt('cards', undefined, true)).toContain('【分集起伏铁律】');
    expect(getOutlineSynopsisPrompt('cards', undefined, false)).toContain('【第1集黄金开局】');
    expect(getOutlineSynopsisPrompt('cards', undefined, false)).toContain('【分集起伏铁律】');
  });
  it('增强 synopsis：海外+国内都含黄金开局', () => {
    expect(getEnhancedSynopsisPrompt(overseas, 'core', 'cards')).toContain('【第1集黄金开局】');
    const d = getEnhancedSynopsisPrompt(domestic, 'core', 'cards');
    expect(d).toContain('【第1集黄金开局】');
    expect(d).toContain('每 3-5 集一个小燃点');
  });
});

describe('getEpisodeRhythm', () => {
  it('40集：含第1集压扬再压+金手指指令与燃点节奏', () => {
    const p = getEpisodeRhythm(40);
    expect(p).toContain('第1集完成"压→扬→再压"一轮起伏并亮出主角金手指');
    expect(p).toContain('每3-5集一个小燃点');
  });
});

describe('script agent prompt', () => {
  it('ep1：单集起伏+第1集黄金开局', () => {
    const p = getScriptAgentPrompt({ episodeNumber: 1 });
    expect(p).toContain('**单集起伏**');
    expect(p).toContain('**第1集黄金开局**');
  });
  it('ep2/无集数：单集起伏在，黄金开局不在', () => {
    const p2 = getScriptAgentPrompt({ episodeNumber: 2 });
    expect(p2).toContain('**单集起伏**');
    expect(p2).not.toContain('**第1集黄金开局**');
    const p0 = getScriptAgentPrompt({});
    expect(p0).toContain('**单集起伏**');
    expect(p0).not.toContain('**第1集黄金开局**');
  });
  it('overseas_drama 配置 + ep1：两个块都在', () => {
    const cfg: IOutputFormatConfig = { mode: 'preset', preset: 'overseas_drama' };
    const p = getScriptAgentPrompt({ episodeNumber: 1, outputFormatConfig: cfg });
    expect(p).toContain('**单集起伏**');
    expect(p).toContain('**第1集黄金开局**');
  });
  it('梗概带卡点标注：注入付费卡点集规则', () => {
    const p = getScriptAgentPrompt({ episodeNumber: 8, episodePlan: '（一卡）摊牌夜：霍太太当众……' });
    expect(p).toContain('**付费卡点集**');
    expect(p).toContain('半次释放');
    const p2 = getScriptAgentPrompt({ episodeNumber: 5, episodePlan: '第5集：玛洛去旧货仓上班' });
    expect(p2).not.toContain('**付费卡点集**');
  });
  it('非海外短剧预设：注入单集节拍硬要求', () => {
    const p = getScriptAgentPrompt({ episodeNumber: 3, outputFormatConfig: { mode: 'preset', preset: 'standard' } });
    expect(p).toContain('单集节拍硬要求');
    expect(p).toContain('场钩');
    const o = getScriptAgentPrompt({ episodeNumber: 3, outputFormatConfig: { mode: 'preset', preset: 'overseas_drama' } });
    expect(o).not.toContain('单集节拍硬要求');
  });
  it('国内短剧预设：默认注入提纯版叙事方法论（无格式冲突段），开关可关', () => {
    const p = getScriptAgentPrompt({ episodeNumber: 3, outputFormatConfig: { mode: 'preset', preset: 'standard' } });
    expect(p).toContain('叙事科学方法论');
    expect(p).toContain('硬性禁止项');
    expect(p).not.toContain('质检报告');
    expect(p).not.toContain('△动作');
    const off = getScriptAgentPrompt({ episodeNumber: 3, outputFormatConfig: { mode: 'preset', preset: 'standard', enableNarrativeMethodology: false } });
    expect(off).not.toContain('叙事科学方法论');
    const overseas = getScriptAgentPrompt({ episodeNumber: 3, outputFormatConfig: { mode: 'preset', preset: 'overseas_drama' } });
    expect(overseas).toContain('叙事科学方法论');
  });
});

describe('付费卡点规划（国内海外通用）', () => {
  it('getPaywallEpisodes：40集 → wall1=8(?)且 wall2>wall1', () => {
    const { wall1, wall2 } = getPaywallEpisodes(40);
    expect(wall1).toBeGreaterThanOrEqual(8);
    expect(wall1).toBeLessThanOrEqual(12);
    expect(wall2).not.toBeNull();
    expect(wall2!).toBeGreaterThan(wall1);
  });
  it('getPaywallEpisodes：10集 → 无二卡', () => {
    const { wall1, wall2 } = getPaywallEpisodes(10);
    expect(wall1).toBeGreaterThanOrEqual(8);
    expect(wall2).toBeNull();
  });
  it('国内分批梗概：含卡点设计与标注要求', () => {
    const p = getOutlineEpisodesBatchPrompt('cards', 'syn', 1, 20, 40, '', undefined, false);
    expect(p).toContain('【付费卡点设计】');
    expect(p).toContain('卡点标注');
    const pe = getEnhancedEpisodesBatchPrompt(domestic, 'core', 'cards', 'syn', 1, 20, 40);
    expect(pe).toContain('【付费卡点设计】');
    expect(pe).toContain('卡点标注');
  });
  it('含卡点集的批次：phaseHint 提示半次释放', () => {
    const p = getOutlineEpisodesBatchPrompt('cards', 'syn', 1, 20, 40, '', undefined, false);
    expect(p).toContain('本批次含卡点集');
    const q = getOutlineEpisodesBatchPrompt('cards', 'syn', 21, 40, 40, '', undefined, false);
    // 40集二卡≈14集在第2批? wall2=min(max(13,14),24)=14 → 21-40批不含卡点
    expect(q).not.toContain('本批次含卡点集');
  });
});

describe('buildEpisodeTensionConstraints', () => {
  it('ep1：2项 tension-1/2，important+verifiable+rhythm，validationCriteria 非空', () => {
    const t = buildEpisodeTensionConstraints(1);
    expect(t).toHaveLength(2);
    expect(t.map(c => c.id)).toEqual(['tension-1', 'tension-2']);
    for (const c of t) {
      expect(c.severity).toBe('important');
      expect(c.category).toBe('verifiable');
      expect(c.type).toBe('rhythm');
      expect(c.validationCriteria?.length).toBeGreaterThan(0);
    }
    expect(t[1].content).toContain('第1集黄金开局');
  });
  it('ep5：tension-1 + tension-4（憋屈过载，ep>1触发）', () => {
    const t = buildEpisodeTensionConstraints(5);
    expect(t.map(c => c.id)).toEqual(['tension-1', 'tension-4']);
  });
  it('ep5 + 卡点标注梗概：追加 tension-3', () => {
    const t = buildEpisodeTensionConstraints(8, { episodePlan: '（一卡）摊牌夜：霍太太当众……' });
    expect(t.map(c => c.id)).toEqual(['tension-1', 'tension-3', 'tension-4']);
    expect(t[1].content).toContain('付费卡点集');
    expect(t[1].validationCriteria?.length).toBeGreaterThan(0);
  });
  it('ep5 + 无卡点标注：不追加 tension-3', () => {
    const t = buildEpisodeTensionConstraints(8, { episodePlan: '第8集：玛洛去旧货仓上班' });
    expect(t.map(c => c.id)).toEqual(['tension-1', 'tension-4']);
  });
});
