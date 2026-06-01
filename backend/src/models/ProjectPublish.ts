import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * 项目发布配置接口
 * 
 * 阅读规则（平台固定）：
 * - 1-5集：免费
 * - 6-20集：积分购买（pricePerEpisode）
 * - 21集+：需购买整本剧本（fullScriptPrice）或联系客服洽谈合作
 */
export interface IProjectPublish extends Document {
    projectId: Types.ObjectId;
    isPublished: boolean;
    pricePerEpisode: number;
    freeEpisodeCount: number;  // 平台固定5集，不可调整
    maxPointsEpisode: number;  // 积分可购买的最大集数（固定20）
    fullScriptPrice: number;   // 🆕 整本购买价格（积分），0表示仅支持洽谈
    coverImage?: string;
    targetAudience: 'male' | 'female';  // 目标受众：男频/女频
    tags: string[];     // 标签ID数组
    supportsRewrite: boolean;  // 是否支持改写服务
    rewritePrice: number;      // 改写服务价格
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 项目发布配置 Schema
 */
const ProjectPublishSchema = new Schema<IProjectPublish>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
            unique: true,
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        pricePerEpisode: {
            type: Number,
            default: 10,
            min: 0,
        },
        freeEpisodeCount: {
            type: Number,
            default: 5,  // 平台固定5集，不可调整
            min: 5,
            max: 5,
        },
        maxPointsEpisode: {
            type: Number,
            default: 20,  // 积分可购买到第20集
            min: 20,
            max: 20,
        },
        fullScriptPrice: {
            type: Number,
            default: 0,  // 0表示仅支持洽谈合作
            min: 0,
        },
        coverImage: {
            type: String,
        },
        targetAudience: {
            type: String,
            enum: ['male', 'female'],
            default: 'female',  // 默认女频
        },
        tags: [{
            type: String,
            trim: true,
        }],
        supportsRewrite: {
            type: Boolean,
            default: false,  // 默认不支持改写
        },
        rewritePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        publishedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// 索引
ProjectPublishSchema.index({ projectId: 1 });
ProjectPublishSchema.index({ isPublished: 1, publishedAt: -1 });
ProjectPublishSchema.index({ targetAudience: 1, isPublished: 1 });

export const ProjectPublish = mongoose.model<IProjectPublish>('ProjectPublish', ProjectPublishSchema);


