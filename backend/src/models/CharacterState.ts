import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacterState extends Document {
  projectId: mongoose.Types.ObjectId;
  characterId: mongoose.Types.ObjectId;
  characterName: string;
  episodeNumber: number;

  // 装备变化
  equipmentGained: string[];
  equipmentLost: string[];

  // 能力变化
  newAbilities: string[];

  // 当前状态描述
  condition: {
    physical: string;
    mental: string;
    combat: string;
  };

  // 永久性标记
  permanentMark?: {
    mark: string;
    type: 'disability' | 'special' | 'awakening';
  };

  // 累计状态（截至本集）
  currentEquipment: string[];
  currentAbilities: string[];

  // 变更描述
  description: string;

  createdAt: Date;
}

const CharacterStateSchema = new Schema<ICharacterState>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true, index: true },
    characterName: { type: String, required: true },
    episodeNumber: { type: Number, required: true },

    equipmentGained: [{ type: String }],
    equipmentLost: [{ type: String }],
    newAbilities: [{ type: String }],

    condition: {
      physical: { type: String, default: '状态正常' },
      mental: { type: String, default: '状态正常' },
      combat: { type: String, default: '战力正常' },
    },

    permanentMark: {
      mark: { type: String },
      type: { type: String, enum: ['disability', 'special', 'awakening'] },
    },

    currentEquipment: [{ type: String }],
    currentAbilities: [{ type: String }],

    description: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// 复合索引
CharacterStateSchema.index({ projectId: 1, characterId: 1, episodeNumber: 1 }, { unique: true });
CharacterStateSchema.index({ projectId: 1, episodeNumber: 1 });

export const CharacterState = mongoose.model<ICharacterState>('CharacterState', CharacterStateSchema);
