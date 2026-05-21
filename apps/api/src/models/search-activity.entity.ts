import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn } from 'typeorm';

/**
 * Tracks which ZIP+query combos are actively being searched by users.
 * The daily cron job uses this to decide which ZIPs and items to refresh,
 * so we never waste Oxylabs credits on inactive locations.
 */
@Entity('search_activity')
@Index(['zip', 'query'], { unique: true })
export class SearchActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  zip: string;

  @Column({ type: 'varchar', length: 100 })
  query: string;

  @UpdateDateColumn()
  searched_at: Date;
}
