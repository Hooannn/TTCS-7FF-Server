import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import UsersController from '@/controllers/users.controller';
import adminMiddleware from '@/middlewares/admin.middleware';
import authMiddleware from '@/middlewares/auth.middleware';

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
    this.router.get(`${this.path}`, adminMiddleware, this.usersController.getAllUsers);
    this.router.post(`${this.path}`, adminMiddleware, this.usersController.addUser);
    this.router.delete(`${this.path}`, adminMiddleware, this.usersController.deleteUser);
    this.router.patch(`${this.path}/profile`, authMiddleware, this.usersController.updateProfile);
    this.router.patch(`${this.path}/change-password`, authMiddleware, this.usersController.changeProfilePassword);
    this.router.patch(`${this.path}`, adminMiddleware, this.usersController.updateUser);
  }
}

export default UsersRoute;
