import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Store } from '../stores/store.entity';
import { Product } from './product.entity';
import { DataSource } from '../stores/store.entity';

@Entity('store_products')
@Unique('uk_store_product', ['store_id', 'product_id'])
@Index('idx_product_price', ['product_id', 'price'])
export class StoreProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  store_id: string;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column()
  product_id: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column('decimal', { precision: 8, scale: 2 })
  price: number;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  sale_price: number;

  @Column('decimal', { precision: 8, scale: 4, nullable: true })
  unit_price: number;

  @Column({ type: 'boolean', default: true })
  in_stock: boolean;

  @Column({ type: 'enum', enum: DataSource })
  source: DataSource;

  @Column({ type: 'timestamp', nullable: true })
  last_verified_at: Date;

  @Column({ type: 'boolean', default: false })
  is_stale: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
