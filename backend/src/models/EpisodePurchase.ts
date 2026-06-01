import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * 剧集购买记录接口
 */
export interface IEpisodePurchase extends Document {
    userId: Types.ObjectId;
    projectId: Types.ObjectId;
    episodeId: Types.ObjectId;
    episodeNumber: number;
    pointsCost: number;
    purchasedAt: Date;
}

/**
 * 剧集购买记录 Schema
 */
const EpisodePurchaseSchema = new Schema<IEpisodePurchase>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'BuyerUser',
            required: true,
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        episodeId: {
            type: Schema.Types.ObjectId,
            ref: 'Episode',
            required: true,
        },
        episodeNumber: {
            type: Number,
            required: true,
        },
        pointsCost: {
            type: Number,
            required: true,
            min: 0,
        },
        purchasedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false,
    }
);

// 唯一索引：防止重复购买
EpisodePurchaseSchema.index({ userId: 1, episodeId: 1 }, { unique: true });
// 查询索引
EpisodePurchaseSchema.index({ userId: 1, projectId: 1 });
EpisodePurchaseSchema.index({ userId: 1, purchasedAt: -1 });

export const EpisodePurchase = mongoose.model<IEpisodePurchase>('EpisodePurchase', EpisodePurchaseSchema);
