import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum StoreChainType {
  GROCERY = 'grocery',
  GAS = 'gas',
  PHARMACY = 'pharmacy',
  GENERAL = 'general',
  WAREHOUSE = 'warehouse'
}

@Entity('store_chains')
export class StoreChain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ type: 'enum', enum: StoreChainType })
  type: StoreChainType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ type: 'boolean', default: false })
  is_membership_required: boolean;

  @CreateDateColumn()
  created_at: Date;
}
