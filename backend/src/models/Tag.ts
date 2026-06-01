import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
  name: string;
  category: 'male' | 'female' | 'common';  // 适用分类：男频、女频、通用
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    category: {
      type: String,
      enum: ['male', 'female', 'common'],
      default: 'common'
    },
    color: { type: String, default: '#6366f1' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// 索引
TagSchema.index({ category: 1, sortOrder: 1 });
TagSchema.index({ isActive: 1 });

export const Tag = mongoose.model<ITag>('Tag', TagSchema);

