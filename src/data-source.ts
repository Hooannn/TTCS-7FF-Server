import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, Order, OrderItem, CartItem, Category, Product, ProductImage, Voucher } from './entity';
import { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } from './config';
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: DB_HOST,
  port: parseInt(DB_PORT),
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  // Just turn synchronize on when need create tables or update tables when entity changed.
  // Then turn off when dev
  synchronize: false,
  logging: true,
  entities: [User, Order, OrderItem, CartItem, Category, Product, ProductImage, Voucher],
  migrations: [],
  subscribers: [],
  timezone: 'z',
});
