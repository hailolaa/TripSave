import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Store } from '../stores/store.entity';

@Entity('favorites')
@Unique('uk_user_store', ['user_id', 'store_id'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  store_id: string;

  @ManyToOne(() => Store, store => store.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ length: 100, nullable: true })
  nickname: string;

  @CreateDateColumn()
  created_at: Date;
}
