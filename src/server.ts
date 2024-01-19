import App from './app';
import AuthRoute from './routes/auth.route';
import CategoriesRoute from './routes/categories.route';
import FilesRoute from './routes/files.route';
import IndexRoute from './routes/index.route';
import OrdersRoute from './routes/orders.route';
import ProductsRoute from './routes/products.route';
import StatisticsRoute from './routes/statistics.route';
import UsersRoute from './routes/users.route';
import VouchersRoute from './routes/vouchers.route';
import validateEnv from './utils/validateEnv';

validateEnv();

const app = new App([
  new IndexRoute(),
  new AuthRoute(),
  new UsersRoute(),
  /* Turn some route on after successfully migrated its service
  new FilesRoute(),
  new ProductsRoute(),
  new VouchersRoute(),
  new OrdersRoute(),
  new StatisticsRoute(),
  new CategoriesRoute(),
  */
]);

app.start();
