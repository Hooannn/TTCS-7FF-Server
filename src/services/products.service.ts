import { isSameTimeframe, getNow, getTime, getStartOfTimeframe, getPreviousTimeframe, getEndOfTimeframe } from '@/utils/time';
import { AppDataSource } from '@/data-source';
import { DataSource, FindManyOptions, Like } from 'typeorm';
import { OrderItem, Product, ProductImage } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { errorStatus } from '@/config';
import { parseCreatedAtFilter } from '@/utils/parseCreatedAtFilter';
import { parsePriceFilter } from '@/utils/parsePriceFilter';
import dayjs from 'dayjs';

class ProductsService {
  private productRepository = AppDataSource.getRepository(Product);
  private orderItemRepository = AppDataSource.getRepository(OrderItem);
  private productImagesRepository = AppDataSource.getRepository(ProductImage);

  public async resetProductsDailyData() {
    return null;
  }

  public async getProductById(id: string) {
    const startDate = getStartOfTimeframe(getNow().valueOf(), 'yearly').valueOf();

    const results = await this.productRepository.manager.query(`
          select 
            p.isActive,
            p.isAvailable,
            p.productId as productId,
            p.nameVi as nameVi,
            p.nameEn as nameEn,
            p.descriptionVi as descriptionVi,
            p.descriptionEn as descriptionEn,
            p.currentPrice as currentPrice,
            p.createdAt as createdAt,
            c.nameVi as categoryNameVi,
            c.nameEn as categoryNameEn,
            subt.totalSold as totalSoldUnits,
            GROUP_CONCAT(pi.imageUrl) as featuredImages 
          FROM PRODUCT p 
          LEFT JOIN CATEGORY c on p.categoryId = c.categoryId
          LEFT JOIN PRODUCT_IMAGE pi ON p.productId  = pi.productId
          LEFT JOIN (
            select oi.productId, sum(oi.quantity) as totalSold from ORDER_ITEM oi
            join (
              select o.orderId from \`ORDER\` o where o.createdAt >= '${dayjs(startDate).format('YYYY-MM-DD HH:mm:ss')}' and o.status = 'Done' 
            ) filteredOrder on oi.orderId = filteredOrder.orderId
            group by oi.productId
          ) subt on subt.productId = p.productId
          group by p.productId
          having p.productId = '${id}' and p.isActive = 1 and p.isAvailable = 1
    `);
    if (results.length === 0) throw new HttpException(400, errorStatus.PRODUCT_NOT_FOUND);
    const product = results[0];
    return {
      ...product,
      price: product.currentPrice,
      _id: product.productId,
      featuredImages: product.featuredImages?.split(',') ?? [],
      name: { vi: product.nameVi, en: product.nameEn },
      description: { vi: product.descriptionVi, en: product.descriptionEn },
      category: { name: { vi: product.categoryNameVi, en: product.categoryNameEn }, nameEn: product.categoryNameEn, nameVi: product.categoryNameVi },
    };
  }

  public async getPopularProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit = 5) {
    const highestTotalSoldUnitsProducts = await this.getHighestTotalSoldProductsByUnit(type, limit);
    return { highestViewCountProducts: [], highestTotalSoldUnitsProducts, highestTotalSalesProducts: [] };
  }

  public async findOneProductByCategory(id: string) {
    return await this.productRepository.findOne({ relations: ['category'], where: { categoryId: id, isActive: 1 } });
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

  public getAllProductsWithTotalSoldUnits = async (type: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();

    const results = await this.productRepository.manager.query(`
        SELECT 
          p.productId as productId, 
          p.nameVi as nameVi, 
          p.nameEn as nameEn, 
          p.descriptionVi as descriptionVi, 
          p.descriptionEn as descriptionEn, 
          p.currentPrice as currentPrice, 
          p.createdAt as createdAt, 
          category.nameVi as categoryNameVi, 
          category.nameEn as categoryNameEn, 
          SUM(filteredOrders.quantity) AS totalSoldUnits,
          (SELECT pi2.imageUrl FROM PRODUCT_IMAGE pi2 WHERE pi2.productId = p.productId LIMIT 1) AS featuredImage
        FROM 
          PRODUCT p
        LEFT JOIN 
          CATEGORY category ON category.categoryId = p.categoryId
        LEFT JOIN 
          (select oi.orderId, oi.productId, oi.quantity from ORDER_ITEM oi join \`ORDER\` o on oi.orderId = o.orderId and o.status = 'Done' and o.createdAt >= '${dayjs(
            startDate,
          ).format('YYYY-MM-DD HH:mm:ss')}') 
    	      AS filteredOrders 
        ON 
          filteredOrders.productId = p.productId
        WHERE 
          p.isActive = 1
        GROUP BY 
          p.productId
      `);

    return results.map(result => ({
      ...result,
      _id: result.productId,
      name: { vi: result.nameVi, en: result.nameEn },
      description: { vi: result.descriptionVi, en: result.descriptionEn },
      category: { name: { vi: result.categoryNameVi, en: result.categoryNameEn } },
    }));
  };

  public async searchProducts({ q }: { q: string }) {
    const startDate = getStartOfTimeframe(getNow().valueOf(), 'monthly').valueOf();
    const endDate = getEndOfTimeframe(startDate.valueOf(), 'monthly').valueOf();

    const products = await this.productRepository.manager.query(`
      select 
        p.productId as productId, 
        p.nameVi as nameVi, 
        p.nameEn as nameEn, 
        p.descriptionVi as descriptionVi, 
        p.descriptionEn as descriptionEn, 
        p.currentPrice as currentPrice, 
        p.createdAt as createdAt,  
        filteredOrders.totalSold AS totalSoldUnits,
        (SELECT pi2.imageUrl FROM PRODUCT_IMAGE pi2 WHERE pi2.productId = p.productId LIMIT 1) AS featuredImage
      FROM PRODUCT p left join (
	      select oi.productId, SUM(oi.quantity) as totalSold from ORDER_ITEM oi inner join \`ORDER\` o 
        on o.orderId = oi.orderId 
        and o.status = 'DONE' 
        and o.createdAt >= '${dayjs(startDate).format('YYYY-MM-DD HH:mm:ss')}'
        and o.createdAt <= '${dayjs(endDate).format('YYYY-MM-DD HH:mm:ss')}'
	      group by oi.productId
      ) as filteredOrders on p.productId = filteredOrders.productId
      where p.isActive = 1 and p.isAvailable = 1 and (p.nameEn like '%${q}%' or p.nameVi like '%${q}%')
    `);

    return {
      products: products.map(product => ({
        ...product,
        price: product.currentPrice,
        _id: product.productId,
        featuredImages: [product.featuredImage],
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
    const isUsed = await this.orderItemRepository.existsBy({ productId });
    if (isUsed) throw new HttpException(400, errorStatus.PRODUCT_IS_USED);
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

  private async getHighestTotalSoldProductsByUnit(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit: number) {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();

    const results = await this.productRepository.manager.query(`
        SELECT 
          p.productId as productId, 
          p.nameVi as nameVi, 
          p.nameEn as nameEn, 
          p.descriptionVi as descriptionVi, 
          p.descriptionEn as descriptionEn, 
          p.currentPrice as currentPrice, 
          p.createdAt as createdAt, 
          category.nameVi as categoryNameVi, 
          category.nameEn as categoryNameEn, 
          SUM(filteredOrders.quantity) AS totalSoldUnits,
          (SELECT pi2.imageUrl FROM PRODUCT_IMAGE pi2 WHERE pi2.productId = p.productId LIMIT 1) AS featuredImage
        FROM 
          PRODUCT p
        LEFT JOIN 
          CATEGORY category ON category.categoryId = p.categoryId
        JOIN 
          (select oi.orderId, oi.productId, oi.quantity, o.createdAt from ORDER_ITEM oi join \`ORDER\` o on oi.orderId = o.orderId and o.status = 'Done' AND o.createdAt >= '${dayjs(
            startDate,
          ).format('YYYY-MM-DD HH:mm:ss')}') 
    	      AS filteredOrders 
        ON 
          filteredOrders.productId = p.productId
        WHERE 
          p.isActive = 1
        GROUP BY 
          p.productId
        ORDER BY 
	        totalSoldUnits DESC
        LIMIT 
          ${limit}
      `);

    return results.map(result => ({
      ...result,
      _id: result.productId,
      name: { vi: result.nameVi, en: result.nameEn },
      description: { vi: result.descriptionVi, en: result.descriptionEn },
      category: { name: { vi: result.categoryNameVi, en: result.categoryNameEn } },
    }));
  }
}

export default ProductsService;
