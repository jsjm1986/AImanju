import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import { ValidationReport } from '../models/ValidationReport';
import { ValidationIssue as BackendIssue, ScriptValidator } from '../services/validation/ScriptValidator';
import { protectProjectRouter } from '../middleware/projectAccess';

const router = Router();
protectProjectRouter(router, {
  params: { id: (id) => ValidationReport.findById(id).select('projectId').exec() },
});

interface FrontendIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  episode: number;
  description: string;
  suggestion?: string;
  location?: string;
  evidence?: string;
  windowRange?: string;
  isGlobal?: boolean;
}

const severityToType: Record<string, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  warning: 'warning',
  suggestion: 'info',
};

function transformIssueForFrontend(issue: BackendIssue): FrontendIssue {
  return {
    type: severityToType[issue.severity] || 'info',
    category: issue.type,
    episode: issue.episode,
    description: issue.description,
    suggestion: issue.suggestion,
    location: issue.location,
    evidence: issue.evidence,
    windowRange: issue.windowRange,
    isGlobal: issue.isGlobal,
  };
}

function setupSSE(res: Response): () => void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  return () => clearInterval(keepAlive);
}

function sendSSE(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function toFrontendSummary(report: { criticalCount: number; warningCount: number; suggestionCount: number }) {
  return { errors: report.criticalCount, warnings: report.warningCount, info: report.suggestionCount };
}

function formatReportForFrontend(report: InstanceType<typeof ValidationReport>) {
  const storedIssues = JSON.parse(report.issues) as BackendIssue[];
  return {
    id: report._id,
    projectId: report.projectId,
    score: report.score,
    rating: report.rating,
    totalIssues: report.totalIssues,
    criticalCount: report.criticalCount,
    warningCount: report.warningCount,
    suggestionCount: report.suggestionCount,
    issues: storedIssues.map(transformIssueForFrontend),
    summary: toFrontendSummary(report),
    createdAt: report.createdAt,
  };
}

function calculateRating(score: number): string {
  if (score < 60) return '需改进';
  if (score < 70) return '及格';
  if (score < 80) return '良好';
  if (score < 90) return '很好';
  return '优秀';
}

router.post('/validate', async (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  const cleanup = setupSSE(res);
  try {
    const validator = new ScriptValidator(projectId);
    const info = await validator.initialize();
    sendSSE(res, { type: 'init', ...info });

    const result = await validator.validateAll((progress) => sendSSE(res, progress));

    if (result.success && result.report) {
      try {
        const report = new ValidationReport({
          projectId: new mongoose.Types.ObjectId(projectId),
          score: result.report.score,
          rating: result.report.rating,
          totalIssues: result.report.totalIssues,
          criticalCount: result.report.summary.critical,
          warningCount: result.report.summary.warning,
          suggestionCount: result.report.summary.suggestion,
          issues: JSON.stringify(result.report.issues),
          validationType: 'full',
          totalEpisodes: info.totalEpisodes,
        });
        await report.save();
        console.log(`[Validation] 验证报告已保存，ID: ${report._id}`);
      } catch (saveError) {
        console.error('[Validation] 保存验证报告失败:', saveError);
      }
    }

    const transformedResult = {
      ...result,
      report: result.report ? {
        ...result.report,
        issues: result.report.issues.map(transformIssueForFrontend),
        summary: {
          errors: result.report.summary.critical,
          warnings: result.report.summary.warning,
          info: result.report.summary.suggestion,
        },
      } : undefined,
    };

    sendSSE(res, { type: 'complete', ...transformedResult });
    res.end();
  } catch (error) {
    sendSSE(res, { type: 'error', error: (error as Error).message });
    res.end();
  } finally {
    cleanup();
  }
});

router.post('/validate-range', async (req: Request, res: Response) => {
  const { projectId, startEpisode, endEpisode } = req.body;
  if (!projectId || !startEpisode || !endEpisode) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const cleanup = setupSSE(res);
  try {
    const validator = new ScriptValidator(projectId);
    const info = await validator.initialize();
    sendSSE(res, { type: 'init', ...info });

    const result = await validator.validateRange(startEpisode, endEpisode, (progress) => sendSSE(res, progress));

    const transformedIssues = result.issues.map(transformIssueForFrontend);
    const errorCount = transformedIssues.filter(i => i.type === 'error').length;
    const warningCount = transformedIssues.filter(i => i.type === 'warning').length;
    const infoCount = transformedIssues.filter(i => i.type === 'info').length;

    const score = Math.max(0, Math.min(100, 100 - errorCount * 10 - warningCount * 3 - infoCount));
    const rating = calculateRating(score);
    const totalIssues = errorCount + warningCount + infoCount;

    try {
      const report = new ValidationReport({
        projectId: new mongoose.Types.ObjectId(projectId),
        score,
        rating,
        totalIssues,
        criticalCount: errorCount,
        warningCount,
        suggestionCount: infoCount,
        issues: JSON.stringify(result.issues),
        validationType: 'range',
        startEpisode,
        endEpisode,
        totalEpisodes: endEpisode - startEpisode + 1,
      });
      await report.save();
      console.log(`[Validation] 范围验证报告已保存，ID: ${report._id}, 范围: ${startEpisode}-${endEpisode}`);
    } catch (saveError) {
      console.error('[Validation] 保存范围验证报告失败:', saveError);
    }

    sendSSE(res, {
      type: 'complete',
      success: result.success,
      issues: transformedIssues,
      summary: { errors: errorCount, warnings: warningCount, info: infoCount },
      report: { score, rating, totalIssues },
    });
    res.end();
  } catch (error) {
    sendSSE(res, { type: 'error', error: (error as Error).message });
    res.end();
  } finally {
    cleanup();
  }
});

router.get('/windows/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const validator = new ScriptValidator(projectId);
    await validator.initialize();
    res.json({ windows: validator.calculateWindows() });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/reports/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const reports = await ValidationReport.find({
      projectId: new mongoose.Types.ObjectId(projectId),
    }).sort({ createdAt: -1 });

    res.json({
      reports: reports.map(r => ({
        id: r._id,
        score: r.score,
        rating: r.rating,
        totalIssues: r.totalIssues,
        criticalCount: r.criticalCount,
        warningCount: r.warningCount,
        suggestionCount: r.suggestionCount,
        validationType: r.validationType || 'full',
        startEpisode: r.startEpisode,
        endEpisode: r.endEpisode,
        totalEpisodes: r.totalEpisodes,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/reports/:projectId/latest', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  try {
    const report = await ValidationReport.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
    }).sort({ createdAt: -1 });

    if (!report) {
      return res.json({ report: null });
    }

    res.json({ report: formatReportForFrontend(report) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/report/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const report = await ValidationReport.findById(id);
    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json({ report: formatReportForFrontend(report) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/report/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await ValidationReport.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
