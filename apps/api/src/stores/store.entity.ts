import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StoreChain } from './store-chain.entity';

// Re-export from shared location for backward compatibility
export { DataSource } from '../common/enums/data-source.enum';
import { DataSource } from '../common/enums/data-source.enum';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  chain_id: string;

  @ManyToOne(() => StoreChain)
  @JoinColumn({ name: 'chain_id' })
  chain: StoreChain;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 2, nullable: true })
  state: string;

  @Column({ length: 10, nullable: true })
  zip: string;

  @Column('decimal', { precision: 10, scale: 7 })
  lat: number;

  @Column('decimal', { precision: 10, scale: 7 })
  lng: number;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  external_id: string;

  @Column({ type: 'enum', enum: DataSource })
  source: DataSource;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_verified_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
