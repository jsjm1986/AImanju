import mongoose, { Schema, Document, Types } from 'mongoose';

export type AllocationType = 'activate' | 'add_quota' | 'reduce_quota';

export interface IAgentAllocation extends Document {
    agentId: Types.ObjectId;
    creatorId: Types.ObjectId;
    type: AllocationType;
    projectCount: number;
    description: string;
    createdAt: Date;
}

const AgentAllocationSchema = new Schema<IAgentAllocation>(
    {
        agentId: {
            type: Schema.Types.ObjectId,
            ref: 'Agent',
            required: true,
        },
        creatorId: {
            type: Schema.Types.ObjectId,
            ref: 'Creator',
            required: true,
        },
        type: {
            type: String,
            enum: ['activate', 'add_quota', 'reduce_quota'],
            required: true,
        },
        projectCount: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            default: '',
            maxlength: 500,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

AgentAllocationSchema.index({ agentId: 1, createdAt: -1 });
AgentAllocationSchema.index({ creatorId: 1, createdAt: -1 });
AgentAllocationSchema.index({ type: 1 });

export const AgentAllocation = mongoose.model<IAgentAllocation>('AgentAllocation', AgentAllocationSchema);
