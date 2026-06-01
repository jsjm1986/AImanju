/**
 * 标签仓库
 */

import { BaseRepository } from './BaseRepository';
import { Tag, ITag } from '../models/Tag';
import { Project } from '../models/Project';

class TagRepository extends BaseRepository<ITag> {
  constructor() {
    super(Tag);
  }

  /**
   * 获取所有标签（按排序顺序）
   */
  async getAllSorted(): Promise<ITag[]> {
    return this.model.find().sort({ sortOrder: 1, name: 1 }).exec();
  }

  /**
   * 按名称查找标签
   */
  async findByName(name: string): Promise<ITag | null> {
    return this.model.findOne({ name }).exec();
  }

  /**
   * 获取项目的所有标签
   */
  async getProjectTags(projectId: string): Promise<ITag[]> {
    const project = await Project.findById(projectId).populate('tags').exec();
    return (project?.tags as unknown as ITag[]) || [];
  }

  /**
   * 为项目添加标签
   */
  async addTagToProject(projectId: string, tagId: string): Promise<boolean> {
    const result = await Project.findByIdAndUpdate(
      projectId,
      { $addToSet: { tags: tagId } },
      { new: true }
    ).exec();
    return result !== null;
  }

  /**
   * 从项目移除标签
   */
  async removeTagFromProject(projectId: string, tagId: string): Promise<boolean> {
    const result = await Project.findByIdAndUpdate(
      projectId,
      { $pull: { tags: tagId } },
      { new: true }
    ).exec();
    return result !== null;
  }

  /**
   * 获取使用某标签的项目数量
   */
  async getTagUsageCount(tagId: string): Promise<number> {
    return Project.countDocuments({ tags: tagId }).exec();
  }

  /**
   * 批量更新排序顺序
   */
  async updateSortOrders(orders: { id: string; sortOrder: number }[]): Promise<void> {
    const bulkOps = orders.map(({ id, sortOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder } },
      },
    }));
    await this.model.bulkWrite(bulkOps);
  }
}

export const tagRepository = new TagRepository();
