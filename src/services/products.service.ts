import { isSameTimeframe, getNow, getTime } from '@/utils/time';

class ProductsService {
  private Product = Product;

  public async resetProductsDailyData() {
    const productsToReset = await this.Product.find({
      $or: [
        { 'dailyViewCount.count': { $gt: 0 } },
        { 'dailyData.totalSales': { $gt: 0 } },
        { 'dailyData.totalUnits': { $gt: 0 } },
        { 'weeklyViewCount.count': { $gt: 0 } },
        { 'monthlyViewCount.count': { $gt: 0 } },
        { 'yearlyViewCount.count': { $gt: 0 } },
      ],
    });
    for (const product of productsToReset) {
      await Promise.all([
        await this.resetViewCount(product, 'daily'),
        await this.resetViewCount(product, 'weekly'),
        await this.resetViewCount(product, 'monthly'),
        await this.resetViewCount(product, 'yearly'),
        await this.updateDailySales({ product, itemQuantity: 0 }),
      ]);
    }
  }

  public async getProductById(productId: string) {
    const product = await this.Product.findById(productId).populate('category');
    this.updateViewCount(product, 'daily');
    this.updateViewCount(product, 'monthly');
    this.updateViewCount(product, 'weekly');
    this.updateViewCount(product, 'yearly');
    return product;
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

  public async findOneProductByCategory(categoryId: string) {
    return await this.Product.findOne({ category: categoryId });
  }

  public async updateProductSales(items: { product: string | Types.ObjectId; quantity: number }[], orderCreatedAt?: number | string | Date) {
    const productIds = items.map(item => new mongo.ObjectId(item.product));
    const products = await this.Product.find({ _id: { $in: productIds } });
    for (let index = 0; index < products.length; index++) {
      const itemQuantity = items.find(item => item.product.toString() === products[index]._id.toString()).quantity;
      await Promise.all([
        await this.updateYearlySales({ product: products[index], itemQuantity, time: orderCreatedAt }),
        await this.updateWeeklySales({ product: products[index], itemQuantity, time: orderCreatedAt }),
        await this.updateMonthlySales({ product: products[index], itemQuantity, time: orderCreatedAt }),
        await this.updateDailySales({ product: products[index], itemQuantity, time: orderCreatedAt }),
      ]);
    }
  }

  public async revertProductSales(items: { product: string | Types.ObjectId; quantity: number }[], orderCreatedAt?: number | string | Date) {
    const productIds = items.map(item => new mongo.ObjectId(item.product));
    const products = await this.Product.find({ _id: { $in: productIds } });
    for (let index = 0; index < products.length; index++) {
      const itemQuantity = items.find(item => item.product.toString() === products[index]._id.toString()).quantity;
      await Promise.all([
        await this.updateYearlySales({ product: products[index], itemQuantity: -itemQuantity, time: orderCreatedAt }),
        await this.updateWeeklySales({ product: products[index], itemQuantity: -itemQuantity, time: orderCreatedAt }),
        await this.updateMonthlySales({ product: products[index], itemQuantity: -itemQuantity, time: orderCreatedAt }),
        await this.updateDailySales({ product: products[index], itemQuantity: -itemQuantity, time: orderCreatedAt }),
      ]);
    }
  }

  public async getAllProducts({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.Product.countDocuments(parseFilter).sort(parseSort);
    const products = await this.Product.find(parseFilter, null, { limit, skip }).sort(parseSort).populate('category');
    return { total, products };
  }

  public async searchProducts({ q }: { q: string }) {
    const parseSearchTerm = JSON.parse(q);
    const products = await this.Product.find({
      $or: [
        {
          'name.vi': parseSearchTerm,
        },
        {
          'name.en': parseSearchTerm,
        },
      ],
      isAvailable: true,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'category',
        select: 'name',
      });

    return { products };
  }

  public async addProduct(reqProduct: IProduct) {
    const product = new this.Product(reqProduct);
    await product.save();
    return product;
  }

  public async deleteProduct(productId: string) {
    return this.Product.findByIdAndDelete(productId);
  }

  public async updateProduct(productId: string, product: IProduct) {
    return await this.Product.findOneAndUpdate({ _id: productId }, product, { returnOriginal: false });
  }

  private async updateYearlySales({ product, itemQuantity, time }: UpdateParams) {
    const date = time ? new Date(time) : new Date();
    const year = date.getFullYear().toString();
    const yearlyDataIndex = product.yearlyData.findIndex(data => data.year === year);
    if (yearlyDataIndex !== -1) {
      await product.updateOne(
        { $inc: { 'yearlyData.$[elem].totalSales': product.price * itemQuantity, 'yearlyData.$[elem].totalUnits': itemQuantity } },
        { arrayFilters: [{ 'elem.year': year }] },
      );
    } else {
      await product.updateOne({
        $push: { yearlyData: { year, totalSales: product.price * itemQuantity, totalUnits: itemQuantity } },
      });
    }
  }

  private async updateMonthlySales({ product, itemQuantity, time }: UpdateParams) {
    const date = time ? new Date(time) : new Date();
    const year = date.getFullYear().toString();
    const month = date.getMonth() + 1;
    const monthlyDataIndex = product.monthlyData.findIndex(data => data.year === year && data.month === month.toString());
    if (monthlyDataIndex !== -1) {
      await product.updateOne(
        { $inc: { 'monthlyData.$[elem1].totalSales': product.price * itemQuantity, 'monthlyData.$[elem2].totalUnits': itemQuantity } },
        { arrayFilters: [{ 'elem1.year': year }, { 'elem2.month': month }], upsert: true },
      );
    } else {
      await product.updateOne({
        $push: { monthlyData: { year, month, totalSales: product.price * itemQuantity, totalUnits: itemQuantity } },
      });
    }
  }

  private async updateDailySales({ product, itemQuantity, time }: UpdateParams) {
    const now = time ? getTime(time) : getNow();
    const dailyData = product.dailyData;

    if (dailyData && isSameTimeframe(now, dailyData.time, 'daily')) {
      await product.updateOne({
        $inc: {
          'dailyData.totalSales': product.price * itemQuantity,
          'dailyData.totalUnits': itemQuantity,
        },
      });
    } else {
      const newDailyData = {
        time: now.startOf('day').valueOf(),
        totalSales: product.price * itemQuantity,
        totalUnits: itemQuantity,
      };
      await product.updateOne({
        $set: { dailyData: newDailyData },
      });
    }
  }

  private async updateWeeklySales({ product, itemQuantity, time }: UpdateParams) {
    const date = time ? new Date(time) : new Date();
    const year = date.getFullYear().toString();
    const week = `${this.getWeekNumber(date)}`;
    const weeklyDataIndex = product.weeklyData.findIndex(data => data.year === year && data.week === week);
    if (weeklyDataIndex !== -1) {
      await product.updateOne(
        { $inc: { 'weeklyData.$[elem1].totalSales': product.price * itemQuantity, 'weeklyData.$[elem2].totalUnits': itemQuantity } },
        { arrayFilters: [{ 'elem1.week': week }, { 'elem2.year': year }], upsert: true },
      );
    } else {
      await product.updateOne({
        $push: { weeklyData: { year, week, totalSales: product.price * itemQuantity, totalUnits: itemQuantity } },
      });
    }
  }

  private getWeekNumber = (date: Date) => {
    const onejan = new Date(date.getFullYear(), 0, 1);
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOfYear = ((today.getTime() - onejan.getTime() + 86400000) / 86400000) >> 0;
    return Math.ceil(dayOfYear / 7);
  };

  private async getHighestViewCountProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit: number) {
    const viewCountField = `${type}ViewCount.count`;
    return await this.Product.find({ [viewCountField]: { $gt: 0 } })
      .limit(limit)
      .sort({ [viewCountField]: -1 })
      .populate('category');
  }

  private async getHighestTotalSoldProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly', field: 'totalSales' | 'totalUnits', limit: number) {
    const now = getNow();
    const year = new Date().getFullYear().toString();
    const month = new Date().getMonth() + 1;
    const week = `${this.getWeekNumber(new Date())}`;
    switch (type) {
      case 'yearly':
        return await this.Product.find({
          'yearlyData.year': year,
          [`yearlyData.${field}`]: { $gt: 0 },
        })
          .sort({ [`yearlyData.${field}`]: -1 })
          .limit(limit)
          .populate('category');
      case 'weekly':
        return await this.Product.find({
          'weeklyData.year': year,
          'weeklyData.week': week,
          [`weeklyData.${field}`]: { $gt: 0 },
        })
          .sort({ [`weeklyData.${field}`]: -1 })
          .limit(limit)
          .populate('category');
      case 'monthly':
        return await this.Product.find({
          'monthlyData.year': year,
          'monthlyData.month': month,
          [`monthlyData.${field}`]: { $gt: 0 },
        })
          .sort({ [`monthlyData.${field}`]: -1 })
          .limit(limit)
          .populate('category');
      case 'daily':
        return await this.Product.find({
          'dailyData.time': now.startOf('day').valueOf(),
          [`dailyData.${field}`]: { $gt: 0 },
        })
          .sort({ [`dailyData.${field}`]: -1 })
          .limit(limit)
          .populate('category');
    }
  }

  private async updateViewCount(product: UpdateParams['product'], type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const now = getNow();
    const viewCountField = `${type}ViewCount`;
    const viewCount = product[viewCountField];
    if (viewCount && isSameTimeframe(now, viewCount.time, type)) {
      await product.updateOne({
        $inc: {
          [`${viewCountField}.count`]: 1,
        },
      });
    } else {
      const newViewCount = {
        time: now.startOf('day').valueOf(),
        count: 1,
      };
      await product.updateOne({
        $set: { [viewCountField]: newViewCount },
      });
    }
  }

  private async resetViewCount(product: UpdateParams['product'], type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const now = getNow();
    const viewCountField = `${type}ViewCount`;
    const viewCount = product[viewCountField];
    if (viewCount && isSameTimeframe(now, viewCount.time, type)) return;
    const newViewCount = {
      time: now.startOf('day').valueOf(),
      count: 0,
    };
    await product.updateOne({
      $set: { [viewCountField]: newViewCount },
    });
  }
}

export default ProductsService;
