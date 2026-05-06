import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Store, DataSource } from '../stores/store.entity';

@Entity('gas_prices')
export class GasPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  store_id: string;

  @OneToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column('decimal', { precision: 5, scale: 3, nullable: true })
  regular_price: number;

  @Column('decimal', { precision: 5, scale: 3, nullable: true })
  midgrade_price: number;

  @Column('decimal', { precision: 5, scale: 3, nullable: true })
  premium_price: number;

  @Column('decimal', { precision: 5, scale: 3, nullable: true })
  diesel_price: number;

  @Column({ type: 'enum', enum: DataSource })
  source: DataSource;

  @Column({ type: 'timestamp', nullable: true })
  last_updated: Date;

  @Column({ type: 'boolean', default: false })
  is_stale: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
