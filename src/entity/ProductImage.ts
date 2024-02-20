import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { Product } from './Product';

@Entity({ name: 'PRODUCT_IMAGE' })
export class ProductImage {
  @PrimaryColumn()
  imageUrl: string;

  @Column()
  productId: string;
  
  @ManyToOne(() => Product, product => product.images)
  @JoinColumn({ name: 'productId' })
  product: Product;
}
