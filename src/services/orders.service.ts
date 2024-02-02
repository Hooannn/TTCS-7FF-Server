/* eslint-disable @typescript-eslint/no-unused-vars */
import { errorStatus } from '@/config';
import { AppDataSource } from '@/data-source';
import { Order, OrderStatus, UserRole } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { isSame, getNow, getPreviousTimeframe, getStartOfTimeframe, getEndOfTimeframe } from '@/utils/time';
import type { Dayjs } from 'dayjs';

// interface CreateChartParams {
//   orders: (Document<unknown, any, IOrder> &
//     Omit<
//       IOrder & {
//         _id: Types.ObjectId;
//       },
//       never
//     >)[];
//   startDate: Dayjs;
//   columns: number;
//   timeUnit: string;
//   format: string;
// }

interface ChartData {
  date: Dayjs;
  name: string;
  totalSales: number;
  totalUnits: number;
}

interface FilterCriteria {
  customerId?: string;
  status?: OrderStatus;
  startTime?: Date;
  endTime?: Date;
}

class OrdersService {
  private orderRepository = AppDataSource.getRepository(Order);

  public async getOrdersByCustomerId({ customerId, userId, role, sort }: { customerId: string; userId?: string; role?: UserRole; sort?: string }) {
    if (customerId.toString() !== userId.toString() && role === 'User') throw new HttpException(403, errorStatus.NO_PERMISSIONS);

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.customerId = :customerId', { customerId })
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .select(['order', 'item.price', 'item.quantity', 'product.nameVi', 'product.nameEn', 'voucher.code']);

    const VALID_SORTING_CRITERIA = ['createdAt', 'totalPrice', 'status'];
    if (VALID_SORTING_CRITERIA.includes(sort)) {
      queryBuilder.addOrderBy(`order.${sort}`, 'ASC');
    } else {
      queryBuilder.orderBy('order.createdAt', 'DESC');
    }

    return await queryBuilder.getMany();
  }

  public async getOrderById({ orderId, userId, role }: { orderId: string; userId?: string; role?: UserRole }) {
    const order = await this.getDetailedOrderById(orderId);

    if (order.customerId.toString() !== userId.toString() && role === UserRole.User) throw new HttpException(403, errorStatus.NO_PERMISSIONS);
    return order;
  }

  public async getAllOrders({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter: FilterCriteria = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');
    const queryBuilder = this.orderRepository.createQueryBuilder('order');

    Object.entries(parseFilter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'startTime' || key === 'endTime') {
          const comparator: string = key === 'startTime' ? '>=' : '<=';
          queryBuilder.andWhere(`order.createdAt ${comparator} :${key}`, {
            [key]: value,
          });
        } else {
          queryBuilder.andWhere(`order.${key} = :${key}`, { [key]: value });
        }
      }
    });

    const [orders, total] = await queryBuilder
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .select(['order', 'item.price', 'item.quantity', 'product.nameVi', 'product.nameEn', 'voucher.code'])
      .orderBy(`order.${Object.keys(parseSort)[0]}`, Object.values(parseSort)[0] as 'ASC' | 'DESC')
      .getManyAndCount();

    return { total, orders };
  }

  public async createOrder(order: Partial<Order>) {
    // TODO:
    // Calculate total price
    // Create order items
    // return newOrder;
  }

  public async updateOrderStatus(orderId: string, status: OrderStatus, rejectionReason?: string, staffId?: string) {
    if (status === 'Rejected' && !rejectionReason) throw new HttpException(404, errorStatus.MISSING_REJECTION_REASON);
    const updateResult = await this.orderRepository.update(
      { orderId },
      {
        status,
        rejectionReason: status === 'Rejected' ? rejectionReason : null,
        staffId,
      },
    );

    if (updateResult.affected !== 1) throw new HttpException(404, errorStatus.UPDATE_STATUS_FAILED);
    return await this.getDetailedOrderById(orderId);
  }

  private async getDetailedOrderById(orderId: string) {
    // Simple find-relation cannot return nested INNER JOIN
    return await this.orderRepository
      .createQueryBuilder('order')
      .where('order.orderId = :orderId', { orderId })
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .select(['order', 'item.price', 'item.quantity', 'product.nameVi', 'product.nameEn', 'voucher.code'])
      .getOne();
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

  // private async createRevenuesChart({ orders, startDate, columns, timeUnit, format }: CreateChartParams) {
  //   const results: ChartData[] = Array.from(Array(columns), (_, i) => ({
  //     date: startDate.add(i, timeUnit as any),
  //     name: startDate.add(i, timeUnit as any).format(format),
  //     totalSales: 0,
  //     totalUnits: 0,
  //   }));
  //   orders.forEach(({ totalPrice, createdAt, items }: any) => {
  //     const index = results.findIndex(result => isSame(createdAt, result.date, timeUnit));
  //     const totalUnits = items.reduce((partialSum: any, item: any) => partialSum + item.quantity, 0);
  //     results[index].totalSales = results[index].totalSales + totalPrice;
  //     results[index].totalUnits = results[index].totalUnits + totalUnits;
  //   });
  //   return results;
  // }
}

export default OrdersService;
