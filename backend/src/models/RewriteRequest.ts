import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * 改写请求状态
 */
export type RewriteRequestStatus = 'pending' | 'paid' | 'processing' | 'completed' | 'rejected' | 'cancelled';

/**
 * 改写请求接口
 */
export interface IRewriteRequest extends Document {
    projectId: Types.ObjectId;
    buyerId: Types.ObjectId;
    status: RewriteRequestStatus;
    price: number;              // 支付的积分
    requirements: string;       // 改写需求描述
    paidAt?: Date;              // 支付时间
    completedAt?: Date;         // 完成时间
    result?: string;            // 改写结果/备注
    adminNote?: string;         // 管理员备注
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 改写请求 Schema
 */
const RewriteRequestSchema = new Schema<IRewriteRequest>(
    {
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        buyerId: {
            type: Schema.Types.ObjectId,
            ref: 'BuyerUser',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'processing', 'completed', 'rejected', 'cancelled'],
            default: 'pending',
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        requirements: {
            type: String,
            required: true,
            maxlength: 2000,
        },
        paidAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
        result: {
            type: String,
        },
        adminNote: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// 索引
RewriteRequestSchema.index({ projectId: 1, createdAt: -1 });
RewriteRequestSchema.index({ buyerId: 1, createdAt: -1 });
RewriteRequestSchema.index({ status: 1 });

export const RewriteRequest = mongoose.model<IRewriteRequest>('RewriteRequest', RewriteRequestSchema);
