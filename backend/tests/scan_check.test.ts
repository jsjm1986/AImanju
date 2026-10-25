import { describe, it, expect } from 'vitest';
import { scanOverseasScript, normalizeOverseasScript } from '../src/services/format/OutputFormatService';

// 新生产格式样例：合并双语台词 + 行业标准场景头 + 场景级人物行
const OK_SCENE = `第 1 集
1-1 农场-溪边 日 外
人物：Claudia、Giovanni
雨点砸在铁皮屋顶上，Giovanni倒在溪边的泥水里，一动不动。
{升格+特写}
Claudia CLAUDIA(Urgently)：Wake up! Wake up!
Giovanni GIOVANNI(Gasping)：You... you saved my life.
`;

describe('新生产格式扫描', () => {
  it('合规剧本不产生格式违规（除可选节奏项外）', () => {
    const vs = scanOverseasScript(OK_SCENE, 9000);
    expect(vs.find(v => v.content.includes('双语'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('人物行缺失'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('英文台词缺失'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('内部标记泄漏'))).toBeUndefined();
  });

  it('场景头缺人物行 命中', () => {
    const c = `第 1 集\n1-1 医院 夜 内\n走廊空无一人，灯管闪烁。\nEmma EMMA(Coldly)：Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('人物行缺失'))).toBeTruthy();
  });

  it('人物行后直接接台词 判为硬切', () => {
    const c = `第 1 集\n1-1 医院 夜 内\n人物：Emma\nEmma EMMA(Coldly)：Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('硬切'))).toBeTruthy();
  });

  it('中文台词（非双语合并行）命中两条违规', () => {
    const c = `第 1 集\n1-1 医院 夜 内\n人物：Emma\n她推门进来。\nEmma：你竟然还活着。\nRyan：闭嘴。`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('双语'))).toBeTruthy();
  });

  it('双语合并行但台词为中文 命中', () => {
    const c = `第 1 集\n1-1 医院 夜 内\n人物：Emma\n她推门进来。\nEmma EMMA(Shocked)：你竟然还活着`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('英文台词缺失'))).toBeTruthy();
  });

  it('内部标记泄漏：[HOOK]/【核心情绪】/△/出场人物/OS： 全部命中', () => {
    const c = `第 1 集\n出场人物：A、B\n1-1 医院 夜 内【核心情绪：紧张】\n人物：A\n△开场画面。\nA A2OS：他说了什么。\n[HOOK]集尾钩子`;
    const vs = scanOverseasScript(c, 9000);
    const leak = vs.find(v => v.content.includes('内部标记泄漏'));
    expect(leak).toBeTruthy();
    expect(leak!.severity).toBe('important');
  });

  it('V.O. 密度超4条命中', () => {
    const vo = 'Emma EMMA(V.O.)：I cannot let him go.';
    const c = `第 1 集\n1-1 医院 夜 内\n人物：Emma\n她站着。\n${vo}\n${vo}\n${vo}\n${vo}\n${vo}`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('V.O.边界'))).toBeTruthy();
  });

  it('弱动作句式仍命中', () => {
    const c = `第 1 集\n1-1 医院 夜 内\n人物：Emma\n她走过去把门关了一下。\nEmma EMMA：Stay.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('弱动作'))).toBeTruthy();
  });

  it('超长英文台词命中', () => {
    const long = 'A '.repeat(60).trim();
    const c = `第 1 集\n1-1 医院 夜 内\n人物：Emma\n她站着。\nEmma EMMA(Angry)：${long}`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('英文台词过长'))).toBeTruthy();
  });
});

describe('新生产格式归一化', () => {
  it('##集标题/出场人物/△/--- 全部归一', () => {
    const c = `## 第1集：集名\n出场人物：A、B\n1-1  医院 夜 内【核心情绪：紧张】\n人物：A\n△她推门。\n---\n第2集`;
    const n = normalizeOverseasScript(c);
    expect(n).toContain('第 1 集');
    expect(n).not.toContain('##');
    expect(n).not.toContain('出场人物');
    expect(n).not.toContain('△');
    expect(n).not.toContain('【核心情绪');
    expect(n).not.toContain('---');
  });

  it('(VO)/(V.O) 归一为 (V.O.)，中英名粘连补空格', () => {
    const c = `ClaudiaCLAUDIA(VO)：I got to him first.`;
    const n = normalizeOverseasScript(c);
    expect(n).toContain('Claudia CLAUDIA(V.O.)：');
  });
});
