/**
 * 创作者标签模型
 * 用于创作者项目分类管理，与 Showcase 标签 (Tag) 分离
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICreatorTag extends Document {
    name: string;
    color: string;
    creatorId: Types.ObjectId;  // 归属的创作者
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const CreatorTagSchema = new Schema<ICreatorTag>(
    {
        name: { type: String, required: true, trim: true, maxlength: 20 },
        color: { type: String, default: '#6366f1' },
        creatorId: { type: Schema.Types.ObjectId, ref: 'Creator', required: true, index: true },
        sortOrder: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
);

// 联合唯一索引：同一创作者下标签名唯一
CreatorTagSchema.index({ creatorId: 1, name: 1 }, { unique: true });
// 排序索引
CreatorTagSchema.index({ creatorId: 1, sortOrder: 1 });

export const CreatorTag = mongoose.model<ICreatorTag>('CreatorTag', CreatorTagSchema);
