import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ProductCategory {
  DAIRY = 'dairy',
  MEAT = 'meat',
  PRODUCE = 'produce',
  BAKERY = 'bakery',
  BEVERAGES = 'beverages',
  SNACKS = 'snacks',
  FROZEN = 'frozen',
  CANNED = 'canned',
  CONDIMENTS = 'condiments',
  CLEANING = 'cleaning',
  BABY = 'baby',
  MEDICINE = 'medicine',
  PERSONAL_CARE = 'personal_care',
  HOUSEHOLD = 'household',
  PET = 'pet',
  GAS = 'gas',
  OTHER = 'other'
}

@Entity('products')
@Index('idx_normalized_name', ['normalized_name'])
@Index('idx_category', ['category'])
@Index('idx_upc', ['upc'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  normalized_name: string | null;

  @Column({ type: 'enum', enum: ProductCategory })
  category: ProductCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  upc: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
