/* eslint-disable @typescript-eslint/no-unused-vars */
import { errorStatus } from '@/config';
import { AppDataSource } from '@/data-source';
import { Order, OrderItem, OrderStatus, Product, UserRole, Voucher, VoucherDiscountType } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { isSame, getNow, getPreviousTimeframe, getStartOfTimeframe, getEndOfTimeframe } from '@/utils/time';
import type { Dayjs } from 'dayjs';
import UsersService from './users.service';
import dayjs from 'dayjs';

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

// interface ChartData {
//   date: Dayjs;
//   name: string;
//   totalSales: number;
//   totalUnits: number;
// }

interface FilterCriteria {
  customerId?: string;
  status?: OrderStatus;
  startTime?: Date;
  endTime?: Date;
}

class OrdersService {
  private orderRepository = AppDataSource.getRepository(Order);
  private orderItemRepository = AppDataSource.getRepository(OrderItem);
  private productRepository = AppDataSource.getRepository(Product); // TODO: Will be changed to product service
  private voucherRepository = AppDataSource.getRepository(Voucher); // TODO: Will be changed to voucher service
  private usersService = new UsersService();

  private DEFAULT_PAGINATION_SKIP = 0;
  private DEFAULT_PAGINATION_LIMIT = 8;
  private FIELDS_TO_SELECT_FOR_ORDERS = [
    'order',
    'item',
    'customer.email',
    'customer.firstName',
    'customer.lastName',
    'product.nameVi',
    'product.nameEn',
    'productImages.imageUrl',
    'voucher.code',
  ];

  public async getOrdersByCustomerId({ customerId, userId, role, sort }: { customerId: string; userId?: string; role?: UserRole; sort?: string }) {
    if (customerId.toString() !== userId.toString() && role === 'User') throw new HttpException(403, errorStatus.NO_PERMISSIONS);

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.customerId = :customerId', { customerId })
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .select(this.FIELDS_TO_SELECT_FOR_ORDERS);

    const VALID_SORTING_CRITERIA = ['createdAt', 'totalPrice', 'status'];
    if (VALID_SORTING_CRITERIA.includes(sort)) {
      queryBuilder.addOrderBy(`order.${sort}`, 'ASC');
    } else {
      queryBuilder.orderBy('order.createdAt', 'DESC');
    }

    return await queryBuilder.getMany();
  }

  public async getOrderById({ orderId, userId, role }: { orderId: string; userId?: string; role?: UserRole }) {
    const order = await this.getOrderByIdQueryBuilder(orderId).getOne();

    if (order == null) throw new HttpException(404, errorStatus.ORDER_NOT_FOUND);
    if (order?.customerId?.toString() !== userId.toString() && role === UserRole.User) throw new HttpException(403, errorStatus.NO_PERMISSIONS);
    return order;
  }

  public async getAllOrders({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter: FilterCriteria = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.images', 'productImages')
      .leftJoinAndSelect('order.voucher', 'voucher');

    const VALID_FILTER_CRITERIA = ['customerId', 'deliveryPhone', 'deliveryAddress', 'status', 'voucherId', 'staffId'];
    Object.entries(parseFilter).forEach(([criteria, value]) => {
      if (value !== undefined) {
        if (criteria === 'startTime' || criteria === 'endTime') {
          const comparator: string = criteria === 'startTime' ? '>=' : '<=';
          queryBuilder.andWhere(`order.createdAt ${comparator} :${criteria}`, {
            [criteria]: value,
          });
        } else if (criteria === 'customerEmail') {
          queryBuilder.andWhere('customer.email = :customerEmail', { customerEmail: value });
        } else if (VALID_FILTER_CRITERIA.includes(criteria)) {
          queryBuilder.andWhere(`order.${criteria} = :${criteria}`, { [criteria]: value });
        }
      }
    });

    const [orders, total] = await queryBuilder
      .select(this.FIELDS_TO_SELECT_FOR_ORDERS)
      .orderBy(`order.${Object.keys(parseSort)[0]}`, Object.values(parseSort)[0] as 'ASC' | 'DESC')
      .skip(skip || this.DEFAULT_PAGINATION_SKIP)
      .take(limit || this.DEFAULT_PAGINATION_LIMIT)
      .getManyAndCount();

    return { total, orders };
  }

  public async createOrder(order: Partial<Order>) {
    const user = await this.usersService.findUserById(order.customerId);
    if (!user) throw new HttpException(400, errorStatus.USER_NOT_FOUND);

    const { productWithPrice, totalPrice } = await this.fetchProductPrice(order.items, order.voucherId);

    const newOrder = this.orderRepository.create({
      customerId: order.customerId,
      deliveryPhone: order.deliveryPhone,
      deliveryAddress: order.deliveryAddress,
      totalPrice: totalPrice,
      note: order?.note || null,
      name: order.name,
      voucherId: order?.voucherId,
      status: OrderStatus.Pending,
    });

    await this.orderRepository.save(newOrder);
    await Promise.all(
      productWithPrice.map(async item =>
        this.orderItemRepository.insert({
          orderId: newOrder.orderId,
          ...item,
        }),
      ),
    );

    return newOrder;
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
    return await this.getOrderByIdQueryBuilder(orderId).getOne();
  }

  private async fetchProductPrice(items: { productId: string; quantity: number }[], voucherId?: string) {
    const getPricePromises = items.map(async item => {
      const product = await this.productRepository.findOneBy({ productId: item.productId });
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.currentPrice,
      };
    });

    const productWithPrice = await Promise.all(getPricePromises);
    const voucher = await this.voucherRepository.findOneBy({ voucherId: voucherId ?? '' });
    // TODO: Verify voucher again
    const voucherVerified = true;

    let totalPrice = productWithPrice.reduce((total, item) => (total += item.price * item.quantity), 0);
    if (voucher != null && voucherVerified) {
      if (voucher.discountType === VoucherDiscountType.Percent) {
        totalPrice = Math.ceil((totalPrice * (100 - voucher.discountAmount)) / 100 / 1000) * 1000;
      } else {
        totalPrice = Math.ceil((totalPrice - voucher.discountAmount) / 1000) * 1000;
      }
    }

    return { productWithPrice, totalPrice };
  }

  private getOrderByIdQueryBuilder(orderId: string) {
    return this.orderRepository
      .createQueryBuilder('order')
      .where('order.orderId = :orderId', { orderId })
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('order.voucher', 'voucher')
      .select(this.FIELDS_TO_SELECT_FOR_ORDERS);
  }

  public async getSummaryOrders(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();
    const currentCount = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startTime', { startTime: dayjs(startDate).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('order.createdAt <= :endTime', { endTime: dayjs(to).format('YYYY-MM-DD HH:mm:ss') })
      .getCount();

    const previousTimeStart = getStartOfTimeframe(getPreviousTimeframe(to, type).valueOf(), type).valueOf();
    const previousTimeEnd = getEndOfTimeframe(previousTimeStart, type).valueOf();
    const previousCount = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startTime', { startTime: dayjs(previousTimeStart).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('order.createdAt <= :endTime', { endTime: dayjs(previousTimeEnd).format('YYYY-MM-DD HH:mm:ss') })
      .getCount();

    return { currentCount, previousCount };
  }

  public async getSummaryRevenues(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();
    const currentOrders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startTime', { startTime: dayjs(startDate).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('order.createdAt <= :endTime', { endTime: dayjs(to).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('order.status = :status', { status: 'Done' })
      .getMany();

    const previousTimeStart = getStartOfTimeframe(getPreviousTimeframe(to, type).valueOf(), type).valueOf();
    const previousTimeEnd = getEndOfTimeframe(previousTimeStart, type).valueOf();
    const previousOrders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startTime', { startTime: dayjs(previousTimeStart).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('order.createdAt <= :endTime', { endTime: dayjs(previousTimeEnd).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('order.status = :status', { status: 'Done' })
      .getMany();

    const currentCount = currentOrders.reduce((partialSum, order) => partialSum + Number(order.totalPrice), 0);
    const previousCount = previousOrders.reduce((partialSum, order) => partialSum + Number(order.totalPrice), 0);
    return { currentCount, previousCount };
  }

  // public async getRevenuesChart(type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  //   const startDate = getStartOfTimeframe(getNow().valueOf(), type);
  //   const currentOrders = await this.Order.find({
  //     createdAt: { $gte: startDate.valueOf(), $lte: getNow().valueOf() },
  //     status: 'Done',
  //   });
  //   const { columns, timeUnit, format } = this.prepareCreateChartParams(type, startDate);
  //   return await this.createRevenuesChart({ orders: currentOrders, startDate, columns, timeUnit, format });
  // }

  // private prepareCreateChartParams(type: 'daily' | 'weekly' | 'monthly' | 'yearly', startDate: Dayjs) {
  //   switch (type) {
  //     case 'daily':
  //       return {
  //         columns: 24,
  //         timeUnit: 'hour',
  //         format: 'hh:mm',
  //       };
  //     case 'weekly':
  //       return {
  //         columns: 7,
  //         timeUnit: 'day',
  //         format: 'dddd DD-MM',
  //       };
  //     case 'monthly':
  //       return {
  //         columns: startDate.daysInMonth(),
  //         timeUnit: 'day',
  //         format: 'dddd DD-MM',
  //       };
  //     case 'yearly':
  //       return {
  //         columns: 12,
  //         timeUnit: 'month',
  //         format: 'MMMM',
  //       };
  //   }
  // }

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
