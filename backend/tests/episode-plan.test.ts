import { describe, it, expect } from 'vitest';
import {
  getEpisodePlanFromOutline,
  parseEpisodeSummaryFromText,
} from '../src/utils/episodePlan';

describe('parseEpisodeSummaryFromText', () => {
  it('1. ## 第N集（无冒号标题）+ 梗概/人物块', () => {
    const t = '## 第1集\n\n梗概：A内容一。\n\n人物：甲，乙\n\n## 第2集\n\n梗概：B内容二。\n\n人物：丙';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('A内容一。');
    expect(parseEpisodeSummaryFromText(t, 2)).toBe('B内容二。');
  });

  it('2. 梗概正文内含"第"字不截断，冒号后文本为标题', () => {
    const t = '## 第4集：双份编号\n\n梗概：艾琳把第一批蔬菜送去市场，第三排货架全是假的。\n人物：Irene\n\n## 第5集：微型实验田\n\n梗概：五的内容很长很长。\n人物：Ethan';
    expect(parseEpisodeSummaryFromText(t, 4)).toBe('双份编号：艾琳把第一批蔬菜送去市场，第三排货架全是假的。');
    expect(parseEpisodeSummaryFromText(t, 5)).toBe('微型实验田：五的内容很长很长。');
  });

  it('3. 括号标注（一卡）保留在结果前缀', () => {
    const t = '## 第8集（一卡）：玻璃上的三个字\n\n梗概：卡点内容足够长。\n人物：x';
    expect(parseEpisodeSummaryFromText(t, 8)).toBe('（一卡）玻璃上的三个字：卡点内容足够长。');
  });

  it('4. 旧格式 第N集：（空标题）+ 梗概块', () => {
    const t = '第1集：\n梗概：旧格式内容一二三。\n人物：甲\n\n第2集：\n梗概：旧格式内容四五六。\n人物：乙';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('旧格式内容一二三。');
    expect(parseEpisodeSummaryFromText(t, 2)).toBe('旧格式内容四五六。');
  });

  it('5. 单行格式 第N集：内容', () => {
    const t = '第1集：单行格式的内容一二三\n第2集：单行格式的内容四五六';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('单行格式的内容一二三');
    expect(parseEpisodeSummaryFromText(t, 2)).toBe('单行格式的内容四五六');
  });

  it('6. 加粗标题 **第1集：标题**，尾部星号去除', () => {
    const t = '**第1集：泥地里的泉眼**\n梗概：加粗标题的内容。\n人物：x';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('泥地里的泉眼：加粗标题的内容。');
  });

  it('7. 梗概正文提及"第3集"等不误判为标题；缺失集回退', () => {
    const t = '## 第1集\n\n梗概：她想起第3集伏笔，第2集开头也提过。\n人物：x\n\n## 第2集\n\n梗概：第二集真正内容。';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('她想起第3集伏笔，第2集开头也提过。');
    expect(parseEpisodeSummaryFromText(t, 2)).toBe('第二集真正内容。');
    expect(parseEpisodeSummaryFromText(t, 3)).toBe('第3集');
  });

  it('8. 梗概跨多行折叠为单行', () => {
    const t = '第1集：\n梗概：第一行内容，\n第二行续写内容。\n人物：甲';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('第一行内容， 第二行续写内容。');
  });

  it('12. 全角集数标题', () => {
    const t = '## 第１集\n梗概：全角数字内容。';
    expect(parseEpisodeSummaryFromText(t, 1)).toBe('全角数字内容。');
  });
});

describe('getEpisodePlanFromOutline', () => {
  const raw = '### 一、人物卡\n\n1. 玛洛·贝克特（女主角）\n性别：女\n\n### 三、分集梗概\n\n## 第1集\n\n梗概：来自raw的分集内容。\n人物：玛洛';

  it('9. episodeSummaries 空串→继续解析 raw（分集梗概段内，列表编号不误配）', () => {
    expect(getEpisodePlanFromOutline({ episodeSummaries: '', raw }, 1)).toBe('来自raw的分集内容。');
    expect(getEpisodePlanFromOutline({ raw }, 1)).toBe('来自raw的分集内容。');
  });

  it('10. episodeSummaries 缺该集但 raw 有 → 用 raw（无提前返回）', () => {
    const o = { episodeSummaries: '## 第9集\n\n梗概：第九集内容足够长。', raw };
    expect(getEpisodePlanFromOutline(o, 1)).toBe('来自raw的分集内容。');
  });

  it('11. episodeSummaries 数组格式', () => {
    const o = { episodeSummaries: [{ episode: 1, summary: '数组格式内容' }] };
    expect(getEpisodePlanFromOutline(o, 1)).toBe('数组格式内容');
  });

  it('13. episodeSummaries 列表格式 N. 内容', () => {
    const o = { episodeSummaries: '1. 列表格式第一集内容\n2. 列表格式第二集内容' };
    expect(getEpisodePlanFromOutline(o, 2)).toBe('列表格式第二集内容');
  });
});
