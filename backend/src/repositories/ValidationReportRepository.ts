import mongoose from 'mongoose';
import { ValidationReport, IValidationReport } from '../models/ValidationReport';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  episode: number;
  message: string;
  details?: string;
}

export interface CreateReportData {
  score: number;
  rating: string;
  issues: ValidationIssue[];
}

class ValidationReportRepositoryClass {
  /**
   * 创建验证报告
   */
  async create(projectId: string, data: CreateReportData): Promise<IValidationReport> {
    const criticalCount = data.issues.filter(i => i.type === 'error').length;
    const warningCount = data.issues.filter(i => i.type === 'warning').length;
    const suggestionCount = data.issues.filter(i => i.type === 'info').length;

    const report = new ValidationReport({
      projectId: new mongoose.Types.ObjectId(projectId),
      score: data.score,
      rating: data.rating,
      totalIssues: data.issues.length,
      criticalCount,
      warningCount,
      suggestionCount,
      issues: JSON.stringify(data.issues),
    });

    return report.save();
  }

  /**
   * 获取项目的所有验证报告
   */
  async findByProject(projectId: string): Promise<IValidationReport[]> {
    return ValidationReport.find({
      projectId: new mongoose.Types.ObjectId(projectId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * 获取项目的最新验证报告
   */
  async getLatest(projectId: string): Promise<IValidationReport | null> {
    return ValidationReport.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * 根据ID获取验证报告
   */
  async findById(id: string): Promise<IValidationReport | null> {
    return ValidationReport.findById(id).lean();
  }

  /**
   * 删除验证报告
   */
  async delete(id: string): Promise<boolean> {
    const result = await ValidationReport.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * 删除项目的所有验证报告
   */
  async deleteByProject(projectId: string): Promise<number> {
    const result = await ValidationReport.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId),
    });
    return result.deletedCount;
  }

  /**
   * 获取验证报告的issues (解析JSON)
   */
  getIssues(report: IValidationReport): ValidationIssue[] {
    try {
      return JSON.parse(report.issues);
    } catch {
      return [];
    }
  }

  /**
   * 获取项目的验证历史统计
   */
  async getHistory(projectId: string, limit = 10): Promise<Array<{
    date: Date;
    score: number;
    totalIssues: number;
  }>> {
    const reports = await ValidationReport.find({
      projectId: new mongoose.Types.ObjectId(projectId),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('createdAt score totalIssues')
      .lean();

    return reports.map(r => ({
      date: r.createdAt,
      score: r.score,
      totalIssues: r.totalIssues,
    }));
  }
}

export const ValidationReportRepository = new ValidationReportRepositoryClass();
