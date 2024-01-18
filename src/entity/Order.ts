import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Voucher } from './Voucher';

@Entity({ name: 'ORDER' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  orderId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ nullable: true, type: 'text' })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text' })
  deliveryAddress: string;

  @Column({ length: 20 })
  deliveryPhone: string;

  @Column({ nullable: true, type: 'text' })
  rejectionReason: string;

  @Column({ type: 'enum', enum: ['Pending', 'Processing', 'Rejected', 'Done'] })
  status: OrderStatus;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ length: 36 })
  customerId: string;

  @Column({ length: 36, nullable: true })
  voucherId: string;

  @Column({ length: 36, nullable: true })
  staffId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @ManyToOne(() => Voucher)
  @JoinColumn({ name: 'voucherId' })
  voucher: Voucher;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'staffId' })
  staff: User;
}

export enum OrderStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Rejected = 'Rejected',
  Done = 'Done',
}
