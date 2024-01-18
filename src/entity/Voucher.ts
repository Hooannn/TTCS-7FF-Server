import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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

  @Column({ nullable: true })
  expiredDate: Date;

  @Column()
  totalUsageLimit: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'bit' })
  isActive: number;
}

export enum VoucherDiscountType {
  Percent = 'Percent',
  FixedAmount = 'Fixed Amount',
}
