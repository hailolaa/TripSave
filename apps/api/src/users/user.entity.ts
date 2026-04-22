import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  name: string;

  @Column('decimal', { precision: 5, scale: 1, default: 25.0 })
  vehicle_mpg: number;

  @Column('decimal', { precision: 5, scale: 3, nullable: true })
  default_gas_price: number;

  @Column({ type: 'enum', enum: ['miles', 'km'], default: 'miles' })
  preferred_distance_unit: string;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  location_lat: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  location_lng: number;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
