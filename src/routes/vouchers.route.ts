import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import VouchersController from '@/controllers/vouchers.controller';
import authMiddleware from '@/middlewares/auth.middleware';
import staffMiddleware from '@/middlewares/staff.middleware';

class VouchersRoute implements Routes {
  public path = '/vouchers';
  public router = Router();
  private vouchersController = new VouchersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, staffMiddleware, this.vouchersController.getAllVouchers);
    this.router.get(`${this.path}/validate`, authMiddleware, this.vouchersController.checkVoucherByCode);
    this.router.post(`${this.path}`, staffMiddleware, this.vouchersController.addVoucher);
    this.router.delete(`${this.path}`, staffMiddleware, this.vouchersController.deleteVoucher);
    this.router.patch(`${this.path}`, staffMiddleware, this.vouchersController.updateVoucher);
  }
}

export default VouchersRoute;
