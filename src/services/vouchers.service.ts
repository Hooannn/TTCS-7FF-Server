import { errorStatus } from '@/config';
import { AppDataSource } from '@/data-source';
import { DataSource, FindManyOptions, Like, MoreThan, MoreThanOrEqual, Not, Raw } from 'typeorm';
import { Voucher, Order, OrderStatus } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { getNow } from '@/utils/time';
import { parseCreatedAtFilter } from '@/utils/parseCreatedAtFilter';

class VouchersService {
  private voucherRepository = AppDataSource.getRepository(Voucher);
  private orderRepository = AppDataSource.getRepository(Order);

  public async getAllVouchers({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');

    parseCreatedAtFilter(parseFilter);

    if (parseFilter.code) parseFilter.code = Like(`%${parseFilter.code}%`);

    const total = await this.voucherRepository.count({ where: { ...parseFilter, isActive: 1 } });
    const findOptions: FindManyOptions<Voucher> = {
      where: { ...parseFilter, isActive: 1 },
      order: parseSort,
      skip,
      take: limit,
      select: ['voucherId', 'code', 'discountType', 'discountAmount', 'expiredDate', 'totalUsageLimit', 'createdAt', 'isActive'],
    };
    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;
    const vouchers = await this.voucherRepository.find(findOptions);
    return { total, vouchers: vouchers.map(v => ({ ...v, _id: v.voucherId })) };
  }

  public async getAllVouchersWithCurrentUsage({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const queryBuilder = this.voucherRepository
      .createQueryBuilder('voucher')
      .select([
        'voucher.voucherId as voucherId',
        'count(order.orderId) as currentUsage',
        'voucher.code as code',
        'voucher.discountType as discountType',
        'voucher.discountAmount as discountAmount',
        'voucher.expiredDate as expiredDate',
        'voucher.totalUsageLimit as totalUsageLimit',
        'voucher.createdAt as createdAt',
      ])
      .leftJoin('voucher.orders', 'order', 'order.status != :rejected', { rejected: OrderStatus.Rejected })
      .groupBy('voucher.voucherId');

    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');

    parseCreatedAtFilter(parseFilter);

    if (parseFilter.code) parseFilter.code = Like(`%${parseFilter.code}%`);

    const findOptions: FindManyOptions<Voucher> = {
      where: { ...parseFilter, isActive: 1 },
      order: parseSort,
      skip,
      take: limit,
    };

    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;

    queryBuilder.setFindOptions(findOptions);
    const total = await this.voucherRepository.count({ where: { ...parseFilter, isActive: 1 } });
    const vouchers = await queryBuilder.getRawMany();
    return { total, vouchers: vouchers.map(v => ({ ...v, _id: v.voucherId })) };
  }

  public async addVoucher(reqVoucher: Partial<Voucher>) {
    const { code, discountType, discountAmount, totalUsageLimit, expiredDate } = reqVoucher;
    const isVoucherExisted = await this.voucherRepository.findOneBy({ code, isActive: 1 });
    if (isVoucherExisted) throw new HttpException(409, errorStatus.VOUCHER_EXISTED);
    if (reqVoucher.discountAmount <= 0 || (reqVoucher.discountType === 'Percent' && reqVoucher.discountAmount > 100)) {
      throw new HttpException(400, errorStatus.INVALID_VOUCHER_AMOUNT);
    }
    const voucher = this.voucherRepository.create({
      code,
      discountType,
      discountAmount,
      totalUsageLimit,
      expiredDate: expiredDate ? new Date(expiredDate) : null,
    });
    await this.voucherRepository.save(voucher);
    return voucher;
  }

  public async deleteVoucher(voucherId: string) {
    const isUsed = await this.orderRepository.existsBy({ voucherId });
    if (isUsed) throw new HttpException(400, errorStatus.VOUCHER_IS_USED);
    return this.voucherRepository.update(voucherId, { isActive: 0 });
  }

  public async updateVoucher(voucherId: string, voucher: Partial<Voucher>) {
    const { code, discountType, discountAmount, expiredDate } = voucher;
    const duplicatedVoucher = await this.voucherRepository.existsBy({ code, isActive: 1, voucherId: Not(voucherId) });
    if (duplicatedVoucher) throw new HttpException(409, errorStatus.VOUCHER_EXISTED);
    if (discountAmount <= 0 || (discountType === 'Percent' && discountAmount > 100)) {
      throw new HttpException(400, errorStatus.INVALID_VOUCHER_AMOUNT);
    }
    return await this.voucherRepository.update(voucherId, { ...voucher, expiredDate: expiredDate ? new Date(expiredDate) : null });
  }

  public async checkVoucherByCode(code: string, userId: string) {
    const voucher = await this.voucherRepository.findOneBy({
      code: code.toUpperCase(),
    });
    if (!voucher) throw new HttpException(400, errorStatus.VOUCHER_NOT_FOUND);

    // count the number of orders that used this voucher and is not rejected
    const currentUsage = await this.orderRepository.countBy({ voucherId: voucher.voucherId, status: Not(OrderStatus.Rejected) });
    if (currentUsage >= voucher.totalUsageLimit) throw new HttpException(400, errorStatus.VOUCHER_EXHAUSTED);

    if (voucher.expiredDate) {
      if (getNow().isAfter(voucher.expiredDate)) throw new HttpException(400, errorStatus.VOUCHER_EXPIRED);
    }
    const isVoucherAlreadyUsed = await this.orderRepository.existsBy({
      customerId: userId,
      voucherId: voucher.voucherId,
      status: Not(OrderStatus.Rejected),
    });
    if (isVoucherAlreadyUsed) throw new HttpException(400, errorStatus.VOUCHER_ALREADY_USED);
    return { ...voucher, _id: voucher.voucherId };
  }

  public async checkVoucherById(voucherId: string, userId: string) {
    const voucher = await this.voucherRepository.findOneBy({
      voucherId,
    });
    if (!voucher) throw new HttpException(400, errorStatus.VOUCHER_NOT_FOUND);

    // count the number of orders that used this voucher and is not rejected
    const currentUsage = await this.orderRepository.countBy({ voucherId: voucher.voucherId, status: Not(OrderStatus.Rejected) });
    if (currentUsage >= voucher.totalUsageLimit) throw new HttpException(400, errorStatus.VOUCHER_EXHAUSTED);

    if (voucher.expiredDate) {
      if (getNow().isAfter(voucher.expiredDate)) throw new HttpException(400, errorStatus.VOUCHER_EXPIRED);
    }
    const isVoucherAlreadyUsed = await this.orderRepository.existsBy({
      customerId: userId,
      voucherId: voucher.voucherId,
      status: Not(OrderStatus.Rejected),
    });
    if (isVoucherAlreadyUsed) throw new HttpException(400, errorStatus.VOUCHER_ALREADY_USED);
    return { ...voucher, _id: voucher.voucherId };
  }
}
export default VouchersService;
