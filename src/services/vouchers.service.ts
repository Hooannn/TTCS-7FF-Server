import { errorStatus } from '@/config';
import { AppDataSource } from '@/data-source';
import { DataSource, FindManyOptions, Like, MoreThan, MoreThanOrEqual, Not, Raw } from 'typeorm';
import { Voucher, Order } from '@/entity';
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
      totalUsageLimit: MoreThan(0),
    });
    if (!voucher) throw new HttpException(400, errorStatus.VOUCHER_NOT_FOUND);
    if (voucher.expiredDate) {
      if (getNow().isAfter(voucher.expiredDate)) throw new HttpException(400, errorStatus.VOUCHER_EXPIRED);
    }
    if (this.orderRepository.existsBy({ customerId: userId, voucherId: voucher.voucherId }))
      throw new HttpException(400, errorStatus.VOUCHER_ALREADY_USED);
    return { ...voucher, _id: voucher.voucherId };
  }
}
export default VouchersService;
