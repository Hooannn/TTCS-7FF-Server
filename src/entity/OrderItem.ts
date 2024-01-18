import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { Product } from './Product';
import { Order } from './Order';

@Entity({ name: 'ORDER_ITEM' })
export class OrderItem {
  @PrimaryColumn({ length: 36 })
  orderId: string;

  @PrimaryColumn({ length: 36 })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: 1 })
  quantity: number;
}
