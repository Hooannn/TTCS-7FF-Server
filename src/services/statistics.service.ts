import OrdersService from './orders.service';
import ProductsService from './products.service';
import UsersService from './users.service';
class StatisticsService {
  private productsService = new ProductsService();
  private usersService = new UsersService();
  private ordersService = new OrdersService();
  public async getStatistics(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const [users, orders, revenues] = await Promise.all([
      await this.usersService.getSummaryUsers(to, type),
      await this.ordersService.getSummaryOrders(to, type),
      await this.ordersService.getSummaryRevenues(to, type),
    ]);
    return { users, orders, revenues };
  }

  public async getPopularProducts(type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    return await this.productsService.getPopularProducts(type);
  }

  public async getPopularUsers(type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const [newestUsers, usersWithHighestTotalOrderValue] = await Promise.all([
      await this.usersService.getNewestUsers(type),
      await this.usersService.getUsersWithHighestTotalOrderValue(type),
    ]);

    return { newestUsers, usersWithHighestTotalOrderValue };
  }

  public async getRevenuesChart(type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    return this.ordersService.getRevenuesChart(type);
  }
}

export default StatisticsService;
