// noinspection SqlResolve,SqlNoDataSourceInspection,SqlRedundantOrderingDirection
import type { PostgresRuntime } from '../types/runtime';

export interface OverviewStats {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  ticketsSold: number;
}

export interface RevenueByDay {
  date: string;
  revenue: number;
}

export interface TicketStats {
  ticketId: string;
  title: string;
  imageUrl: string;
  eventAt: string | null;
  soldQuantity: number;
  totalQuantity: number;
  revenue: number;
  sellThroughPercent: number;
}

export interface TicketTypeFilter {
  id: string;
  title: string;
}

export interface TicketEventFilter {
  id: string;
  title: string;
  eventAt: string | null;
}

export function createAdminStatsRepository(postgresRuntime: PostgresRuntime | null) {
  if (!postgresRuntime) {
    return null;
  }

  return {
    async getOverviewStats(params: {
      startDate: Date;
      endDate: Date;
      ticketTypeId?: string;
      ticketEventId?: string;
    }): Promise<OverviewStats> {
      // noinspection SqlResolve,SqlNoDataSourceInspection
      const result = await postgresRuntime.pool.query(
        // language=TEXT
        `
          -- noinspection SqlResolve,SqlNoDataSourceInspection
          SELECT
            COUNT(*) as order_count,
            COALESCE(SUM(total_price), 0) as total_revenue,
            CASE
              WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_price), 0) / COUNT(*)
              ELSE 0
            END as avg_order_value,
            COALESCE(SUM(tickets_sold), 0) as tickets_sold
          FROM (
            SELECT DISTINCT
              o.id,
              o.total_price,
              (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as tickets_sold
            FROM orders o
            WHERE o.status = 'confirmed'
              AND o.created_at >= $1::timestamptz AT TIME ZONE 'UTC'
              AND o.created_at < $2::timestamptz AT TIME ZONE 'UTC' + INTERVAL '1 day'
              AND ($3::uuid IS NULL OR EXISTS (
                SELECT 1 FROM order_items oi2
                JOIN ticket_events te ON oi2.ticket_id = te.id
                WHERE oi2.order_id = o.id AND te.ticket_type_id = $3
              ))
              AND ($4::uuid IS NULL OR EXISTS (
                SELECT 1 FROM order_items oi3
                WHERE oi3.order_id = o.id AND oi3.ticket_id = $4
              ))
          ) subquery
        `,
        [params.startDate, params.endDate, params.ticketTypeId || null, params.ticketEventId || null]
      );

      const row = result.rows[0];
      return {
        totalRevenue: Number(row.total_revenue),
        orderCount: Number(row.order_count),
        avgOrderValue: Number(row.avg_order_value),
        ticketsSold: Number(row.tickets_sold),
      };
    },

    async getRevenueByDay(params: {
      startDate: Date;
      endDate: Date;
      ticketTypeId?: string;
      ticketEventId?: string;
    }): Promise<RevenueByDay[]> {
      // noinspection SqlResolve,SqlNoDataSourceInspection
      const result = await postgresRuntime.pool.query(
        // language=TEXT
        `
          -- noinspection SqlResolve,SqlNoDataSourceInspection
          SELECT
            TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') as date,
            COALESCE(SUM(o.total_price), 0) as revenue
          FROM orders o
          WHERE o.status = 'confirmed'
            AND o.created_at >= $1::timestamptz AT TIME ZONE 'UTC'
            AND o.created_at < $2::timestamptz AT TIME ZONE 'UTC' + INTERVAL '1 day'
            AND ($3::uuid IS NULL OR EXISTS (
              SELECT 1 FROM order_items oi2
              JOIN ticket_events te ON oi2.ticket_id = te.id
              WHERE oi2.order_id = o.id AND te.ticket_type_id = $3
            ))
            AND ($4::uuid IS NULL OR EXISTS (
              SELECT 1 FROM order_items oi3
              WHERE oi3.order_id = o.id AND oi3.ticket_id = $4
            ))
          GROUP BY DATE(o.created_at)
          ORDER BY date ASC
        `,
        [params.startDate, params.endDate, params.ticketTypeId || null, params.ticketEventId || null]
      );

      return result.rows.map(row => ({
        date: row.date,
        revenue: Number(row.revenue),
      }));
    },

    async getTopSellingTickets(params: {
      startDate: Date;
      endDate: Date;
      ticketTypeId?: string;
      limit?: number;
    }): Promise<TicketStats[]> {
      const limit = params.limit || 10;

      // noinspection SqlResolve,SqlNoDataSourceInspection
      const result = await postgresRuntime.pool.query(
        // language=TEXT
        `
          -- noinspection SqlResolve,SqlNoDataSourceInspection
          SELECT
            te.id,
            te.title,
            te.event_at,
            te.sold_quantity,
            te.total_quantity,
            te.price,
            (te.sold_quantity * te.price) as revenue,
            ROUND((te.sold_quantity::decimal / NULLIF(te.total_quantity, 0)) * 100, 1) as sell_through_percent,
            ia.local_image_path as image_url
          FROM ticket_events te
          JOIN image_assets ia ON te.image_asset_id = ia.id
          WHERE te.is_active = true
            AND ($1::uuid IS NULL OR te.ticket_type_id = $1)
          ORDER BY revenue DESC
          LIMIT $2
        `,
        [params.ticketTypeId || null, limit]
      );

      return result.rows.map(row => ({
        ticketId: row.id,
        title: row.title,
        imageUrl: row.image_url,
        eventAt: row.event_at,
        soldQuantity: Number(row.sold_quantity),
        totalQuantity: Number(row.total_quantity),
        revenue: Number(row.revenue),
        sellThroughPercent: Number(row.sell_through_percent),
      }));
    },

    async getLeastSellingTickets(params: {
      startDate: Date;
      endDate: Date;
      ticketTypeId?: string;
      limit?: number;
    }): Promise<TicketStats[]> {
      const limit = params.limit || 10;

      // noinspection SqlResolve,SqlNoDataSourceInspection
      const result = await postgresRuntime.pool.query(
        // language=TEXT
        `
          -- noinspection SqlResolve,SqlNoDataSourceInspection
          SELECT
            te.id,
            te.title,
            te.event_at,
            te.sold_quantity,
            te.total_quantity,
            te.price,
            (te.sold_quantity * te.price) as revenue,
            ROUND((te.sold_quantity::decimal / NULLIF(te.total_quantity, 0)) * 100, 1) as sell_through_percent,
            ia.local_image_path as image_url
          FROM ticket_events te
          JOIN image_assets ia ON te.image_asset_id = ia.id
          WHERE te.is_active = true
            AND ($1::uuid IS NULL OR te.ticket_type_id = $1)
          ORDER BY revenue ASC
          LIMIT $2
        `,
        [params.ticketTypeId || null, limit]
      );

      return result.rows.map(row => ({
        ticketId: row.id,
        title: row.title,
        imageUrl: row.image_url,
        eventAt: row.event_at,
        soldQuantity: Number(row.sold_quantity),
        totalQuantity: Number(row.total_quantity),
        revenue: Number(row.revenue),
        sellThroughPercent: Number(row.sell_through_percent),
      }));
    },

    async getTicketTypes(): Promise<TicketTypeFilter[]> {
      // noinspection SqlResolve,SqlNoDataSourceInspection
      const result = await postgresRuntime.pool.query(
        // language=TEXT
        `
          -- noinspection SqlResolve,SqlNoDataSourceInspection
          SELECT DISTINCT
            tt.id,
            tt.title
          FROM ticket_types tt
          JOIN ticket_events te ON tt.id = te.ticket_type_id
          WHERE te.is_active = true
          ORDER BY tt.title ASC
        `
      );

      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
      }));
    },

    async getTicketEvents(ticketTypeId?: string): Promise<TicketEventFilter[]> {
      // noinspection SqlResolve,SqlNoDataSourceInspection
      const result = await postgresRuntime.pool.query(
        // language=TEXT
        `
          -- noinspection SqlResolve,SqlNoDataSourceInspection
          SELECT
            te.id,
            te.title,
            te.event_at
          FROM ticket_events te
          WHERE te.is_active = true
            AND ($1::uuid IS NULL OR te.ticket_type_id = $1)
          ORDER BY te.event_at ASC NULLS LAST, te.title ASC
        `,
        [ticketTypeId || null]
      );

      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        eventAt: row.eventAt,
      }));
    },
  };
}