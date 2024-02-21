import { isSameTimeframe, getNow, getTime } from '@/utils/time';
import { AppDataSource } from '@/data-source';
import { DataSource, FindManyOptions } from 'typeorm';
import { Category, Product, ProductImage } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { errorStatus } from '@/config';

class ProductsService {
  private productRepository = AppDataSource.getRepository(Product);
  private categoryRepository = AppDataSource.getRepository(Category);
  private productImagesRepository = AppDataSource.getRepository(ProductImage);

  public async resetProductsDailyData() {
    return null;
  }

  public async getProductById(id: string) {
    const product = await this.productRepository.findOneBy({ productId: id, isActive: 1 });
    return {
      ...product,
      price: product.currentPrice,
      _id: product.productId,
      featuredImages: product.images?.map(i => i.imageUrl),
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

  public async getProductsPrice(items: { product: string | Types.ObjectId; quantity: number }[]) {
    const productIds = items.map(item => new mongo.ObjectId(item.product));
    const failedProducts = [];
    let totalPrice = 0;
    const products = await this.Product.find({ _id: { $in: productIds } });
    for (let index = 0; index < products.length; index++) {
      const itemQuantity = items.find(item => item.product.toString() === products[index]._id.toString()).quantity;
      if (itemQuantity <= products[index].stocks && products[index].isAvailable) {
        totalPrice += products[index].price * itemQuantity;
        await products[index].updateOne({ $inc: { stocks: -itemQuantity } });
        products[index].save();
      } else failedProducts.push(products[index]._id.toString());
    }
    return { totalPrice, failedProducts };
  }

  public async findOneProductByCategory(id: string) {
    return await this.productRepository.find({ relations: ['category'], where: { categoryId: id } });
  }

  public async updateProductSales(items: { product: string | Types.ObjectId; quantity: number }[], orderCreatedAt?: number | string | Date) {
    return null;
  }

  public async revertProductSales(items: { product: string | Types.ObjectId; quantity: number }[], orderCreatedAt?: number | string | Date) {
    return null;
  }

  public async getAllProducts({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.productRepository.count({ where: { isActive: 1 } });
    const findOptions: FindManyOptions<Product> = {
      relations: ['images'],
      where: parseFilter,
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
        featuredImages: product.images.map(i => i.imageUrl),
        name: { vi: product.nameVi, en: product.nameEn },
        description: { vi: product.descriptionVi, en: product.descriptionEn },
      })),
    };
  }

  public async searchProducts({ q }: { q: string }) {
    const parseSearchTerm = JSON.parse(q);
    const findOptions: FindManyOptions<Product> = {
      where: [
        { nameEn: parseSearchTerm, isActive: 1 },
        { nameVi: parseSearchTerm, isActive: 1 },
      ],
    };
    const products = await this.productRepository.find(findOptions);
    return { products };
  }

  public async addProduct(reqProduct: Partial<Product>) {
    const { nameEn, nameVi, descriptionEn, descriptionVi, categoryId, featuredImages, currentPrice } = reqProduct;
    const product = this.productRepository.create({
      nameEn,
      nameVi,
      descriptionEn,
      descriptionVi,
      categoryId,
      currentPrice,
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
