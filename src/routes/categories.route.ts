import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import adminMiddleware from '@/middlewares/admin.middleware';
import CategoriesController from '@/controllers/categories.controller';

class CategoriesRoute implements Routes {
  public path = '/categories';
  public router = Router();
  private categoriesController = new CategoriesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, this.categoriesController.getAllCategories);
    this.router.post(`${this.path}`, adminMiddleware, this.categoriesController.addCategory);
    this.router.delete(`${this.path}`, adminMiddleware, this.categoriesController.deleteCategory);
    this.router.patch(`${this.path}`, adminMiddleware, this.categoriesController.updateCategory);
  }
}

export default CategoriesRoute;
