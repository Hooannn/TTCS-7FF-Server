import { errorStatus } from '@/config';
import Voucher, { IVoucher } from '@/models/Voucher';
import { HttpException } from '@/exceptions/HttpException';
import { getNow } from '@/utils/time';

class VouchersService {
  private Voucher = Voucher;

  public async getAllVouchers({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.Voucher.countDocuments(parseFilter).sort(parseSort);
    const vouchers = await this.Voucher.find(parseFilter, null, { limit, skip }).sort(parseSort);
    return { total, vouchers };
  }

  public async addVoucher(reqVoucher: Partial<IVoucher>) {
    const isVoucherExisted = await this.Voucher.findOne({ code: reqVoucher.code });
    if (isVoucherExisted) throw new HttpException(409, errorStatus.VOUCHER_EXISTED);

    if (reqVoucher.discountAmount <= 0 || (reqVoucher.discountType === 'percent' && reqVoucher.discountAmount > 100)) {
      throw new HttpException(400, errorStatus.INVALID_VOUCHER_AMOUNT);
    }

    const voucher = new this.Voucher(reqVoucher);
    await voucher.save();
    return voucher;
  }

  public async deleteVoucher(voucherId: string) {
    return this.Voucher.findByIdAndDelete(voucherId);
  }

  public async updateVoucher(voucherId: string, voucher: Partial<IVoucher>) {
    const duplicatedVoucher = await this.Voucher.findOne({ code: voucher.code, _id: { $ne: voucherId } });
    if (duplicatedVoucher) throw new HttpException(409, errorStatus.VOUCHER_EXISTED);

    if (voucher.discountAmount <= 0 || (voucher.discountType === 'percent' && voucher.discountAmount > 100)) {
      throw new HttpException(400, errorStatus.INVALID_VOUCHER_AMOUNT);
    }

    return await this.Voucher.findOneAndUpdate({ _id: voucherId }, voucher, { returnOriginal: false });
  }

  public async checkVoucherByCode(code: string, userId: string) {
    const voucher = await this.Voucher.findOne({
      code: code.toUpperCase(),
      totalUsageLimit: { $gt: 0 },
      usersClaimed: { $nin: [userId] },
      expiredDate: { $gte: getNow().valueOf() },
    });
    if (!voucher) throw new HttpException(400, errorStatus.VOUCHER_NOT_FOUND);
    return voucher;
  }
}
export default VouchersService;
