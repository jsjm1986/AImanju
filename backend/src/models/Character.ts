import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
  projectId: mongoose.Types.ObjectId;
  name: string;
  role?: string;         // 角色定位：男主角、反派等
  type: string;          // 角色类型（自由文本）
  gender: string;        // 性别（自由文本：男/女/不明等）
  age?: string;
  identity: string;
  personality: string;
  background: string;
  abilities?: string;
  // 详细外貌字段（V1兼容）
  hairStyle?: string;    // 发型
  hairColor?: string;    // 发色
  faceType?: string;     // 脸型
  bodyType?: string;     // 身材
  clothing?: string;     // 穿着
  accessories?: string;  // 配饰
  // 保留原有 appearance 字段用于兼容
  appearance?: string;
  // 初始装备和能力（用于状态追踪）
  initialEquipment?: string[];
  initialAbilities?: string[];
  relationships: {
    targetCharacterId: mongoose.Types.ObjectId;
    targetName: string;
    relationship: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const CharacterSchema = new Schema<ICharacter>(
  {
    projectId: { $type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { $type: String, required: true },
    role: { $type: String },  // 角色定位
    type: { $type: String, default: '配角' },  // 角色类型（自由文本）
    gender: { $type: String, default: '未知' },
    age: { $type: String },
    identity: { $type: String, default: '' },
    personality: { $type: String, default: '' },
    background: { $type: String, default: '' },
    abilities: { $type: String },
    // 详细外貌字段
    hairStyle: { $type: String },
    hairColor: { $type: String },
    faceType: { $type: String },
    bodyType: { $type: String },
    clothing: { $type: String },
    accessories: { $type: String },
    // 保留原有字段
    appearance: { $type: String },
    // 初始装备和能力
    initialEquipment: [{ $type: String }],
    initialAbilities: [{ $type: String }],
    relationships: [
      {
        targetCharacterId: { $type: Schema.Types.ObjectId, ref: 'Character' },
        targetName: { $type: String },
        relationship: { $type: String },
      },
    ],
  },
  {
    timestamps: true,
    typeKey: '$type',  // 使用 $type 作为类型关键字，避免与 type 字段名冲突
  }
);

// 复合索引：项目ID + 角色名
CharacterSchema.index({ projectId: 1, name: 1 });

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);
