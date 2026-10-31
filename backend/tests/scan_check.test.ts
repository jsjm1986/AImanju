import { describe, it, expect } from 'vitest';
import { scanOverseasScript, normalizeOverseasScript, scanDomesticDialogue, scanMetaLeak } from '../src/services/format/OutputFormatService';

// 中英台词对照标准样例：第X话标题 + 集-场 时间/内外 地点场景头 + 人物行 + ▲动作 + 中英对照同行台词
const OK_SCENE = `第一话

1-1 日/外 农场·溪边

人物：克劳迪娅, 乔凡尼

▲雨点砸在铁皮屋顶上，乔凡尼倒在溪边的泥水里，一动不动。

{升格+特写}

克劳迪娅（急切）：快醒醒！快醒醒！Claudia (Urgently): Wake up! Wake up!

乔凡尼（喘息）：你……你救了我一命。Giovanni (Gasping): You... you saved my life.
`;

describe('中英对照格式扫描', () => {
  it('合规剧本不产生格式违规', () => {
    const vs = scanOverseasScript(OK_SCENE, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('人物行缺失'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('内部标记泄漏'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('缺▲'))).toBeUndefined();
  });

  it('群演编号名块（镇民群像#2 Townsperson #2）识别为合规对照行', () => {
    const c = `第一话\n\n1-1 日/外 小镇广场\n\n人物：镇民群像\n\n▲人群骚动。\n\n镇民群像#2（惶恐）：天哪！Townsperson #2 (Horrified): Oh God!`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('名块不一致'))).toBeUndefined();
  });

  it('场景头缺人物行 命中', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n▲走廊空无一人，灯管闪烁。\n\n艾玛（冷）：出去。Emma (Coldly): Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('人物行缺失'))).toBeTruthy();
  });

  it('人物行后直接接台词 判为硬切', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n艾玛（冷）：出去。Emma (Coldly): Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('硬切'))).toBeTruthy();
  });

  it('旧合并格式（Name EN(emo)：English）判为非对照台词', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她推门进来。\n\nEmma EMMA(Coldly)：Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeTruthy();
  });

  it('纯中文台词（无英文对照）命中', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她推门进来。\n\n艾玛（震惊）：你竟然还活着。`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeTruthy();
  });

  it('▲前缀的台词行（名字(英文情绪): 中文。English.）命中——实测漏检缺陷', () => {
    const c = `第一话\n\n1-1 日/内 教堂·葬礼大厅\n\n人物：卡梅拉\n\n▲棺木停在祭坛前。\n\n▲Camela (Cold Fury): 私生女无权继承。No bastard gets a dime.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeTruthy();
  });

  it('无▲的英文名打头台词变体（Camela (Cold Fury): 中文。English.）命中', () => {
    const c = `第一话\n\n1-1 日/内 教堂·葬礼大厅\n\n人物：卡梅拉\n\n▲棺木停在祭坛前。\n\nCamela (Cold Fury): 私生女无权继承。No bastard gets a dime.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeTruthy();
  });

  it('中文槽位写英文 命中（中文台词缺失）', () => {
    const c = `第一话\n\n1-1 夜/内 排水涵洞\n\n人物：艾琳\n\n▲她压着声音。\n\n艾琳（极低）：Same direction. Same cut. Irene (Very low): Same direction. Same cut.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('中文台词缺失'))).toBeTruthy();
  });

  it('英文情绪混入中文 命中', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她站着。\n\n艾玛（冷）：出去。Emma (冷冷地): Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('英文情绪必须为英文'))).toBeTruthy();
  });

  it('英文台词混入中文字符 命中（important）', () => {
    const c = `第二话\n\n2-1 夜/内 宴会厅\n\n人物：诺亚\n\n▲诺亚站起来。\n\n诺亚（举杯）：五十页灰石碱数据。Noah (Raising glass): Fifty pages of灰石碱 data.`;
    const vs = scanOverseasScript(c, 9000);
    const v = vs.find(v => v.content.includes('英文台词混入中文'));
    expect(v).toBeTruthy();
    expect(v!.severity).toBe('important');
  });

  it('纯英文台词不报混入', () => {
    const c = `第二话\n\n2-1 夜/内 宴会厅\n\n人物：诺亚\n\n▲诺亚站起来。\n\n诺亚（举杯）：全是伪造数据。Noah (Raising glass): All of it falsified.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('英文台词混入中文'))).toBeUndefined();
  });

  it('中文动作行缺▲ 命中', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n她推门进来，灯管闪烁。\n\n艾玛（冷）：出去。Emma (Coldly): Get out.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('缺▲'))).toBeTruthy();
  });

  it('内部标记泄漏：[HOOK]/【核心情绪】/△/出场人物 全部命中', () => {
    const c = `第一话\n出场人物：A、B\n1-1 夜/内 医院·走廊【核心情绪：紧张】\n人物：A\n△开场画面。\n[HOOK]集尾钩子`;
    const vs = scanOverseasScript(c, 9000);
    const leak = vs.find(v => v.content.includes('内部标记泄漏'));
    expect(leak).toBeTruthy();
    expect(leak!.severity).toBe('important');
  });

  it('合法交付标记不误报：【卡点】【字幕：】【闪回】【闪出】', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n【闪回】\n\n▲三年前的雨夜。\n\n【闪出】\n\n▲艾玛站着。\n\n艾玛（冷）：出去。Emma (Coldly): Get out.\n\n【字幕：三天后】\n\n【卡点】`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('内部标记泄漏'))).toBeUndefined();
    expect(vs.find(v => v.content.includes('缺▲'))).toBeUndefined();
  });

  it('V.O. 密度超4条命中', () => {
    const vo = '艾玛（画外音）：我不能放他走。Emma (V.O.): I cannot let him go.';
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她站着。\n\n${vo}\n\n${vo}\n\n${vo}\n\n${vo}\n\n${vo}`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('V.O.边界'))).toBeTruthy();
  });

  it('弱动作句式仍命中', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她走过去把门关了一下。\n\n艾玛（冷）：站住。Emma (Coldly): Stay.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('弱动作'))).toBeTruthy();
  });

  it('超长英文台词命中', () => {
    const long = 'A '.repeat(100).trim();
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她站着。\n\n艾玛（怒）：${long}。Emma (Angry): ${long}`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('英文台词过长'))).toBeTruthy();
  });

  it('道具文字行不判为非对照台词（白名单）', () => {
    const c = `第一话\n\n1-1 夜/内 医院·走廊\n\n人物：艾玛\n\n▲她翻开卷宗。\n\n纸上写着：GHOST。\n\n收款人一栏：D. Ricci。\n\n{特写}封皮备注：CASE 11-04。\n\n艾玛（冷）：站住。Emma (Coldly): Stay.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('对照'))).toBeUndefined();
  });

  it('同一中文名对应多个不相关英文名 命中', () => {
    const c = `第一话\n\n1-1 日/外 农场\n\n人物：薇拉\n\n▲她绞着手帕。\n\n薇拉（轻声）：别动。Vera Hale (Quietly): Stay.\n\n薇拉（大喊）：快跑！Half Voice (Loudly): Run!`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('名块不一致'))).toBeTruthy();
  });

  it('同名简繁写法与昵称前缀不误报', () => {
    const c = `第一话\n\n1-1 日/外 农场\n\n人物：薇拉, 乔凡尼\n\n▲她绞着手帕。\n\n薇拉（轻声）：别动。Vera (Quietly): Stay.\n\n薇拉（大喊）：快跑！Vera Hale (Loudly): Run!\n\n乔凡尼（冷）：住手。Giovanni (Coldly): Stop.\n\n乔凡尼（放软）：求你了。Gio (Softer): Please.`;
    const vs = scanOverseasScript(c, 9000);
    expect(vs.find(v => v.content.includes('名块不一致'))).toBeUndefined();
  });

  it('docx 实样变体全部放行：复合场景头/分行台词/-VO-/卡点前钩/15s回忆/OS在行内', () => {
    // 直接取自《暗域之王》docx 正文的真实行
    const c = `第三话

3-1 日/内 温特家族庄园·门厅

人物：凯·温特, 哈兰·温特

▲凯·温特站在门厅中央。

哈兰（对着落魄的凯假笑）：“家族凑王室宴会血脉名额，接你回家。”
Harlan faked a smile to ragged Kai: "Family needs a blood quota for royal banquet, welcome home."

▲门缝外，罗南·温特的身影僵在原地，拳头攥紧【罗南OS：我就知道，他从来没把凯当家人】。

-VO-：凯·温特OS：三个月。给我三个月。
-VO- Kai Vinter (Inner Voice): Three months. Give me three months.

-VO-：高燃BGM骤起

【卡点前钩】哈兰转身面向观众，高举双手。

【15s快闪回忆】▲镜头1：伊莱娜临终前苍白的脸。

【字幕：暗域之王·凯·温特】【Subtitle: Kai Vinter, the Dark Realm Sovereign】

1-3 三个月前/夜/内 王室星耀宴会大厅

人物：凯·温特, 莉娅

▲水晶灯下。

凯（眼神冰冷，声音清晰）：祖父，你最好祈祷我死透。
Kai (Staring Down at the Abyss, dark purple magic swirling at his fingertips): Grandfather, you'd better pray I die for good.
`;
    const vs = scanOverseasScript(c, 99999);
    const important = vs.filter(v => v.severity === 'important');
    expect(important, important.map(v => `${v.content}|${v.evidence}`).join('\n')).toHaveLength(0);
  });
});

describe('中英对照格式归一化', () => {
  it('集标题归一为"第X话"中文数字', () => {
    expect(normalizeOverseasScript('第10集')).toContain('第十话');
    expect(normalizeOverseasScript('第1集')).toContain('第一话');
    expect(normalizeOverseasScript('第十集')).toContain('第十话');
    expect(normalizeOverseasScript('EP 10')).toContain('第十话');
    expect(normalizeOverseasScript('第12话')).toContain('第十二话');
  });

  it('旧式场景头（地点 时间 内外）归一为新式（时间/内外 地点·子）', () => {
    const n = normalizeOverseasScript('1-5 农场-卧室 日 内');
    expect(n).toContain('1-5 日/内 农场·卧室');
  });

  it('新式场景头保持不变', () => {
    const n = normalizeOverseasScript('9-2 夜/内 王宫·杀阵中枢暗室');
    expect(n).toContain('9-2 夜/内 王宫·杀阵中枢暗室');
  });

  it('动作行缺▲自动补▲', () => {
    const n = normalizeOverseasScript('第一话\n\n1-1 日/外 农场\n\n人物：A\n\n她推门进来。');
    expect(n).toContain('▲她推门进来。');
  });

  it('人物行顿号/中文逗号归一为半角逗号', () => {
    const n = normalizeOverseasScript('人物：奥瑞安王子、哈兰，Kai');
    expect(n).toContain('人物：奥瑞安王子, 哈兰, Kai');
  });

  it('##标题/出场人物/△/--- 全部归一', () => {
    const c = `## 第1集：集名\n出场人物：A、B\n1-1 医院 夜 内【核心情绪：紧张】\n人物：A\n△她推门。\n---\n第2集`;
    const n = normalizeOverseasScript(c);
    expect(n).toContain('第一话');
    expect(n).toContain('第二话');
    expect(n).not.toContain('##');
    expect(n).not.toContain('出场人物');
    expect(n).not.toContain('△');
    expect(n).not.toContain('【核心情绪');
    expect(n).not.toContain('---');
    expect(n).toContain('▲她推门');
  });

  it('(VO)/(v.o.) 归一为 (V.O.)', () => {
    const n = normalizeOverseasScript('艾玛（画外音）(VO)：我先到的。Emma (v.o.): I got to him first.');
    expect(n).toContain('(V.O.)');
  });

  it('裸镜头词冒号写法归一为花括号，闪回/闪出归一为方头括号', () => {
    const c = `特写：纸上写的是"GHOST"。\n慢镜头: 他倒下。\n闪回：三年前的雨夜。`;
    const n = normalizeOverseasScript(c);
    expect(n).toContain('{特写}纸上写的是');
    expect(n).toContain('{慢镜头}他倒下');
    expect(n).toContain('【闪回】三年前的雨夜');
  });
});

describe('国内短剧对白长度扫描', () => {
  const shortLines = Array.from({ length: 10 }, (_, i) => `苏兰（对顾言舟）：短句${i}。`).join('\n');
  it('短句为主体的剧本不产生违规', () => {
    expect(scanDomesticDialogue(`场景1 日 内\n${shortLines}\n△她攥紧工牌。`)).toHaveLength(0);
  });
  it('单句超25字命中"对白长句"', () => {
    const c = `场景1 日 内\n${shortLines}\n心腹（低声）：赵总，铁盒被第三方先取走了，B区3号柜门被撬，只剩张纸条，人已查。`;
    const vs = scanDomesticDialogue(c);
    expect(vs.some(v => v.content.includes('25字以上'))).toBe(true);
    expect(vs.every(v => v.severity === 'normal')).toBe(true);
  });
  it('超15字占比>35%命中"对白整体偏长"', () => {
    const longLines = Array.from({ length: 6 }, (_, i) => `周子墨（急报）：这一条信息量真的有点长超过十五个字${i}`).join('\n');
    const c = `场景1 日 内\n${shortLines}\n${longLines}`;
    const vs = scanDomesticDialogue(c);
    expect(vs.some(v => v.content.includes('占比过高'))).toBe(true);
  });
  it('少量超15字（<=35%）不误报', () => {
    const c = `场景1 日 内\n${shortLines}\n苏兰：TC-2003-007，从来没注销过。`;
    expect(scanDomesticDialogue(c)).toHaveLength(0);
  });
});

describe('元信息泄漏扫描', () => {
  it('命中【自检评分】/质检报告段', () => {
    const c = '场景1 日 内\n苏兰：你骗不了我。\n\n【自检评分】\n- 开场钩子：18/20';
    const vs = scanMetaLeak(c);
    expect(vs.length).toBeGreaterThan(0);
    expect(vs[0].severity).toBe('important');
  });
  it('正常剧本不误报', () => {
    expect(scanMetaLeak('场景1 日 内\n苏兰：你骗不了我。\n△她攥紧工牌。')).toHaveLength(0);
  });
});
