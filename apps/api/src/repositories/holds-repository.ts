import type { Pool, PoolClient } from 'pg';
import type { Hold } from '../types/domain';
import type { PostgresRuntime } from '../types/runtime';

type HoldRow = {
  id: string;
  ticket_id: string;
  session_id: string;
  status: Hold['status'];
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type Queryable = Pool | PoolClient;

function mapHoldRow(row: HoldRow): Hold {
  const expiresAtMs = new Date(row.expires_at).getTime();
  const ttlMs = Math.max(expiresAtMs - Date.now(), 0);

  return {
    id: row.id,
    ticketId: row.ticket_id,
    sessionId: row.session_id,
    status: row.status,
    expiresAt: row.expires_at,
    ttlSeconds: Math.ceil(ttlMs / 1000),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createHoldsRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async createHold(params: {
      ticketId: string;
      sessionId: string;
      expiresAt: string;
    }, client: Queryable = postgresRuntime.pool): Promise<Hold> {
      // noinspection SqlResolve
      const result = await client.query<HoldRow>(
        `
          insert into ticket_holds (
            ticket_id,
            session_id,
            status,
            expires_at
          )
          values ($1, $2, 'active', $3)
          returning
            id,
            ticket_id,
            session_id,
            status,
            expires_at,
            created_at,
            updated_at
        `,
        [params.ticketId, params.sessionId, params.expiresAt]
      );

      return mapHoldRow(result.rows[0]);
    },

    async findById(holdId: string): Promise<Hold | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<HoldRow>(
        `
          select
            id,
            ticket_id,
            session_id,
            status,
            expires_at,
            created_at,
            updated_at
          from ticket_holds
          where id = $1
        `,
        [holdId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapHoldRow(result.rows[0]);
    },

    async expireHold(holdId: string): Promise<Hold | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<HoldRow>(
        `
          update ticket_holds
          set
            status = 'expired',
            updated_at = now()
          where id = $1
            and status = 'active'
          returning
            id,
            ticket_id,
            session_id,
            status,
            expires_at,
            created_at,
            updated_at
        `,
        [holdId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapHoldRow(result.rows[0]);
    },

    async cancelHold(holdId: string): Promise<Hold | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<HoldRow>(
        `
          update ticket_holds
          set
            status = 'cancelled',
            updated_at = now()
          where id = $1
            and status = 'active'
          returning
            id,
            ticket_id,
            session_id,
            status,
            expires_at,
            created_at,
            updated_at
        `,
        [holdId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapHoldRow(result.rows[0]);
    },

    async confirmHold(
      holdId: string,
      client: Queryable = postgresRuntime.pool
    ): Promise<Hold | null> {
      // noinspection SqlResolve
      const result = await client.query<HoldRow>(
        `
          update ticket_holds
          set
            status = 'confirmed',
            updated_at = now()
          where id = $1
            and status = 'active'
          returning
            id,
            ticket_id,
            session_id,
            status,
            expires_at,
            created_at,
            updated_at
        `,
        [holdId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapHoldRow(result.rows[0]);
    },

    async countActiveHoldsByTicketId(ticketId: string, client: Queryable = postgresRuntime.pool): Promise<number> {
      // noinspection SqlResolve
      const result = await client.query<{ count: number }>(
        `
          select count(*)::int as count
          from ticket_holds
          where ticket_id = $1
            and status = 'active'
            and expires_at > now()
        `,
        [ticketId]
      );

      return Number(result.rows[0].count);
    },

    async expireActiveHoldsForTicket(ticketId: string, client: Queryable = postgresRuntime.pool): Promise<void> {
      // noinspection SqlResolve
      await client.query(
        `
          update ticket_holds
          set
            status = 'expired',
            updated_at = now()
          where ticket_id = $1
            and status = 'active'
            and expires_at <= now()
        `,
        [ticketId]
      );
    },

    async findBySessionId(sessionId: string): Promise<Hold[]> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<HoldRow>(
        `
          select
            id,
            ticket_id,
            session_id,
            status,
            expires_at,
            created_at,
            updated_at
          from ticket_holds
          where session_id = $1
            and status = 'active'
            and expires_at > now()
          order by created_at desc
        `,
        [sessionId]
      );

      return result.rows.map(mapHoldRow);
    },
  };
}