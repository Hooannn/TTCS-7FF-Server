import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import OrdersController from '@/controllers/orders.controller';
import authMiddleware from '@/middlewares/auth.middleware';
import staffMiddleware from '@/middlewares/staff.middleware';

class OrdersRoute implements Routes {
  public path = '/orders';
  public router = Router();
  private ordersController = new OrdersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, staffMiddleware, this.ordersController.getAllOrders);
    this.router.get(`${this.path}/:orderId`, authMiddleware, this.ordersController.getOrderById);
    this.router.get(`/my-orders/:customerId`, authMiddleware, this.ordersController.getOrdersByCustomerId);
    this.router.post(`/checkout`, authMiddleware, /*checkoutValidator(),*/ this.ordersController.checkoutThenCreateOrder);
    this.router.patch(`${this.path}`, staffMiddleware, this.ordersController.updateOrderStatus);
  }
}

export default OrdersRoute;
