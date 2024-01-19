import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'CATEGORY' })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  categoryId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  icon: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'bit', default: () => `b'1'` })
  isActive: number;
}
