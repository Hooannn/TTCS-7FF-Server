import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'USER' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  userId: string;

  @Column({ unique: true })
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

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'bit' })
  isActive: number;
}

export enum UserRole {
  User = 'User',
  Staff = 'Staff',
  Admin = 'Admin',
}
