import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('listeners')
export class Listener {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email: string | null;

  @Column({ type: 'varchar', length: 30, unique: true, nullable: true })
googleId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  facebookId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}