import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import ProductsController from '@/controllers/products.controller';
import staffMiddleware from '@/middlewares/staff.middleware';
class ProductsRoute implements Routes {
  public path = '/products';
  public router = Router();
  private productsController = new ProductsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/statistics`, staffMiddleware, this.productsController.getAllProductsWithTotalSoldUnits);
    this.router.get(`${this.path}/:productId`, this.productsController.getProductById);
    this.router.get(`${this.path}/reset/daily`, this.productsController.resetProductsDailyData);
    this.router.get(`/search${this.path}`, this.productsController.searchProducts);
    this.router.get(`${this.path}`, this.productsController.getAllProducts);
    this.router.post(`${this.path}`, staffMiddleware, this.productsController.addProduct);
    this.router.delete(`${this.path}`, staffMiddleware, this.productsController.deleteProduct);
    this.router.patch(`${this.path}`, staffMiddleware, this.productsController.updateProduct);
  }
}

export default ProductsRoute;
