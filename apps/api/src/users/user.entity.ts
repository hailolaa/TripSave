import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password_hash: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column('decimal', { precision: 5, scale: 1, default: 25.0 })
  vehicle_mpg: number;

  @Column('decimal', { precision: 5, scale: 3, nullable: true })
  default_gas_price: number | null;

  @Column({ type: 'enum', enum: ['miles', 'km'], default: 'miles' })
  preferred_distance_unit: string;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  location_lat: number | null;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  location_lng: number | null;

  @Column({ type: 'varchar', nullable: true })
  location_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  zip_code: string | null;

  @Column({ type: 'varchar', nullable: true })
  referral_source: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  @Column({
    type: 'enum',
    enum: ['none', 'trialing', 'active', 'canceled', 'past_due'],
    default: 'none'
  })
  subscription_status: string;

  @Column({ type: 'timestamp', nullable: true })
  trial_end_date: Date | null;

  @Column({ default: false })
  onboarding_completed: boolean;

  @Column({ type: 'varchar', nullable: true })
  google_id: string | null;

  @Column({ default: false })
  is_email_verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  verification_code: string | null;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
