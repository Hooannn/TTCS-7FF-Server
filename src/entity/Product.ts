import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm';
import { Category } from './Category';
import { ProductImage } from './ProductImage';

@Entity({ name: 'PRODUCT' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  productId: string;

  @Column()
  nameVi: string;

  @Column()
  nameEn: string;

  @Column({ type: 'text' })
  descriptionVi: string;

  @Column({ type: 'text' })
  descriptionEn: string;

  @Column('decimal', { precision: 10, scale: 2 })
  currentPrice: number;

  @Column({ type: 'bit' })
  isAvailable: number;

  @CreateDateColumn({ precision: null, type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'bit', default: () => `b'1'` })
  isActive: number;

  @Column({ length: 36 })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(() => ProductImage, productImage => productImage.product)
  images: ProductImage[];
}
