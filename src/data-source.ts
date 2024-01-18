import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, Order, OrderItem, CartItem, Category, Product, ProductImage, Voucher } from './entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'hoandaica123',
  database: '7ff',
  synchronize: true,
  logging: false,
  entities: [User, Order, OrderItem, CartItem, Category, Product, ProductImage, Voucher],
  migrations: [],
  subscribers: [],
});
