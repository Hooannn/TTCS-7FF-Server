import { errorStatus, successStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces';
import VouchersService from '@/services/vouchers.service';
import { NextFunction, Request, Response } from 'express';
class VouchersController {
  private vouchersService = new VouchersService();
  public getAllVouchers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, filter, sort } = req.query;
      const { total, vouchers } = await this.vouchersService.getAllVouchers({
        skip: parseInt(skip?.toString()),
        limit: parseInt(limit?.toString()),
        filter: filter?.toString(),
        sort: sort?.toString(),
      });
      res.status(200).json({ code: 200, success: true, data: vouchers, total, took: vouchers.length });
    } catch (error) {
      next(error);
    }
  };

  public addVoucher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, discountAmount, discountType, expiredDate, totalUsageLimit } = req.body;
      const voucher = await this.vouchersService.addVoucher({
        code: code.trim().toUpperCase(),
        discountAmount,
        discountType,
        expiredDate,
        totalUsageLimit,
      });
      res.status(201).json({ code: 201, success: true, data: voucher, message: successStatus.CREATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public deleteVoucher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      await this.vouchersService.deleteVoucher(id.toString());
      res.status(200).json({ code: 200, success: true, message: successStatus.DELETE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public updateVoucher = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      const { code, discountAmount, discountType, expiredDate, totalUsageLimit } = req.body;
      const updatedVoucher = await this.vouchersService.updateVoucher(id.toString(), {
        code: code.trim().toUpperCase(),
        discountAmount,
        discountType,
        expiredDate,
        totalUsageLimit,
      });
      res.status(200).json({ code: 200, success: true, data: updatedVoucher, message: successStatus.UPDATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public checkVoucherByCode = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.auth;
      const code = req.query.code;
      const voucher = await this.vouchersService.checkVoucherByCode(code.toString(), userId);
      res.status(200).json({ code: 200, success: true, data: voucher, message: successStatus.VOUCHER_FOUND });
    } catch (error) {
      next(error);
    }
  };
}

export default VouchersController;
