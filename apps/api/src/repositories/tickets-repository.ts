import type { Pool, PoolClient } from 'pg';
import type { PostgresRuntime } from '../types/runtime';
import type { Ticket } from '../types/domain';

type TicketRow = {
  id: string;
  ticket_type_id: string | null;
  slug: string;
  title: string;
  description: string;
  event_at: string | null;
  price: number;
  currency: string;
  local_image_path: string;
  total_quantity: number;
  sold_quantity: number;
  active_holds: number | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RawTicketRow = {
  id: string;
  ticket_type_id: string | null;
  slug: string;
  title: string;
  description: string;
  event_at: string | null;
  price: number;
  currency: string;
  total_quantity: number;
  sold_quantity: number;
  is_active: boolean;
  image_asset_id: string;
  created_at: string;
  updated_at: string;
};

type Queryable = Pool | PoolClient;

function mapTicketRow(row: TicketRow): Ticket {
  const activeHolds = Number(row.active_holds || 0);

  return {
    id: row.id,
    ticketTypeId: row.ticket_type_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    eventAt: row.event_at,
    price: row.price,
    currency: row.currency,
    imageUrl: row.local_image_path,
    totalQuantity: row.total_quantity,
    soldQuantity: row.sold_quantity,
    activeHolds,
    availableQuantity: row.total_quantity - row.sold_quantity - activeHolds,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTicketsRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async findAll(): Promise<Ticket[]> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<TicketRow>(
        `
          select
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path,
            coalesce(
              count(*) filter (where th.status = 'active' and th.expires_at > now()),
              0
            ) as active_holds
          from ticket_events te
          inner join image_assets ia on ia.id = te.image_asset_id
          left join ticket_holds th on th.ticket_id = te.id
          group by
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path
          order by te.event_at asc nulls last, te.created_at asc
        `
      );

      return result.rows.map(mapTicketRow);
    },

    async findById(ticketId: string): Promise<Ticket | null> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query<TicketRow>(
        `
          select
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path,
            coalesce(
              count(*) filter (where th.status = 'active' and th.expires_at > now()),
              0
            ) as active_holds
          from ticket_events te
          inner join image_assets ia on ia.id = te.image_asset_id
          left join ticket_holds th on th.ticket_id = te.id
          where te.id = $1
          group by
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path
        `,
        [ticketId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapTicketRow(result.rows[0]);
    },

    async findRawById(ticketId: string, client: Queryable = postgresRuntime.pool): Promise<RawTicketRow | null> {
      // noinspection SqlResolve
      const result = await client.query<RawTicketRow>(
        `
          select
            id,
            ticket_type_id,
            slug,
            title,
            description,
            event_at,
            price,
            currency,
            total_quantity,
            sold_quantity,
            is_active,
            image_asset_id,
            created_at,
            updated_at
          from ticket_events
          where id = $1
        `,
        [ticketId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    },

    async findRawByIdForUpdate(ticketId: string, client: Queryable): Promise<RawTicketRow | null> {
      // noinspection SqlResolve
      const result = await client.query<RawTicketRow>(
        `
          SELECT *
          FROM ticket_events
          WHERE id = $1
          FOR UPDATE
        `,
        [ticketId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    },

    async incrementSoldQuantity(
      ticketId: string,
      quantity: number,
      client: Queryable = postgresRuntime.pool
    ): Promise<void> {
      // noinspection SqlResolve
      await client.query(
        `
          update ticket_events
          set
            sold_quantity = sold_quantity + $2,
            updated_at = now()
          where id = $1
        `,
        [ticketId, quantity]
      );
    },

    async getGroupedPreviews(): Promise<Array<{
      periodStartYear: number;
      events: Ticket[];
      totalCount: number;
    }>> {
      // noinspection SqlResolve
      const result = await postgresRuntime.pool.query(`
        WITH grouped_events AS (
          SELECT
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path,
            coalesce(
              count(*) filter (where th.status = 'active' and th.expires_at > now()),
              0
            ) as active_holds,
            floor(extract(year from te.event_at) / 5) * 5 as period_start_year,
            row_number() OVER (PARTITION BY floor(extract(year from te.event_at) / 5) ORDER BY te.event_at ASC) as rn,
            count(*) OVER (PARTITION BY floor(extract(year from te.event_at) / 5)) as total_per_group
          FROM ticket_events te
          INNER JOIN image_assets ia ON ia.id = te.image_asset_id
          LEFT JOIN ticket_holds th ON th.ticket_id = te.id
          WHERE te.is_active = true 
            AND te.event_at > now() 
            AND te.event_at IS NOT NULL
          GROUP BY
            te.id, te.ticket_type_id, te.slug, te.title, te.description, te.event_at,
            te.price, te.currency, te.total_quantity, te.sold_quantity, te.is_active,
            te.created_at, te.updated_at, ia.local_image_path,
            floor(extract(year from te.event_at) / 5)
          ORDER BY period_start_year ASC, te.event_at ASC
        )
        SELECT * FROM grouped_events
      `);

      const rowsByPeriod: { [key: number]: { events: TicketRow[], total: number } } = {};
      for (const row of result.rows) {
        const period = row.period_start_year;
        if (!rowsByPeriod[period]) {
          rowsByPeriod[period] = { events: [], total: Number(row.total_per_group) };
        }
        if (row.rn <= 5) {
          rowsByPeriod[period].events.push(row);
        }
      }

      const groups: Array<{
        periodStartYear: number;
        events: Ticket[];
        totalCount: number;
      }> = [];
      for (const [period, data] of Object.entries(rowsByPeriod)) {
        const periodNum = Number(period);
        groups.push({
          periodStartYear: periodNum,
          events: data.events.map(mapTicketRow),
          totalCount: data.total,
        });
      }

      return groups;
    },

    async findByDateRange(
      startDate: Date,
      endDate: Date,
      limit: number = 20,
      offset: number = 0
    ): Promise<{ items: Ticket[]; total: number }> {
      // First, get total count
      // noinspection SqlResolve
      const countResult = await postgresRuntime.pool.query(
        `
          SELECT COUNT(*) as total
          FROM ticket_events te
          INNER JOIN image_assets ia ON ia.id = te.image_asset_id
          LEFT JOIN ticket_holds th ON th.ticket_id = te.id
          WHERE te.is_active = true 
            AND te.event_at >= $1 
            AND te.event_at < $2
            AND te.event_at IS NOT NULL
        `,
        [startDate, endDate]
      );
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Then, get paginated items
      // noinspection SqlResolve
      const itemsResult = await postgresRuntime.pool.query<TicketRow>(
        `
          select
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path,
            coalesce(
              count(*) filter (where th.status = 'active' and th.expires_at > now()),
              0
            ) as active_holds
          from ticket_events te
          inner join image_assets ia on ia.id = te.image_asset_id
          left join ticket_holds th on th.ticket_id = te.id
          where te.is_active = true 
            AND te.event_at >= $1 
            AND te.event_at < $2
            AND te.event_at IS NOT NULL
          group by
            te.id,
            te.ticket_type_id,
            te.slug,
            te.title,
            te.description,
            te.event_at,
            te.price,
            te.currency,
            te.total_quantity,
            te.sold_quantity,
            te.is_active,
            te.created_at,
            te.updated_at,
            ia.local_image_path
          order by te.event_at asc
          limit $3 offset $4
        `,
        [startDate, endDate, limit, offset]
      );

      const items = itemsResult.rows.map(mapTicketRow);

      return { items, total };
    },
  };
}
