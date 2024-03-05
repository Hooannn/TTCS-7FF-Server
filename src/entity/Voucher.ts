import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Order } from './Order';

@Entity({ name: 'VOUCHER' })
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  voucherId: string;

  @Column()
  code: string;

  @Column({ type: 'enum', enum: ['Percent', 'Fixed Amount'] })
  discountType: VoucherDiscountType;

  @Column('decimal', { precision: 10, scale: 2 })
  discountAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  expiredDate: Date;

  @Column()
  totalUsageLimit: number;

  @CreateDateColumn({ precision: null, type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'bit', default: () => `b'1'` })
  isActive: number;

  @OneToMany(() => Order, order => order.voucher)
  orders: Order[];
}

export enum VoucherDiscountType {
  Percent = 'Percent',
  FixedAmount = 'Fixed Amount',
}
