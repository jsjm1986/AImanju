import mongoose, { Schema, Document } from 'mongoose';

export interface IOutline extends Document {
  projectId: mongoose.Types.ObjectId;
  raw?: string;
  characterCards?: string;
  synopsis?: string;
  episodeSummaries?: string;
  generatedAt: Date;
}

const OutlineSchema = new Schema<IOutline>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    raw: { type: String },
    characterCards: { type: String },
    synopsis: { type: String },
    episodeSummaries: { type: String },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

export const Outline = mongoose.model<IOutline>('Outline', OutlineSchema);
