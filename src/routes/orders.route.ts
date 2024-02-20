import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import adminMiddleware from '@/middlewares/admin.middleware';
import OrdersController from '@/controllers/orders.controller';
import { checkoutValidator } from '@/validators';
import authMiddleware from '@/middlewares/auth.middleware';

class OrdersRoute implements Routes {
  public path = '/orders';
  public router = Router();
  private ordersController = new OrdersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, adminMiddleware, this.ordersController.getAllOrders);
    this.router.get(`${this.path}/:orderId`, authMiddleware, this.ordersController.getOrderById);
    this.router.get(`/my-orders/:customerId`, authMiddleware, this.ordersController.getOrdersByCustomerId);
    this.router.post(`/checkout`, authMiddleware, checkoutValidator(), this.ordersController.checkoutThenCreateOrder);
    this.router.patch(`${this.path}`, adminMiddleware, this.ordersController.updateOrderStatus);
  }
}

export default OrdersRoute;
