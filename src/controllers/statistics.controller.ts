import { errorStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import StatisticsService from '@/services/statistics.service';
import { NextFunction, Request, Response } from 'express';
class StatisticsController {
  private statisticsService = new StatisticsService();
  public getStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, to } = req.query;
      if (!type || !to) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const results = await this.statisticsService.getStatistics(
        parseInt(to.toString()),
        type.toString() as 'daily' | 'weekly' | 'monthly' | 'yearly',
      );
      res.status(200).json({ code: 200, success: true, data: results });
    } catch (error) {
      next(error);
    }
  };

  public getPopularProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      if (!type) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const results = await this.statisticsService.getPopularProducts(type.toString() as 'daily' | 'weekly' | 'monthly' | 'yearly');
      res.status(200).json({ code: 200, success: true, data: results });
    } catch (error) {
      next(error);
    }
  };

  public getPopularUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      if (!type) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const results = await this.statisticsService.getPopularUsers(type.toString() as 'daily' | 'weekly' | 'monthly' | 'yearly');
      res.status(200).json({ code: 200, success: true, data: results });
    } catch (error) {
      next(error);
    }
  };

  public getRevenuesChart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      if (!type) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const results = await this.statisticsService.getRevenuesChart(type.toString() as 'daily' | 'weekly' | 'monthly' | 'yearly');
      res.status(200).json({ code: 200, success: true, data: results });
    } catch (error) {
      next(error);
    }
  };
}

export default StatisticsController;
