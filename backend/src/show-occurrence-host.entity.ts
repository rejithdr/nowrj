import { Entity, PrimaryColumn, Index } from 'typeorm';

/** An RJ who hosted a particular show. */
@Entity('show_occurrence_hosts')
@Index('IDX_show_occurrence_hosts_rjId', ['rjId'])
export class ShowOccurrenceHost {
  @PrimaryColumn({ type: 'uuid' })
  occurrenceId: string;

  @PrimaryColumn({ type: 'uuid' })
  rjId: string;
}
