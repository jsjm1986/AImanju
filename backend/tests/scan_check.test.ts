import { describe, it, expect } from 'vitest';
import { scanOverseasScript } from '../src/services/format/OutputFormatService';

describe('场景过渡扫描', () => {
  it('对白→场景头→对白 硬切命中', () => {
    const c = '第1集：测试\n出场人物：A\n1-1医院（夜内）\n△开场画面。\nA：台词\n1-2仓库（夜内）\nB：接话';
    const vs = scanOverseasScript(c);
    const t = vs.find(v => v.content.includes('场景过渡'));
    expect(t).toBeTruthy();
    expect(t!.evidence).toContain('1处');
  });
  it('场景头前△行 或 场景头后△行 不误报', () => {
    const c = '第1集：测试\n出场人物：A\n1-1医院（夜内）\n△开场。\nA：台词\n△切镜：车驶入夜色\n1-2仓库（夜内）\n△仓库内部画面。\nB：接话\n1-3街道（日外）\n△街道画面';
    const vs = scanOverseasScript(c);
    expect(vs.find(v => v.content.includes('场景过渡'))).toBeUndefined();
  });
  it('首个场景头（出场人物后）不误报', () => {
    const c = '第1集：测试\n出场人物：A\n1-1医院（夜内）\nA：开口就说话';
    const vs = scanOverseasScript(c);
    expect(vs.find(v => v.content.includes('场景过渡'))).toBeUndefined();
  });

  it('多个[HOOK]标记命中且为important级', () => {
    const c = '第1集：测试\n出场人物：A\n1-1医院（夜内）【核心情绪：压迫】\n△开场。\n[HOOK]中段钩子\n1-2仓库（夜内）【核心情绪：悬念】\n△画面。\n[HOOK]集尾钩子';
    const vs = scanOverseasScript(c, 5000);
    const hook = vs.find(v => v.content.includes('钩子唯一'));
    expect(hook).toBeTruthy();
    expect(hook!.severity).toBe('important');
  });

  it('长台词命中，出场人物/字幕行不误报', () => {
    const c = '第1集：测试\n出场人物：Adrian Cole、Nora Bennett、Tommy Vance、Diego Ramos\n1-1场（日内）【核心情绪：试探】\n△画面。\nNora：松开。三拨人蹲一条巷子，皮卡里那把撬棍快顶到你后脑勺了，你还攥着东西。\n字幕（特写）：一行两行三行四行五行六行七行八行九行十行十一行十二行十三行';
    const vs = scanOverseasScript(c, 5000);
    const dlg = vs.find(v => v.content.includes('对白精简'));
    expect(dlg).toBeTruthy();
    expect(dlg!.evidence).toContain('命中1行');
  });

  it('场标缺情绪标签 + 缺出场人物行 命中', () => {
    const c = '1-1场（日内）\n△画面。\nA：台词。';
    const vs = scanOverseasScript(c, 5000);
    expect(vs.find(v => v.content.includes('核心情绪'))).toBeTruthy();
    expect(vs.find(v => v.content.includes('出场人物'))).toBeTruthy();
  });

  it('超长△行命中', () => {
    const c = `出场人物：A\n1-1场（日内）【核心情绪：平静】\n△他走过去把门关上又转身拿起桌上的杯子喝了一口水再放下然后走到窗边拉开窗帘往外看了一眼街角`;
    const vs = scanOverseasScript(c, 5000);
    expect(vs.find(v => v.content.includes('动作线精简'))).toBeTruthy();
  });
});
