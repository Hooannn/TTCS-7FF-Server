import { HttpException } from '@/exceptions/HttpException';
import { Category } from '@/entity';
import { errorStatus } from '@/config';
import { DataSource, FindManyOptions } from 'typeorm';
import { AppDataSource } from '@/data-source';

interface CreateCategoryReq {
  nameVi: string;
  nameEn: string;
  icon?: string;
}
class CategoriesService {
  private categoryRepository = AppDataSource.getRepository(Category);

  public async getAllCategories({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.categoryRepository.count({ select: ['categoryId'], where: { ...parseFilter, isActive: 1 }, order: parseSort });
    const findOptions: FindManyOptions<Category> = {
      where: { ...parseFilter, isActive: 1 },
      order: parseSort,
      skip,
      take: limit,
      select: ['categoryId', 'nameVi', 'nameEn', 'icon', 'createdAt', 'isActive'],
    };
    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;
    const categories = await this.categoryRepository.find(findOptions);
    return {
      total,
      categories: categories.map(category => ({ ...category, _id: category.categoryId, name: { vi: category.nameVi, en: category.nameEn } })),
    };
  }

  public async addCategory(reqCategory: Partial<Category>) {
    const { nameVi, nameEn, icon } = reqCategory;
    const existedCategory = await this.categoryRepository.existsBy({ nameVi, nameEn, isActive: 1 });
    if (existedCategory) throw new HttpException(409, errorStatus.CATEGORY_DUPLICATE_NAME);
    const category = this.categoryRepository.create({
      nameVi,
      nameEn,
      icon,
    });
    await this.categoryRepository.save(category);
    return category;
  }

  public async deleteCategory(categoryId: string) {
    return this.categoryRepository.update(categoryId, { isActive: 0 });
  }

  public async updateCategory(categoryId: string, category: Partial<Category>) {
    const { nameVi, nameEn, icon } = category;
    const duplicatedCategory = await this.categoryRepository.existsBy({ nameVi, nameEn, isActive: 1 });
    if (duplicatedCategory) throw new HttpException(409, errorStatus.CATEGORY_DUPLICATE_NAME);
    const updatedCategory = { nameVi, nameEn, icon };
    return await this.categoryRepository.update(categoryId, updatedCategory);
  }
}

export default CategoriesService;
