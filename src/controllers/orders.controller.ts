import { CLIENT_URL, errorStatus, successStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces';
import NodemailerService from '@/services/nodemailer.service';
import OrdersService from '@/services/orders.service';
import UsersService from '@/services/users.service';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { getNow } from '@/utils/time';
import { UserRole } from '@/entity';
class OrdersController {
  private ordersService = new OrdersService();
  private usersService = new UsersService();
  private nodemailerService = new NodemailerService();

  public getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, filter, sort } = req.query;
      const { total, orders } = await this.ordersService.getAllOrders({
        skip: parseInt(skip?.toString()),
        limit: parseInt(limit?.toString()),
        filter: filter?.toString(),
        sort: sort?.toString(),
      });
      res.status(200).json({ code: 200, success: true, data: orders, total, took: orders.length });
    } catch (error) {
      next(error);
    }
  };

  public getOrdersByCustomerId = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { customerId } = req.params;
      const { sort } = req.query;
      const { userId, role } = req.auth;
      const orders = await this.ordersService.getOrdersByCustomerId({
        customerId: customerId.toString(),
        userId,
        role,
        sort: sort?.toString(),
      });
      res.status(200).json({ code: 200, success: true, data: orders });
    } catch (error) {
      next(error);
    }
  };

  public getOrderById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { userId, role } = req.auth;
      const data = await this.ordersService.getOrderById({ orderId, userId, role });
      res.status(200).json({ code: 200, success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public updateOrderStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      const { userId, role } = req.auth;
      const { status, rejectionReason } = req.body;
      if (role === UserRole.User) throw new HttpException(403, errorStatus.NO_PERMISSIONS);
      const updatedOrder = await this.ordersService.updateOrderStatus(id.toString(), status, rejectionReason, userId);
      res.status(200).json({ code: 200, success: true, data: updatedOrder, message: successStatus.UPDATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public checkoutThenCreateOrder = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const OPEN_HOUR = 7;
      const CLOSE_HOUR = 22;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const now = getNow();
      const checkoutHour = now.hour();
      const checkoutMinute = now.minute();
      if (checkoutHour < OPEN_HOUR || checkoutHour > CLOSE_HOUR || (checkoutHour === CLOSE_HOUR && checkoutMinute > 0))
        throw new HttpException(400, errorStatus.INVALID_CHECKOUT_TIME);

      const { deliveryAddress, deliveryPhone, items, note, voucherId, name } = req.body;
      const { userId } = req.auth;
      const { locale } = req.query;

      const order = await this.ordersService.createOrder({
        customerId: userId as any,
        voucherId,
        deliveryAddress,
        deliveryPhone,
        items,
        note,
        name,
      });

      const { email: customerEmail, userId: customerId, firstName } = await this.usersService.findUserById(userId);
      await this.usersService.resetCartItems(customerId);
      const mailHref = `${CLIENT_URL}/profile/orders`;
      if (customerEmail) {
        this.nodemailerService.sendOrderConfirmationEmail(customerEmail, firstName, customerId, mailHref, locale.toString());
      }

      res.status(201).json({ code: 201, success: true, data: order, message: successStatus.CREATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };
}

export default OrdersController;
