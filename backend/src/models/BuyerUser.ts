import mongoose, { Schema, Document } from 'mongoose';

/**
 * 买家用户接口
 */
export interface IBuyerUser extends Document {
    username: string;
    email: string;
    passwordHash: string;
    nickname: string;
    avatar?: string;
    points: number;
    role: 'buyer' | 'admin';
    status: 'active' | 'banned';
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 买家用户 Schema
 */
const BuyerUserSchema = new Schema<IBuyerUser>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 20,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        nickname: {
            type: String,
            required: true,
            trim: true,
            maxlength: 30,
        },
        avatar: {
            type: String,
        },
        points: {
            type: Number,
            default: 0,
            min: 0,
        },
        role: {
            type: String,
            enum: ['buyer', 'admin'],
            default: 'buyer',
        },
        status: {
            type: String,
            enum: ['active', 'banned'],
            default: 'active',
        },
        lastLoginAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// 索引
BuyerUserSchema.index({ email: 1 });
BuyerUserSchema.index({ username: 1 });
BuyerUserSchema.index({ createdAt: -1 });

export const BuyerUser = mongoose.model<IBuyerUser>('BuyerUser', BuyerUserSchema);
