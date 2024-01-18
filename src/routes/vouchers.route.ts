import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import adminMiddleware from '@/middlewares/admin.middleware';
import VouchersController from '@/controllers/vouchers.controller';
import authMiddleware from '@/middlewares/auth.middleware';

class VouchersRoute implements Routes {
  public path = '/vouchers';
  public router = Router();
  private vouchersController = new VouchersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, adminMiddleware, this.vouchersController.getAllVouchers);
    this.router.get(`${this.path}/validate`, authMiddleware, this.vouchersController.checkVoucherByCode);
    this.router.post(`${this.path}`, adminMiddleware, this.vouchersController.addVoucher);
    this.router.delete(`${this.path}`, adminMiddleware, this.vouchersController.deleteVoucher);
    this.router.patch(`${this.path}`, adminMiddleware, this.vouchersController.updateVoucher);
  }
}

export default VouchersRoute;
