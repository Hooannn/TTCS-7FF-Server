import { errorStatus, successStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import CategoriesService from '@/services/categories.service';
import ProductsService from '@/services/products.service';
import { NextFunction, Request, Response } from 'express';
class CategoriesController {
  private categoriesService = new CategoriesService();
  private productsService = new ProductsService();
  public getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { skip, limit, filter, sort } = req.query;
      const { total, categories } = await this.categoriesService.getAllCategories({
        skip: parseInt(skip?.toString()),
        limit: parseInt(limit?.toString()),
        filter: filter?.toString(),
        sort: sort?.toString(),
      });
      res.status(200).json({ code: 200, success: true, data: categories, total, took: categories.length });
    } catch (error) {
      next(error);
    }
  };

  public addCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;
      const category = await this.categoriesService.addCategory({ name, description });
      res.status(201).json({ code: 201, success: true, data: category, message: successStatus.CREATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      const product = await this.productsService.findOneProductByCategory(id.toString());
      if (product) throw new HttpException(400, errorStatus.CATEGORY_ALREADY_ATTACHED);
      await this.categoriesService.deleteCategory(id.toString());
      res.status(200).json({ code: 200, success: true, message: successStatus.DELETE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.query;
      const category = req.body;
      const updatedCategory = await this.categoriesService.updateCategory(id.toString(), category);
      res.status(200).json({ code: 200, success: true, data: updatedCategory, message: successStatus.UPDATE_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };
}

export default CategoriesController;
