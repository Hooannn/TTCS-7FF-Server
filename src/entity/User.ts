import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'USER' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  userId: string;

  @Column({ unique: true, type: 'varchar', length: 191 })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true, length: 20 })
  phoneNumber: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'enum', enum: ['User', 'Staff', 'Admin'] })
  role: UserRole;

  @CreateDateColumn({ precision: null, type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'bit', default: () => `b'1'` })
  isActive: number;
}

export enum UserRole {
  User = 'User',
  Staff = 'Staff',
  Admin = 'Admin',
}
