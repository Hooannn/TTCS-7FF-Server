import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import StatisticsController from '@/controllers/statistics.controller';
import staffMiddleware from '@/middlewares/staff.middleware';

class StatisticsRoute implements Routes {
  public path = '/statistics';
  public router = Router();
  private statisticsController = new StatisticsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, staffMiddleware, this.statisticsController.getStatistics);
    this.router.get(`${this.path}/popular-products`, staffMiddleware, this.statisticsController.getPopularProducts);
    this.router.get(`${this.path}/charts/revenues`, staffMiddleware, this.statisticsController.getRevenuesChart);
    this.router.get(`${this.path}/popular-users`, staffMiddleware, this.statisticsController.getPopularUsers);
  }
}

export default StatisticsRoute;
