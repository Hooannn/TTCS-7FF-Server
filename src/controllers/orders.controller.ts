import { CLIENT_URL, errorStatus, successStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import { RequestWithUser } from '@/interfaces';
import NodemailerService from '@/services/nodemailer.service';
import OrdersService from '@/services/orders.service';
import UsersService from '@/services/users.service';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { getNow } from '@/utils/time';
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

  public deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      await this.ordersService.deleteOrder(id.toString());
      res.status(200).json({ code: 200, success: true, message: successStatus.DELETE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public updateOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      const order = req.body;
      const updatedOrder = await this.ordersService.updateOrder(id.toString(), order);
      res.status(200).json({ code: 200, success: true, data: updatedOrder, message: successStatus.UPDATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public ratingOrder = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { value } = req.body;
      const { userId } = req.auth;
      if (!parseInt(value)) throw new HttpException(400, errorStatus.MISSING_RATING_VALUE);
      const updatedOrder = await this.ordersService.ratingOrder(orderId.toString(), userId, parseInt(value));
      res.status(200).json({ code: 200, success: true, data: updatedOrder, message: successStatus.RATING_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public checkoutThenCreateOrder = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const OPEN_HOUR = 7;
      const CLOSE_HOUR = 21;
      const CLOSE_MINUTE = 30;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { isDelivery, deliveryAddress, deliveryPhone, items, note, voucher } = req.body;
      const now = getNow();
      const checkoutHour = now.hour();
      const checkoutMinute = now.minute();
      const validateDeliveryCondition = () => {
        if (checkoutHour < OPEN_HOUR || checkoutHour > CLOSE_HOUR || (checkoutHour === CLOSE_HOUR && checkoutMinute > 0))
          throw new HttpException(400, errorStatus.INVALID_CHECKOUT_TIME);
      };
      const validateCondition = () => {
        if (checkoutHour < OPEN_HOUR || checkoutHour > CLOSE_HOUR || (checkoutHour === CLOSE_HOUR && checkoutMinute > CLOSE_MINUTE))
          throw new HttpException(400, errorStatus.INVALID_CHECKOUT_TIME);
      };

      if (isDelivery) {
        validateDeliveryCondition();
      } else {
        validateCondition();
      }

      const { userId } = req.auth;
      const { locale } = req.query;
      const order = await this.ordersService.createOrder({
        customerId: userId as any,
        voucher,
        isDelivery,
        deliveryAddress,
        deliveryPhone,
        items,
        note,
      });
      const { email: customerEmail, _id, firstName } = await this.usersService.getUserById(userId);
      await this.usersService.resetCartItems(_id.toString());
      const mailHref = `${CLIENT_URL}/profile/orders`;
      if (customerEmail)
        this.nodemailerService.sendOrderConfirmationEmail(customerEmail, firstName, order._id.toString(), mailHref, locale.toString());
      res.status(201).json({ code: 201, success: true, data: order, message: successStatus.CREATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };
}

export default OrdersController;
