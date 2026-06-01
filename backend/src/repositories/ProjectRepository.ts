import { Project, IProject } from '../models';
import { BaseRepository } from './BaseRepository';

type ProjectStatus = 'draft' | 'outline_done' | 'generating' | 'completed';

export class ProjectRepository extends BaseRepository<IProject> {
  constructor() {
    super(Project);
  }

  async findAllSorted(): Promise<IProject[]> {
    return this.model.find().sort({ updatedAt: -1 }).exec();
  }

  async findById(id: string): Promise<IProject | null> {
    return this.model.findById(id).exec();
  }

  async updateStatus(id: string, status: ProjectStatus): Promise<IProject | null> {
    return this.update(id, { status, updatedAt: new Date() });
  }
}

export const projectRepository = new ProjectRepository();
