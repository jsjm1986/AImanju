/**
 * 角色增强管理控制器
 * 提供角色魅力、成长弧线、语言风格和关系的 CRUD API
 */

import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import { Character } from '../models/Character';
import { CharacterEnhancement } from '../models/CharacterEnhancement';
import { characterArcTracker } from '../services/character/CharacterArcTracker';
import { characterCharmAnalyzer } from '../services/character/CharacterCharmAnalyzer';
import { characterEnhancementInitService } from '../services/character/CharacterEnhancementInitService';
import { characterVoiceProfiler } from '../services/character/CharacterVoiceProfiler';
import { relationshipTracker } from '../services/character/RelationshipTracker';
import { SSEHandler } from '../services/sse/SSEHandler';
import { createLogger } from '../utils/errorLogger';

const router = Router();
const logger = createLogger('CharacterEnhancementController');

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function formatEnhancement(e: InstanceType<typeof CharacterEnhancement>) {
  return {
    _id: e._id,
    characterId: e.characterId.toString(),
    characterName: e.characterName,
    charm: e.charm,
    arc: e.arc,
    voice: e.voice,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function formatRelationship(r: { _id: unknown; characterAId: { toString(): string }; characterBId: { toString(): string }; characterAName: string; characterBName: string; currentLevel: unknown; sentiment: unknown; history: unknown; keyEvents: unknown; lastInteractionEpisode: unknown }) {
  return {
    _id: r._id,
    characterAId: r.characterAId.toString(),
    characterBId: r.characterBId.toString(),
    characterAName: r.characterAName,
    characterBName: r.characterBName,
    currentLevel: r.currentLevel,
    sentiment: r.sentiment,
    history: r.history,
    keyEvents: r.keyEvents,
    lastInteractionEpisode: r.lastInteractionEpisode,
  };
}

type RouteHandler = (req: Request, res: Response) => Promise<unknown>;

function asyncHandler(method: string, handler: RouteHandler): RouteHandler {
  return async (req: Request, res: Response) => {
    try {
      return await handler(req, res);
    } catch (error) {
      logger.error(`${method} 失败`, error as Error, {
        method,
        additionalInfo: { ...req.params },
      });
      return res.status(500).json({ success: false, error: '操作失败' });
    }
  };
}

function requireFields(res: Response, fields: Record<string, unknown>): boolean {
  const missing = Object.entries(fields).some(([, v]) => !v);
  if (missing) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return false;
  }
  return true;
}

router.get('/:characterId', asyncHandler('GET /:characterId', async (req, res) => {
  const { characterId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ success: false, error: '缺少 projectId' });
  }

  const enhancement = await CharacterEnhancement.findOne({
    projectId: toObjectId(projectId as string),
    characterId: toObjectId(characterId),
  });

  if (!enhancement) {
    return res.json({ success: true, exists: false, enhancement: null });
  }

  return res.json({
    success: true,
    exists: true,
    enhancement: formatEnhancement(enhancement),
  });
}));

router.get('/project/:projectId', asyncHandler('GET /project/:projectId', async (req, res) => {
  const { projectId } = req.params;

  const enhancements = await CharacterEnhancement.find({
    projectId: toObjectId(projectId),
  });

  return res.json({
    success: true,
    enhancements: enhancements.map(formatEnhancement),
  });
}));

router.put('/:characterId/charm', asyncHandler('PUT /:characterId/charm', async (req, res) => {
  const { characterId } = req.params;
  const { projectId, characterName, charm } = req.body;

  if (!requireFields(res, { projectId, characterName })) return;

  const result = await characterCharmAnalyzer.setCharm(projectId, characterId, characterName, charm);

  if (!result) {
    return res.status(500).json({ success: false, error: '更新失败' });
  }

  return res.json({ success: true, charm: result.charm });
}));

router.post('/:characterId/impressive-moment', asyncHandler('POST /:characterId/impressive-moment', async (req, res) => {
  const { characterId } = req.params;
  const { projectId, characterName, episode, description, type } = req.body;

  if (!requireFields(res, { projectId, characterName, episode, description, type })) return;

  const success = await characterCharmAnalyzer.recordImpressiveMoment(
    projectId, characterId, characterName, episode, description, type
  );

  return res.json({ success });
}));

router.put('/:characterId/arc/stage', asyncHandler('PUT /:characterId/arc/stage', async (req, res) => {
  const { characterId } = req.params;
  const { projectId, characterName, stage, trigger, episode } = req.body;

  if (!requireFields(res, { projectId, characterName, stage, trigger, episode })) return;

  const success = await characterArcTracker.updateStage(
    projectId, characterId, characterName, stage, trigger, episode
  );

  return res.json({ success });
}));

router.post('/:characterId/arc/turning-point', asyncHandler('POST /:characterId/arc/turning-point', async (req, res) => {
  const { characterId } = req.params;
  const { projectId, characterName, episode, event, impact, beforeState, afterState } = req.body;

  if (!requireFields(res, { projectId, characterName, episode, event, impact })) return;

  const success = await characterArcTracker.recordTurningPoint(
    projectId, characterId, characterName, episode, event, impact,
    beforeState || '', afterState || ''
  );

  return res.json({ success });
}));

router.post('/:characterId/arc/growth-event', asyncHandler('POST /:characterId/arc/growth-event', async (req, res) => {
  const { characterId } = req.params;
  const { projectId, characterName, episode, type, description } = req.body;

  if (!requireFields(res, { projectId, characterName, episode, type, description })) return;

  const success = await characterArcTracker.recordGrowthEvent(
    projectId, characterId, characterName, episode, type, description
  );

  return res.json({ success });
}));

router.put('/:characterId/voice', asyncHandler('PUT /:characterId/voice', async (req, res) => {
  const { characterId } = req.params;
  const { projectId, characterName, voice } = req.body;

  if (!requireFields(res, { projectId, characterName })) return;

  const success = await characterVoiceProfiler.setVoice(projectId, characterId, characterName, voice);

  if (!success) {
    return res.status(500).json({ success: false, error: '更新失败' });
  }

  const updatedVoice = await characterVoiceProfiler.getVoice(characterId);
  return res.json({ success: true, voice: updatedVoice });
}));

router.get('/:characterId/relationships', asyncHandler('GET /:characterId/relationships', async (req, res) => {
  const { characterId } = req.params;
  const { projectId } = req.query;

  if (!projectId) {
    return res.status(400).json({ success: false, error: '缺少 projectId' });
  }

  const relationships = await relationshipTracker.getCharacterRelationships(
    projectId as string, characterId
  );

  return res.json({ success: true, relationships: relationships.map(formatRelationship) });
}));

router.get('/relationships/project/:projectId', asyncHandler('GET /relationships/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const relationships = await relationshipTracker.getProjectRelationships(projectId);
  return res.json({ success: true, relationships: relationships.map(formatRelationship) });
}));

router.put('/relationship', asyncHandler('PUT /relationship', async (req, res) => {
  const { projectId, charAId, charBId, charAName, charBName, level, event, episode } = req.body;

  if (!requireFields(res, { projectId, charAId, charBId, charAName, charBName, level, event, episode })) return;

  const success = await relationshipTracker.updateRelationship(
    projectId, charAId, charBId, charAName, charBName, level, event, episode
  );

  return res.json({ success });
}));

router.post('/relationship/key-event', asyncHandler('POST /relationship/key-event', async (req, res) => {
  const { projectId, charAId, charBId, charAName, charBName, episode, type, description, impact } = req.body;

  if (!requireFields(res, { projectId, charAId, charBId, charAName, charBName, episode, type, description, impact })) return;

  const success = await relationshipTracker.recordKeyEvent(
    projectId, charAId, charBId, charAName, charBName, episode, type, description, impact
  );

  return res.json({ success });
}));

router.get('/relationships/stagnant/:projectId', asyncHandler('GET /relationships/stagnant/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { currentEpisode } = req.query;

  if (!currentEpisode) {
    return res.status(400).json({ success: false, error: '缺少 currentEpisode' });
  }

  const stagnant = await relationshipTracker.checkStagnantRelationships(
    projectId, parseInt(currentEpisode as string, 10)
  );

  return res.json({ success: true, stagnant });
}));

function countCharmItems(charm: { catchphrases?: unknown[]; quirks?: unknown[]; signatureMoves?: unknown[] } | null | undefined): number {
  if (!charm) return 0;
  return (charm.catchphrases?.length || 0) +
    (charm.quirks?.length || 0) +
    (charm.signatureMoves?.length || 0);
}

/** 批量初始化项目所有角色的增强属性（SSE 流式） */
router.post('/batch-init', async (req: Request, res: Response) => {
  const sse = new SSEHandler(res);

  try {
    const { projectId } = req.body;

    if (!projectId) {
      sse.sendError('缺少 projectId');
      return;
    }

    sse.onClose(() => {
      logger.info('批量初始化: 客户端断开连接');
    });

    sse.send('start', { message: '开始初始化角色增强属性' });

    const sseSend = (event: string, data: unknown) => {
      if (!sse.isClosed()) sse.send(event, data);
    };

    await characterEnhancementInitService.initializeProjectCharacters(projectId, {
      onStart: (total) => sseSend('init_start', { totalCharacters: total }),
      onProgress: (current, total, characterName) => {
        if (!sse.isClosed()) sse.sendProgress(current, total, `正在初始化: ${characterName}`);
      },
      onCharacterDone: (result) => sseSend('character_done', {
        characterId: result.characterId,
        characterName: result.characterName,
        success: result.success,
        error: result.error,
        charmCount: countCharmItems(result.charm),
      }),
      onComplete: (batchResult) => {
        if (!sse.isClosed()) {
          sse.sendDone({
            projectId: batchResult.projectId,
            totalCharacters: batchResult.totalCharacters,
            successCount: batchResult.successCount,
            failedCount: batchResult.failedCount,
          });
        }
      },
      onError: (error) => {
        if (!sse.isClosed()) sse.sendError(error.message);
      },
    });
  } catch (error) {
    logger.error('批量初始化失败', error as Error, { method: 'POST /batch-init' });
    if (!sse.isClosed()) sse.sendError((error as Error).message);
  }
});

router.get('/init-status/:projectId', asyncHandler('GET /init-status/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const status = await characterEnhancementInitService.getInitializationStatus(projectId);
  return res.json({ success: true, ...status });
}));

router.post('/:characterId/init', asyncHandler('POST /:characterId/init', async (req, res) => {
  const { characterId } = req.params;
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ success: false, error: '缺少 projectId' });
  }

  const character = await Character.findById(characterId);

  if (!character) {
    return res.status(404).json({ success: false, error: '角色不存在' });
  }

  if (character.projectId.toString() !== projectId) {
    return res.status(403).json({ success: false, error: '角色不属于该项目' });
  }

  const result = await characterEnhancementInitService.initializeCharacter(character);

  return res.json({
    success: result.success,
    error: result.error,
    charm: result.charm,
    voice: result.voice,
  });
}));

router.get('/:projectId/init-status', asyncHandler('GET /:projectId/init-status', async (req, res) => {
  const { projectId } = req.params;

  const characters = await Character.find({
    projectId: toObjectId(projectId),
  });

  if (characters.length === 0) {
    return res.json({
      success: true,
      data: { totalCharacters: 0, initializedCount: 0, uninitializedCount: 0, characters: [] },
    });
  }

  const enhancements = await CharacterEnhancement.find({
    projectId: toObjectId(projectId),
  });

  const enhancedCharIds = new Set(enhancements.map((e) => e.characterId.toString()));

  const characterStatus = characters.map((c) => ({
    name: c.name,
    characterId: c._id.toString(),
    initialized: enhancedCharIds.has(c._id.toString()),
  }));

  const initializedCount = characterStatus.filter((c) => c.initialized).length;

  return res.json({
    success: true,
    data: {
      totalCharacters: characters.length,
      initializedCount,
      uninitializedCount: characters.length - initializedCount,
      characters: characterStatus,
    },
  });
}));

/** 批量初始化项目所有角色（SSE 流式） */
router.post('/:projectId/batch-init-stream', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { force, preview } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendSSE = (type: string, data: unknown) => {
      res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`);
    };

    const characters = await Character.find({
      projectId: toObjectId(projectId),
    });

    if (characters.length === 0) {
      sendSSE('done', { message: '没有需要初始化的角色' });
      return res.end();
    }

    let charsToInit = characters;

    if (!force && !preview) {
      const enhancements = await CharacterEnhancement.find({
        projectId: toObjectId(projectId),
      });
      const enhancedCharIds = new Set(enhancements.map((e) => e.characterId.toString()));
      charsToInit = characters.filter((c) => !enhancedCharIds.has(c._id.toString()));

      if (charsToInit.length === 0) {
        sendSSE('done', { message: '所有角色已初始化' });
        return res.end();
      }
    }

    sendSSE('start', { total: charsToInit.length, preview: !!preview });

    for (let i = 0; i < charsToInit.length; i++) {
      const char = charsToInit[i];

      sendSSE('progress', {
        current: i + 1,
        total: charsToInit.length,
        characterName: char.name,
      });

      try {
        const result = preview
          ? await characterEnhancementInitService.generatePreview(char)
          : await characterEnhancementInitService.initializeCharacter(char);

        sendSSE('character_done', {
          characterId: char._id.toString(),
          characterName: char.name,
          success: result.success,
          charmCount: countCharmItems(result.charm),
          error: result.error,
          ...(preview && result.success ? { charm: result.charm, voice: result.voice } : {}),
        });
      } catch (charError) {
        sendSSE('character_done', {
          characterId: char._id.toString(),
          characterName: char.name,
          success: false,
          error: (charError as Error).message,
        });
      }
    }

    sendSSE('done', { message: '批量初始化完成' });
    return res.end();
  } catch (error) {
    logger.error('批量初始化角色失败', error as Error, {
      method: 'POST /:projectId/batch-init-stream',
      additionalInfo: { projectId: req.params.projectId },
    });
    res.write(`data: ${JSON.stringify({ type: 'error', message: '批量初始化失败' })}\n\n`);
    return res.end();
  }
});

router.post('/:projectId/batch-confirm', asyncHandler('POST /:projectId/batch-confirm', async (req, res) => {
  const { projectId } = req.params;
  const { characters } = req.body;

  if (!characters || !Array.isArray(characters) || characters.length === 0) {
    return res.status(400).json({ success: false, error: '缺少角色数据' });
  }

  let successCount = 0;
  let failCount = 0;
  const results: Array<{ characterId: string; characterName: string; success: boolean; error?: string }> = [];

  for (const { characterId, characterName, charm, voice } of characters) {
    if (!characterId || !charm || !voice) {
      results.push({ characterId, characterName, success: false, error: '数据不完整' });
      failCount++;
      continue;
    }

    const success = await characterEnhancementInitService.saveCharacterEnhancement(
      projectId, characterId, characterName, charm, voice
    );

    if (success) {
      successCount++;
      results.push({ characterId, characterName, success: true });
    } else {
      failCount++;
      results.push({ characterId, characterName, success: false, error: '保存失败' });
    }
  }

  return res.json({
    success: failCount === 0,
    message: `保存完成：${successCount} 成功，${failCount} 失败`,
    successCount,
    failCount,
    results,
  });
}));

export default router;

