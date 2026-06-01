/**
 * 修复会话模型 - 支持断点续传
 * 记录多集修复的中间状态
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFixSessionEpisode {
    episodeNumber: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    originalContent?: string;
    fixedContent?: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
}

export interface IFixSession extends Document {
    projectId: mongoose.Types.ObjectId;

    // 原始问题信息
    originalIssue: {
        type: string;
        description: string;
        evidence?: string;
        episode: number;
    };

    // 修复方案
    plan: {
        id: string;
        name: string;
        description: string;
        changes: Array<{
            episode: number;
            location: string;
            original: string;
            modified: string;
            reason: string;
            relatedTo?: number[];
        }>;
    };

    // 各集状态
    episodes: IFixSessionEpisode[];

    // 整体状态
    status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
    currentEpisode?: number;
    progress: number;  // 0-100

    // 时间戳
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

const FixSessionEpisodeSchema = new Schema({
    episodeNumber: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
    },
    originalContent: String,
    fixedContent: String,
    error: String,
    startedAt: Date,
    completedAt: Date,
});

const FixSessionSchema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },

    originalIssue: {
        type: { type: String, required: true },
        description: { type: String, required: true },
        evidence: String,
        episode: { type: Number, required: true },
    },

    plan: {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        changes: [{
            episode: Number,
            location: String,
            original: String,
            modified: String,
            reason: String,
            relatedTo: [Number],
        }],
    },

    episodes: [FixSessionEpisodeSchema],

    status: {
        type: String,
        enum: ['created', 'running', 'paused', 'completed', 'failed'],
        default: 'created'
    },
    currentEpisode: Number,
    progress: { type: Number, default: 0 },

    completedAt: Date,
}, {
    timestamps: true,
});

// 索引
FixSessionSchema.index({ projectId: 1, status: 1 });
FixSessionSchema.index({ projectId: 1, createdAt: -1 });

export const FixSession = mongoose.model<IFixSession>('FixSession', FixSessionSchema);
