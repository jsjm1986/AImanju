import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * 项目上架申请接口
 * 创作者提交上架申请，管理员审核后上架到买家平台
 */
export interface IPublishRequest extends Document {
    projectId: Types.ObjectId;
    creatorId: Types.ObjectId;
    status: 'pending' | 'approved' | 'rejected';

    // 上架配置
    pricePerEpisode: number;
    freeEpisodeCount: number;
    targetAudience: 'male' | 'female';
    tags: string[];
    supportsRewrite: boolean;
    rewritePrice: number;

    // 审核信息
    adminNote?: string;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

const PublishRequestSchema = new Schema<IPublishRequest>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'Creator',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        pricePerEpisode: {
            type: Number,
            default: 10,
            min: 0,
        },
        freeEpisodeCount: {
            type: Number,
            default: 5,
            min: 0,
        },
        targetAudience: {
            type: String,
            enum: ['male', 'female'],
            default: 'male',
        },
        tags: [{
            type: String,
            trim: true,
        }],
        supportsRewrite: {
            type: Boolean,
            default: false,
        },
        rewritePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        adminNote: {
            type: String,
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'BuyerUser',
        },
        reviewedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// 索引
PublishRequestSchema.index({ projectId: 1 });
PublishRequestSchema.index({ creatorId: 1 });
PublishRequestSchema.index({ status: 1, createdAt: -1 });

export const PublishRequest = mongoose.model<IPublishRequest>('PublishRequest', PublishRequestSchema);
