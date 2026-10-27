/**
 * 从大纲中获取指定集的梗概
 * 支持两种格式：
 * 1. 字符串格式（实际存储格式）：
 *    第1集：
 *    梗概：100-150字本集详细剧情概括
 *    人物：本集出场人物
 * 2. JSON数组格式（备用）：
 *    { episodeSummaries: [{ episode: 1, summary: "..." }] }
 */
export function getEpisodePlanFromOutline(outline: unknown, episodeNumber: number): string {
  const fallback = `第${episodeNumber}集`;
  if (!outline) {
    return fallback;
  }

  // 处理字符串类型（原始大纲文本）
  if (typeof outline === 'string') {
    const markerIdx = outline.indexOf('分集梗概');
    const section = markerIdx >= 0 ? outline.slice(markerIdx + 4) : outline;
    return parseEpisodeSummaryFromText(section, episodeNumber, markerIdx >= 0);
  }

  // 处理对象类型
  if (typeof outline === 'object') {
    const outlineObj = outline as {
      episodeSummaries?: string | Array<{ episode?: number; summary?: string }>;
      raw?: string;
    };

    // 优先使用 episodeSummaries 字段
    if (typeof outlineObj.episodeSummaries === 'string' && outlineObj.episodeSummaries) {
      // 如果是字符串格式（实际存储格式）
      const result = parseEpisodeSummaryFromText(outlineObj.episodeSummaries, episodeNumber, true);
      if (result !== fallback) {
        return result;
      }
      // 未命中则继续尝试 raw，不提前返回
    } else if (Array.isArray(outlineObj.episodeSummaries)) {
      // 如果是数组格式（备用）
      const episodeSummary = outlineObj.episodeSummaries.find(
        (s) => s.episode === episodeNumber
      );
      if (episodeSummary && episodeSummary.summary) {
        return episodeSummary.summary;
      }
    }

    // 尝试从 raw 字段解析
    if (outlineObj.raw && typeof outlineObj.raw === 'string') {
      const markerIdx = outlineObj.raw.indexOf('分集梗概');
      const section = markerIdx >= 0 ? outlineObj.raw.slice(markerIdx + 4) : outlineObj.raw;
      const result = parseEpisodeSummaryFromText(section, episodeNumber, markerIdx >= 0);
      if (result !== fallback) {
        return result;
      }
    }
  }

  return fallback;
}

/**
 * 从文本中解析指定集的梗概
 * 支持格式：
 * 第N集：
 * 梗概：xxx
 * 人物：xxx
 */
export function parseEpisodeSummaryFromText(
  text: string,
  episodeNumber: number,
  allowListFormat = false
): string {
  const fallback = `第${episodeNumber}集`;
  // 全角数字转半角
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  const lines = normalized.split(/\r?\n/);

  // 集标题行：允许 markdown 前缀、可选括号标注、可选冒号标题
  const headingRe =
    /^[\s#>*-]*第\s*(\d+)\s*集\s*((?:[（(【][^）)】]{0,20}[）)】])?)\s*\**\s*(?:[：:]\s*(.*))?$/;

  let headingIdx = -1;
  let tag = '';
  let headingRest = '';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m && parseInt(m[1], 10) === episodeNumber) {
      headingIdx = i;
      tag = m[2] || '';
      headingRest = (m[3] || '').replace(/[\s*]+$/, '').trim();
      break;
    }
  }

  if (headingIdx >= 0) {
    // 本集块：标题之后到下一个集标题（任意集号）或文末
    const block: string[] = [];
    for (let j = headingIdx + 1; j < lines.length; j++) {
      if (headingRe.test(lines[j])) break;
      block.push(lines[j]);
    }

    let summary = '';
    const gkIdx = block.findIndex((l) => /梗概[：:]/.test(l));
    if (gkIdx >= 0) {
      // 块内含"梗概："：取首个梗概行之后内容，直到"人物："行或块尾
      const parts = [block[gkIdx].replace(/^.*?梗概[：:]\s*/, '')];
      for (let k = gkIdx + 1; k < block.length; k++) {
        if (/^\s*人物[：:]/.test(block[k])) break;
        parts.push(block[k]);
      }
      summary = parts.join(' ');
    } else {
      // 否则整块去掉人物行、分隔线、空行
      summary = block
        .filter(
          (l) =>
            !/^\s*人物[：:]/.test(l) &&
            !/^\s*(?:-{3,}|\*{3,})\s*$/.test(l) &&
            l.trim() !== ''
        )
        .join(' ');
    }
    summary = summary.replace(/\s+/g, ' ').trim();

    // 标题行冒号后若以"梗概："开头，去掉前缀视为内容
    let headingContent = '';
    if (/^梗概[：:]/.test(headingRest)) {
      headingContent = headingRest.replace(/^梗概[：:]\s*/, '');
      headingRest = '';
    }

    let title = '';
    if (!summary) {
      summary = headingContent || headingRest;
    } else {
      title = headingRest;
    }

    if (summary.length >= 5) {
      return `${tag}${title ? title + '：' : ''}${summary}`;
    }
  }

  // 兜底：列表格式 "N. xxx" / "N、xxx"（仅在明确分集梗概段落内启用，避免误配人物卡编号）
  if (allowListFormat) {
    const m = normalized.match(
      new RegExp(`(?:^|\\n)${episodeNumber}[.、]\\s*([^\\n]+)`)
    );
    if (m && m[1]) {
      const s = m[1].replace(/人物[：:].*/, '').trim();
      if (s.length > 5) {
        return s;
      }
    }
  }

  return fallback;
}
