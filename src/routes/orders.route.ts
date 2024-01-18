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
    this.router.delete(`${this.path}`, adminMiddleware, this.ordersController.deleteOrder);
    this.router.post(`/checkout`, authMiddleware, checkoutValidator(), this.ordersController.checkoutThenCreateOrder);
    this.router.put(`/rating/:orderId`, authMiddleware, this.ordersController.ratingOrder);
    this.router.patch(`${this.path}`, adminMiddleware, this.ordersController.updateOrder);
  }
}

export default OrdersRoute;
