import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './Product';

@Entity({ name: 'PRODUCT_IMAGE' })
export class ProductImage {
  @PrimaryColumn()
  imageUrl: string;

  @ManyToOne(() => Product, product => product.images)
  @JoinColumn({ name: 'productId' })
  product: Product;
}
