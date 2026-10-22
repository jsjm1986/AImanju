import { Request, Response, Router } from 'express';
import { projectRepository, episodeRepository, characterRepository } from '../repositories';
import { foreshadowingRepository } from '../repositories/ForeshadowingRepository';
import { ContextManager } from '../services/context/ContextManager';
import mongoose from 'mongoose';
import { WordCountService } from '../utils/wordCount';
import { creatorAuth, optionalCreatorAuth, checkProjectQuota, checkEpisodeQuota } from '../middleware/creatorMiddleware';
import { Creator } from '../models/Creator';
import { Project } from '../models/Project';
import { Episode } from '../models/Episode';
import { Character } from '../models/Character';
import { CharacterEnhancement } from '../models/CharacterEnhancement';
import { CharacterRelationship } from '../models/CharacterRelationship';
import { CharacterState } from '../models/CharacterState';
import { WorldState } from '../models/WorldState';
import { Outline } from '../models/Outline';
import { EpisodeSummary } from '../models/EpisodeSummary';
import { Foreshadowing } from '../models/Foreshadowing';
import { ValidationReport } from '../models/ValidationReport';
import { RewriteHistory } from '../models/RewriteHistory';
import { RewriteRequest } from '../models/RewriteRequest';
import { BatchRewriteHistory } from '../models/BatchRewriteHistory';
import { BatchTask } from '../models/BatchTask';
import { GenerationLog } from '../models/GenerationLog';
import { FixSession } from '../models/FixSession';
import { EpisodePurchase } from '../models/EpisodePurchase';
import { Favorite } from '../models/Favorite';
import { ProjectPublish } from '../models/ProjectPublish';
import { PublishRequest } from '../models/PublishRequest';

const router = Router();

// --- 共享辅助函数 ---

type RouteHandler = (req: Request, res: Response) => Promise<void>;

function asyncHandler(fn: RouteHandler): RouteHandler {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  };
}

async function findProjectOrFail(req: Request, res: Response): Promise<any | null> {
  const project = await projectRepository.findById(req.params.id);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return null;
  }
  return project;
}

async function checkProjectOwnership(req: Request, res: Response): Promise<{ project: any } | null> {
  const project = await findProjectOrFail(req, res);
  if (!project) return null;
  if (req.creator?.role !== 'admin' && project.creatorId?.toString() !== req.creatorId) {
    res.status(403).json({ success: false, error: '无权访问此项目' });
    return null;
  }
  return { project };
}

function buildEpisodeData(content: string, extra: Record<string, any> = {}): Record<string, any> {
  return {
    content,
    wordCount: WordCountService.countV1(content || ''),
    wordCountV2: WordCountService.countV2(content || ''),
    wordCountAlgorithm: 'v2',
    ...extra,
  };
}

router.get('/', creatorAuth, asyncHandler(async (req, res) => {
  const creatorId = req.creatorId;
  const { filterCreatorId } = req.query;

  let projects;
  if (req.creator?.role === 'admin') {
    const query = filterCreatorId ? { creatorId: filterCreatorId } : {};
    projects = await Project.find(query)
      .sort({ updatedAt: -1 })
      .populate('tags')
      .populate('creatorId', 'username email tier')
      .lean();
  } else {
    projects = await Project.find({ creatorId })
      .sort({ updatedAt: -1 })
      .populate('tags')
      .lean();
  }

  const { PublishRequest } = await import('../models/PublishRequest');
  const { ProjectPublish } = await import('../models/ProjectPublish');

  const projectIds = projects.map(p => p._id);

  const publishRequests = await PublishRequest.find({ projectId: { $in: projectIds } })
    .sort({ createdAt: -1 })
    .lean();
  const requestMap = new Map<string, any>();
  for (const r of publishRequests) {
    const key = r.projectId.toString();
    if (!requestMap.has(key)) requestMap.set(key, r);
  }

  const publishConfigs = await ProjectPublish.find({ projectId: { $in: projectIds } }).lean();
  const publishMap = new Map(publishConfigs.map(c => [c.projectId.toString(), c]));

  const result = projects.map(p => {
    const pid = p._id.toString();
    const request = requestMap.get(pid);
    const publishConfig = publishMap.get(pid);
    return {
      ...p,
      publishStatus: publishConfig?.isPublished ? 'published' : (request?.status || null),
      publishRequest: request ? {
        _id: request._id,
        status: request.status,
        adminNote: request.adminNote,
        createdAt: request.createdAt,
      } : null,
    };
  });

  res.json({ success: true, data: result });
}));

router.get('/:id', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;
  res.json({ success: true, data: ownership.project });
}));

router.post('/', creatorAuth, checkProjectQuota, asyncHandler(async (req, res) => {
  const { name, genre, type, totalEpisodes, tags, writingStyle, outputFormat } = req.body;
  const creatorId = req.creatorId;

  const project = await projectRepository.create({
    name,
    genre: genre || '男频漫剧',
    type: type || '玄幻',
    totalEpisodes: totalEpisodes || 60,
    status: 'draft',
    tags: tags || [],
    creatorId: new mongoose.Types.ObjectId(creatorId),
    writingStyle: writingStyle || { preset: 'colloquial' },
    ...(outputFormat ? { outputFormat } : {}),
  });

  await Creator.findByIdAndUpdate(creatorId, { $inc: { projectsUsed: 1 } });
  res.status(201).json({ success: true, data: project });
}));

router.put('/:id', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;
  const project = await projectRepository.update(req.params.id, req.body);
  res.json({ success: true, data: project });
}));

// 配额返还逻辑：已生成 >= 10集则不返还配额（防止滥用）
router.delete('/:id', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;
  const { project: existingProject } = ownership;

  const generatedEpisodeCount = await Episode.countDocuments({ projectId: req.params.id });
  await projectRepository.delete(req.params.id);

  // 级联清理项目关联数据，避免孤儿记录
  const projectId = req.params.id;
  const cascades: Array<[string, mongoose.Model<unknown>]> = [
    ['episodes', Episode], ['characters', Character], ['characterEnhancements', CharacterEnhancement],
    ['characterRelationships', CharacterRelationship], ['characterStates', CharacterState],
    ['worldStates', WorldState], ['outlines', Outline], ['episodeSummaries', EpisodeSummary],
    ['foreshadowings', Foreshadowing], ['validationReports', ValidationReport],
    ['rewriteHistories', RewriteHistory], ['rewriteRequests', RewriteRequest],
    ['batchRewriteHistories', BatchRewriteHistory], ['batchTasks', BatchTask],
    ['generationLogs', GenerationLog], ['fixSessions', FixSession],
    ['episodePurchases', EpisodePurchase], ['favorites', Favorite],
    ['projectPublishes', ProjectPublish], ['publishRequests', PublishRequest],
  ];
  const results = await Promise.allSettled(cascades.map(([, m]) => m.deleteMany({ projectId })));
  const removed = cascades.reduce<number>((sum, [name], i) => {
    const r = results[i];
    if (r.status === 'rejected') {
      console.error(`[Delete] 级联清理 ${name} 失败:`, r.reason);
      return sum;
    }
    return sum + (r.value.deletedCount || 0);
  }, 0);
  console.log(`[Delete] 级联清理完成 - 项目 ${existingProject.name}, 共删除 ${removed} 条关联记录`);

  const EPISODE_THRESHOLD = 10;
  if (existingProject.creatorId && generatedEpisodeCount < EPISODE_THRESHOLD) {
    await Creator.findByIdAndUpdate(existingProject.creatorId, { $inc: { projectsUsed: -1 } });
    console.log(`[Delete] 返还配额 - 项目 ${existingProject.name}, 已生成集数: ${generatedEpisodeCount}`);
  } else if (existingProject.creatorId) {
    console.log(`[Delete] 不返还配额 - 项目 ${existingProject.name}, 已生成集数: ${generatedEpisodeCount} >= ${EPISODE_THRESHOLD}`);
  }

  res.json({
    success: true,
    message: generatedEpisodeCount < EPISODE_THRESHOLD
      ? '删除成功，配额已返还'
      : `删除成功（已生成${generatedEpisodeCount}集，配额不返还）`
  });
}));

router.post('/:id/outline', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;

  const { characterCards, synopsis, episodeSummaries } = req.body;
  const outline = [characterCards, synopsis, episodeSummaries].filter(Boolean).join('\n\n');

  const updated = await projectRepository.update(req.params.id, {
    outline,
    status: 'outline_done',
  });

  res.json({ success: true, data: updated });
}));

router.get('/:id/episodes/:episode', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;

  const episode = await episodeRepository.findByNumber(
    req.params.id,
    parseInt(req.params.episode)
  );
  if (!episode) {
    res.status(404).json({ success: false, error: '剧本不存在' });
    return;
  }
  res.json({ success: true, data: episode });
}));

router.post('/:id/episodes/:episode', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;

  const { content, summary } = req.body;
  const episode = await episodeRepository.upsert(
    req.params.id,
    parseInt(req.params.episode),
    buildEpisodeData(content, { summary, status: 'completed' })
  );

  res.json({ success: true, data: episode });
}));

router.post('/:id/episodes-batch', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;

  const { episodes } = req.body;
  const saved = [];

  for (const ep of episodes) {
    await episodeRepository.upsert(
      req.params.id,
      ep.number,
      buildEpisodeData(ep.content, { summary: ep.summary || '', status: 'completed' })
    );
    saved.push(ep.number);
  }

  await projectRepository.update(req.params.id, { status: 'generating' });
  res.json({ success: true, saved });
}));

router.get('/:id/export', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;
  const { project } = ownership;

  const { type, start, end, includeCharacters } = req.query;
  const allEpisodes = await episodeRepository.findByProject(req.params.id);

  const formatOutline = (outline: any): string => {
    if (!outline) return '';
    if (typeof outline === 'string') return `【大纲】\n${outline}\n\n`;

    let content = '';
    if (outline.characterCards) content += `【人物卡】\n${outline.characterCards}\n\n`;
    if (outline.synopsis) content += `【剧情梗概】\n${outline.synopsis}\n\n`;
    if (outline.episodeSummaries) content += `【分集摘要】\n${outline.episodeSummaries}\n\n`;
    if (!content && outline.raw) content = `【大纲】\n${outline.raw}\n\n`;
    return content;
  };

  let exportText = `《${project.name}》\n${'='.repeat(50)}\n\n`;

  if (project.outline) {
    exportText += formatOutline(project.outline);
  }

  if (type === 'outline') {
    const fileName = `${project.name}_大纲`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.txt"`);
    res.send(exportText);
    return;
  }

  if (includeCharacters === 'true') {
    const characters = await characterRepository.findByProject(req.params.id);
    if (characters.length > 0) {
      exportText += `${'='.repeat(50)}\n`;
      exportText += `【角色表】\n`;
      exportText += `${'─'.repeat(50)}\n`;

      for (const char of characters) {
        exportText += `\n◆ ${char.name}`;
        if (char.role) exportText += ` [${char.role}]`;
        exportText += '\n';

        const basicInfo: string[] = [];
        if (char.gender) basicInfo.push(`性别: ${char.gender}`);
        if (char.age) basicInfo.push(`年龄: ${char.age}`);
        if (char.type) basicInfo.push(`类型: ${char.type}`);
        if (basicInfo.length > 0) {
          exportText += `  ${basicInfo.join(' | ')}\n`;
        }

        if (char.identity) exportText += `  身份: ${char.identity}\n`;
        if (char.personality) exportText += `  性格: ${char.personality}\n`;
        if (char.background) exportText += `  背景: ${char.background}\n`;
        if (char.abilities) exportText += `  能力: ${char.abilities}\n`;

        const appearanceParts: string[] = [];
        if (char.hairColor || char.hairStyle) {
          const hair = [char.hairColor, char.hairStyle].filter(Boolean).join('');
          if (hair) appearanceParts.push(hair);
        }
        if (char.faceType) appearanceParts.push(char.faceType);
        if (char.bodyType) appearanceParts.push(char.bodyType);
        if (char.clothing) appearanceParts.push(char.clothing);
        if (char.accessories) appearanceParts.push(char.accessories);

        if (appearanceParts.length > 0) {
          exportText += `  外貌: ${appearanceParts.join('，')}\n`;
        } else if (char.appearance) {
          exportText += `  外貌: ${char.appearance}\n`;
        }

        if (char.initialEquipment && char.initialEquipment.length > 0) {
          exportText += `  初始装备: ${char.initialEquipment.join('、')}\n`;
        }
        if (char.initialAbilities && char.initialAbilities.length > 0) {
          exportText += `  初始能力: ${char.initialAbilities.join('、')}\n`;
        }

        if (char.relationships && char.relationships.length > 0) {
          exportText += `  人物关系:\n`;
          for (const rel of char.relationships) {
            exportText += `    - ${rel.targetName}: ${rel.relationship}\n`;
          }
        }

        exportText += '\n';
      }

      exportText += `${'='.repeat(50)}\n\n`;
    }
  }

  let episodes = allEpisodes;
  let rangeText = '';

  if (start && end) {
    const startNum = parseInt(start as string);
    const endNum = parseInt(end as string);
    if (!isNaN(startNum) && !isNaN(endNum)) {
      episodes = allEpisodes.filter(ep => ep.episodeNumber >= startNum && ep.episodeNumber <= endNum);
      rangeText = `_第${startNum}-${endNum}集`;
    }
  }

  if (episodes.length > 0) {
    exportText += `${'='.repeat(50)}\n`;
    exportText += rangeText ? `【剧本 (${rangeText})】\n` : `【完整剧本】\n`;
    exportText += `${'='.repeat(50)}\n\n`;

    for (const ep of episodes.sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      exportText += `【第${ep.episodeNumber}集】${ep.title || ''}\n\n`;
      exportText += (ep.content || '') + '\n\n';
      exportText += '---\n\n';
    }
  }

  const fileName = `${project.name}${rangeText}`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.txt"`);
  res.send(exportText);
}));

router.get('/:id/search', asyncHandler(async (req, res) => {
  const project = await findProjectOrFail(req, res);
  if (!project) return;

  const { keyword, caseSensitive } = req.query;
  if (!keyword || (keyword as string).trim() === '') {
    res.status(400).json({ success: false, error: '请输入搜索关键字' });
    return;
  }

  const episodes = await episodeRepository.findByProject(req.params.id);
  const searchKey = (keyword as string).trim();
  const flags = caseSensitive === 'true' ? 'g' : 'gi';
  const regex = new RegExp(searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

  const results: Array<{ episode: number; matches: Array<{ context: string; position: number }> }> = [];

  for (const ep of episodes) {
    if (!ep.content) continue;
    const matches: Array<{ context: string; position: number }> = [];
    let match;
    while ((match = regex.exec(ep.content)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(ep.content.length, match.index + searchKey.length + 30);
      matches.push({ context: ep.content.substring(start, end), position: match.index });
    }
    if (matches.length > 0) {
      results.push({ episode: ep.episodeNumber, matches });
    }
  }

  res.json({
    success: true,
    data: {
      keyword: searchKey,
      total: results.reduce((sum, r) => sum + r.matches.length, 0),
      results,
    },
  });
}));

const OVERDUE_THRESHOLD = { high: 10, normal: 20, low: 30 };
const WARNING_THRESHOLD = { high: 5, normal: 10, low: 15 };

router.get('/:id/foreshadowing', asyncHandler(async (req, res) => {
  const project = await findProjectOrFail(req, res);
  if (!project) return;

  const episodes = await episodeRepository.findByProject(req.params.id);
  const currentEpisode = episodes.length > 0 ? Math.max(...episodes.map(e => e.episodeNumber)) : 0;

  const unresolved = await foreshadowingRepository.getUnresolved(req.params.id);
  const all = await foreshadowingRepository.findByProject(req.params.id);
  const resolved = all.filter(f => f.status === 'resolved');

  const unresolvedWithStatus = unresolved.map(f => {
    const episodeGap = currentEpisode - f.episodePlanted;
    const importance = f.importance || 'normal';
    const overdueThreshold = OVERDUE_THRESHOLD[importance as keyof typeof OVERDUE_THRESHOLD] || 20;
    const warningThreshold = WARNING_THRESHOLD[importance as keyof typeof WARNING_THRESHOLD] || 10;
    let overdueStatus = 'normal';
    if (episodeGap >= overdueThreshold) overdueStatus = 'overdue';
    else if (episodeGap >= warningThreshold) overdueStatus = 'warning';
    return { ...f.toObject(), episodeGap, overdueStatus, overdueThreshold, remainingEpisodes: overdueThreshold - episodeGap };
  });

  res.json({
    success: true,
    data: {
      stats: {
        total: all.length,
        unresolved: unresolved.length,
        resolved: resolved.length,
        highPriority: unresolved.filter(f => f.importance === 'high').length,
        overdue: unresolvedWithStatus.filter(f => f.overdueStatus === 'overdue').length,
        warning: unresolvedWithStatus.filter(f => f.overdueStatus === 'warning').length,
      },
      unresolved: unresolvedWithStatus,
      resolved,
      currentEpisode,
    },
  });
}));

router.post('/:id/clone', asyncHandler(async (req, res) => {
  const sourceProject = await findProjectOrFail(req, res);
  if (!sourceProject) return;

  const cloneName = req.body.newName || `${sourceProject.name} (副本)`;
  const newProject = await projectRepository.create({
    name: cloneName,
    genre: sourceProject.genre,
    type: sourceProject.type,
    totalEpisodes: sourceProject.totalEpisodes,
    outline: sourceProject.outline,
    status: sourceProject.status,
  });

  const episodes = await episodeRepository.findByProject(req.params.id);
  for (const ep of episodes) {
    const content = ep.content || '';
    await episodeRepository.upsert(newProject._id.toString(), ep.episodeNumber, {
      content: ep.content,
      summary: ep.summary,
      wordCount: WordCountService.countV1(content),
      wordCountV2: WordCountService.countV2(content),
      wordCountAlgorithm: 'v2',
      status: ep.status,
    });
  }

  const characters = await characterRepository.findByProject(req.params.id);
  for (const char of characters) {
    await characterRepository.create({
      projectId: new mongoose.Types.ObjectId(newProject._id.toString()) as any,
      name: char.name, gender: char.gender, age: char.age,
      identity: char.identity, personality: char.personality,
      background: char.background, abilities: char.abilities,
      appearance: char.appearance, relationships: char.relationships,
    });
  }

  const foreshadowings = await foreshadowingRepository.findByProject(req.params.id);
  for (const f of foreshadowings) {
    await foreshadowingRepository.create(newProject._id.toString(), f.episodePlanted, {
      content: f.content, type: f.type, importance: f.importance,
    });
  }

  res.json({
    success: true,
    data: {
      newProject,
      stats: { episodes: episodes.length, characters: characters.length, foreshadowings: foreshadowings.length },
    },
  });
}));

router.get('/:id/character-continuity', asyncHandler(async (req, res) => {
  const project = await findProjectOrFail(req, res);
  if (!project) return;

  const contextManager = new ContextManager(req.params.id);
  const context = await contextManager.buildFullContext({ currentEpisode: project.totalEpisodes });

  const characters = await characterRepository.findByProject(req.params.id);
  const episodes = await episodeRepository.findByProject(req.params.id);
  const latestEpisode = episodes.length > 0 ? Math.max(...episodes.map(e => e.episodeNumber)) : 0;

  const characterStats = characters.map(char => {
    const appearances: number[] = [];
    for (const ep of episodes) {
      if (ep.content && ep.content.includes(char.name)) appearances.push(ep.episodeNumber);
    }
    const lastAppearance = appearances.length > 0 ? Math.max(...appearances) : 0;
    return {
      id: char._id, name: char.name, identity: char.identity,
      totalAppearances: appearances.length, lastAppearance,
      gapEpisodes: latestEpisode > 0 && appearances.length > 0 ? latestEpisode - lastAppearance : 0,
      appearances: appearances.slice(-10),
    };
  });

  res.json({
    success: true,
    data: {
      latestEpisode,
      characters: characterStats.sort((a, b) => b.totalAppearances - a.totalAppearances),
      continuityContext: context.characterContinuity,
    },
  });
}));

import { outputFormatService } from '../services/format/OutputFormatService';
import { IOutputFormatConfig } from '../types/OutputFormat';

router.get('/:id/output-format', creatorAuth, asyncHandler(async (req, res) => {
  const project = await findProjectOrFail(req, res);
  if (!project) return;

  const config = project.outputFormat || { mode: 'preset', preset: 'standard' };
  const resolved = outputFormatService.resolveConfig(config as IOutputFormatConfig);
  res.json({ success: true, data: { config, resolved, presets: outputFormatService.getPresets() } });
}));

router.put('/:id/output-format', creatorAuth, asyncHandler(async (req, res) => {
  const ownership = await checkProjectOwnership(req, res);
  if (!ownership) return;

  const config: IOutputFormatConfig = req.body;
  const validation = outputFormatService.validateConfig(config);
  if (!validation.valid) {
    res.status(400).json({ success: false, errors: validation.errors });
    return;
  }

  await projectRepository.update(req.params.id, { outputFormat: config });
  const resolved = outputFormatService.resolveConfig(config);
  res.json({ success: true, data: { config, resolved } });
}));

router.post('/:id/output-format/preview', creatorAuth, asyncHandler(async (_req, res) => {
  const config: IOutputFormatConfig = _req.body;
  const resolved = outputFormatService.resolveConfig(config);
  const promptSection = outputFormatService.buildFormatPromptSection(resolved);
  res.json({ success: true, data: { promptSection, resolved } });
}));

export default router;
