/* eslint-disable @typescript-eslint/no-unused-vars */
import { errorStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import Order, { IOrder } from '@/models/Order';
import { IUser } from '@/models/User';
import { isSame, getNow, getPreviousTimeframe, getStartOfTimeframe, getEndOfTimeframe } from '@/utils/time';
import mongoose, { Document, Types } from 'mongoose';
import type { Dayjs } from 'dayjs';
import Product from '@/models/Product';
interface CreateChartParams {
  orders: (Document<unknown, any, IOrder> &
    Omit<
      IOrder & {
        _id: Types.ObjectId;
      },
      never
    >)[];
  startDate: Dayjs;
  columns: number;
  timeUnit: string;
  format: string;
}

interface ChartData {
  date: Dayjs;
  name: string;
  totalSales: number;
  totalUnits: number;
}
class OrdersService {
  private Order = Order;
  private Product = Product;

  public async getOrdersByCustomerId({
    customerId,
    userId,
    role,
    sort,
  }: {
    customerId: string;
    userId?: string;
    role?: IUser['role'];
    sort?: string;
  }) {
    if (customerId.toString() !== userId.toString() && role === 'User') throw new HttpException(403, errorStatus.NO_PERMISSIONS);
    if (sort === 'status') {
      const orderOfStatus = ['Processing', 'Delivering', 'Done', 'Cancelled'];
      return this.Order.aggregate([
        { $match: { customerId: new mongoose.Types.ObjectId(customerId) } },
        { $addFields: { __order: { $indexOfArray: [orderOfStatus, '$status'] } } },
        { $sort: { __order: 1 } },
      ]);
    }
    return await this.Order.find({ customerId })
      .sort(sort ? { [sort]: 1 } : { createdAt: -1 })
      .populate('items.product', 'name price isAvailable featuredImages rating ratingCount');
  }

  public async getOrderById({ orderId, userId, role }: { orderId: string; userId?: string; role?: IUser['role'] }) {
    const order = await this.Order.findById(orderId).populate('items.product', 'name price isAvailable featuredImages rating ratingCount');
    if (order.customerId.toString() !== userId.toString() && role === 'User') throw new HttpException(403, errorStatus.NO_PERMISSIONS);
    return order;
  }

  public async getAllOrders({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.Order.countDocuments(parseFilter).sort(parseSort);
    const orders = await this.Order.find(parseFilter, null, { limit, skip }).sort(parseSort).populate('items.product voucher');
    return { total, orders };
  }

  public async createOrder(order: Partial<IOrder>) {
    const newOrder = new this.Order(order);
    await newOrder.save();
    return newOrder;
  }

  public async deleteOrder(orderId: string) {
    return this.Order.findByIdAndDelete(orderId);
  }

  public async updateOrder(orderId: string, order: IOrder) {
    return await this.Order.findOneAndUpdate({ _id: orderId }, order, { returnOriginal: false });
  }

  public async ratingOrder(orderId: string, userId: string, value: number) {
    const target = await this.Order.findById(orderId);
    if (!target) throw new HttpException(404, errorStatus.ORDER_NOT_FOUND);
    if (target.customerId.toString() !== userId) throw new HttpException(403, errorStatus.NO_PERMISSIONS);
    if (target.status !== 'Done') throw new HttpException(400, 'YOU_CAN_ONLY_RATE_A_COMPLETE_ORDER');
    if (target.rating) throw new HttpException(409, errorStatus.ORDER_ALREADY_BEEN_RATED);

    const updateValue = value < 1 ? 1 : value > 5 ? 5 : value;
    await this.Order.findByIdAndUpdate(orderId, { rating: updateValue }, { timestamps: false });

    target.items.forEach(async item => {
      const product = await this.Product.findById(item.product);
      if (product) {
        if (!product.ratingCount) product.ratingCount = 1;
        const newRating = (product.rating * product.ratingCount + updateValue) / (product.ratingCount + 1);
        product.ratingCount += 1;
        product.rating = newRating;
        await product.save();
      }
    });
    return target;
  }

  public async getSummaryOrders(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();
    const currentCount = await this.Order.countDocuments({
      createdAt: { $gte: startDate, $lte: to },
    });
    const previousTimeFrame = getPreviousTimeframe(to, type).valueOf();
    const previousCount = await this.Order.countDocuments({
      createdAt: { $gte: getStartOfTimeframe(previousTimeFrame, type).valueOf(), $lte: getEndOfTimeframe(previousTimeFrame, type).valueOf() },
    });
    return { currentCount, previousCount };
  }

  public async getSummaryRevenues(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type);
    const currentOrders = await this.Order.find({
      createdAt: { $gte: startDate.valueOf(), $lte: to },
      status: 'Done',
    });
    const previousTimeFrame = getPreviousTimeframe(to, type).valueOf();
    const previousOrders = await this.Order.find({
      createdAt: { $gte: getStartOfTimeframe(previousTimeFrame, type).valueOf(), $lte: getEndOfTimeframe(previousTimeFrame, type).valueOf() },
      status: 'Done',
    });
    const currentCount = currentOrders.reduce((partialSum, order) => partialSum + order.totalPrice, 0);
    const previousCount = previousOrders.reduce((partialSum, order) => partialSum + order.totalPrice, 0);
    // const { columns, timeUnit, format } = this.prepareCreateChartParams(type, startDate);
    // const details = await this.createRevenuesChart({ orders: currentOrders, startDate, columns, timeUnit, format });
    return { currentCount, previousCount /*, details  */ };
  }

  public async getRevenuesChart(type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type);
    const currentOrders = await this.Order.find({
      createdAt: { $gte: startDate.valueOf(), $lte: getNow().valueOf() },
      status: 'Done',
    });
    const { columns, timeUnit, format } = this.prepareCreateChartParams(type, startDate);
    return await this.createRevenuesChart({ orders: currentOrders, startDate, columns, timeUnit, format });
  }

  private prepareCreateChartParams(type: 'daily' | 'weekly' | 'monthly' | 'yearly', startDate: Dayjs) {
    switch (type) {
      case 'daily':
        return {
          columns: 24,
          timeUnit: 'hour',
          format: 'hh:mm',
        };
      case 'weekly':
        return {
          columns: 7,
          timeUnit: 'day',
          format: 'dddd DD-MM',
        };
      case 'monthly':
        return {
          columns: startDate.daysInMonth(),
          timeUnit: 'day',
          format: 'dddd DD-MM',
        };
      case 'yearly':
        return {
          columns: 12,
          timeUnit: 'month',
          format: 'MMMM',
        };
    }
  }

  private async createRevenuesChart({ orders, startDate, columns, timeUnit, format }: CreateChartParams) {
    const results: ChartData[] = Array.from(Array(columns), (_, i) => ({
      date: startDate.add(i, timeUnit as any),
      name: startDate.add(i, timeUnit as any).format(format),
      totalSales: 0,
      totalUnits: 0,
    }));
    orders.forEach(({ totalPrice, createdAt, items }: any) => {
      const index = results.findIndex(result => isSame(createdAt, result.date, timeUnit));
      const totalUnits = items.reduce((partialSum: any, item: any) => partialSum + item.quantity, 0);
      results[index].totalSales = results[index].totalSales + totalPrice;
      results[index].totalUnits = results[index].totalUnits + totalUnits;
    });
    return results;
  }
}

export default OrdersService;
