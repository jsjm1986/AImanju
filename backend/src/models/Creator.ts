import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * 创作者用户模型
 * 独立于买家用户，用于创作者端认证和配额管理
 */

export interface ICreator extends Document {
    username: string;
    email: string;
    passwordHash: string;
    role: 'admin' | 'creator';
    tier: 'trial' | 'paid';
    // 配额管理
    projectQuota: number;      // 购买的项目配额（付费用户）
    projectsUsed: number;      // 已创建项目数
    trialEpisodesUsed: number; // 试用已生成集数（上限由配置决定）
    // 代理关联
    agentId?: Types.ObjectId;  // 所属代理（通过邀请码注册时绑定）
    inviteCode?: string;       // 注册时使用的邀请码
    // 元数据
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;

    // 方法
    comparePassword(candidatePassword: string): Promise<boolean>;
    canCreateProject(): boolean;
    canGenerateEpisode(): boolean;
    getRemainingTrialEpisodes(): number;
    getRemainingProjectQuota(): number;
}

const CreatorSchema = new Schema<ICreator>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
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
        role: {
            type: String,
            enum: ['admin', 'creator'],
            default: 'creator',
        },
        tier: {
            type: String,
            enum: ['trial', 'paid'],
            default: 'trial',
        },
        projectQuota: {
            type: Number,
            default: 0,  // 试用用户默认0，通过 tier='trial' 获得1个免费项目
        },
        projectsUsed: {
            type: Number,
            default: 0,
        },
        trialEpisodesUsed: {
            type: Number,
            default: 0,
        },
        agentId: {
            type: Schema.Types.ObjectId,
            ref: 'Agent',
            default: null,
        },
        inviteCode: {
            type: String,
            default: null,
        },
        lastLoginAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// 密码加密中间件
CreatorSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) return;

    // 如果传入的是明文密码（不是已加密的hash）
    if (this.passwordHash && this.passwordHash.length < 50) {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
});

// 比较密码
CreatorSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// 检查是否可以创建项目
CreatorSchema.methods.canCreateProject = function (): boolean {
    // 管理员无限制
    if (this.role === 'admin') return true;

    // 试用用户只能创建1个项目
    if (this.tier === 'trial') {
        return this.projectsUsed < 1;
    }

    // 付费用户检查配额
    return this.projectsUsed < this.projectQuota;
};

// 检查是否可以生成剧集
CreatorSchema.methods.canGenerateEpisode = function (): boolean {
    // 管理员无限制
    if (this.role === 'admin') return true;

    // 付费用户无限制
    if (this.tier === 'paid') return true;

    // 试用用户检查集数限制（默认10集）
    const trialLimit = parseInt(process.env.TRIAL_EPISODE_LIMIT || '10');
    return this.trialEpisodesUsed < trialLimit;
};

// 获取剩余试用集数
CreatorSchema.methods.getRemainingTrialEpisodes = function (): number {
    if (this.role === 'admin' || this.tier === 'paid') return -1; // -1 表示无限
    const trialLimit = parseInt(process.env.TRIAL_EPISODE_LIMIT || '10');
    return Math.max(0, trialLimit - this.trialEpisodesUsed);
};

// 获取剩余项目配额
CreatorSchema.methods.getRemainingProjectQuota = function (): number {
    if (this.role === 'admin') return -1; // -1 表示无限
    if (this.tier === 'trial') {
        return Math.max(0, 1 - this.projectsUsed);
    }
    return Math.max(0, this.projectQuota - this.projectsUsed);
};

// 索引
CreatorSchema.index({ agentId: 1 });

export const Creator = mongoose.model<ICreator>('Creator', CreatorSchema);
