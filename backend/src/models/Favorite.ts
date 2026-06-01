import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * 收藏记录接口
 */
export interface IFavorite extends Document {
    userId: Types.ObjectId;
    projectId: Types.ObjectId;
    createdAt: Date;
}

/**
 * 收藏记录 Schema
 */
const FavoriteSchema = new Schema<IFavorite>(
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
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// 唯一索引：防止重复收藏
FavoriteSchema.index({ userId: 1, projectId: 1 }, { unique: true });
// 查询索引
FavoriteSchema.index({ userId: 1, createdAt: -1 });

export const Favorite = mongoose.model<IFavorite>('Favorite', FavoriteSchema);
