import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Tracks the history of data synchronization jobs from external providers.
 * Used by admin dashboard and debugging.
 */
@Entity('data_sync_logs')
export class DataSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  provider_name: string;

  @Column({ type: 'enum', enum: ['running', 'success', 'failed'], default: 'running' })
  status: 'running' | 'success' | 'failed';

  @Column({ type: 'int', default: 0 })
  records_synced: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;
}
