import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import CategoriesController from '@/controllers/categories.controller';
import staffMiddleware from '@/middlewares/staff.middleware';

class CategoriesRoute implements Routes {
  public path = '/categories';
  public router = Router();
  private categoriesController = new CategoriesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, this.categoriesController.getAllCategories);
    this.router.post(`${this.path}`, staffMiddleware, this.categoriesController.addCategory);
    this.router.delete(`${this.path}`, staffMiddleware, this.categoriesController.deleteCategory);
    this.router.patch(`${this.path}`, staffMiddleware, this.categoriesController.updateCategory);
  }
}

export default CategoriesRoute;
