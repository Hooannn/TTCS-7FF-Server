import { isSameTimeframe, getNow, getTime } from '@/utils/time';
import { AppDataSource } from '@/data-source';
import { DataSource, FindManyOptions, Like } from 'typeorm';
import { Category, Product, ProductImage } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { errorStatus } from '@/config';
import { parseCreatedAtFilter } from '@/utils/parseCreatedAtFilter';
import { parsePriceFilter } from '@/utils/parsePriceFilter';

class ProductsService {
  private productRepository = AppDataSource.getRepository(Product);
  private categoryRepository = AppDataSource.getRepository(Category);
  private productImagesRepository = AppDataSource.getRepository(ProductImage);

  public async resetProductsDailyData() {
    return null;
  }

  public async getProductById(id: string) {
    const product = await this.productRepository.findOne({
      where: { productId: id, isActive: 1 },
      relations: ['images', 'category'],
    });
    return {
      ...product,
      price: product.currentPrice,
      _id: product.productId,
      isAvailable: product.isAvailable?.readUInt8(0) === 1,
      featuredImages: product.images.map(i => i.imageUrl),
      name: { vi: product.nameVi, en: product.nameEn },
      description: { vi: product.descriptionVi, en: product.descriptionEn },
    };
  }

  public async getPopularProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit = 5) {
    const [highestViewCountProducts, highestTotalSoldUnitsProducts, highestTotalSalesProducts] = await Promise.all([
      await this.getHighestViewCountProducts(type, limit),
      await this.getHighestTotalSoldProducts(type, 'totalUnits', limit),
      await this.getHighestTotalSoldProducts(type, 'totalSales', limit),
    ]);
    return { highestViewCountProducts, highestTotalSoldUnitsProducts, highestTotalSalesProducts };
  }

  public async findOneProductByCategory(id: string) {
    return await this.productRepository.findOne({ relations: ['category'], where: { categoryId: id, isActive: 1 } });
  }

  public async updateProductSales(items: { product: string | Types.ObjectId; quantity: number }[], orderCreatedAt?: number | string | Date) {
    return null;
  }

  public async revertProductSales(items: { product: string | Types.ObjectId; quantity: number }[], orderCreatedAt?: number | string | Date) {
    return null;
  }

  public async getAllProducts({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');

    parseCreatedAtFilter(parseFilter);
    parsePriceFilter(parseFilter);

    if (parseFilter.nameVi) parseFilter.nameVi = Like(`%${parseFilter.nameVi}%`);
    if (parseFilter.nameEn) parseFilter.nameEn = Like(`%${parseFilter.nameEn}%`);
    if (parseFilter.descriptionVi) parseFilter.descriptionVi = Like(`%${parseFilter.descriptionVi}%`);
    if (parseFilter.descriptionEn) parseFilter.descriptionEn = Like(`%${parseFilter.descriptionEn}%`);

    const total = await this.productRepository.count({ where: { ...parseFilter, isActive: 1 } });
    const findOptions: FindManyOptions<Product> = {
      relations: ['images', 'category'],
      where: { ...parseFilter, isActive: 1 },
      order: parseSort,
      skip,
      take: limit,
      select: [
        'productId',
        'nameVi',
        'nameEn',
        'category',
        'images',
        'descriptionVi',
        'descriptionEn',
        'isAvailable',
        'isActive',
        'currentPrice',
        'createdAt',
      ],
    };
    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;
    const products = await this.productRepository.find(findOptions);

    return {
      total,
      products: products.map(product => ({
        ...product,
        price: product.currentPrice,
        _id: product.productId,
        isAvailable: product.isAvailable?.readUInt8(0) === 1,
        featuredImages: product.images.map(i => i.imageUrl),
        name: { vi: product.nameVi, en: product.nameEn },
        description: { vi: product.descriptionVi, en: product.descriptionEn },
      })),
    };
  }

  public async searchProducts({ q }: { q: string }) {
    const findOptions: FindManyOptions<Product> = {
      relations: ['images'],
      where: [
        { nameEn: Like(`%${q}%`), isActive: 1 },
        { nameVi: Like(`%${q}%`), isActive: 1 },
      ],
    };
    const products = await this.productRepository.find(findOptions);
    return {
      products: products.map(product => ({
        ...product,
        price: product.currentPrice,
        _id: product.productId,
        isAvailable: product.isAvailable?.readUInt8(0) === 1,
        featuredImages: product.images.map(i => i.imageUrl),
        name: { vi: product.nameVi, en: product.nameEn },
        description: { vi: product.descriptionVi, en: product.descriptionEn },
      })),
    };
  }

  public async addProduct(reqProduct: Partial<Product>) {
    const { nameEn, nameVi, descriptionEn, descriptionVi, categoryId, featuredImages, currentPrice, isAvailable } = reqProduct;
    const product = this.productRepository.create({
      nameEn,
      nameVi,
      descriptionEn,
      descriptionVi,
      categoryId,
      currentPrice,
      isAvailable: isAvailable ? 1 : 0,
    });
    const images = featuredImages.map(image => this.productImagesRepository.create({ imageUrl: image }));
    await this.productImagesRepository.save(images);
    product.images = images;
    await this.productRepository.save(product);
    return product;
  }

  public async deleteProduct(productId: string) {
    return this.productRepository.update(productId, { isActive: 0 });
  }

  public async updateProduct(productId: string, reqProduct: Partial<Product>) {
    const product = await this.productRepository.findOneBy({ productId, isActive: 1 });
    if (!product) throw new HttpException(400, errorStatus.PRODUCT_NOT_FOUND);
    const images = reqProduct.featuredImages?.map(image => this.productImagesRepository.create({ imageUrl: image }));
    await this.productImagesRepository.save(images);
    product.images = images;
    product.nameEn = reqProduct.nameEn;
    product.nameVi = reqProduct.nameVi;
    product.descriptionEn = reqProduct.descriptionEn;
    product.descriptionVi = reqProduct.descriptionVi;
    product.categoryId = reqProduct.categoryId;
    product.currentPrice = reqProduct.currentPrice;
    product.isAvailable = reqProduct.isAvailable;
    return await this.productRepository.save(product);
  }

  private getWeekNumber = (date: Date) => {
    const onejan = new Date(date.getFullYear(), 0, 1);
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOfYear = ((today.getTime() - onejan.getTime() + 86400000) / 86400000) >> 0;
    return Math.ceil(dayOfYear / 7);
  };

  private async getHighestViewCountProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit: number) {
    return [];
  }

  private async getHighestTotalSoldProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly', field: 'totalSales' | 'totalUnits', limit: number) {
    return [];
  }
}

export default ProductsService;
