import { Inject, Injectable } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { DATABASE_POOL } from '../database/database.constants.js';

@Injectable()
export class OrganizationsRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  async consumeCredit(
    id: string,
    client?: PoolClient,
  ): Promise<number | undefined> {
    const db = client ?? this.pool;

    const result = await db.query<{ credits: number }>(
      `UPDATE organizations
      SET credits = credits - 1
      WHERE id = $1
        AND credits > 0
      RETURNING credits;`,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return row.credits;
  }
}
