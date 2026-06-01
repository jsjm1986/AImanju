import mongoose, { Schema, Document } from 'mongoose';

export interface IEpisodeSummary extends Document {
  projectId: mongoose.Types.ObjectId;
  episodeNumber: number;
  summary?: string;
  keyEvents?: string[];
  cliffhanger?: string;
  characterChanges?: string[];
  createdAt: Date;
}

const EpisodeSummarySchema = new Schema<IEpisodeSummary>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    episodeNumber: { type: Number, required: true },
    summary: { type: String },
    keyEvents: [{ type: String }],
    cliffhanger: { type: String },
    characterChanges: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

EpisodeSummarySchema.index({ projectId: 1, episodeNumber: 1 }, { unique: true });

export const EpisodeSummary = mongoose.model<IEpisodeSummary>('EpisodeSummary', EpisodeSummarySchema);
