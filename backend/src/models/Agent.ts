import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IAgent extends Document {
    username: string;
    email: string;
    passwordHash: string;
    status: 'active' | 'frozen';
    projectQuota: number;
    projectsAllocated: number;
    inviteCode: string;
    note: string;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;

    comparePassword(candidatePassword: string): Promise<boolean>;
    canAllocateProjects(count: number): boolean;
    getRemainingQuota(): number;
}

const AgentSchema = new Schema<IAgent>(
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
        status: {
            type: String,
            enum: ['active', 'frozen'],
            default: 'active',
        },
        projectQuota: {
            type: Number,
            default: 0,
        },
        projectsAllocated: {
            type: Number,
            default: 0,
        },
        inviteCode: {
            type: String,
            unique: true,
            required: true,
        },
        note: {
            type: String,
            default: '',
            maxlength: 500,
        },
        lastLoginAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

AgentSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) return;
    if (this.passwordHash && this.passwordHash.length < 50) {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
});

AgentSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

AgentSchema.methods.canAllocateProjects = function (count: number): boolean {
    return (this.projectsAllocated + count) <= this.projectQuota;
};

AgentSchema.methods.getRemainingQuota = function (): number {
    return Math.max(0, this.projectQuota - this.projectsAllocated);
};

export function generateInviteCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

AgentSchema.index({ email: 1 });
AgentSchema.index({ username: 1 });
AgentSchema.index({ inviteCode: 1 }, { unique: true });
AgentSchema.index({ status: 1 });

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);
