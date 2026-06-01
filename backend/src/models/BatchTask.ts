import mongoose, { Document, Schema } from 'mongoose';

/**
 * 批量生成任务状态
 */
export type BatchTaskStatus =
    | 'pending'    // 等待中
    | 'running'    // 执行中
    | 'paused'     // 已暂停
    | 'completed'  // 已完成
    | 'failed'     // 失败
    | 'stopped';   // 已停止

/**
 * 失败的集数信息
 */
export interface IFailedEpisode {
    episode: number;
    error: string;
    attempts: number;
}

/**
 * 当前进度信息
 */
export interface ICurrentProgress {
    percent: number;
    step: string;
    message: string;
    startTime: Date;
}

/**
 * 日志条目
 */
export interface ITaskLog {
    time: Date;
    message: string;
    level: 'info' | 'warn' | 'error';
    episode: number;
}

/**
 * 统计信息
 */
export interface ITaskStats {
    totalTime: number;           // 总耗时（毫秒）
    avgTimePerEpisode: number;   // 平均单集耗时（毫秒）
    successRate: number;         // 成功率（0-1）
}

/**
 * 批量任务接口
 */
export interface IBatchTask extends Document {
    projectId: string;           // 项目ID
    creatorId?: string;          // 创建者ID（用户隔离）
    projectName?: string;        // 项目名称（缓存）
    modelName?: string;          // AI 模型名称
    status: BatchTaskStatus;     // 任务状态

    // 集数信息
    episodes: number[];          // 需要生成的集数列表（如 [1, 2, 3, 5]）
    currentIndex: number;        // 当前正在处理的索引
    currentEpisode: number;      // 当前正在生成的集数

    // 结果分类
    completed: number[];         // 已完成的集数
    failed: IFailedEpisode[];    // 失败的集数及错误信息
    skipped: number[];           // 超时跳过的集数

    // 实时进度（当前集）
    currentProgress: ICurrentProgress;

    // 日志（FIFO 限制200条）
    logs: ITaskLog[];

    // 最后一集的详细数据（用于前端显示）
    lastContext?: any;                    // 上下文信息
    lastAnalysis?: any;                   // 分析结果
    lastMultiHeadAnalysis?: any;          // 多头注意力分析
    lastConstraintValidation?: any;       // 约束验证结果
    lastAIConstraintDecision?: any;       // AI 约束决策
    lastBudgetAllocation?: any;           // 预算分配

    // 统计
    stats: ITaskStats;

    // 时间戳
    createdAt: Date;
    startedAt?: Date;
    pausedAt?: Date;             // 暂停时间
    completedAt?: Date;
    updatedAt: Date;
}

const FailedEpisodeSchema = new Schema<IFailedEpisode>(
    {
        episode: { type: Number, required: true },
        error: { type: String, required: true },
        attempts: { type: Number, default: 0 },
    },
    { _id: false }
);

const CurrentProgressSchema = new Schema<ICurrentProgress>(
    {
        percent: { type: Number, default: 0 },
        step: { type: String, default: '' },
        message: { type: String, default: '' },
        startTime: { type: Date, default: Date.now },
    },
    { _id: false }
);

const TaskLogSchema = new Schema<ITaskLog>(
    {
        time: { type: Date, default: Date.now },
        message: { type: String, required: true },
        level: {
            type: String,
            enum: ['info', 'warn', 'error'],
            default: 'info'
        },
        episode: { type: Number, required: true },
    },
    { _id: false }
);

const TaskStatsSchema = new Schema<ITaskStats>(
    {
        totalTime: { type: Number, default: 0 },
        avgTimePerEpisode: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 },
    },
    { _id: false }
);

const BatchTaskSchema = new Schema<IBatchTask>(
    {
        projectId: {
            type: String,
            required: true,
            index: true  // 创建索引用于快速查询
        },
        creatorId: {
            type: String,
            index: true
        },
        status: {
            type: String,
            enum: ['pending', 'running', 'paused', 'completed', 'failed', 'stopped'],
            default: 'pending',
            index: true  // 创建索引用于快速查询活跃任务
        },

        // 项目名称（缓存，方便显示）
        projectName: {
            type: String,
            default: ''
        },

        // AI 模型名称
        modelName: {
            type: String,
            default: ''
        },

        // 集数信息
        episodes: {
            type: [Number],
            required: true,
            default: []
        },
        currentIndex: {
            type: Number,
            default: 0
        },
        currentEpisode: {
            type: Number
        },

        // 结果分类
        completed: {
            type: [Number],
            default: []
        },
        failed: {
            type: [FailedEpisodeSchema],
            default: []
        },
        skipped: {
            type: [Number],
            default: []
        },

        // 实时进度
        currentProgress: {
            type: CurrentProgressSchema,
            default: () => ({
                percent: 0,
                step: '',
                message: '',
                startTime: new Date()
            })
        },

        // 日志（限制200条）
        logs: {
            type: [TaskLogSchema],
            default: []
        },

        // 最后一集的详细数据
        lastContext: { type: Schema.Types.Mixed },
        lastAnalysis: { type: Schema.Types.Mixed },
        lastMultiHeadAnalysis: { type: Schema.Types.Mixed },
        lastConstraintValidation: { type: Schema.Types.Mixed },
        lastAIConstraintDecision: { type: Schema.Types.Mixed },
        lastBudgetAllocation: { type: Schema.Types.Mixed },

        // 统计
        stats: {
            type: TaskStatsSchema,
            default: () => ({
                totalTime: 0,
                avgTimePerEpisode: 0,
                successRate: 0
            })
        },

        // 时间戳
        startedAt: { type: Date },
        pausedAt: { type: Date },
        completedAt: { type: Date },
    },
    {
        timestamps: true,  // 自动创建 createdAt 和 updatedAt
    }
);

// 创建复合索引：用于查询特定项目的活跃任务
BatchTaskSchema.index({ projectId: 1, status: 1 });
// 创建复合索引：用于按用户查询任务
BatchTaskSchema.index({ creatorId: 1, status: 1 });

export const BatchTask = mongoose.model<IBatchTask>('BatchTask', BatchTaskSchema);
