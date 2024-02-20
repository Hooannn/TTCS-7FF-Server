import { errorStatus } from '@/config';
import { AppDataSource } from '@/data-source';
import { DataSource, FindManyOptions, MoreThan, MoreThanOrEqual } from 'typeorm';
import { Voucher, Order } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { getNow } from '@/utils/time';

class VouchersService {
  private voucherRepository = AppDataSource.getRepository(Voucher);
  private orderRepository = AppDataSource.getRepository(Order);

  public async getAllVouchers({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.voucherRepository.count({where: {isActive: 1}});
    const findOptions: FindManyOptions<Voucher> = {
      where: parseFilter,
      order: parseSort,
      skip,
      take: limit,
      select: ['voucherId', 'code', 'discountType', 'discountAmount', 'expiredDate', 'totalUsageLimit','createdAt','isActive']
    };
    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;
    const vouchers = await this.voucherRepository.find(findOptions);
    return { total, vouchers };
  }

  public async addVoucher(reqVoucher: Partial<Voucher>) {
    const { code, discountType, discountAmount, totalUsageLimit} = reqVoucher;
    const isVoucherExisted = await this.voucherRepository.findOneBy({code, isActive: 1});
    if (isVoucherExisted) throw new HttpException(409, errorStatus.VOUCHER_EXISTED);
    if (reqVoucher.discountAmount <= 0 || (reqVoucher.discountType === 'Percent' && reqVoucher.discountAmount > 100)) {
      throw new HttpException(400, errorStatus.INVALID_VOUCHER_AMOUNT);
    }
    const voucher = this.voucherRepository.create({
      code,
      discountType,
      discountAmount,
      totalUsageLimit
    });
    await this.voucherRepository.save(voucher);
    return voucher;
  }

  public async deleteVoucher(voucherId: string) {
    return this.voucherRepository.update(voucherId, {isActive: 0});
  }

  public async updateVoucher(voucherId: string, voucher: Partial<Voucher>) {
    const { code, discountType, discountAmount} = voucher;
    const duplicatedVoucher = await this.voucherRepository.existsBy({code, isActive: 1})
    if (duplicatedVoucher) throw new HttpException(409, errorStatus.VOUCHER_EXISTED);
    if (voucher.discountAmount <= 0 || (voucher.discountType === 'Percent' && voucher.discountAmount > 100)) {
      throw new HttpException(400, errorStatus.INVALID_VOUCHER_AMOUNT);
    }
    return await this.voucherRepository.update(voucherId, voucher)
  }

  public async checkVoucherByCode(code: string, userId: string) {
    const voucher = await this.voucherRepository.findOneBy({
      code: code.toUpperCase(),
      totalUsageLimit: MoreThan(0),
    });
    if (!voucher) throw new HttpException(400, errorStatus.VOUCHER_NOT_FOUND);
    if (voucher.expiredDate) {
      if (getNow().isAfter(voucher.expiredDate)) throw new HttpException(400, errorStatus.VOUCHER_EXPIRED);}
    if (this.orderRepository.existsBy({customerId: userId, voucherId: voucher.voucherId})) throw new HttpException(400, errorStatus.VOUCHER_ALREADY_USED);
    return voucher;
  }
}
export default VouchersService;
