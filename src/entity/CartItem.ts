import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { Product } from './Product';
import { User } from './User';

@Entity({ name: 'CART_ITEM' })
export class CartItem {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn({ length: 36 })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: ['Active', 'Removed', 'Purchased'] })
  status: CartItemStatus;

  @Column({ default: 1 })
  quantity: number;
}

export enum CartItemStatus {
  Active = 'Active',
  Removed = 'Removed',
  Purchased = 'Purchased',
}
