import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * 积分交易类型
 */
export type TransactionType = 'recharge' | 'purchase' | 'rewrite' | 'refund' | 'admin_adjust';

/**
 * 积分交易记录接口
 */
export interface IPointsTransaction extends Document {
    userId: Types.ObjectId;
    type: TransactionType;
    amount: number;           // 正数=收入，负数=支出
    balance: number;          // 交易后余额
    description: string;
    relatedId?: Types.ObjectId;  // 关联的订单/请求ID
    relatedType?: 'episode' | 'rewrite' | 'recharge';
    createdAt: Date;
}

/**
 * 积分交易记录 Schema
 */
const PointsTransactionSchema = new Schema<IPointsTransaction>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'BuyerUser',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['recharge', 'purchase', 'rewrite', 'refund', 'admin_adjust'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        balance: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            required: true,
            maxlength: 200,
        },
        relatedId: {
            type: Schema.Types.ObjectId,
        },
        relatedType: {
            type: String,
            enum: ['episode', 'rewrite', 'recharge'],
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// 索引
PointsTransactionSchema.index({ userId: 1, createdAt: -1 });
PointsTransactionSchema.index({ type: 1, createdAt: -1 });

export const PointsTransaction = mongoose.model<IPointsTransaction>('PointsTransaction', PointsTransactionSchema);
