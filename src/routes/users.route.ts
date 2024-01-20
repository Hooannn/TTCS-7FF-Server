import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import UsersController from '@/controllers/users.controller';
import adminMiddleware from '@/middlewares/admin.middleware';
import authMiddleware from '@/middlewares/auth.middleware';
import staffMiddleware from '@/middlewares/staff.middleware';

class UsersRoute implements Routes {
  public path = '/users';
  public cartPath = '/cart';
  public router = Router();
  private usersController = new UsersController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}${this.cartPath}`, authMiddleware, this.usersController.getCartItems);
    this.router.patch(`${this.path}${this.cartPath}/add`, authMiddleware, this.usersController.addCartItem);
    this.router.patch(`${this.path}${this.cartPath}/remove`, authMiddleware, this.usersController.removeCartItem);
    this.router.post(`${this.path}${this.cartPath}/reset`, authMiddleware, this.usersController.resetCartItems);
    this.router.get(`${this.path}`, staffMiddleware, this.usersController.getAllUsers);
    this.router.post(`${this.path}`, staffMiddleware, this.usersController.addUser);
    this.router.delete(`${this.path}`, staffMiddleware, this.usersController.deleteUser);
    this.router.patch(`${this.path}`, staffMiddleware, this.usersController.updateUser);
    this.router.get(`/staffs`, adminMiddleware, this.usersController.getAllStaffs);
    this.router.post(`/staffs`, adminMiddleware, this.usersController.addStaff);
    this.router.delete(`/staffs`, adminMiddleware, this.usersController.deleteStaff);
    this.router.patch(`/staffs`, adminMiddleware, this.usersController.updateStaff);
    this.router.patch(`${this.path}/profile`, authMiddleware, this.usersController.updateProfile);
    this.router.patch(`${this.path}/change-password`, authMiddleware, this.usersController.changeProfilePassword);
  }
}

export default UsersRoute;
