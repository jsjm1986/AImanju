import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationReport extends Document {
  projectId: mongoose.Types.ObjectId;
  score: number;
  rating: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  issues: string; // JSON string
  // 验证范围信息
  validationType: 'full' | 'range';  // 全量验证 or 范围验证
  startEpisode?: number;  // 起始集数（范围验证时）
  endEpisode?: number;    // 结束集数（范围验证时）
  totalEpisodes?: number; // 验证的总集数
  createdAt: Date;
}

const ValidationReportSchema = new Schema<IValidationReport>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    score: { type: Number, required: true },
    rating: { type: String, required: true },
    totalIssues: { type: Number, default: 0 },
    criticalCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    suggestionCount: { type: Number, default: 0 },
    issues: { type: String, default: '[]' },
    // 验证范围信息
    validationType: { type: String, enum: ['full', 'range'], default: 'full' },
    startEpisode: { type: Number },
    endEpisode: { type: Number },
    totalEpisodes: { type: Number },
  },
  {
    timestamps: true,
  }
);

export const ValidationReport = mongoose.model<IValidationReport>('ValidationReport', ValidationReportSchema);
