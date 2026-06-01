import { Character, ICharacter } from '../models';
import { BaseRepository } from './BaseRepository';
import mongoose from 'mongoose';

export class CharacterRepository extends BaseRepository<ICharacter> {
  constructor() {
    super(Character);
  }

  async findByProject(projectId: string): Promise<ICharacter[]> {
    return this.model.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .sort({ createdAt: 1 }).exec();
  }

  async findByName(projectId: string, name: string): Promise<ICharacter | null> {
    return this.model.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
      name
    }).exec();
  }

  async updateRelationships(
    id: string,
    relationships: ICharacter['relationships']
  ): Promise<ICharacter | null> {
    return this.model.findByIdAndUpdate(
      id,
      { relationships, updatedAt: new Date() },
      { new: true }
    ).exec();
  }

  async deleteByProject(projectId: string): Promise<number> {
    const result = await this.model.deleteMany({
      projectId: new mongoose.Types.ObjectId(projectId)
    }).exec();
    return result.deletedCount;
  }
}

export const characterRepository = new CharacterRepository();
